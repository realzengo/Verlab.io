/**
 * Generates the Clone tab's preset characters (src/lib/config/clone-presets.json)
 * into public/clone-presets/<id>.jpg, so the "Preset character" picker serves
 * bundled static files -- nothing is generated at request time. Every preset
 * is a fictional, original character (no real-person likeness). Uses fal's
 * synchronous Nano Banana endpoint with FAL_API_KEY from .env.local (~$0.04
 * per image). Rerun after adding presets; existing files are skipped.
 *
 *   node scripts/generate-clone-presets.mjs
 */
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const OUT_DIR = path.join(process.cwd(), "public", "clone-presets");
const ENDPOINT = "https://fal.run/fal-ai/nano-banana";

const env = Object.fromEntries(
  (await readFile(path.join(process.cwd(), ".env.local"), "utf8"))
    .split("\n")
    .filter((line) => line.includes("=") && !line.trimStart().startsWith("#"))
    .map((line) => {
      const index = line.indexOf("=");
      return [line.slice(0, index).trim(), line.slice(index + 1).trim().replace(/^["']|["']$/g, "")];
    })
);
const key = process.env.FAL_API_KEY ?? env.FAL_API_KEY;
if (!key) throw new Error("FAL_API_KEY is not set (.env.local)");

const presets = JSON.parse(await readFile(path.join(process.cwd(), "src/lib/config/clone-presets.json"), "utf8"));

await mkdir(OUT_DIR, { recursive: true });
let failed = 0;

for (const preset of presets) {
  const file = path.join(OUT_DIR, `${preset.id}.jpg`);
  const exists = await access(file).then(() => true, () => false);
  if (exists) {
    console.log(`skip  ${preset.id} (exists)`);
    continue;
  }

  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: { Authorization: `Key ${key}`, "Content-Type": "application/json" },
    // sync_mode returns the image inline as a data URI -- no second fetch
    // against fal's CDN, whose hostnames vary per request.
    body: JSON.stringify({ prompt: preset.prompt, num_images: 1, aspect_ratio: "9:16", output_format: "jpeg", sync_mode: true }),
    signal: AbortSignal.timeout(120_000),
  });
  const payload = await response.json().catch(() => null);
  const url = payload?.images?.[0]?.url;
  if (!response.ok || typeof url !== "string") {
    console.error(`FAIL  ${preset.id}: ${response.status} ${JSON.stringify(payload?.detail ?? payload).slice(0, 300)}`);
    failed++;
    continue;
  }

  let bytes;
  if (url.startsWith("data:")) {
    bytes = Buffer.from(url.slice(url.indexOf(",") + 1), "base64");
  } else {
    const image = await fetch(url, { signal: AbortSignal.timeout(60_000) }).catch((error) => error);
    if (!(image instanceof Response) || !image.ok) {
      console.error(`FAIL  ${preset.id}: download ${image instanceof Response ? image.status : image.message}`);
      failed++;
      continue;
    }
    bytes = Buffer.from(await image.arrayBuffer());
  }
  await writeFile(file, bytes);
  console.log(`ok    ${preset.id}`);
}

if (failed > 0) process.exit(1);
