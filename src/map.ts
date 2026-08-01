import {
  Map as MapLibreMap,
  addProtocol,
  GeolocateControl,
  NavigationControl,
  ScaleControl,
  type StyleSpecification,
} from "maplibre-gl";
import { Protocol } from "pmtiles";
import { layers, namedFlavor } from "@protomaps/basemaps";

import { AU_BOUNDS, BASEMAP, INITIAL_VIEW } from "./config.ts";

/**
 * Registers the `pmtiles://` protocol with MapLibre. Must run before any map is
 * constructed, and only once per page — a second registration throws.
 */
let protocolRegistered = false;
function registerPmtilesProtocol(): void {
  if (protocolRegistered) return;
  const protocol = new Protocol();
  addProtocol("pmtiles", protocol.tile);
  protocolRegistered = true;
}

function prefersDark(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function buildStyle(dark: boolean): StyleSpecification {
  return {
    version: 8,
    glyphs: BASEMAP.glyphs,
    sprite: dark ? BASEMAP.spriteDark : BASEMAP.spriteLight,
    sources: {
      protomaps: {
        type: "vector",
        url: `pmtiles://${BASEMAP.pmtiles}`,
        attribution: BASEMAP.attribution,
      },
    },
    layers: layers("protomaps", namedFlavor(dark ? "dark" : "light"), { lang: "en" }),
  };
}

export function createMap(container: HTMLElement): MapLibreMap {
  registerPmtilesProtocol();

  const map = new MapLibreMap({
    container,
    style: buildStyle(prefersDark()),
    center: INITIAL_VIEW.center,
    zoom: INITIAL_VIEW.zoom,
    pitch: INITIAL_VIEW.pitch,
    bearing: INITIAL_VIEW.bearing,
    // The basemap only covers Australia and its external territories; let the
    // user roam a little past the edge but not off into empty tiles worldwide.
    maxBounds: [
      [AU_BOUNDS[0] - 8, AU_BOUNDS[1] - 6],
      [AU_BOUNDS[2] + 8, AU_BOUNDS[3] + 6],
    ],
    attributionControl: { compact: true },
    // Phones: keep the pixel count down. Retina rendering of a vector globe is
    // where mid-range hardware starts dropping frames.
    maxPitch: 75,
    hash: false,
  });

  // Globe rather than Mercator: Australia spans ~40 degrees of longitude and
  // the seasonal north/south story reads better without Mercator's distortion.
  map.on("style.load", () => {
    map.setProjection({ type: "globe" });
  });

  map.addControl(new NavigationControl({ visualizePitch: true }), "top-right");
  map.addControl(
    new GeolocateControl({
      positionOptions: { enableHighAccuracy: true },
      trackUserLocation: true,
    }),
    "top-right",
  );
  map.addControl(new ScaleControl({ unit: "metric" }), "bottom-right");

  // Follow the OS theme if the user flips it while the page is open.
  window
    .matchMedia("(prefers-color-scheme: dark)")
    .addEventListener("change", (event) => {
      map.setStyle(buildStyle(event.matches));
    });

  return map;
}
