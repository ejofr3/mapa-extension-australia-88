# Australia WHV Specified-Work Map — Build Plan

> Durable plan for this project. Sessions don't survive; this file does.
> Companion files: `CLAUDE.md` (rules all agents follow), `PROGRESS.md` (what's done).
> Last updated: 2026-08-01

## What this is

An interactive 3D map of Australia showing where Working Holiday Maker specified
work counts toward a second/third visa — by postcode, by industry, and across the
year — layered with agricultural and tourism context so it also answers "where
should I go, and when".

Replaces the previous Leaflet page in this repo entirely. Same repo, same URL:
**https://ejofr3.github.io/mapa-extension-australia-88/**

## Decisions made (2026-08-01, with Elias)

| Decision | Choice |
|---|---|
| Repo / URL | Same repo, same GitHub Pages URL. Existing code discarded, not migrated. |
| Visa scope | Toggle between **subclass 462 and 417**, 462 as default. |
| Geography handling | **Option C** — eligibility exact per postcode with hard borders; agriculture and tourism as soft heatmaps with no hard edges. |
| Address lookup | Town/locality search + tap-the-map + direct postcode entry. **No geocoding backend.** |
| Basemap | **Self-hosted** street-level vector tiles on the VPS. No API key, no quota. |
| Data host | `https://eliasjofre.com/data/` (path on existing domain — no DNS record needed). |
| Devices | **Mobile and laptop are both first-class.** Not a polish item. |

### Why Option C

Three government datasets, three incompatible geographies:

- **Eligibility** is written by Home Affairs in **postcodes** (~2,600 ABS POA areas).
- **Agriculture** is published by ABS/ABARES at **SA2/SA4** statistical areas.
- **Tourism** is published by Tourism Research Australia at **Tourism Region** (~76).

Their boundaries do not align. Rather than fabricate per-postcode figures by
area-weighting (which fails worst in exactly the large, empty outback postcodes
that matter most here), eligibility stays sharp and authoritative while the
context layers render as deliberately edgeless heatmaps. Nothing on screen is a
number nobody measured.

## Architecture

```
GitHub Pages  ejofr3.github.io/mapa-extension-australia-88/
              └── the app (Vite build output)
                       │  fetch, CORS
                       ▼
VPS (Caddy)   eliasjofre.com/data/
              ├── whv462/source/    authoritative source PDFs (provenance anchor)
              ├── whv462/derived/   generated eligibility JSON
              └── basemap/          Australia vector tiles (.pmtiles)
```

Small project data (postcode tiles, eligibility rules, stats) lives in the repo —
it fits comfortably. Only the **basemap** goes on the VPS, because PMTiles is a
single multi-hundred-MB file and GitHub caps individual files at 100 MB and does
not serve Git LFS from Pages.

**Verified working 2026-08-01:** CORS headers, `Accept-Ranges: bytes`, HTTP `206`
range responses with correct `Content-Range` — all surviving the Cloudflare proxy,
with `cf-cache-status: HIT`. PMTiles range requests will work, and Cloudflare
provides free CDN caching in front of them.

## Stack

- **MapLibre GL JS v5** — globe projection, 3D terrain, `fill-extrusion`. Open
  source, no API key. (Leaflet can't do 3D or handle the data volume; that's why
  the old page loaded a 6 MB GeoJSON on every visit.)
- **deck.gl** — GPU layers for density: extruded columns, hexbins, and arcs for
  the north–south tourism flow. Composes with MapLibre.
- **PMTiles** — single-file tile archives served over HTTP range requests.
  No tile server, no key, no quota.
- **Vite + TypeScript, vanilla** — no React. A build step is needed for deck.gl
  regardless, and TS catches the data-shape bugs that otherwise cost days.
- **Python + geopandas + tippecanoe** — the ETL pipeline that generates everything
  in `derived/`. One re-runnable script, committed.

### Rejected

- **CesiumJS** — true 3D globe with a built-in time widget, genuinely tempting for
  the month slider. Rejected: much heavier runtime, and good terrain needs a Cesium
  Ion token with a quota. MapLibre's globe reads the same for a fraction of the weight.
- **Hosted tile provider free tier** — would put a domain-locked API key in public
  page source and cap us at roughly 100k tile requests/month. One share into a WA
  backpacker Facebook group would exhaust it and blank the map.
- **Minimal Natural Earth basemap** — a few MB, no VPS needed, but no street-level
  detail. Ruled out: street detail is required so people can find their own farm.

## Data sources

| Layer | Source | Geography | Time | Status |
|---|---|---|---|---|
| 462 eligibility | Home Affairs "Specified subclass 462 work" (updated 7 May 2026) | postcode | static | ✅ on VPS |
| 6-month limitation | Home Affairs condition 8547 (updated 23 Sep 2025) | postcode | static | ✅ on VPS |
| 417 eligibility | Home Affairs subclass 417 specified work page | postcode | static | ⬜ to source |
| Postcode boundaries | ABS POA 2021 Digital Boundary Files (CC-BY) | postcode | — | ⬜ |
| Localities | ~15,000 AU localities for the search box | point | — | ⬜ |
| Agriculture | ABS Agricultural Census / Value of Agricultural Commodities Produced; ABARES CLUM land use | SA2/SA4 | annual | ⬜ |
| Harvest seasonality | National Harvest Labour Information Service / Harvest Trail guide | harvest region | **monthly** | ⬜ |
| Tourism | Tourism Research Australia NVS + IVS | Tourism Region | quarterly | ⬜ |
| Basemap | OpenStreetMap via Protomaps build | — | — | ⬜ |

**Known ceiling on accuracy:** Australia Post does not publish postcode boundaries.
ABS POA is an approximation built from mesh blocks, and PO-box-only postcodes have
no geography at all — which is why the old map needed 223 centroid fallbacks. This
is as accurate as the data permits and the page should say so.

Only the Harvest Trail guide is natively monthly. It is the backbone of the slider;
tourism steps quarterly and agriculture is annual. Nothing else may be presented as
monthly precision it doesn't have.

## The industry → zone rule

The thing the old map never did. Eligibility is not one map — it's a different map
per industry:

| Industry | Eligible areas |
|---|---|
| Tourism & hospitality | Northern **or** Remote/Very Remote (+ 4406, 4416, 4498, 7215) |
| Plant & animal cultivation | Northern **+** Regional |
| Construction | Northern **+** Regional |
| Fishing & pearling | **Northern only** |
| Tree farming & felling | **Northern only** |
| Bushfire recovery | Bushfire-declared areas (work after 31 Jul 2019) |
| Natural disaster recovery | Disaster-declared areas (work after 31 Dec 2021) |
| Critical COVID-19 health | Anywhere in Australia (after 31 Jan 2020) |

Selecting an industry must re-render the eligible set. This is the single most
useful interaction in the app.

## Sourcing rule — official sources only

**The previous version of this repo is not a source.** Its data is known to be
flawed and is discarded entirely. Nothing is copied, adapted, or diffed *from* it;
every figure is re-derived from the primary publisher.

For every dataset, record in `derived/SOURCES.md`: the publishing agency, the exact
URL or document, its own "last updated" date, the retrieval date, the licence, and a
sha256 of the retrieved file. If a number can't be traced to a line in one of those,
it does not go in.

Precedence when sources disagree:

1. Home Affairs published tables (eligibility) — legally operative, beats everything.
2. ABS / ABARES / Geoscape / BoM / Tourism Research Australia — official statistics.
3. Anything else — context only, must be labelled as such in the UI.

No blogs, no backpacker forums, no working-hostel lists, and no model general
knowledge presented as fact. Where a seasonal claim has no official source, the map
says so rather than guessing.

## Traps to test for

Failure modes found when auditing the discarded version. They aren't inherited — but
they're the mistakes any extraction of this data can make, so each becomes a test:

1. **Norfolk Island.** The old data returned `["remote"]` for 2899 and missed that
   the source lists Norfolk Island under Regional Australia. Test both memberships.
2. **Phantom postcodes.** Enumerating ranges numerically invented ~2,760 postcodes
   that don't exist (5,274 reported vs. ~2,514 real). Every generated postcode must
   validate against the official postcode list, not just against a range.
3. **Postcodes with no polygon.** ABS POA has no geometry for PO-box-only postcodes.
   They must be represented as explicitly approximate in the UI, never drawn as if
   they were a real boundary.

## Mobile constraints (design in from the start)

- **Payload**: PMTiles means tens of KB per view instead of 6 MB up front.
- **GPU**: reduced detail level on small screens — fewer extruded layers, simplified
  geometry at low zoom. Mid-range phones drop frames on globe + extrusion + thousands
  of polygons simultaneously.
- **Touch**: one finger drags the map, so the month slider must live *outside* the
  map canvas. Phone = collapsible bottom sheet, slider thumb-reachable. Laptop = side
  panel. Same components, different layout.
- **Verification**: Elias loads it on his actual phone at checkpoints. Simulated
  viewports are not sufficient sign-off.

## Build phases

1. **Foundation** — Vite + TS skeleton, MapLibre globe, self-hosted basemap built and
   deployed to the VPS, responsive shell (bottom sheet / side panel).
2. **Eligibility** — ETL from source PDFs → `derived/eligibility.json` + postcode
   PMTiles. Industry selector, 462/417 toggle, tap-to-test, postcode entry, locality
   search. **This is the minimum useful product — ship it here.**
3. **Seasonality** — Harvest Trail ingest, month slider, per-month recolouring.
4. **Context layers** — agriculture and tourism heatmaps, checkbox toggles, 3D density
   extrusion.
5. **Polish** — legend, About page stating sources and the POA caveat, share links.

## Verification

- Automated: every postcode in `derived/` traces to a table in the source PDFs, and
  every postcode in those tables appears in `derived/`. Runs as a hook on every write
  to `derived/`.
- Independent: a fresh `verifier` subagent re-derives the postcode lists from the PDFs
  without having seen the extraction, and diffs. It must not inherit the extracting
  session's context — that's the whole point.
- Manual: Elias loads it on his phone and on a laptop at the end of each phase.

## Open items

- [ ] **BLOCKER — GitHub push auth.** A dedicated **deploy key** scoped to this repo
      alone (Elias's call, correctly — his personal `id_ed25519` is deliberately not
      used). Add at repo → Settings → Deploy keys → Add deploy key, title
      `mac-claude-code`, **tick "Allow write access"**:
      `ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIEb2sR9qlOoZ5hKpraLMSfMc97Hj6bRvzlFTFuijfEtd mapa-extension-australia-88 deploy key (mac)`
      Already wired locally: private key `~/.ssh/mapa88_deploy`, SSH host alias
      `github-mapa88` in `~/.ssh/config` with `IdentitiesOnly yes`, and `origin` set to
      `git@github-mapa88:ejofr3/mapa-extension-australia-88.git`. Nothing else to do
      once the key is pasted in.
- [ ] Source and verify the subclass 417 postcode lists
- [ ] Confirm the Harvest Trail guide's current location and licence terms
- [ ] Decide basemap zoom ceiling — full street detail vs. VPS disk (65 GB free)
