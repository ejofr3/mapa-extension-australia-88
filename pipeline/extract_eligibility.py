#!/usr/bin/env python3
"""
Extract the specified-work postcode tables from the Home Affairs PDF.

Reads the authoritative PDF (not the previous version of this repo, not any
third-party list) and writes data/eligibility_<visa>.json.

Every postcode produced is validated against data/postcodes_2021.json — the
2,641 real Australian postal areas from the ABS. A range like "4699 to 4707"
enumerates integers, and integers that are not real postcodes must not survive.
That mistake is what inflated the previous version of this data to 5,274
"eligible postcodes" when only ~2,600 exist at all.

Usage:  python3 pipeline/extract_eligibility.py 462
"""

from __future__ import annotations

import hashlib
import json
import re
import subprocess
import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / "pipeline" / "cache"
DATA = ROOT / "data"

STATE_NAMES = {
    "New South Wales": "NSW", "Victoria": "VIC", "Queensland": "QLD",
    "South Australia": "SA", "Western Australia": "WA", "Tasmania": "TAS",
    "Northern Territory": "NT", "Australian Capital Territory": "ACT",
    "Norfolk Island": "NI",
    "NSW": "NSW", "VIC": "VIC", "QLD": "QLD", "SA": "SA",
    "WA": "WA", "TAS": "TAS", "NT": "NT", "ACT": "ACT",
}
STATE_FIRST_WORDS = {n.split()[0] for n in STATE_NAMES}

# Official Australia Post allocations. Used only to expand "all postcodes in X".
# Prefix matching is not good enough: ACT (2600-2618, 2900-2920) is interleaved
# with NSW, so a startswith("26") test would wrongly sweep in NSW postcodes.
# Norfolk Island owns 2899 alone, which is why NSW's range is split around it.
STATE_RANGES: dict[str, list[tuple[int, int]]] = {
    "NSW": [(1000, 1999), (2000, 2599), (2619, 2898), (2921, 2999)],
    "ACT": [(200, 299), (2600, 2618), (2900, 2920)],
    "VIC": [(3000, 3999), (8000, 8999)],
    "QLD": [(4000, 4999), (9000, 9999)],
    "SA":  [(5000, 5999)],
    "WA":  [(6000, 6999)],
    "TAS": [(7000, 7999)],
    "NT":  [(800, 999)],
    "NI":  [(2899, 2899)],
}

# Which designated areas each industry may be performed in. Taken from the prose
# of the same document, not inferred. This mapping is the whole point of the map:
# eligibility is not one map, it is a different map per industry.
INDUSTRIES_462 = {
    "tourism_hospitality": {
        "label": "Tourism and hospitality",
        "areas": ["northern", "remote"],
        "note": "From 22 June 2021. Applications lodged from 5 March 2022 "
                "(1 July 2022 for the Table 2 postcodes).",
    },
    "plant_animal_cultivation": {
        "label": "Plant and animal cultivation",
        "areas": ["northern", "regional"],
        "note": "Excludes secondary processing such as winemaking, brewing, "
                "distillation, milling and retail.",
    },
    "construction": {
        "label": "Construction",
        "areas": ["northern", "regional"],
        "note": None,
    },
    "fishing_pearling": {
        "label": "Fishing and pearling",
        "areas": ["northern"],
        "note": "Northern Australia only.",
    },
    "tree_farming_felling": {
        "label": "Tree farming and felling",
        "areas": ["northern"],
        "note": "Northern Australia only.",
    },
    "bushfire_recovery": {
        "label": "Bushfire recovery",
        "areas": ["bushfire"],
        "note": "Work carried out after 31 July 2019. Paid or voluntary.",
    },
    "disaster_recovery": {
        "label": "Natural disaster recovery",
        "areas": ["disaster"],
        "note": "Flood, cyclone or other severe weather. Work after "
                "31 December 2021. Paid or voluntary.",
    },
    "covid_health": {
        "label": "Critical COVID-19 work in healthcare and medical",
        "areas": ["anywhere"],
        "note": "Anywhere in Australia, after 31 January 2020.",
    },
}

# Table caption -> designated area key. Tables 1 and 2 are both Remote and Very
# Remote Australia; they differ only in the visa-application date they apply
# from, and merge into one area.
TABLE_TO_AREA = {1: "remote", 2: "remote", 3: "northern",
                 4: "regional", 5: "bushfire", 6: "disaster"}

