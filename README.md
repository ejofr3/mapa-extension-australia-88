# Remote & Very Remote Australia — WHV 462 Eligible Postcodes Map

Interactive map highlighting Australian postcodes eligible for the second/third
Work & Holiday Visa (subclass 462) Tourism & Hospitality work concession
(eligible specified work from 22 June 2021).

## Run

`fetch()` needs a real web server (file:// won't work):

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

## Files

- `index.html` — Leaflet map with toggleable zone layers, legend, popups
- `postcodes-data.js` — source-of-truth postcode definitions for all 5 zones
- `postcodes.geojson` — 2,291 postcode polygons, each tagged with its zone memberships
- `postcodes-fallback.json` — 223 centroid points for postcodes with no ABS polygon (shown as ~15 km geographic circles)

## Data sources

- Polygons: ABS POA boundaries (via `ferocia/australia-geojsons`, Visvalingam-simplified)
- Centroids: `matthewproctor/australianpostcodes` (fallback for postcodes not in ABS source)
- Postcode lists: Australian Dept of Home Affairs WHV 462 specified work page
- Tiles: OpenStreetMap
