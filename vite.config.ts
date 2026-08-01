import { defineConfig } from "vite";

// GitHub Pages serves this repo from a subpath, not a domain root:
//   https://ejofr3.github.io/mapa-extension-australia-88/
// `base` must match or every asset URL 404s in production while working locally.
//
// Build output goes to docs/ because Pages is configured to serve `main` + /docs,
// which keeps generated files from colliding with source at the repo root.
export default defineConfig({
  base: "/mapa-extension-australia-88/",
  build: {
    outDir: "docs",
    emptyOutDir: true,
    target: "es2022",
  },
  server: {
    port: 5173,
    host: true, // bind on the LAN so the map can be opened on a phone during development
  },
});