AREA_LABELS = {
    "remote": "Remote and Very Remote Australia",
    "northern": "Northern Australia",
    "regional": "Regional Australia",
    "bushfire": "Bushfire declared areas",
    "disaster": "Natural disaster declared areas",
}


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    h.update(path.read_bytes())
    return h.hexdigest()


def pdf_to_text(pdf: Path) -> str:
    out = pdf.with_suffix(".txt")
    subprocess.run(["pdftotext", "-layout", str(pdf), str(out)], check=True)
    return out.read_text(encoding="utf-8", errors="replace")


# Every word that can appear inside a state/territory name. Used to peel a name
# off the front of a line without depending on column alignment — tables here
# span page breaks and the indentation shifts between pages.
STATE_WORDS = {w for name in STATE_NAMES for w in name.split()}


def is_name_prefix(s: str) -> bool:
    """True if s is a complete state name or the start of one."""
    return any(full == s or full.startswith(s + " ") for full in STATE_NAMES)


def looks_like_postcodes(s: str) -> bool:
    """
    True only if the text is *entirely* postcode notation.

    A loose "contains a digit" test is not enough: the prose following each
    table says things like "work carried out from 22 June 2021", which would
    sail straight through and be parsed as postcodes.
    """
    if re.search(r"All (postcodes|areas)", s, re.I):
        return True
    residue = re.sub(r"[\d,;]|\bto\b|\s", "", s)
    return residue == ""


def parse_table(lines: list[str]) -> dict[str, str]:
    """Parse one 'State/Territory | Postcodes' table into {state_code: raw text}."""
    rows: dict[str, list[str]] = {}
    order: list[str] = []
    current: str | None = None
    # Table 5 prints "All postcodes in ACT are eligible" BEFORE the name
    # "Australian / Capital / Territory (ACT)". Hold such text until a row opens.
    orphan: list[str] = []

    for raw in lines:
        s = raw.strip()
        if not s:
            continue
        if re.search(r"State", s) and re.search(r"Postcodes?\b", s):
            continue

        toks = s.split()
        i = 0
        while i < len(toks) and toks[i] in STATE_WORDS:
            i += 1
        name_part, rest = " ".join(toks[:i]), " ".join(toks[i:])

        # A trailing "(ACT)" belongs to the name, not to the postcodes.
        m = re.match(r"^\(\w+\)\s*(.*)$", rest)
        if m and name_part:
            rest = m.group(1)

        if name_part:
            joined = f"{current} {name_part}" if current else None
            if joined and current not in STATE_NAMES and is_name_prefix(joined):
                # Completing a wrapped name: "New South" + "Wales".
                rows[joined] = rows.pop(current)
                order[order.index(current)] = joined
                current = joined
            elif is_name_prefix(name_part):
                current = name_part
                rows.setdefault(current, [])
                order.append(current)
                if orphan:
                    rows[current].extend(orphan)
                    orphan = []
            else:
                break  # not a state name — the table has ended

        if rest:
            if not looks_like_postcodes(rest):
                break  # drifted into the prose that follows the table
            if current is None:
                orphan.append(rest)
            else:
                rows[current].append(rest)

    resolved: dict[str, str] = {}
    for name in order:
        if name not in rows:
            continue
        code = STATE_NAMES.get(name)
        if code is None:
            raise ValueError(f"unrecognised state/territory in table: {name!r}")
        resolved[code] = " ".join(rows[name])
    return resolved


def all_postcodes_for(state: str, valid: set[str]) -> list[str]:
    out = []
    for lo, hi in STATE_RANGES[state]:
        out.extend(f"{n:04d}" for n in range(lo, hi + 1) if f"{n:04d}" in valid)
    return sorted(out)


