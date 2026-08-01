/**
 * Central configuration. Anything that points outside this repo lives here so
 * there is exactly one place to look when a URL moves.
 */

/**
 * Self-hosted data host (Caddy on the OVH VPS, behind Cloudflare).
 *
 * Served from a path rather than a subdomain so no DNS record was needed.
 * Verified to return CORS headers and honour HTTP Range requests through the
 * Cloudflare proxy — PMTiles depends entirely on ranged reads.
 */
export const DATA_HOST = "https://eliasjofre.com/data";

export const BASEMAP = {
  /** Australia + external territories, OSM via Protomaps, z0–14 (~1.1 GB). */
  pmtiles: `${DATA_HOST}/basemap/australia.pmtiles`,
  glyphs: `${DATA_HOST}/basemap/fonts/{fontstack}/{range}.pbf`,
  spriteLight: `${DATA_HOST}/basemap/sprites/v4/light`,
  spriteDark: `${DATA_HOST}/basemap/sprites/v4/dark`,
  /** Required by ODbL. Do not remove. */
  attribution:
    '<a href="https://protomaps.com">Protomaps</a> © <a href="https://openstreetmap.org">OpenStreetMap</a>',
} as const;

/**
 * Extract bounds of the basemap. Deliberately wider than mainland Australia:
 * four eligible postcodes sit on external territories that a naive
 * "mainland" box silently drops —
 *   6798 Christmas Island · 6799 Cocos (Keeling) · 2898 Lord Howe · 2899 Norfolk
 */
export const AU_BOUNDS: [number, number, number, number] = [96.0, -45.0, 169.5, -8.5];

/** Opening view: the whole country, centred on the continent. */
export const INITIAL_VIEW = {
  center: [134.0, -25.5] as [number, number],
  zoom: 3.1,
  pitch: 0,
  bearing: 0,
};

export const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;

/** Southern-hemisphere seasons — the whole point of the month slider. */
export const SEASON_OF_MONTH = [
  "Summer", "Summer", "Autumn", "Autumn", "Autumn", "Winter",
  "Winter", "Winter", "Spring", "Spring", "Spring", "Summer",
] as const;

export type VisaSubclass = "462" | "417";

/** 462 is the default because it is the visa Elias holds. */
export const DEFAULT_VISA: VisaSubclass = "462";
