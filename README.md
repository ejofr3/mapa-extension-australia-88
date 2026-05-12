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

- `index.html` — Leaflet map, legend, popups, loading state
- `postcodes.geojson` — 302 postcode polygons (state-coloured)
- `postcodes-fallback.json` — 93 centroid markers for PO-only postcodes with no
  ABS boundary data
- Total coverage: 395 postcodes across NSW, NT (all), QLD, VIC, SA, TAS, WA

## Data sources

- Polygons: ABS POA boundaries (via `ferocia/australia-geojsons`, Visvalingam-simplified)
- Centroids: `matthewproctor/australianpostcodes`
- Tiles: OpenStreetMap
