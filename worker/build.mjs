// Builds the worker's two bundles from the app's own source (alias @ -> ../src):
//   dist/page/  the render page headless Chrome loads (renderer, tracker, fonts)
//   dist/*.mjs  the Node side (the worker loop, the spike)
// Run from anywhere: node worker/build.mjs

import { build } from "esbuild";
import { copyFile, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const src = path.resolve(here, "../src");
const dist = path.join(here, "dist");
const alias = { "@": src };

await rm(dist, { recursive: true, force: true });
await mkdir(path.join(dist, "page"), { recursive: true });

await build({
  entryPoints: [path.join(here, "page/entry.ts")],
  outdir: path.join(dist, "page"),
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "chrome120",
  splitting: true,
  sourcemap: "linked",
  alias,
  // The app's own fonts are referenced from /fonts (public/fonts); the worker serves that folder.
  external: ["/fonts/*"],
  loader: { ".woff2": "file", ".woff": "file", ".ttf": "file" },
  assetNames: "assets/[name]-[hash]",
  define: { "process.env.NODE_ENV": '"production"' },
  logLevel: "warning",
});
await copyFile(path.join(here, "page/index.html"), path.join(dist, "page/index.html"));

const entries = { spike: "spike/render-fixture.ts", fixture: "spike/make-fixture.ts" };
await build({
  entryPoints: Object.fromEntries(Object.entries(entries).map(([name, file]) => [name, path.join(here, file)])),
  outdir: dist,
  outExtension: { ".js": ".mjs" },
  bundle: true,
  format: "esm",
  platform: "node",
  target: "node22",
  sourcemap: "linked",
  alias: { ...alias, "server-only": path.join(here, "src/server-only-shim.ts") },
  // Playwright ships its own driver files; it's installed next to the bundle, not inlined.
  external: ["playwright-core"],
  // Some bundled CommonJS deps call require(); give the ESM bundle one.
  banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" },
  logLevel: "warning",
});

console.log("worker built ->", path.relative(process.cwd(), dist));
