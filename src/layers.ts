/**
 * Postcode eligibility layers.
 *
 * Colour encoding, deliberately: ONE hue for "counts for your visa", and
 * transparent for everything else.
 *
 * Not colour-per-designated-area, even though there are five of them. A
 * choropleth is compared all-pairs rather than only between neighbours, and
 * only three categorical hues clear the colour-vision-deficiency separation
 * floors under that comparison — five would not. The five areas are therefore
 * identified by *text* in the readout, never by colour alone.
 *
 * The hue is the categorical orange rather than the documented sequential blue
 * because the basemap underneath already uses blue for water, and a blue
 * overlay over a blue river is unreadable.
 */

import type {
  Map as MapLibreMap,
  ExpressionSpecification,
  PointLike,
} from "maplibre-gl";

import { POSTCODES } from "./config.ts";

export const SRC = "postcodes";
export const FILL_LAYER = "postcodes-fill";
export const LINE_LAYER = "postcodes-outline";
export const SELECTED_LAYER = "postcodes-selected";

const ELIGIBLE_LIGHT = "#eb6834";
const ELIGIBLE_DARK = "#d95926";
const TRANSPARENT = "rgba(0,0,0,0)";

function eligibleColour(dark: boolean): string {
  return dark ? ELIGIBLE_DARK : ELIGIBLE_LIGHT;
}

/**
 * Insert data layers *below* the basemap's labels, so town and road names stay
 * legible on top of the fill rather than being buried by it.
 */
function firstSymbolLayerId(map: MapLibreMap): string | undefined {
  return map.getStyle()?.layers?.find((l) => l.type === "symbol")?.id;
}

export function addEligibilityLayers(map: MapLibreMap, dark: boolean): void {
  if (map.getSource(SRC)) return;

  map.addSource(SRC, {
    type: "vector",
    url: `pmtiles://${POSTCODES.pmtiles}`,
    // Lets feature-state and filters key off the postcode itself; the tiles
    // carry no numeric feature ids of their own.
    promoteId: "postcode",
  });

  const before = firstSymbolLayerId(map);

  map.addLayer(
    {
      id: FILL_LAYER,
      type: "fill",
      source: SRC,
      "source-layer": "postcodes",
      paint: {
        // Replaced by setEligiblePostcodes(); starts fully transparent so
        // nothing is implied before the data has loaded.
        "fill-color": TRANSPARENT,
        "fill-opacity": 0.45,
      },
    },
    before,
  );

  map.addLayer(
    {
      id: LINE_LAYER,
      type: "line",
      source: SRC,
      "source-layer": "postcodes",
      paint: {
        "line-color": TRANSPARENT,
        "line-width": 1,
      },
    },
    before,
  );

  map.addLayer({
    id: SELECTED_LAYER,
    type: "line",
    source: SRC,
    "source-layer": "postcodes",
    filter: ["==", ["get", "postcode"], ""],
    paint: {
      "line-color": dark ? "#ffffff" : "#12161c",
      "line-width": 2.5,
    },
  });
}

/**
 * Paint the given postcodes as eligible and everything else as transparent.
 *
 * A `match` expression rather than a `filter`: MapLibre compiles match to a
 * hash lookup, so a couple of thousand labels stay cheap per feature, and the
 * ineligible polygons remain in the layer so they are still clickable.
 */
export function setEligiblePostcodes(
  map: MapLibreMap,
  postcodes: string[],
  dark: boolean,
): void {
  if (!map.getLayer(FILL_LAYER)) return;

  const colour = eligibleColour(dark);

  if (postcodes.length === 0) {
    map.setPaintProperty(FILL_LAYER, "fill-color", TRANSPARENT);
    map.setPaintProperty(LINE_LAYER, "line-color", TRANSPARENT);
    return;
  }

  const fill: ExpressionSpecification = [
    "match",
    ["get", "postcode"],
    postcodes,
    colour,
    TRANSPARENT,
  ];
  const line: ExpressionSpecification = [
    "match",
    ["get", "postcode"],
    postcodes,
    colour,
    TRANSPARENT,
  ];

  map.setPaintProperty(FILL_LAYER, "fill-color", fill);
  map.setPaintProperty(LINE_LAYER, "line-color", line);
}

/** Every postcode counts — used for the "anywhere in Australia" industries. */
export function setAllEligible(map: MapLibreMap, dark: boolean): void {
  if (!map.getLayer(FILL_LAYER)) return;
  map.setPaintProperty(FILL_LAYER, "fill-color", eligibleColour(dark));
  map.setPaintProperty(LINE_LAYER, "line-color", eligibleColour(dark));
}

export function setSelectedPostcode(map: MapLibreMap, postcode: string | null): void {
  if (!map.getLayer(SELECTED_LAYER)) return;
  map.setFilter(SELECTED_LAYER, ["==", ["get", "postcode"], postcode ?? ""]);
}

/** The postcode under a screen point, if any. */
export function postcodeAt(map: MapLibreMap, point: PointLike): string | null {
  const hits = map.queryRenderedFeatures(point, { layers: [FILL_LAYER] });
  const pc = hits[0]?.properties?.["postcode"];
  return typeof pc === "string" ? pc : null;
}
