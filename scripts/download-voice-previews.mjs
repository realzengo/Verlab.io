/**
 * Downloads ElevenLabs' own sample clip for every default voice in
 * src/lib/config/elevenlabs.ts into public/voice-previews/<voiceId>.mp3, so
 * the voice picker plays bundled static files -- no API call, nothing
 * generated. Uses the public GET /v1/voices listing (no API key needed).
 * Rerun after changing the default voice list; existing files are skipped.
 *
 *   node scripts/download-voice-previews.mjs
 */
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const OUT_DIR = path.join(process.cwd(), "public", "voice-previews");

// Pulled from the TS source rather than duplicated, so this can't drift.
const source = await readFile(path.join(process.cwd(), "src/lib/config/elevenlabs.ts"), "utf8");
const voiceIds = [...source.matchAll(/defaultVoice\("([A-Za-z0-9]{20})"/g)].map((m) => m[1]);

const response = await fetch("https://api.elevenlabs.io/v1/voices");
if (!response.ok) throw new Error(`ElevenLabs /v1/voices failed (${response.status})`);
const { voices } = await response.json();
const previewUrls = new Map(voices.map((v) => [v.voice_id, v.preview_url]));

await mkdir(OUT_DIR, { recursive: true });
let failed = 0;

for (const voiceId of voiceIds) {
  const file = path.join(OUT_DIR, `${voiceId}.mp3`);
  const exists = await access(file).then(() => true, () => false);
  if (exists) {
    console.log(`skip    ${voiceId}`);
    continue;
  }
  const url = previewUrls.get(voiceId);
  if (!url) {
    failed++;
    console.error(`MISSING ${voiceId}: not in ElevenLabs' default voices anymore`);
    continue;
  }
  const audio = await fetch(url);
  if (!audio.ok) {
    failed++;
    console.error(`FAILED  ${voiceId}: ${audio.status}`);
    continue;
  }
  const bytes = new Uint8Array(await audio.arrayBuffer());
  await writeFile(file, bytes);
  console.log(`saved   ${voiceId} (${Math.round(bytes.length / 1024)} KB)`);
}

if (failed) process.exit(1);
