"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, CloudDownload, Download, Eye, Link2, RotateCcw, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { BEZEL_FIELD, BEZEL_FIELD_ROW, INK_TITLE } from "@/components/brand/BrandKit";
import { PlasticButton } from "@/components/ui/plastic-button";
import { Portal } from "@/components/ui/Portal";
import { LinkFieldNote } from "@/components/transcripts/LinkFieldNote";
import {
  DOWNLOAD_PLATFORMS,
  DOWNLOAD_PLATFORM_ORDER,
  DownloadPlatformMark,
  type DownloadPlatform,
} from "@/components/downloads/platform";
import type { DownloadFormat } from "@/lib/types";
import { isValidUrl } from "@/lib/validation";

// Always download at the highest quality reliably available for any video —
// higher tiers (4K/8K) fail outright for sources that don't have them.
const DOWNLOAD_FORMAT: DownloadFormat = "1080";

// Same patterns as the server's detectDownloadPlatform.
const PLATFORM_MATCHERS: { platform: DownloadPlatform; match: RegExp }[] = [
  { platform: "youtube", match: /youtube\.com|youtu\.be/i },
  { platform: "tiktok", match: /tiktok\.com/i },
  { platform: "facebook", match: /facebook\.com|fb\.watch/i },
];

function detectPlatform(url: string): DownloadPlatform | null {
  return PLATFORM_MATCHERS.find(({ match }) => match.test(url))?.platform ?? null;
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
  // What's wrong with the link itself (empty, unsupported, malformed), kept
  // apart from `error` so a bad paste doesn't turn the button into "Try again".
  const [linkHint, setLinkHint] = useState<string | null>(null);
  const detectedPlatform = detectPlatform(url.trim());
  const unsupportedLink = !detectedPlatform && isValidUrl(url.trim());
  const popupTitleId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

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
    setLinkHint(null);
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

  const popupOpen = (state === "preparing" || state === "ready") && !popupDismissed;

  useEffect(() => {
    if (!popupOpen) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setPopupDismissed(true);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [popupOpen]);

  // The Download button: starts a job from idle/error, or re-opens the
  // popup if the job already finished and got dismissed. It's never washed
  // out -- pressing it without a usable link says why and focuses the field.
  function handleTriggerClick() {
    if (state === "preparing") return;
    if (state === "ready") {
      setPopupDismissed(false);
      return;
    }
    const trimmedUrl = url.trim();
    if (!trimmedUrl) {
      setLinkHint("Paste a video link first");
      inputRef.current?.focus();
      return;
    }
    if (!detectPlatform(trimmedUrl)) {
      setLinkHint("Only YouTube, TikTok and Facebook links work here");
      inputRef.current?.focus();
      return;
    }
    if (!isValidUrl(trimmedUrl)) {
      setLinkHint("That doesn't look like a valid link");
      inputRef.current?.focus();
      return;
    }
    setLinkHint(null);
    void prepare(trimmedUrl, ++jobToken.current);
  }

  return (
    <div className="@container flex w-full flex-col pb-16">
      <section className="flex flex-col items-center pt-10 text-center sm:pt-16">
        <h1 className={`${INK_TITLE} text-[40px] leading-[1.02] tracking-[-0.045em] min-[400px]:text-[44px] sm:text-[64px]`}>
          Video downloader
        </h1>
        <p className="mt-4 max-w-md text-balance text-base leading-relaxed text-subtle sm:text-[17px]">
          Paste a YouTube, TikTok or Facebook link and save the video as an MP4, in up to 1080p.
        </p>
      </section>

      <div className="relative mx-auto mt-10 w-full max-w-2xl sm:mt-12">
        <LinkFieldNote>
          Save any video
          <br />
          in full HD
        </LinkFieldNote>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            handleTriggerClick();
          }}
          className={BEZEL_FIELD}
        >
          <div className={BEZEL_FIELD_ROW}>
            <span className="flex h-5 w-5 shrink-0 items-center justify-center">
              {detectedPlatform ? (
                <DownloadPlatformMark platform={detectedPlatform} className="h-[18px] w-[18px]" />
              ) : (
                <Link2 className="h-[18px] w-[18px] text-subtle" strokeWidth={1.75} />
              )}
            </span>
            <input
              ref={inputRef}
              type="text"
              inputMode="url"
              autoCapitalize="off"
              autoCorrect="off"
              aria-label="Video link"
              aria-invalid={Boolean(linkHint) || state === "error"}
              value={url}
              onChange={(event) => {
                resetJob();
                setUrl(event.target.value);
              }}
              placeholder="Paste a video link"
              className="h-11 min-w-0 flex-1 bg-transparent text-[15px] text-heading outline-none placeholder:text-subtle"
            />
            {/* mb-1 matches the button's 4px pressed lip (a shadow, outside
                its box), so the face and lip center in the row together. */}
            <PlasticButton
              type="submit"
              className="mb-1 h-11 shrink-0"
              text={state === "ready" ? "View file" : state === "error" ? "Try again" : "Download"}
              trailing={
                state === "ready" ? (
                  <Check className="h-4 w-4" strokeWidth={2} />
                ) : state === "error" ? (
                  <RotateCcw className="h-4 w-4" strokeWidth={2} />
                ) : (
                  <ArrowRight className="h-4 w-4" strokeWidth={2} />
                )
              }
              loading={state === "preparing"}
              loadingText="Preparing"
            />
          </div>
        </form>

        {/* One line under the field so nothing jumps: what went wrong, what's
            wrong with the link, the detected platform, or which ones work. */}
        <div className="mt-4 flex min-h-6 flex-wrap items-center justify-center gap-x-3 gap-y-2 text-center text-sm">
          {state === "error" && error ? (
            <p className="text-danger">{error}</p>
          ) : linkHint ? (
            <p className="text-danger">{linkHint}</p>
          ) : unsupportedLink ? (
            <p className="text-subtle">Only YouTube, TikTok and Facebook links work here</p>
          ) : detectedPlatform ? (
            <span className="flex items-center gap-1.5 font-medium text-heading">
              <DownloadPlatformMark platform={detectedPlatform} className="h-4 w-4" />
              {DOWNLOAD_PLATFORMS[detectedPlatform].label} video
            </span>
          ) : (
            <span className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-subtle">
              Works with
              {DOWNLOAD_PLATFORM_ORDER.map((platform) => (
                <span key={platform} className="flex items-center gap-1.5 text-heading">
                  <DownloadPlatformMark platform={platform} className="h-4 w-4" />
                  {DOWNLOAD_PLATFORMS[platform].label}
                </span>
              ))}
            </span>
          )}
        </div>
      </div>

      {popupOpen && (
        <Portal>
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4 backdrop-blur-sm"
          onClick={() => setPopupDismissed(true)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={popupTitleId}
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

                <h3 id={popupTitleId} className="mt-4 text-lg font-semibold text-slate-900 dark:text-white">
                  Downloading your Video...
                </h3>

                <div
                  role="progressbar"
                  aria-label="Download progress"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={progress ?? 0}
                  className="mt-5 flex items-center gap-[3px]"
                >
                  {Array.from({ length: PROGRESS_SEGMENT_COUNT }).map((_, index) => {
                    const filled = index < Math.round(((progress ?? 0) / 100) * PROGRESS_SEGMENT_COUNT);
                    return (
                      <span
                        key={index}
                        className={cn(
                          "h-2 flex-1 rounded-full transition-colors duration-300",
                          filled ? "bg-primary" : "bg-slate-200 dark:bg-zinc-800"
                        )}
                      />
                    );
                  })}
                </div>

                <p className="mt-3 text-xs text-slate-500 dark:text-zinc-400">
                  After completion, view in{" "}
                  <Link
                    href="/library"
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

                  <h3 id={popupTitleId} className="mt-4 text-lg font-semibold text-slate-900 dark:text-white">
                    Video ready!
                  </h3>
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
                      onClick={() => {
                        if (!readyId) return;
                        triggerBrowserDownload(`/api/downloads/file/${readyId}`);
                        setUrl("");
                        setPopupDismissed(true);
                        resetJob();
                      }}
                      className="flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl bg-btn-primary px-2 py-3 text-sm font-semibold text-white hover:bg-btn-primary-hover"
                    >
                      <Download className="h-4 w-4 shrink-0" />
                      Download
                    </button>
                  </div>

                  <p className="mt-4 text-xs text-slate-500 dark:text-zinc-400">
                    View all downloads in{" "}
                    <Link href="/library" className="font-medium text-primary hover:underline">
                      Library
                    </Link>
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
        </Portal>
      )}
    </div>
  );
}
