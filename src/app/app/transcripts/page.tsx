"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import useSWR from "swr";
import {
  ArrowLeft,
  Check,
  Copy,
  Download,
  FileText,
  Link2,
  Loader2,
  Pause,
  Play,
  PlayCircle,
  Sparkles,
  X,
  XCircle,
} from "lucide-react";
import type { TranscriptRow } from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { PlasticButton } from "@/components/ui/plastic-button";
import { TranscriptHistoryTable } from "@/components/transcripts/TranscriptHistoryTable";
import { ExportModal } from "@/components/transcripts/ExportModal";
import { exportTranscripts } from "@/lib/transcript-export";
import { pollUntilSettled } from "@/lib/polling";
import { cn } from "@/lib/utils";
import { isValidUrl } from "@/lib/validation";

const SUPPORTED_PLATFORMS = [
  { id: "youtube", label: "YouTube", logo: "/logos/social/youtube.png" },
  { id: "tiktok", label: "TikTok", logo: "/logos/social/tiktok.png" },
  { id: "instagram", label: "Instagram", logo: "/logos/social/instagram.png" },
] as const;

type PageView = "history" | "result";

type TranscriptsResponse = { transcripts: TranscriptRow[] };

// referrerPolicy is a valid global HTML attribute (browsers apply it to
// <video>'s resource fetch), but React's VideoHTMLAttributes type omits it —
// spreading a separately-typed object sidesteps the excess-property check
// that a literal `referrerPolicy="no-referrer"` prop would trigger.
const VIDEO_REFERRER_POLICY: { referrerPolicy: React.HTMLAttributeReferrerPolicy } = {
  referrerPolicy: "no-referrer",
};

// Simulated progress for the extraction popup: jumps quickly at first, then
// eases off — never reaching the cap on its own so it doesn't look "done"
// before the real job actually finishes (which snaps it to 100 immediately).
const POPUP_PROGRESS_CAP = 92;
const POPUP_PROGRESS_TIME_CONSTANT_MS = 3_500;
const POPUP_PROGRESS_TICK_MS = 150;
const POPUP_PROGRESS_SEGMENTS = 28;

function IconButton({
  icon: Icon,
  label,
  onClick,
  active,
}: {
  icon: typeof Copy;
  label: string;
  onClick?: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition-all duration-200",
        active ? "scale-110 border-primary bg-accent text-primary" : "scale-100 border-hairline bg-surface text-body hover:bg-app"
      )}
    >
      <Icon className={cn("h-4 w-4", active && "animate-bounce")} />
    </button>
  );
}

// Timestamps come as "m:ss" or "h:mm:ss" -- convert to seconds for video.currentTime.
function timestampToSeconds(timestamp: string): number {
  const parts = timestamp.split(":").map((part) => Number(part) || 0);
  return parts.reduce((seconds, part) => seconds * 60 + part, 0);
}

function firstUrl(input: string): string | null {
  const line = input
    .split(/\s+/)
    .map((s) => s.trim())
    .find(Boolean);
  return line ?? null;
}

