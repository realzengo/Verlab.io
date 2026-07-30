"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Check, CloudDownload, Download, Eye, Link2, Loader2, RotateCcw, X } from "lucide-react";
import { BorderTrail } from "@/components/ui/BorderTrail";
import type { DownloadFormat } from "@/lib/types";

// Always download at the highest quality reliably available for any video —
// higher tiers (4K/8K) fail outright for sources that don't have them.
const DOWNLOAD_FORMAT: DownloadFormat = "1080";

const SUPPORTED_PLATFORMS = [
  { id: "youtube", label: "YouTube", logo: "/logos/social/youtube.png", match: /youtube\.com|youtu\.be/i },
  { id: "tiktok", label: "TikTok", logo: "/logos/social/tiktok.png", match: /tiktok\.com/i },
  { id: "facebook", label: "Facebook", logo: "/logos/social/facebook.png", match: /facebook\.com|fb\.watch/i },
] as const;

function detectPlatform(url: string): (typeof SUPPORTED_PLATFORMS)[number] | null {
  return SUPPORTED_PLATFORMS.find((platform) => platform.match.test(url)) ?? null;
}

const POLL_INTERVAL_MS = 2_000;

// Simulated progress: jumps quickly at first, then eases off — never
// reaching PROGRESS_CAP on its own so it doesn't look "done" before the
// real job actually finishes (which snaps it to 100 immediately).
const PROGRESS_CAP = 92;
const PROGRESS_TIME_CONSTANT_MS = 3_500;
const PROGRESS_TICK_MS = 150;

// Number of bars drawn in the "Downloading your Video..." popup's segmented
// progress meter.
const PROGRESS_SEGMENT_COUNT = 28;