def expand(text: str, state: str, valid: set[str]) -> tuple[list[str], list[str]]:
    """
    Turn "4025, 4183, 4417 to 4420" into an explicit list.

    Returns (kept, rejected). Rejected entries are integers that fall inside a
    stated range but are not real postal areas. Dropping them is correct;
    reporting them keeps the drop visible instead of silent.
    """
    if re.search(r"All (postcodes|areas)", text, re.I):
        return all_postcodes_for(state, valid), []

    kept: set[str] = set()
    rejected: list[str] = []
    cleaned = re.sub(r",\s*,", ",", text)  # the source PDF contains "4470, , 4474"

    for chunk in re.split(r"[;,]", cleaned):
        chunk = chunk.strip()
        if not chunk:
            continue
        rng = re.match(r"^(\d{3,4})\s+to\s+(\d{3,4})$", chunk)
        if rng:
            lo, hi = int(rng.group(1)), int(rng.group(2))
            if hi < lo:
                raise ValueError(f"reversed range: {chunk!r}")
            for n in range(lo, hi + 1):
                code = f"{n:04d}"
                kept.add(code) if code in valid else rejected.append(code)
            continue
        one = re.match(r"^(\d{3,4})$", chunk)
        if one:
            code = f"{int(one.group(1)):04d}"
            kept.add(code) if code in valid else rejected.append(code)
            continue
        raise ValueError(f"unparsed postcode fragment: {chunk!r}")

    return sorted(kept), rejected


def main() -> int:
    visa = sys.argv[1] if len(sys.argv) > 1 else "462"
    pdf = CACHE / f"whv{visa}.pdf"
    if not pdf.exists():
        print(f"missing {pdf}", file=sys.stderr)
        return 1

    valid = set(json.loads((DATA / "postcodes_2021.json").read_text())["postcodes"])
    lines = pdf_to_text(pdf).splitlines()

    caption_idx = [(i, l.strip()) for i, l in enumerate(lines)
                   if re.match(r"^Table \d+:", l.strip())]
    if len(caption_idx) != 6:
        raise ValueError(f"expected 6 tables, found {len(caption_idx)}")

    areas: dict[str, dict] = {}
    all_rejected: dict[str, list[str]] = {}

    for n, (start, caption) in enumerate(caption_idx, start=1):
        end = caption_idx[n][0] if n < len(caption_idx) else len(lines)
        table = parse_table(lines[start + 1:end])
        area = TABLE_TO_AREA[n]
        entry = areas.setdefault(area, {"label": AREA_LABELS[area], "by_state": {}})

        summary = []
        for st, raw in table.items():
            kept, rejected = expand(raw, st, valid)
            prev = set(entry["by_state"].get(st, []))
            entry["by_state"][st] = sorted(prev | set(kept))
            summary.append(f"{st}:{len(kept)}")
            if rejected:
                all_rejected.setdefault(f"{area}/{st}", []).extend(rejected)

        print(f"Table {n} -> {area:9} " + "  ".join(summary))

    # Flatten and cross-check.
    for area, entry in areas.items():
        merged = sorted({p for lst in entry["by_state"].values() for p in lst})
        entry["postcodes"] = merged
        entry["count"] = len(merged)
        assert all(p in valid for p in merged), f"{area} contains a non-existent postcode"

    out = {
        "visa": visa,
        "generated": date.today().isoformat(),
        "source": {
            "publisher": "Australian Government — Department of Home Affairs",
            "document": f"Specified work for Work and Holiday visa (subclass {visa})",
            "page_last_updated": "2026-05-07",
            "sha256": sha256(pdf),
            "retrieved": "2026-08-01",
        },
        "validated_against": {
            "dataset": "ABS ASGS Edition 3 (2021) Postal Areas",
            "real_postcodes": len(valid),
        },
        "areas": areas,
        "industries": INDUSTRIES_462,
    }

    dest = DATA / f"eligibility_{visa}.json"
    dest.write_text(json.dumps(out, indent=1))

    print(f"\nwrote {dest.relative_to(ROOT)}")
    for area, entry in sorted(areas.items()):
        print(f"  {area:9} {entry['count']:>5} postcodes   "
              f"({', '.join(f'{k} {len(v)}' for k, v in sorted(entry['by_state'].items()))})")

    total = len({p for e in areas.values() for p in e["postcodes"]})
    print(f"\n  unique postcodes eligible for at least one area: {total} of {len(valid)}")

    if all_rejected:
        n_rej = sum(len(v) for v in all_rejected.values())
        print(f"\n  dropped {n_rej} range-implied numbers that are not real postcodes")
        for k, v in sorted(all_rejected.items())[:6]:
            print(f"    {k}: {len(v)} e.g. {v[:6]}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
