import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { parseArgs } from "node:util";
import { RenderBrowser } from "../src/browser";
import { execFileAsync, probeStreams, remuxAudioToAac, ssim } from "../src/media";
import { defaultSettings } from "@/lib/client/clip-defaults";
import type { ClipEditSettings } from "@/lib/client/clip-render";
import type { ClipMoment, TranscriptWord } from "@/lib/clips";

// Phase 0 spike: renders the fixture clip with the editor's own renderer in
// headless Chrome and reports what this machine's Chrome can encode, how fast,
// and what came out. Run it on a Mac and inside the worker image, then compare.
//
//   node worker/dist/spike.mjs --fixture worker/spike/fixture --out worker/spike/out [--label linux]
//        [--chrome /usr/bin/google-chrome] [--track] [--pauses]
//        [--ref worker/spike/ref]        compare frames with a reference render's (SSIM)
//        [--write-ref worker/spike/ref]  save this render's frames as the reference

const { values } = parseArgs({
  options: {
    fixture: { type: "string", default: "worker/spike/fixture" },
    out: { type: "string", default: "worker/spike/out" },
    label: { type: "string", default: os.platform() },
    chrome: { type: "string", default: process.env.CHROME_PATH },
    track: { type: "boolean", default: false },
    pauses: { type: "boolean", default: false },
    ref: { type: "string" },
    "write-ref": { type: "string" },
  },
});

// Frames compared against the reference: under the hook, mid-captions, late.
const REF_TIMES = [1.5, 12, 30];
const REF_SIZE = { width: 540, height: 960 };
const refFrame = (dir: string, t: number) => path.join(dir, `frame-${t}.jpg`);

async function extractFrame(video: string, t: number, file: string) {
  await execFileAsync("ffmpeg", [
    "-v",
    "error",
    "-y",
    "-ss",
    String(t),
    "-i",
    video,
    "-frames:v",
    "1",
    "-vf",
    `scale=${REF_SIZE.width}:${REF_SIZE.height}`,
    "-q:v",
    "2",
    file,
  ]);
}

const here = path.dirname(new URL(import.meta.url).pathname);
const fixture = path.resolve(values.fixture!);
const outDir = path.resolve(values.out!);
await mkdir(outDir, { recursive: true });

const words = JSON.parse(await readFile(path.join(fixture, "words.json"), "utf8")) as TranscriptWord[];
const clip = JSON.parse(await readFile(path.join(fixture, "clip.json"), "utf8")) as ClipMoment;
const settings: ClipEditSettings = { ...defaultSettings(clip), removePauses: values.pauses! };
const sourcePath = path.join(fixture, "source.mp4");
const outputPath = path.join(outDir, `${values.label}.mp4`);

const browser = await RenderBrowser.launch({
  pageDir: path.join(here, "page"),
  // In the image the app's fonts are copied next to the worker (FONTS_DIR).
  fontsDir: process.env.FONTS_DIR ?? path.resolve(here, "../../public/fonts"),
  executablePath: values.chrome || undefined,
  channel: "chrome",
  noSandbox: process.env.CHROME_NO_SANDBOX === "1",
  log: (event, fields) => console.log(JSON.stringify({ event, ...fields })),
});

try {
  const probe = await browser.probe();
  console.log(JSON.stringify({ event: "probe", ...probe }));

  let last = -1;
  const started = Date.now();
  const result = await browser.render(
    {
      offset: 0,
      settings,
      words,
      clip: { keywords: clip.keywords, emojis: clip.emojis },
      track: values.track ? { from: 0, to: 60 } : null,
    },
    { sourcePath, backgroundPath: null, outputPath },
    {
      timeoutMs: 10 * 60_000,
      onProgress: (stage, progress) => {
        const step = Math.floor(progress * 10);
        if (step !== last) {
          last = step;
          console.log(JSON.stringify({ event: "progress", stage, progress: Number(progress.toFixed(2)) }));
        }
      },
    }
  );
  const wallMs = Date.now() - started;

  const media = await probeStreams(outputPath);
  const audio = media.streams.find((s) => s.codec_type === "audio");
  let playable = outputPath;
  if (audio && audio.codec_name !== "aac") {
    playable = path.join(outDir, `${values.label}-aac.mp4`);
    await remuxAudioToAac(outputPath, playable);
  }
  let similarity: Record<string, number | null> | null = null;
  if (values["write-ref"]) {
    const dir = path.resolve(values["write-ref"]);
    await mkdir(dir, { recursive: true });
    for (const t of REF_TIMES) await extractFrame(playable, t, refFrame(dir, t));
  }
  if (values.ref) {
    similarity = {};
    for (const t of REF_TIMES) {
      const mine = path.join(outDir, `${values.label}-frame-${t}.jpg`);
      await extractFrame(playable, t, mine);
      similarity[String(t)] = await ssim(mine, refFrame(path.resolve(values.ref), t), REF_SIZE.width, REF_SIZE.height);
    }
  }

  const report = {
    label: values.label,
    probe,
    result,
    wallMs,
    realtime: Number((result.duration / (result.encodeMs / 1000)).toFixed(2)),
    output: media,
    audioRemuxed: playable !== outputPath,
    playable,
    ssim: similarity,
    cpus: os.cpus().length,
    cpuModel: os.cpus()[0]?.model,
  };
  await writeFile(path.join(outDir, `${values.label}.json`), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ event: "report", ...report }, null, 2));
} finally {
  await browser.close();
}
