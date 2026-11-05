"use client";

import { useEffect, useId, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Check, Download, ExternalLink, Link2, Loader2, RotateCcw, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Portal } from "@/components/ui/Portal";
import type { DownloadFormat } from "@/lib/types";
import { isValidUrl } from "@/lib/validation";

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

/** "https://www.tiktok.com/@a/video/1" -> "tiktok.com/@a/video/1" */
function displayUrl(url: string): string {
  return url.trim().replace(/^https?:\/\/(www\.|m\.)?/i, "");
}

function PlatformLogo({ src, className }: { src: string; className?: string }) {
  // White tile in both themes -- TikTok's mark is black and vanishes on dark surfaces.
  return (
    <span className={cn("flex shrink-0 items-center justify-center rounded-md border border-hairline bg-white", className)}>
      <Image src={src} alt="" width={16} height={16} className="h-3 w-3 object-contain" />
    </span>
  );
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
  const unsupportedLink = !detectedPlatform && isValidUrl(url.trim());
  const popupTitleId = useId();

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

  const popupOpen = (state === "preparing" || state === "ready") && !popupDismissed;

  useEffect(() => {
    if (!popupOpen) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setPopupDismissed(true);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [popupOpen]);

  // The download button: starts a job from idle/error, or re-opens the
  // popup if the job already finished and got dismissed.
  function handleTriggerClick() {
    if (state === "ready") {
      setPopupDismissed(false);
      return;
    }
    const trimmedUrl = url.trim();
    if ((state === "idle" || state === "error") && trimmedUrl && detectPlatform(trimmedUrl)) {
      if (!isValidUrl(trimmedUrl)) {
        setError("That doesn't look like a valid link");
        setState("error");
        return;
      }
      void prepare(trimmedUrl, ++jobToken.current);
    }
  }

  const buttonDisabled = state === "preparing" || ((state === "idle" || state === "error") && !detectedPlatform);

  return (
    <div className="mx-auto flex w-full max-w-2xl min-h-[calc(100dvh-4.5rem)] flex-col justify-center px-4 py-6 sm:block sm:min-h-0 sm:py-24">
      <header className="text-center">
        <h1 className="text-2xl font-semibold tracking-[-0.02em] text-heading sm:text-[28px]">Video downloader</h1>
        <p className="mt-1.5 text-sm text-subtle">
          Paste a link to save the video in up to 1080p. Downloads are kept in your Library.
        </p>
      </header>

      <div className="mt-8 flex items-center gap-3 rounded-2xl border border-hairline bg-surface p-2 pl-4 shadow-[0_1px_2px_rgba(16,24,40,0.05)] transition-[border-color,box-shadow] duration-150 focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/10 sm:mt-10">
        <span className="flex h-5 w-5 shrink-0 items-center justify-center">
          {detectedPlatform ? (
            <PlatformLogo src={detectedPlatform.logo} className="h-5 w-5" />
          ) : (
            <Link2 className="h-4 w-4 text-subtle" strokeWidth={1.75} />
          )}
        </span>
        <input
          type="url"
          inputMode="url"
          autoCapitalize="off"
          autoCorrect="off"
          aria-label="Video link"
          value={url}
          onChange={(event) => {
            resetJob();
            setUrl(event.target.value);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") handleTriggerClick();
          }}
          placeholder="Paste video URL"
          className="h-11 min-w-0 flex-1 bg-transparent text-base text-heading outline-none placeholder:text-subtle"
        />
        <button
          type="button"
          onClick={handleTriggerClick}
          disabled={buttonDisabled}
          aria-busy={state === "preparing"}
          aria-label={
            state === "ready" ? "Show download" : state === "error" ? "Retry download" : "Start download"
          }
          className={cn(
            "flex h-11 shrink-0 items-center gap-2 rounded-lg px-4 text-sm font-medium transition-colors duration-150 active:scale-[0.98]",
            buttonDisabled && state !== "preparing"
              ? "cursor-not-allowed bg-btn-secondary text-subtle"
              : "bg-btn-primary text-white hover:bg-btn-primary-hover"
          )}
        >
          {state === "preparing" ? (
            <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.75} />
          ) : state === "ready" ? (
            <Check className="h-4 w-4" strokeWidth={1.75} />
          ) : state === "error" ? (
            <RotateCcw className="h-4 w-4" strokeWidth={1.75} />
          ) : (
            <Download className="h-4 w-4" strokeWidth={1.75} />
          )}
          {state === "preparing"
            ? "Preparing"
            : state === "ready"
              ? "View file"
              : state === "error"
                ? "Try again"
                : "Download"}
        </button>
      </div>

      {/* One status line under the field, so nothing below it jumps:
          the error, a hint for links we can't download, or the platforms. */}
      <div className="mt-4 flex min-h-5 items-center justify-center text-center text-sm leading-5">
        {state === "error" && error ? (
          <p className="text-danger">{error}</p>
        ) : unsupportedLink ? (
          <p className="text-subtle">Only YouTube, TikTok and Facebook links are supported</p>
        ) : (
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
            <span className="hidden text-subtle sm:inline">Works with</span>
            {SUPPORTED_PLATFORMS.map(({ id, label, logo }) => (
              <span key={id} className="flex items-center gap-2 text-body">
                <PlatformLogo src={logo} className="h-5 w-5" />
                {label}
              </span>
            ))}
          </div>
        )}
      </div>

      {popupOpen && (
        <Portal>
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 sm:backdrop-blur-sm"
          onClick={() => setPopupDismissed(true)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={popupTitleId}
            className="w-full max-w-sm rounded-card border border-hairline bg-surface p-6 shadow-[0_24px_48px_-12px_rgba(16,24,40,0.28)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id={popupTitleId} className="text-base font-semibold leading-6 text-heading">
                  {state === "preparing" ? "Downloading video" : "Video ready"}
                </h2>
                <p className="mt-0.5 text-sm leading-5 text-subtle">
                  {state === "preparing" ? (
                    "Preparing the file in up to 1080p"
                  ) : (
                    <>
                      Also saved to your{" "}
                      <Link href="/library" className="font-medium text-primary hover:underline">
                        Library
                      </Link>
                    </>
                  )}
                </p>
              </div>
              {state === "ready" && (
                <button
                  type="button"
                  onClick={() => setPopupDismissed(true)}
                  aria-label="Close"
                  className="-mr-2 -mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-subtle transition-colors duration-150 hover:bg-btn-secondary hover:text-heading"
                >
                  <X className="h-4 w-4" strokeWidth={1.75} />
                </button>
              )}
            </div>

            <div className="mt-5 flex items-center gap-3 rounded-xl border border-hairline bg-app px-3 py-2.5">
              {detectedPlatform && <PlatformLogo src={detectedPlatform.logo} className="h-6 w-6" />}
              <span className="min-w-0 flex-1 truncate text-sm text-body">{displayUrl(url)}</span>
              {state === "ready" && <Check className="h-4 w-4 shrink-0 text-success" strokeWidth={1.75} />}
            </div>

            {state === "preparing" ? (
              <>
                <div
                  role="progressbar"
                  aria-label="Download progress"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={progress ?? 0}
                  className="mt-4 h-1.5 overflow-hidden rounded-full bg-hairline"
                >
                  <div
                    className="h-full w-full origin-left rounded-full bg-primary transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
                    style={{ transform: `scaleX(${(progress ?? 0) / 100})` }}
                  />
                </div>

                <div className="mt-5 flex items-center justify-between gap-4">
                  <p className="text-xs leading-4 text-subtle">It will also appear in your Library</p>
                  <button
                    type="button"
                    onClick={resetJob}
                    className="h-9 shrink-0 rounded-lg border border-hairline px-3 text-sm font-medium text-heading transition-colors duration-150 hover:bg-btn-secondary"
                  >
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <div className="mt-5 flex gap-2">
                <button
                  type="button"
                  onClick={() =>
                    readyId &&
                    window.open(`/api/downloads/file/${readyId}?disposition=inline`, "_blank", "noopener,noreferrer")
                  }
                  className="flex h-10 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-hairline text-sm font-medium text-heading transition-colors duration-150 hover:bg-btn-secondary"
                >
                  <ExternalLink className="h-4 w-4 shrink-0" strokeWidth={1.75} />
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
                  className="flex h-10 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-btn-primary text-sm font-medium text-white transition-colors duration-150 hover:bg-btn-primary-hover"
                >
                  <Download className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                  Download
                </button>
              </div>
            )}
          </div>
        </div>
        </Portal>
      )}
    </div>
  );
}
