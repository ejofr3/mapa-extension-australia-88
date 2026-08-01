/**
 * Copies MapLibre's web worker into public/ so Vite serves it verbatim.
 *
 * Why this is needed: MapLibre v6 resolves its worker at runtime with
 * `new URL(`./${name}`, import.meta.url)`. That is dynamic, so no bundler can
 * statically analyse it — Vite rewrites the *reference* into assets/ but never
 * emits the file. The browser then requests assets/maplibre-gl-worker.mjs, gets
 * the SPA fallback HTML back, and the worker hangs forever. Symptom: the globe
 * renders as a plain grey circle and not one tile request is ever made, with
 * nothing logged to the console.
 *
 * The worker also imports `./maplibre-gl-shared.mjs` as a sibling, so both files
 * must land in the same directory with their original names — which rules out
 * Vite's `?url` imports, since those hash each file independently and would
 * break the relative specifier.
 *
 * public/ is copied verbatim by Vite in both dev and build, so this works
 * identically in both. src/map.ts then calls setWorkerUrl() to point at it.
 */
import { copyFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const from = join(root, "node_modules", "maplibre-gl", "dist");
const to = join(root, "public", "maplibre");

// Names must be preserved: the worker imports the shared chunk by exact name.
const FILES = ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"];

await mkdir(to, { recursive: true });
for (const name of FILES) {
  await copyFile(join(from, name), join(to, name));
}

console.log(`vendored ${FILES.length} maplibre worker files -> public/maplibre/`);
