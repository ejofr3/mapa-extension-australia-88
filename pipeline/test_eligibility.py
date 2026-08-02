#!/usr/bin/env python3
"""
Tests for the extracted eligibility data.

Run: python3 pipeline/test_eligibility.py   (exits non-zero on any failure)

These are not unit tests of the parser — they are assertions about the *output*,
because the failure mode that matters is a wrong answer about someone's visa,
not a wrong function signature.
"""

from __future__ import annotations

import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "pipeline"))

failures: list[str] = []


def check(name: str, ok: bool, detail: str = "") -> None:
    if ok:
        print(f"  PASS  {name}")
    else:
        failures.append(f"{name}: {detail}")
        print(f"  FAIL  {name}  {detail}")


def main() -> int:
    valid = set(json.loads((ROOT / "data" / "postcodes_2021.json").read_text())["postcodes"])
    elig = json.loads((ROOT / "data" / "eligibility_462.json").read_text())
    areas = {k: set(v["postcodes"]) for k, v in elig["areas"].items()}

    print("\n-- every eligible postcode must actually exist --")
    for area, codes in sorted(areas.items()):
        bogus = sorted(codes - valid)
        check(f"{area}: all postcodes real", not bogus,
              f"{len(bogus)} not in ABS POA 2021, e.g. {bogus[:5]}")

    print("\n-- the five designated areas are all present and non-empty --")
    for area in ("remote", "northern", "regional", "bushfire", "disaster"):
        check(f"{area} populated", area in areas and len(areas[area]) > 0)

    print("\n-- regressions from the discarded version of this data --")
    # 1. Norfolk Island was missing from Regional Australia.
    check("2899 Norfolk Island is regional", "2899" in areas["regional"],
          "the source lists Norfolk Island under Regional Australia")
    # 2. Ranges were enumerated as raw integers, inventing ~2,760 postcodes.
    total = len({p for c in areas.values() for p in c})
    check("no phantom postcodes", total <= len(valid),
          f"{total} eligible vs only {len(valid)} real postcodes in Australia")

    print("\n-- postcodes named explicitly in the source prose --")
    for pc in ("4406", "4416", "4498", "7215"):
        check(f"{pc} in remote (Table 2)", pc in areas["remote"])
    for pc, area in (("6798", "remote"), ("6799", "remote"), ("2898", "remote")):
        check(f"{pc} external territory in {area}", pc in areas[area])

    print("\n-- capital cities must not be regional/northern --")
    for pc, city in (("2000", "Sydney"), ("3000", "Melbourne"), ("6000", "Perth")):
        check(f"{city} {pc} not regional", pc not in areas["regional"])
    check("Brisbane 4000 not northern", "4000" not in areas["northern"])

    print("\n-- industry -> area mapping is internally consistent --")
    for key, ind in elig["industries"].items():
        for a in ind["areas"]:
            check(f"{key} -> {a} exists", a == "anywhere" or a in areas)

    print("\n-- cross-check Northern Australia against the condition 8547 document --")
    txt = ROOT / "pipeline" / "cache" / "whv8547.txt"
    if not txt.exists():
        print("  SKIP  8547 text not extracted (run the pipeline first)")
    else:
        from extract_eligibility import expand, parse_table
        lines = txt.read_text(errors="replace").splitlines()
        start = next(i for i, l in enumerate(lines)
                     if "Eligible areas of Northern Australia" in l)
        table = parse_table(lines[start + 1:start + 40])
        independent: set[str] = set()
        for st, raw in table.items():
            independent |= set(expand(raw, st, valid)[0])
        check("two independent Home Affairs documents agree on Northern Australia",
              independent == areas["northern"],
              f"462 doc {len(areas['northern'])} vs 8547 doc {len(independent)}; "
              f"differences {sorted(independent ^ areas['northern'])[:8]}")

    print()
    if failures:
        print(f"{len(failures)} FAILURE(S):")
        for f in failures:
            print(f"  - {f}")
        return 1
    print("all checks passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
