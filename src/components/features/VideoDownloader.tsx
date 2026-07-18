"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Download, Loader2, Play } from "lucide-react";
import type { VideoPreviewResult } from "@/lib/server/video-provider";

const SUPPORTED_PLATFORMS = [
  { id: "youtube", label: "YouTube", logo: "/logos/social/youtube.png" },
  { id: "instagram", label: "Instagram", logo: "/logos/social/instagram.png" },
  { id: "tiktok", label: "TikTok", logo: "/logos/social/tiktok.png" },
  { id: "facebook", label: "Facebook", logo: "/logos/social/facebook.png" },
] as const;

const PLATFORM_LOGO: Record<VideoPreviewResult["platform"], { logo: string; label: string }> = {
  youtube: { logo: "/logos/social/youtube.png", label: "YouTube" },
  instagram: { logo: "/logos/social/instagram.png", label: "Instagram" },
  tiktok: { logo: "/logos/social/tiktok.png", label: "TikTok" },
};

const POLL_INTERVAL_MS = 2_000;
const PREVIEW_DEBOUNCE_MS = 500;

interface DownloadStatus {
  status: "queued" | "processing" | "complete" | "failed";
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

export function VideoDownloader() {
  const [url, setUrl] = useState("");
  const [state, setState] = useState<"idle" | "working" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<VideoPreviewResult | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [thumbnailFailed, setThumbnailFailed] = useState(false);

  useEffect(() => {
    const trimmedUrl = url.trim();
    if (trimmedUrl.length <= 10) return;

    const controller = new AbortController();

    const timeoutId = setTimeout(async () => {
      setPreviewLoading(true);
      try {
        const response = await fetch(`/api/downloads/preview?url=${encodeURIComponent(trimmedUrl)}`, {
          signal: controller.signal,
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        setThumbnailFailed(false);
        setPreview(data.preview as VideoPreviewResult);
      } catch (err) {
        // Preview is best-effort (a slow/flaky third-party lookup) and never
        // blocks the actual download below, so failures just clear the card
        // instead of surfacing an alarming error to the user.
        if (err instanceof DOMException && err.name === "AbortError") return;
        setPreview(null);
      } finally {
        setPreviewLoading(false);
      }
    }, PREVIEW_DEBOUNCE_MS);

    return () => {
      controller.abort();
      clearTimeout(timeoutId);
    };
  }, [url]);

  async function handleDownload() {
    const trimmedUrl = url.trim();
    if (!trimmedUrl || state === "working") return;

    setState("working");
    setError(null);

    try {
      const createResponse = await fetch("/api/downloads/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmedUrl, format: "mp4" }),
      });
      const createData = await createResponse.json();
      if (!createResponse.ok) {
        throw new Error(createData.error ?? "Could not start download");
      }

      const id = createData.id as string;
      while (true) {
        await wait(POLL_INTERVAL_MS);
        const statusResponse = await fetch(`/api/downloads/status/${id}`);
        const statusData = await statusResponse.json();
        if (!statusResponse.ok) {
          throw new Error(statusData.error ?? "Could not check download status");
        }

        const download = statusData.download as DownloadStatus;
        if (download.status === "complete" && download.file_path) {
          setState("done");
          triggerBrowserDownload(`/api/downloads/file/${id}`);
          return;
        }
        if (download.status === "failed") {
          throw new Error(download.error_message ?? "That download failed");
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setState("error");
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:py-24">
      <div className="text-center">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
          Video Downloader
        </h1>
        <p className="mt-3 text-xs text-slate-500 dark:text-zinc-400 sm:text-base">
          Download videos from YouTube, Instagram, TikTok, and Facebook. 10 downloads use 1
          credit.
        </p>
      </div>

      <div className="mt-6 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-900/30 dark:backdrop-blur-md sm:mt-10 sm:p-12">
        <input
          type="url"
          inputMode="url"
          autoCapitalize="off"
          autoCorrect="off"
          value={url}
          onChange={(event) => {
            const nextUrl = event.target.value;
            setUrl(nextUrl);
            if (state !== "idle") setState("idle");
            if (nextUrl.trim().length <= 10) {
              setPreview(null);
              setPreviewLoading(false);
            }
          }}
          placeholder="Paste video URL here..."
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-base text-slate-900 outline-none placeholder:text-slate-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-white/10 dark:bg-black/40 dark:text-white dark:placeholder:text-zinc-500 sm:px-5 sm:py-4"
        />

        {previewLoading && (
          <div className="mt-4 flex aspect-video w-full animate-pulse items-center justify-center rounded-xl border border-slate-200 bg-slate-100 dark:border-zinc-800 dark:bg-zinc-900">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400 dark:text-zinc-600" />
          </div>
        )}

        {!previewLoading && preview && (
          <div className="relative mt-4 aspect-video w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-900 dark:border-zinc-800">
            {preview.thumbnailUrl && !thumbnailFailed && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={preview.thumbnailUrl}
                alt=""
                referrerPolicy="no-referrer"
                onError={() => setThumbnailFailed(true)}
                className="h-full w-full object-cover"
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />

            <div className="absolute inset-0 m-auto flex h-12 w-12 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-md">
              <Play className="h-5 w-5 fill-white" />
            </div>

            <div className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-xs font-medium text-white backdrop-blur">
              <Image
                src={PLATFORM_LOGO[preview.platform].logo}
                alt=""
                width={12}
                height={12}
                className="h-3 w-3 object-contain"
              />
              {PLATFORM_LOGO[preview.platform].label}
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={handleDownload}
          disabled={state === "working"}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3.5 text-base font-semibold text-white transition-[background-color,transform] hover:bg-primary-hover hover:-translate-y-px active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 disabled:pointer-events-none disabled:hover:translate-y-0 sm:px-5 sm:py-4"
        >
          {state === "working" ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Download className="h-5 w-5" />
          )}
          {state === "working" ? "Downloading..." : "Download"}
        </button>

        {state === "error" && error && (
          <p className="mt-3 text-center text-sm text-red-500 dark:text-red-400">{error}</p>
        )}

        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-xs text-slate-400 dark:text-zinc-500 sm:mt-8 sm:gap-x-4">
          <span>Supports</span>
          {SUPPORTED_PLATFORMS.map(({ id, label, logo }) => (
            <span key={id} className="flex items-center gap-1.5">
              <Image src={logo} alt={label} width={14} height={14} className="h-3.5 w-3.5 object-contain" />
              <span className="hidden sm:inline">{label}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
