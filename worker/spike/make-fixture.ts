import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { execFileAsync } from "../src/media";
import type { ClipMoment, TranscriptWord } from "@/lib/clips";

// A stand-in source for the render spike, made with ffmpeg alone so it builds
// the same on a Mac and inside the worker's Linux image: 60s of 1080p test
// pattern with film grain (so H.264 has real detail to spend bits on), a tone
// as the soundtrack, as a fragmented MP4 like the provider's, plus word
// timings for the captions and a 45s clip with a hook.
//
//   node worker/dist/fixture.mjs [dir]

const dir = path.resolve(process.argv[2] ?? "worker/spike/fixture");
const SECONDS = 60;

const TEXT =
  "Here is the thing nobody tells you about building a channel. You do not need a face. " +
  "You need a format that already works, a hook in the first three seconds, and the patience " +
  "to post every single day for ninety days. Most people quit after two weeks. The ones who " +
  "stay find the one video that breaks out, and then everything changes. That is the whole secret.";

function timedWords(): TranscriptWord[] {
  const words: TranscriptWord[] = [];
  let t = 1;
  for (const [i, word] of TEXT.split(/\s+/).entries()) {
    words.push([Number(t.toFixed(2)), Number((t + 0.28).toFixed(2)), word]);
    // A breath at every sentence end, a word every ~0.36s otherwise.
    t += /[.!?]$/.test(word) ? 1.1 : 0.36 + (i % 3) * 0.02;
    if (t > SECONDS - 2) break;
  }
  return words;
}

await mkdir(dir, { recursive: true });
await execFileAsync("ffmpeg", [
  "-v",
  "error",
  "-y",
  "-f",
  "lavfi",
  "-i",
  `testsrc2=size=1920x1080:rate=30,noise=alls=18:allf=t+u`,
  "-f",
  "lavfi",
  "-i",
  "sine=frequency=220:sample_rate=48000",
  "-t",
  String(SECONDS),
  "-c:v",
  "libx264",
  "-preset",
  "veryfast",
  "-b:v",
  "6M",
  "-g",
  "60",
  "-pix_fmt",
  "yuv420p",
  "-c:a",
  "aac",
  "-b:a",
  "128k",
  "-ac",
  "2",
  "-movflags",
  "frag_keyframe+empty_moov+default_base_moof",
  path.join(dir, "source.mp4"),
]);

const clip: ClipMoment = {
  id: "c1",
  start: 5,
  end: 50,
  title: "You don't need a face to grow",
  hookTitle: "Nobody tells you this secret",
  hook: "Here is the thing nobody tells you",
  score: 91,
  scores: { hook: 90, flow: 88, value: 92, trend: 85 },
  reason: "A clear promise with a payoff.",
  keywords: ["face", "format", "hook", "ninety", "secret"],
  emojis: [{ word: "secret", emoji: "🤫" }],
  caption: "The real secret to faceless growth",
  hashtags: ["faceless", "youtube", "growth"],
};

await writeFile(path.join(dir, "words.json"), JSON.stringify(timedWords()));
await writeFile(path.join(dir, "clip.json"), JSON.stringify(clip, null, 2));
console.log(`fixture written to ${dir}`);