export default function TranscriptsPage() {
  const [view, setView] = useState<PageView>("history");
  // Cached by request URL -- revisiting /transcripts after navigating to
  // another sidebar tab reuses whatever was already fetched instead of
  // re-requesting the whole history from scratch.
  const {
    data: transcriptsData,
    isLoading: isLoadingRows,
    mutate: mutateRows,
  } = useSWR<TranscriptsResponse>("/api/transcripts");
  const rows = transcriptsData?.transcripts ?? [];
  const [bulkInput, setBulkInput] = useState("");
  const [activeRow, setActiveRow] = useState<TranscriptRow | null>(null);
  const [showTimestamps, setShowTimestamps] = useState(true);
  const [copied, setCopied] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [coverFailed, setCoverFailed] = useState(false);
  const [popupOpen, setPopupOpen] = useState(false);
  const [popupProgress, setPopupProgress] = useState(0);
  const pollCancelRef = useRef<(() => void) | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoPlaying, setVideoPlaying] = useState(false);

  useEffect(() => {
    return () => pollCancelRef.current?.();
  }, []);

  // Drives the popup's progress bar while a freshly-submitted job is in
  // flight: fast climb early on, decelerating toward the cap. Real
  // completion (in pollUntilSettled) snaps straight to 100.
  const activeRowId = activeRow?.id;
  const activeRowStatus = activeRow?.status;
  useEffect(() => {
    if (!popupOpen || (activeRowStatus !== "queued" && activeRowStatus !== "processing")) return;

    const start = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - start;
      const eased = POPUP_PROGRESS_CAP * (1 - Math.exp(-elapsed / POPUP_PROGRESS_TIME_CONSTANT_MS));
      setPopupProgress(Math.round(eased));
    }, POPUP_PROGRESS_TICK_MS);

    return () => clearInterval(interval);
  }, [popupOpen, activeRowId, activeRowStatus]);

  function openRow(row: TranscriptRow) {
    setActiveRow(row);
    setCoverFailed(false);
    setPopupOpen(false);
  }

  async function handleDeleteRows(ids: string[]) {
    if (activeRow && ids.includes(activeRow.id)) {
      setActiveRow(null);
      setView("history");
    }
    try {
      await mutateRows(
        async (current) => {
          const res = await fetch("/api/transcripts", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ids }),
          });
          if (!res.ok) throw new Error();
          return current ? { transcripts: current.transcripts.filter((row) => !ids.includes(row.id)) } : current;
        },
        {
          optimisticData: (current) => ({
            transcripts: current?.transcripts.filter((row) => !ids.includes(row.id)) ?? [],
          }),
          rollbackOnError: true,
          revalidate: false,
        }
      );
    } catch {
      setError("Couldn't delete. Try again.");
    }
  }

  function startPolling(id: string) {
    pollCancelRef.current?.();
    pollCancelRef.current = pollUntilSettled(
      async () => {
        const res = await fetch(`/api/transcripts/status/${id}`);
        if (!res.ok) throw new Error("Could not check transcript status");
        const { transcript } = await res.json();
        return transcript as TranscriptRow;
      },
      (transcript) => transcript.status === "complete" || transcript.status === "failed",
      (transcript) => {
        mutateRows(
          (current) =>
            current ? { transcripts: current.transcripts.map((r) => (r.id === id ? transcript : r)) } : current,
          { revalidate: false }
        );
        setActiveRow((prev) => (prev?.id === id ? transcript : prev));
        if (transcript.status === "complete") {
          setPopupProgress(100);
        }
      },
      { intervalMs: 1500 }
    );
  }

  const handleExtract = async () => {
    const url = firstUrl(bulkInput);
    if (!url) return;

    if (!isValidUrl(url)) {
      setError("That doesn't look like a valid URL.");
      return;
    }

    setSubmitting(true);
    setError(null);

    const res = await fetch("/api/transcripts/extract", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    const data = await res.json();
    setSubmitting(false);

    if (!res.ok) {
      setError(data.error ?? "Could not start extraction");
      return;
    }

    setBulkInput("");
    setShowTimestamps(true);
    setPopupProgress(0);
    const placeholderRow: TranscriptRow = {
      id: data.id,
      source_url: url,
      platform: "tiktok",
      status: "queued",
      title: null,
      cover_url: null,
      duration_seconds: null,
      video_url: null,
      embed_url: null,
      lines: null,
      error_message: null,
      created_at: new Date().toISOString(),
    };
    setActiveRow(placeholderRow);
    setPopupOpen(true);
    setView("result");
    startPolling(data.id);
    // Prepend locally instead of refetching the whole list -- the server
    // already agrees on the shape (this is exactly what it just created),
    // and startPolling's mutateRows call above will replace it with the
    // real row once the job settles.
    mutateRows(
      (current) => ({ transcripts: [placeholderRow, ...(current?.transcripts ?? [])] }),
      { revalidate: false }
    );
  };

  const handleCopy = async () => {
    const lines = activeRow?.lines;
    if (!lines) return;
    const fullText = lines
      .map((line) => (showTimestamps ? `[${line.timestamp}] ${line.text}` : line.text))
      .join("\n");
    await navigator.clipboard.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleDownloadTxt = () => {
    const lines = activeRow?.lines;
    if (!lines) return;
    const fullText = lines
      .map((line) => (showTimestamps ? `[${line.timestamp}] ${line.text}` : line.text))
      .join("\n");
    const blob = new Blob([fullText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const filename = `${(activeRow?.title || "transcript").replace(/[\\/:*?"<>|]+/g, " ").trim()}.txt`;
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
    setDownloaded(true);
    setTimeout(() => setDownloaded(false), 1200);
  };

  const handleSeekTo = (timestamp: string) => {
    const el = videoRef.current;
    if (!el) return;
    el.currentTime = timestampToSeconds(timestamp);
    el.play();
  };

  return (
    <div className="flex flex-col gap-6 pt-2 pb-12">
      <div>
        <h1 className="bg-gradient-to-br from-heading via-heading to-primary bg-clip-text text-3xl font-extrabold tracking-tight text-transparent sm:text-4xl">
          Transcripts
        </h1>
        <p className="mt-2 text-xs font-medium tracking-wide text-body/60 sm:text-sm">
          Paste a TikTok, Reels, or Shorts link to pull a clean, timestamped transcript.
        </p>
      </div>

      <div className="relative">
        <Card className="relative flex flex-col gap-5 overflow-hidden border-primary/15 shadow-none">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />

          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent">
              <Link2 className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-heading">Video link</h3>
              <p className="text-xs text-subtle">Paste a link and get a clean, timestamped transcript in seconds</p>
            </div>
          </div>

          <div className="group flex items-center gap-3 rounded-2xl border border-hairline bg-app/60 px-4 py-3.5 transition-all focus-within:border-primary/50 focus-within:bg-surface focus-within:ring-4 focus-within:ring-primary/10 hover:border-primary/25">
            <Link2 className="h-4 w-4 shrink-0 text-subtle transition-colors group-focus-within:text-primary" />
            <input
              type="text"
              value={bulkInput}
              onChange={(event) => setBulkInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && bulkInput.trim() && !submitting) handleExtract();
              }}
              placeholder="Paste a YouTube, TikTok, or Instagram link…"
              className="w-full bg-transparent text-sm text-heading placeholder:text-subtle focus:outline-none"
            />
            {bulkInput && (
              <button
                type="button"
                onClick={() => setBulkInput("")}
                aria-label="Clear"
                className="shrink-0 text-subtle transition-colors hover:text-heading"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {error && <p className="text-sm text-danger">{error}</p>}

          <div className="flex flex-col gap-4 border-t border-hairline pt-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2 text-xs text-subtle">
              <span className="font-medium text-body">Supported:</span>
              {SUPPORTED_PLATFORMS.map(({ id, label, logo }) => (
                <span
                  key={id}
                  className="flex items-center gap-1.5 rounded-full border border-hairline bg-app p-1.5 text-subtle transition-colors hover:border-primary/25 hover:text-heading sm:px-2.5 sm:py-1"
                >
                  <Image src={logo} alt={label} width={14} height={14} className="h-3.5 w-3.5 object-contain" />
                  <span className="hidden sm:inline">{label}</span>
                </span>
              ))}
            </div>
            <PlasticButton
              text={
                <>
                  <Sparkles className="h-4 w-4" />
                  Extract Transcript
                </>
              }
              loading={submitting}
              loadingText="Extracting…"
              disabled={!bulkInput.trim()}
              onClick={handleExtract}
              className="w-full justify-center px-6 py-3 text-sm sm:w-auto"
            />
          </div>
        </Card>
      </div>

      {view === "history" ? (
        <>
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-base font-semibold text-heading">Transcript History</h3>
            <Button variant="ghost" size="sm" bevel={false} icon={Download} onClick={() => setExportModalOpen(true)}>
              Export All
            </Button>
          </div>

          {isLoadingRows ? (
            <Card className="flex flex-col gap-3 shadow-none">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 shrink-0 rounded-xl" />
                  <div className="flex flex-1 flex-col gap-2">
                    <Skeleton className="h-3.5 w-1/3 rounded-full" />
                    <Skeleton className="h-3 w-1/5 rounded-full" />
                  </div>
                </div>
              ))}
            </Card>
          ) : rows.length === 0 ? (
            <Card className="flex flex-col items-center gap-3 py-14 text-center shadow-none">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-heading">No transcripts yet</p>
                <p className="mt-1 text-xs text-subtle">Paste a link above to get started.</p>
              </div>
            </Card>
          ) : (
            <TranscriptHistoryTable
              rows={rows}
              onOpenRow={(row) => {
                openRow(row);
                setView("result");
              }}
              onDeleteRows={handleDeleteRows}
            />
          )}
        </>
      ) : (
        activeRow && (
          <>
            <Button variant="text" icon={ArrowLeft} onClick={() => setView("history")} className="self-start">
              Back to history
            </Button>

            {activeRow.status !== "complete" && activeRow.status !== "failed" ? (
              <Card className="flex flex-col items-center gap-3 py-16 text-center">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <p className="text-sm text-body">Extracting transcript…</p>
              </Card>
            ) : activeRow.status === "failed" ? (
              <Card className="flex flex-col items-center gap-3 py-16 text-center">
                <XCircle className="h-6 w-6 text-danger" />
                <p className="text-sm text-body">
                  {activeRow.error_message || "Couldn't extract that transcript. Try a different link."}
                </p>
              </Card>
            ) : (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,240px)_1fr] lg:grid-cols-[minmax(0,280px)_1fr]">
                <div className="flex flex-col gap-3">
                  <div className="flex aspect-[9/16] w-full items-center justify-center overflow-hidden rounded-card border border-hairline bg-ink">
                    {activeRow.video_url ? (
                      <div className="relative h-full w-full">
                        <video
                          ref={videoRef}
                          key={activeRow.video_url}
                          src={activeRow.video_url}
                          poster={activeRow.cover_url || undefined}
                          playsInline
                          onPlay={() => setVideoPlaying(true)}
                          onPause={() => setVideoPlaying(false)}
                          className="h-full w-full object-cover"
                          {...VIDEO_REFERRER_POLICY}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const el = videoRef.current;
                            if (!el) return;
                            if (el.paused) el.play();
                            else el.pause();
                          }}
                          aria-label={videoPlaying ? "Pause video" : "Play video"}
                          className={cn(
                            "absolute inset-0 flex items-center justify-center transition-opacity",
                            videoPlaying ? "opacity-0 hover:opacity-100" : "opacity-100 bg-black/10"
                          )}
                        >
                          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/95 shadow-card-hover ring-1 ring-inset ring-black/5 transition-transform duration-200 hover:scale-110">
                            {videoPlaying ? (
                              <Pause className="h-5 w-5 fill-ink text-ink" />
                            ) : (
                              <Play className="h-5 w-5 translate-x-0.5 fill-ink text-ink" />
                            )}
                          </span>
                        </button>
                      </div>
                    ) : activeRow.embed_url ? (
                      <iframe
                        key={activeRow.embed_url}
                        src={activeRow.embed_url}
                        title={activeRow.title ?? "Video"}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        className="h-full w-full"
                      />
                    ) : activeRow.cover_url && !coverFailed ? (
                      <a
                        href={activeRow.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group relative h-full w-full"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={activeRow.cover_url}
                          alt={activeRow.title ?? "Video cover"}
                          referrerPolicy="no-referrer"
                          onError={() => setCoverFailed(true)}
                          loading="lazy"
                          decoding="async"
                          className="h-full w-full object-cover"
                        />
                        <span className="absolute inset-0 flex items-center justify-center bg-black/20 transition-colors group-hover:bg-black/30">
                          <PlayCircle className="h-12 w-12 text-white/90" />
                        </span>
                      </a>
                    ) : (
                      <PlayCircle className="h-12 w-12 text-white/70" />
                    )}
                  </div>
                </div>

                <Card className="flex flex-col gap-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => setShowTimestamps((v) => !v)}
                      className="flex items-center gap-2 text-sm text-heading"
                    >
                      <span
                        className={cn(
                          "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors",
                          showTimestamps ? "bg-primary" : "bg-hairline"
                        )}
                      >
                        <span
                          className={cn(
                            "inline-block h-4 w-4 transform rounded-full bg-white shadow-card transition-transform",
                            showTimestamps ? "translate-x-4" : "translate-x-0.5"
                          )}
                        />
                      </span>
                      Show timestamp
                    </button>

                    <div className="flex items-center gap-2">
                      <IconButton icon={copied ? Check : Copy} label="Copy transcript" onClick={handleCopy} active={copied} />
                      <IconButton
                        icon={downloaded ? Check : Download}
                        label="Download as TXT"
                        onClick={handleDownloadTxt}
                        active={downloaded}
                      />
                    </div>
                  </div>

                  <div className="flex max-h-[420px] flex-col gap-3 overflow-y-auto pr-1">
                    {(activeRow.lines ?? []).map((line, i) => (
                      <button
                        key={i}
                        type="button"
                        disabled={!activeRow.video_url}
                        onClick={() => handleSeekTo(line.timestamp)}
                        className="flex gap-3 rounded-lg px-1 py-0.5 text-left text-sm transition-colors enabled:hover:bg-app disabled:cursor-default"
                      >
                        {showTimestamps && (
                          <span className="w-10 shrink-0 font-mono text-xs text-body">{line.timestamp}</span>
                        )}
                        <p className="leading-relaxed text-heading">{line.text}</p>
                      </button>
                    ))}
                    {activeRow.lines?.length === 0 && (
                      <p className="text-sm text-body">No captions were found for this video.</p>
                    )}
                  </div>
                </Card>
              </div>
            )}
          </>
        )
      )}

      {popupOpen && activeRow && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4 backdrop-blur-sm"
          onClick={() => setPopupOpen(false)}
        >
          <div
            className="w-full max-w-sm overflow-hidden rounded-2xl bg-surface text-center shadow-card-hover"
            onClick={(event) => event.stopPropagation()}
          >
            {activeRow.status === "queued" || activeRow.status === "processing" ? (
              <div className="p-6 pt-4">
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setPopupOpen(false)}
                    aria-label="Close"
                    className="text-body hover:text-heading"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="mx-auto -mt-3 flex h-16 w-16 items-center justify-center rounded-full bg-primary">
                  <FileText className="h-8 w-8 text-white" />
                </div>

                <h3 className="mt-4 text-lg font-semibold text-heading">Extracting your Transcript...</h3>

                <div className="mt-5 flex items-center gap-[3px]">
                  {Array.from({ length: POPUP_PROGRESS_SEGMENTS }).map((_, index) => {
                    const filled = index < Math.round((popupProgress / 100) * POPUP_PROGRESS_SEGMENTS);
                    return (
                      <span
                        key={index}
                        className={cn(
                          "h-2 flex-1 rounded-full transition-colors duration-300",
                          filled ? "bg-primary" : "bg-hairline"
                        )}
                      />
                    );
                  })}
                </div>

                <p className="mt-3 text-xs text-body">
                  After completion, view in{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setPopupOpen(false);
                      setView("history");
                    }}
                    className="inline-flex items-center gap-0.5 font-medium text-primary hover:underline"
                  >
                    Transcript History
                    <Link2 className="h-3 w-3" />
                  </button>
                </p>
              </div>
            ) : activeRow.status === "failed" ? (
              <div className="p-6 pt-4">
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setPopupOpen(false)}
                    aria-label="Close"
                    className="text-body hover:text-heading"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="mx-auto -mt-3 flex h-16 w-16 items-center justify-center rounded-full bg-danger-tint">
                  <XCircle className="h-8 w-8 text-danger" />
                </div>

                <h3 className="mt-4 text-lg font-semibold text-heading">Extraction failed</h3>
                <p className="mt-1 text-sm text-body">
                  {activeRow.error_message || "Couldn't extract that transcript. Try a different link."}
                </p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between border-b border-hairline px-5 py-4">
                  <h3 className="text-base font-semibold text-heading">Transcript Ready</h3>
                  <button
                    type="button"
                    onClick={() => setPopupOpen(false)}
                    aria-label="Close"
                    className="text-body hover:text-heading"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="p-6">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success-tint">
                    <Check className="h-8 w-8 text-success" />
                  </div>

                  <h3 className="mt-4 text-lg font-semibold text-heading">Transcript ready!</h3>
                  <p className="mt-1 text-sm text-body">Your transcript has been processed successfully</p>

                  <div className="mt-5 flex gap-2">
                    <button
                      type="button"
                      onClick={handleCopy}
                      className="flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border border-hairline px-2 py-3 text-sm font-semibold text-heading hover:bg-app"
                    >
                      {copied ? <Check className="h-4 w-4 shrink-0" /> : <Copy className="h-4 w-4 shrink-0" />}
                      {copied ? "Copied" : "Copy"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setPopupOpen(false)}
                      className="flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl bg-btn-primary px-2 py-3 text-sm font-semibold text-white hover:bg-btn-primary-hover"
                    >
                      <PlayCircle className="h-4 w-4 shrink-0" />
                      View Transcript
                    </button>
                  </div>

                  <p className="mt-4 text-xs text-body">
                    View all in{" "}
                    <button
                      type="button"
                      onClick={() => {
                        setPopupOpen(false);
                        setView("history");
                      }}
                      className="font-medium text-primary hover:underline"
                    >
                      Transcript History
                    </button>
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <ExportModal
        isOpen={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        count={rows.length}
        onExport={(format) => exportTranscripts(rows, format)}
      />
    </div>
  );
}

