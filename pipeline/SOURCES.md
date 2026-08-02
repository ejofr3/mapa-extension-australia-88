# Data sources

Every figure in this project traces to a row in this table. Nothing is copied from
the previous version of this repo — see the sourcing rule in `PLAN.md`.

Precedence when sources disagree:

1. **Home Affairs** published tables — legally operative for eligibility.
2. **ABS / ABARES / Geoscape / BoM / Tourism Research Australia** — official statistics.
3. Anything else — context only, and must be labelled as such in the UI.

---

## Postcode boundaries — ✅ retrieved

| | |
|---|---|
| Publisher | Australian Bureau of Statistics |
| Dataset | ASGS Edition 3 (July 2021 – June 2026), Postal Areas (POA), GDA2020, ESRI Shapefile |
| URL | https://www.abs.gov.au/statistics/standards/australian-statistical-geography-standard-asgs/edition-3-july-2021-june-2026/access-and-downloads/digital-boundary-files |
| File | `POA_2021_AUST_GDA2020_SHP.zip` |
| sha256 | `92182d5e491a2dc0d49bd282283722701eef8a347ae072c04c344b4aeac2c49a` |
| Published | 20 July 2021 |
| Retrieved | 2026-08-02 |
| Licence | CC BY 4.0 |
| Records | **2,644** — matches the count ABS publishes |

Three of those are non-spatial special purpose codes (`9494`, `9797`, `ZZZZ`, the
last being "Outside Australia") and are excluded, leaving **2,641 real postal
areas**, written to `data/postcodes_2021.json`.

Source extent is `96.82,-43.74 → 168.00,-9.14`, which independently confirms the
basemap bounding box: postal areas really do run from Cocos (Keeling) in the west
to Norfolk Island in the east.

**Accuracy ceiling, state this in the UI.** Australia Post does not publish
postcode boundaries. ABS POA is an *approximation* built from Mesh Blocks, and
postcodes that exist only as PO boxes have no geography at all. This is as
accurate as the data permits, and no more.

Build: `pipeline/build_boundaries.sh` → `postcodes.pmtiles` (19 MB, z0–12),
served at `https://eliasjofre.com/data/basemap/postcodes.pmtiles`.

---

## Basemap — ✅ retrieved

| | |
|---|---|
| Publisher | Protomaps (built from OpenStreetMap) |
| Source | `https://build.protomaps.com/20260801.pmtiles` (127.7 GB planet) |
| Extract | bbox `96.0,-45.0,169.5,-8.5`, maxzoom 14 → 1.1 GB |
| Retrieved | 2026-08-01 |
| Licence | **ODbL — OpenStreetMap attribution is required and must stay on the map** |

Fonts and sprites from `protomaps/basemaps-assets` are self-hosted alongside it,
so the page loads nothing from a third-party host.

---

## Eligibility, subclass 462 — ⬜ source held, not yet extracted

| | |
|---|---|
| Publisher | Department of Home Affairs |
| Document | "Specified work for Work and Holiday visa (subclass 462)" |
| Page last updated | **7 May 2026** |
| sha256 | `f913a1573e00fbebd2b66dd7dc345099d06b3ae8cd785f7fe988cf546fb9eb7c` |
| Held at | `/data/whv462/source/` on the data host |

Six postcode tables: Remote and Very Remote Australia (two tables, different
commencement dates), Northern Australia, Regional Australia, Bushfire declared
areas, Natural disaster declared areas.

Companion document — the 6-month work limitation (condition 8547), page last
updated 23 September 2025, sha256
`97d0d4ec69093037992b3b708f57750a3803a4ae79c33af1d51174d47e6f99b8`. Different
rule (how long you may stay with one employer) but the same Northern Australia
postcode list, so it doubles as a cross-check.

---

## Eligibility, subclass 417 — ⬜ BLOCKED

| | |
|---|---|
| Publisher | Department of Home Affairs |
| URL | https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/work-holiday-417/specified-work |

**Home Affairs returns 403 to this VPS** — the whole site, not just this page.
A datacenter-IP block; the same box also gets 403s from Seek and 429s from
YouTube. Anthropic's fetcher is blocked too.

Retrieval therefore needs a residential connection: open the page and save it as
a PDF, then drop it in `/data/whv462/source/`. Note that the Mac's default route
is the WireGuard tunnel *to this VPS*, so the VPN has to be off or it egresses
from the blocked address anyway.

Until this lands the 417 half of the visa toggle has no data behind it and must
not pretend otherwise.

---

## Still to source

| Layer | Publisher | Geography | Notes |
|---|---|---|---|
| Localities (~15k) | Geoscape / data.gov.au | point | for the town search box |
| Agriculture | ABS Agricultural Census; ABARES CLUM | SA2/SA4 | ABARES timed out from the VPS on 2026-08-02, retry |
| Harvest seasonality | National Harvest Labour Information Service | harvest region | the only genuinely **monthly** source; backbone of the slider |
| Tourism | Tourism Research Australia NVS + IVS | Tourism Region | quarterly, not monthly — do not present it as monthly |
