import { execFile } from "node:child_process";
import { promisify } from "node:util";

// ffmpeg/ffprobe helpers shared by the worker and the spike.

const run = promisify(execFile);

export interface StreamInfo {
  codec_type: "video" | "audio";
  codec_name: string;
  profile?: string;
  width?: number;
  height?: number;
  bit_rate?: string;
  duration?: string;
  sample_rate?: string;
  channels?: number;
}

export async function probeStreams(file: string): Promise<{ streams: StreamInfo[]; duration: number }> {
  const { stdout } = await run("ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "stream=codec_type,codec_name,profile,width,height,bit_rate,duration,sample_rate,channels:format=duration",
    "-of",
    "json",
    file,
  ]);
  const data = JSON.parse(stdout) as { streams?: StreamInfo[]; format?: { duration?: string } };
  return { streams: data.streams ?? [], duration: Number(data.format?.duration ?? 0) };
}

/**
 * Re-encodes only the audio to AAC (video copied as is). For outputs whose
 * audio came out as Opus, which QuickTime and iPhone Photos play silent.
 */
export async function remuxAudioToAac(input: string, output: string): Promise<void> {
  await run("ffmpeg", [
    "-v",
    "error",
    "-y",
    "-i",
    input,
    "-map",
    "0",
    "-c:v",
    "copy",
    "-c:a",
    "aac",
    "-b:a",
    "160k",
    "-movflags",
    "+faststart",
    output,
  ]);
}

/** Structural similarity of two videos' frames (1 = identical), both scaled to the same size first. */
export async function ssim(a: string, b: string, width = 1080, height = 1920): Promise<number | null> {
  const { stderr } = await run(
    "ffmpeg",
    [
      "-v",
      "info",
      "-i",
      a,
      "-i",
      b,
      "-lavfi",
      `[0:v]scale=${width}:${height},setsar=1[x];[1:v]scale=${width}:${height},setsar=1[y];[x][y]ssim`,
      "-f",
      "null",
      "-",
    ],
    { maxBuffer: 64 * 1024 * 1024 }
  );
  const match = /All:([0-9.]+)/.exec(stderr);
  return match ? Number(match[1]) : null;
}

export { run as execFileAsync };
