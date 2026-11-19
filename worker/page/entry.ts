// The render worker's page. Headless Chrome loads this and runs the editor's
// own renderer (exportClip) and face tracker (analyzeReframe), so a server
// render matches the preview the user saw frame for frame.

import "@fontsource/open-sauce-one/600.css";
import "@fontsource/open-sauce-one/700.css";
import "@fontsource/open-sauce-one/800.css";
import "@fontsource/open-sauce-one/900.css";
// The same faces the editor imports (ClipEditor.tsx).
import "@fontsource/montserrat/latin-700.css";
import "@fontsource/montserrat/latin-800.css";
import "@fontsource/montserrat/latin-900.css";
import "@fontsource/poppins/latin-700.css";
import "@fontsource/poppins/latin-800.css";
import "@fontsource/poppins/latin-900.css";
import "@fontsource/inter/latin-700.css";
import "@fontsource/inter/latin-800.css";
import "@fontsource/inter/latin-900.css";
import "@fontsource/anton/latin-400.css";
import "@fontsource/bebas-neue/latin-400.css";
import "@fontsource/luckiest-guy/latin-400.css";
import "@/components/clipping/montserrat-arabic.css";
import "@/components/clipping/komika-axis.css";
import { ClipRenderError, exportClip } from "@/lib/client/clip-render";
import { analyzeReframe, type ReframeTrack } from "@/lib/client/clip-reframe";
import { decodeTrack } from "@/lib/client/clip-track-io";
import {
  PAGE_API_VERSION,
  type CodecProbe,
  type PageApi,
  type PageRenderFailure,
  type PageRenderInput,
  type PageRenderResult,
} from "../src/page-api";

async function fetchBlob(url: string): Promise<Blob> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return response.blob();
}

async function supported(config: VideoEncoderConfig): Promise<boolean> {
  try {
    return (await VideoEncoder.isConfigSupported(config)).supported === true;
  } catch {
    return false;
  }
}

async function audioSupported(config: AudioEncoderConfig): Promise<boolean> {
  if (typeof AudioEncoder === "undefined") return false;
  try {
    return (await AudioEncoder.isConfigSupported(config)).supported === true;
  } catch {
    return false;
  }
}

async function probe(): Promise<CodecProbe> {
  const webCodecs = typeof VideoEncoder !== "undefined";
  const avc = (width: number, height: number, hardwareAcceleration: HardwareAcceleration = "no-preference") =>
    webCodecs
      ? supported({ codec: "avc1.640028", width, height, bitrate: 6e6, framerate: 30, hardwareAcceleration })
      : Promise.resolve(false);
  const [avc1080, avc720, avcHardware, aac, opus] = await Promise.all([
    avc(1080, 1920),
    avc(720, 1280),
    avc(1080, 1920, "prefer-hardware"),
    audioSupported({ codec: "mp4a.40.2", sampleRate: 48000, numberOfChannels: 2, bitrate: 160e3 }),
    audioSupported({ codec: "opus", sampleRate: 48000, numberOfChannels: 2, bitrate: 160e3 }),
  ]);
  return { userAgent: navigator.userAgent, webCodecs, avc1080, avc720, avcHardware, aac, opus };
}

async function render(input: PageRenderInput): Promise<PageRenderResult | PageRenderFailure> {
  try {
    return await renderClip(input);
  } catch (error) {
    return {
      failed: true,
      name: error instanceof Error ? error.name : "Error",
      message: error instanceof Error ? error.message : String(error),
      fatal: error instanceof ClipRenderError && error.fatal,
    };
  }
}

async function renderClip(input: PageRenderInput): Promise<PageRenderResult> {
  const report = (stage: "tracking" | "encoding", progress: number) => window.verlabProgress?.(stage, progress);
  const [blob, background] = await Promise.all([
    fetchBlob(input.sourceUrl),
    input.backgroundUrl ? fetchBlob(input.backgroundUrl) : Promise.resolve(null),
  ]);
  const source = { blob, offset: input.offset };

  let track: ReframeTrack | null = null;
  const trackStarted = performance.now();
  if (input.trackUrl) {
    track = await decodeTrack(new Uint8Array(await (await fetchBlob(input.trackUrl)).arrayBuffer()));
  } else if (input.track) {
    try {
      track = await analyzeReframe(source, input.track.from, input.track.to, (p) => report("tracking", p));
    } catch (error) {
      // Same as the editor: a reframe that fails falls back to a centered Fill.
      console.warn("[worker-page] face tracking failed; rendering a centered crop:", error);
    }
  }
  const trackMs = performance.now() - trackStarted;

  const encodeStarted = performance.now();
  const result = await exportClip({
    source,
    settings: input.settings,
    words: input.words,
    clip: input.clip,
    track,
    background,
    onProgress: (p) => report("encoding", p),
    preciseAudio: input.preciseAudio,
    // This page always rasters in software (no GPU on the worker).
    fastBackdrop: true,
  });
  const encodeMs = performance.now() - encodeStarted;

  const upload = await fetch(input.outputUrl, { method: "PUT", body: result.blob });
  if (!upload.ok) throw new Error(`Handing the clip to the worker failed (${upload.status})`);
  return { duration: result.duration, bytes: result.blob.size, trackMs, encodeMs, tracked: Boolean(track) };
}

const api: PageApi = { version: PAGE_API_VERSION, probe, render };
window.verlab = api;
