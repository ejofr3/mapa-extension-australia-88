#!/usr/bin/env bash
# Build postcode boundary tiles from the ABS Postal Areas digital boundary file.
#
# Output: pipeline/cache/postcodes.pmtiles, deployed to the data host as
#         https://eliasjofre.com/data/basemap/postcodes.pmtiles
#
# Requires: gdal-bin, tippecanoe  (apt install gdal-bin tippecanoe)
#
# Re-run when the ABS publishes a new ASGS edition. The current one covers
# July 2021 – June 2026, so this is stable until then.

set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CACHE="$HERE/cache"
DEPLOY_DIR="/srv/sites/data.eliasjofre.com/public/basemap"

BASE="https://www.abs.gov.au/statistics/standards/australian-statistical-geography-standard-asgs/edition-3-july-2021-june-2026/access-and-downloads/digital-boundary-files"
ZIP="POA_2021_AUST_GDA2020_SHP.zip"
SHP="POA_2021_AUST_GDA2020.shp"

# ABS 403s a default curl user-agent.
UA="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36"

mkdir -p "$CACHE"
cd "$CACHE"

if [[ ! -f "$ZIP" ]]; then
  echo "==> downloading $ZIP"
  curl -sL --compressed -A "$UA" -o "$ZIP" "$BASE/$ZIP"
fi
echo "sha256: $(sha256sum "$ZIP" | cut -d' ' -f1)"

[[ -f "$SHP" ]] || python3 -c "import zipfile;zipfile.ZipFile('$ZIP').extractall('.')"

# GDA2020 (EPSG:7844) -> WGS84 for the web. Drop the three non-spatial special
# purpose codes; they are administrative placeholders with no real geography.
echo "==> converting to WGS84 GeoJSON"
ogr2ogr -f GeoJSONSeq -t_srs EPSG:4326 \
  -sql "SELECT POA_CODE21 AS postcode, AREASQKM21 AS area_sqkm \
        FROM POA_2021_AUST_GDA2020 \
        WHERE POA_CODE21 NOT IN ('9494','9797','ZZZZ')" \
  postcodes.geojsonl "$SHP"

count=$(wc -l < postcodes.geojsonl)
[[ "$count" -eq 2641 ]] || { echo "FAIL: expected 2641 postal areas, got $count" >&2; exit 1; }
echo "    $count features"

# --detect-shared-borders keeps adjacent postcodes aligned after simplification,
# so the choropleth has no hairline gaps between neighbours.
# --no-feature-limit/--no-tile-size-limit: never silently DROP a postcode. A
# missing postcode here would read as "not eligible", which is a wrong answer
# about someone's visa, so size is the acceptable trade.
echo "==> tiling"
tippecanoe -o postcodes.pmtiles -l postcodes -Z0 -z12 \
  --detect-shared-borders --simplification=4 \
  --no-feature-limit --no-tile-size-limit --force -q \
  postcodes.geojsonl

if [[ -d "$DEPLOY_DIR" ]]; then
  echo "==> deploying to $DEPLOY_DIR"
  cp postcodes.pmtiles "$DEPLOY_DIR/"
fi

ls -lh postcodes.pmtiles
echo "done"