interface DownloadStatus {
  status: "queued" | "processing" | "complete" | "failed";
  progress: number | null;
  title: string | null;
  file_path: string | null;
  error_message: string | null;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function triggerBrowserDownload(fileUrl: string): void {
  const link = document.createElement("a");
  link.href = fileUrl;
  link.rel = "noopener noreferrer";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

// idle: nothing to prepare yet. preparing: job running, popup shows progress.
// ready: file is on the server, popup shows the download-complete card.
type PrepState = "idle" | "preparing" | "ready" | "error";

export function VideoDownloader() {
  const [url, setUrl] = useState("");
  const [state, setState] = useState<PrepState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [readyId, setReadyId] = useState<string | null>(null);
  const [popupDismissed, setPopupDismissed] = useState(false);
  const detectedPlatform = detectPlatform(url.trim());

  // Bumped whenever the in-flight job should be abandoned (url changed
  // mid-prepare, or the component unmounted) so a stale poll loop can't
  // overwrite newer state or keep hitting the network after the user's left.
  const jobToken = useRef(0);

  useEffect(() => {
    return () => {
      jobToken.current += 1;
    };
  }, []);

  async function prepare(targetUrl: string, myToken: number) {
    setState("preparing");
    setError(null);
    setProgress(0);
    setReadyId(null);
    setPopupDismissed(false);

    try {
      const createResponse = await fetch("/api/downloads/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: targetUrl, format: DOWNLOAD_FORMAT }),
      });
      const createData = await createResponse.json();
      if (!createResponse.ok) {
        throw new Error(createData.error ?? "Could not start download");
      }
      if (jobToken.current !== myToken) return;

      const id = createData.id as string;
      while (true) {
        await wait(POLL_INTERVAL_MS);
        if (jobToken.current !== myToken) return;

        const statusResponse = await fetch(`/api/downloads/status/${id}`);
        const statusData = await statusResponse.json();
        if (jobToken.current !== myToken) return;
        if (!statusResponse.ok) {
          throw new Error(statusData.error ?? "Could not check download status");
        }

        const download = statusData.download as DownloadStatus;
        if (download.status === "complete" && download.file_path) {
          setProgress(100);
          setReadyId(id);
          setState("ready");
          return;
        }
        if (download.status === "failed") {
          throw new Error(download.error_message ?? "That download failed");
        }
        // Real provider progress arrives in lumpy jumps (long stalls at 0,
        // then a sudden leap) — driving the bar off it looks broken. Instead
        // a simulated curve (below) fills fast up front and eases off, so it
        // always looks alive; this branch just keeps polling for completion.
      }
    } catch (err) {
      if (jobToken.current !== myToken) return;
      setError(err instanceof Error ? err.message : "Something went wrong");
      setState("error");
    }
  }

  // Abandons any in-flight job and drops the UI back to idle — called
  // synchronously from the input handler (not an effect) so the progress
  // bar clears the instant the user edits the url.
  function resetJob() {
    jobToken.current += 1;
    setState("idle");
    setError(null);
    setProgress(null);
    setReadyId(null);
    setPopupDismissed(false);
  }

  // Drives the visible bar while a job is in flight: fast climb early on,
  // decelerating toward PROGRESS_CAP. Real completion (in `prepare`) snaps
  // straight to 100 regardless of where this simulated curve has gotten to.
  useEffect(() => {
    if (state !== "preparing") return;

    const start = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - start;
      const eased = PROGRESS_CAP * (1 - Math.exp(-elapsed / PROGRESS_TIME_CONSTANT_MS));
      setProgress(Math.round(eased));
    }, PROGRESS_TICK_MS);

    return () => clearInterval(interval);
  }, [state]);

  // The compact arrow button: starts a job from idle/error, or re-opens the
  // popup if the job already finished and got dismissed.
  function handleTriggerClick() {
    if (state === "ready") {
      setPopupDismissed(false);
      return;
    }
    const trimmedUrl = url.trim();
    if ((state === "idle" || state === "error") && trimmedUrl && detectPlatform(trimmedUrl)) {
      void prepare(trimmedUrl, ++jobToken.current);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl min-h-[calc(100dvh-4.5rem)] flex-col justify-center px-4 py-6 sm:block sm:min-h-0 sm:py-24">
      <div className="relative text-center">
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 -top-8 -z-10 flex justify-center">
          <div className="h-24 w-72 rounded-full bg-primary/25 blur-[70px] dark:bg-primary/35" />
        </div>
        <h1 className="bg-gradient-to-br from-heading via-heading to-primary bg-clip-text text-[2.25rem] font-extrabold leading-tight tracking-tight text-transparent sm:text-6xl">
          Video Downloader
        </h1>
        <p className="mx-auto mt-2 max-w-[15rem] text-[0.7rem] font-medium leading-relaxed tracking-wide text-body/60 sm:mt-3 sm:max-w-sm sm:text-xs">
          Download videos from YouTube, TikTok, and Facebook
        </p>
      </div>

      <div className="relative mt-6 sm:mt-12">
        {/* Ambient glow behind the card, matching the app's premium panel style */}
        <div aria-hidden="true" className="pointer-events-none absolute -inset-16 -z-10 overflow-hidden">
          <div className="absolute left-1/2 top-0 h-56 w-80 -translate-x-1/2 rounded-full bg-blue-500/20 blur-[100px] dark:bg-blue-500/30" />
        </div>

        <div className="relative rounded-2xl border border-slate-200 shadow-[0_12px_32px_-16px_rgba(37,99,235,0.15)] dark:border-white/10 dark:shadow-[0_1px_0_rgba(255,255,255,0.04),0_24px_60px_-20px_rgba(37,99,235,0.5)]">
          <BorderTrail
            size={130}
            className="bg-gradient-to-l from-blue-200 via-blue-500 to-blue-200 opacity-60 blur-[8px] dark:from-blue-400 dark:via-blue-300 dark:to-blue-400"
            transition={{ repeat: Infinity, duration: 16, ease: "linear" }}
          />

          <div className="relative overflow-hidden rounded-[calc(1rem-1px)] bg-white/70 p-4 backdrop-blur-2xl backdrop-saturate-150 dark:bg-zinc-950/80 dark:bg-[linear-gradient(180deg,rgba(59,130,246,0.12),rgba(9,9,11,0)_45%)] sm:p-10">
            <div className="flex items-stretch gap-2 sm:gap-3">
              <div className="relative min-w-0 flex-1">
                <Link2 className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-zinc-500 sm:left-4" />
                <input
                  type="url"
                  inputMode="url"
                  autoCapitalize="off"
                  autoCorrect="off"
                  value={url}
                  onChange={(event) => {
                    resetJob();
                    setUrl(event.target.value);
                  }}
                  placeholder="Paste video URL"
                  className="w-full min-w-0 rounded-xl border border-slate-200 bg-white py-3.5 pl-10 pr-3 text-base text-slate-900 shadow-[inset_0_1px_2px_rgba(15,23,42,0.04)] outline-none transition-shadow duration-200 placeholder:text-slate-400 focus:border-primary/50 focus:ring-4 focus:ring-primary/10 dark:border-white/10 dark:bg-black/40 dark:text-white dark:placeholder:text-zinc-500 sm:py-4 sm:pl-11 sm:pr-4"
                />
              </div>

              <button
                type="button"
                onClick={handleTriggerClick}
                disabled={state === "preparing" || ((state === "idle" || state === "error") && !detectedPlatform)}
                aria-label={
                  state === "ready" ? "Show download" : state === "error" ? "Retry download" : "Start download"
                }
                className="relative flex w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl text-white transition-all duration-200 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40 sm:w-16"
                style={{
                  background:
                    state === "ready"
                      ? "linear-gradient(to bottom, rgb(16,185,129), rgb(5,150,105))"
                      : "linear-gradient(to bottom, rgb(59,130,246), rgb(37,99,235))",
                  boxShadow:
                    state === "ready"
                      ? "0 2px 10px 0 rgba(5,150,105,0.35), 0 1.5px 0 0 rgba(255,255,255,0.25) inset, 0 -2px 8px 0 rgba(5,150,105,0.5) inset"
                      : "0 2px 10px 0 rgba(37,99,235,0.35), 0 1.5px 0 0 rgba(255,255,255,0.25) inset, 0 -2px 8px 0 rgba(37,99,235,0.5) inset",
                }}
              >
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute left-1/2 top-0 h-2/5 w-[80%] -translate-x-1/2 rounded-t-full"
                  style={{
                    background: "linear-gradient(180deg, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0) 80%)",
                    filter: "blur(1.5px)",
                  }}
                />
                <span className="relative z-10">
                  {state === "preparing" ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : state === "ready" ? (
                    <Check className="h-5 w-5" />
                  ) : state === "error" ? (
                    <RotateCcw className="h-5 w-5" />
                  ) : (
                    <ArrowRight className="h-5 w-5" />
                  )}
                </span>
              </button>
            </div>

            {detectedPlatform && (
              <div className="mt-3 flex items-center justify-center gap-1.5 text-sm text-slate-500 dark:text-zinc-400">
                <Image
                  src={detectedPlatform.logo}
                  alt=""
                  width={16}
                  height={16}
                  className="h-4 w-4 object-contain"
                />
                {detectedPlatform.label}
              </div>
            )}

            {state === "error" && error && (
              <p className="mt-3 text-center text-sm text-red-500 dark:text-red-400">{error}</p>
            )}

            <div className="mt-6 flex flex-wrap items-center justify-center gap-2 sm:mt-8">
              <span className="text-xs font-medium text-slate-400 dark:text-zinc-500">Supports</span>
              {SUPPORTED_PLATFORMS.map(({ id, label, logo }) => (
                <span
                  key={id}
                  className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white/80 p-2 text-xs font-medium text-slate-600 shadow-sm dark:border-white/10 dark:bg-white/5 dark:text-zinc-300 sm:px-3 sm:py-1"
                >
                  <Image src={logo} alt={label} width={14} height={14} className="h-3.5 w-3.5 object-contain" />
                  <span className="hidden sm:inline">{label}</span>
                </span>
              ))}
            </div>

            <p className="mt-4 text-center text-[11px] leading-relaxed text-slate-400 dark:text-zinc-500">
              Only download content you own or have permission to reuse.
            </p>
          </div>
        </div>
      </div>

      {(state === "preparing" || state === "ready") && !popupDismissed && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4 backdrop-blur-sm"
          onClick={() => setPopupDismissed(true)}
        >
          <div
            className="w-full max-w-sm overflow-hidden rounded-2xl bg-white text-center shadow-2xl dark:bg-zinc-900"
            onClick={(event) => event.stopPropagation()}
          >
            {state === "preparing" ? (
              <div className="p-6 pt-4">
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={resetJob}
                    aria-label="Cancel download"
                    className="text-slate-400 hover:text-slate-600 dark:text-zinc-500 dark:hover:text-zinc-300"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="mx-auto -mt-3 flex h-16 w-16 items-center justify-center rounded-full bg-primary">
                  <CloudDownload className="h-8 w-8 text-white" />
                </div>

                <h3 className="mt-4 text-lg font-semibold text-slate-900 dark:text-white">
                  Downloading your Video...
                </h3>

                <div className="mt-5 flex items-center gap-[3px]">
                  {Array.from({ length: PROGRESS_SEGMENT_COUNT }).map((_, index) => {
                    const filled = index < Math.round(((progress ?? 0) / 100) * PROGRESS_SEGMENT_COUNT);
                    return (
                      <span
                        key={index}
                        className={`h-2 flex-1 rounded-full transition-colors duration-300 ${
                          filled ? "bg-primary" : "bg-slate-200 dark:bg-zinc-800"
                        }`}
                      />
                    );
                  })}
                </div>

                <p className="mt-3 text-xs text-slate-500 dark:text-zinc-400">
                  After completion, view in{" "}
                  <Link
                    href="/app/library"
                    className="inline-flex items-center gap-0.5 font-medium text-primary hover:underline"
                  >
                    Library
                    <Link2 className="h-3 w-3" />
                  </Link>
                </p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-zinc-800">
                  <h3 className="text-base font-semibold text-slate-900 dark:text-white">Download Complete</h3>
                  <button
                    type="button"
                    onClick={() => setPopupDismissed(true)}
                    aria-label="Close"
                    className="text-slate-400 hover:text-slate-600 dark:text-zinc-500 dark:hover:text-zinc-300"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="p-6">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-500/10">
                    <Check className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
                  </div>

                  <h3 className="mt-4 text-lg font-semibold text-slate-900 dark:text-white">Video ready!</h3>
                  <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
                    Your video has been processed successfully
                  </p>

                  <div className="mt-5 flex gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        readyId &&
                        window.open(
                          `/api/downloads/file/${readyId}?disposition=inline`,
                          "_blank",
                          "noopener,noreferrer"
                        )
                      }
                      className="flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border border-slate-200 px-2 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:text-zinc-200 dark:hover:bg-white/5"
                    >
                      <Eye className="h-4 w-4 shrink-0" />
                      Open in new tab
                    </button>
                    <button
                      type="button"
                      onClick={() => readyId && triggerBrowserDownload(`/api/downloads/file/${readyId}`)}
                      className="flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl bg-btn-primary px-2 py-3 text-sm font-semibold text-white hover:bg-btn-primary-hover"
                    >
                      <Download className="h-4 w-4 shrink-0" />
                      Download
                    </button>
                  </div>

                  <p className="mt-4 text-xs text-slate-500 dark:text-zinc-400">
                    View all downloads in{" "}
                    <Link href="/app/library" className="font-medium text-primary hover:underline">
                      Library
                    </Link>
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
