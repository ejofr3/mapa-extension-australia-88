/**
 * Copy generated data from data/ into public/data/ so Vite serves it.
 *
 * data/ is the source of truth and is committed; public/data/ is a staged copy
 * and is gitignored. Fetched at runtime rather than imported, so the 130 KB of
 * eligibility data does not inflate the JS bundle and can be cached separately.
 */
import { copyFile, mkdir, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const from = join(root, "data");
const to = join(root, "public", "data");

await mkdir(to, { recursive: true });
const files = (await readdir(from)).filter((f) => f.endsWith(".json"));
for (const name of files) {
  await copyFile(join(from, name), join(to, name));
}
console.log(`staged ${files.length} data files -> public/data/`);
