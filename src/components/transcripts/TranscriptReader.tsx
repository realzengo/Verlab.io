"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowUpRight,
  Check,
  ChevronRight,
  Copy,
  Download,
  Loader2,
  Pause,
  Play,
  PlayCircle,
} from "lucide-react";
import type { TranscriptLine, TranscriptRow } from "@/lib/types";
import { BezelPanel, INK_BUTTON } from "@/components/brand/BrandKit";
import {
  TRANSCRIPT_PLATFORMS,
  TranscriptPlatformMark,
  displayUrl,
  formatCreated,
  formatDuration,
  splitCaption,
} from "@/components/transcripts/platform";
import { cn } from "@/lib/utils";

// referrerPolicy is a valid global HTML attribute (browsers apply it to
// <video>'s resource fetch), but React's VideoHTMLAttributes type omits it —
// spreading a separately-typed object sidesteps the excess-property check
// that a literal `referrerPolicy="no-referrer"` prop would trigger.
const VIDEO_REFERRER_POLICY: { referrerPolicy: React.HTMLAttributeReferrerPolicy } = {
  referrerPolicy: "no-referrer",
};

type ViewMode = "timed" | "text";

const VIEW_MODES: { value: ViewMode; label: string }[] = [
  { value: "timed", label: "Timed" },
  { value: "text", label: "Text" },
];

const PILL_BUTTON =
  "inline-flex h-9 items-center gap-1.5 rounded-full border border-hairline bg-surface px-4 text-[13px] font-medium text-heading outline-none transition-colors hover:bg-(--app-fill) focus-visible:ring-2 focus-visible:ring-primary/40 disabled:pointer-events-none disabled:opacity-50 dark:bg-transparent";

// Timestamps come as "m:ss" or "h:mm:ss" -- convert to seconds for video.currentTime.
function timestampToSeconds(timestamp: string): number {
  const parts = timestamp.split(":").map((part) => Number(part) || 0);
  return parts.reduce((seconds, part) => seconds * 60 + part, 0);
}

function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

// Caption lines are fragments ("it looks past you. At dawn,"). For reading,
// they're flowed into paragraphs that close on a sentence end once they're
// long enough, or regardless once they run long.
const PARAGRAPH_SOFT_WORDS = 45;
const PARAGRAPH_HARD_WORDS = 90;

function toParagraphs(lines: TranscriptLine[]): number[][] {
  const paragraphs: number[][] = [];
  let current: number[] = [];
  let words = 0;
  lines.forEach((line, i) => {
    current.push(i);
    words += countWords(line.text);
    const endsSentence = /[.!?…]["'”’)]*$/.test(line.text.trim());
    if ((endsSentence && words >= PARAGRAPH_SOFT_WORDS) || words >= PARAGRAPH_HARD_WORDS) {
      paragraphs.push(current);
      current = [];
      words = 0;
    }
  });
  if (current.length) paragraphs.push(current);
  return paragraphs;
}

export function transcriptText(row: TranscriptRow, withTimestamps: boolean): string {
  return (row.lines ?? [])
    .map((line) => (withTimestamps ? `[${line.timestamp}] ${line.text}` : line.text))
    .join("\n");
}

function paragraphText(lines: TranscriptLine[]): string {
  return toParagraphs(lines)
    .map((paragraph) => paragraph.map((i) => lines[i].text.trim()).join(" "))
    .join("\n\n");
}

function useFlag(durationMs: number): [boolean, () => void] {
  const [on, setOn] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => clearTimeout(timer.current ?? undefined), []);
  return [
    on,
    () => {
      setOn(true);
      clearTimeout(timer.current ?? undefined);
      timer.current = setTimeout(() => setOn(false), durationMs);
    },
  ];
}

function BackLink({ onBack }: { onBack: () => void }) {
  return (
    <button
      type="button"
      onClick={onBack}
      className="-ml-1 inline-flex h-8 items-center gap-1.5 self-start rounded-lg px-1 text-[14px] font-medium text-subtle outline-none transition-colors hover:text-heading focus-visible:ring-2 focus-visible:ring-primary/40"
    >
      <ArrowLeft className="h-4 w-4" />
      History
    </button>
  );
}

function Scrubber({
  current,
  duration,
  onSeek,
}: {
  current: number;
  duration: number;
  onSeek: (seconds: number) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const ratio = duration > 0 ? Math.min(1, current / duration) : 0;

  function seekFromPointer(clientX: number) {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect || duration <= 0) return;
    onSeek(Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)) * duration);
  }

  return (
    <div
      ref={trackRef}
      role="slider"
      tabIndex={0}
      aria-label="Seek"
      aria-valuemin={0}
      aria-valuemax={Math.round(duration)}
      aria-valuenow={Math.round(current)}
      aria-valuetext={`${formatDuration(current) ?? "0:00"} of ${formatDuration(duration) ?? "0:00"}`}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        seekFromPointer(event.clientX);
      }}
      onPointerMove={(event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) seekFromPointer(event.clientX);
      }}
      onKeyDown={(event) => {
        if (event.key === "ArrowRight") onSeek(Math.min(duration, current + 5));
        if (event.key === "ArrowLeft") onSeek(Math.max(0, current - 5));
      }}
      className="group/scrub flex h-4 cursor-pointer touch-none items-center outline-none focus-visible:ring-2 focus-visible:ring-white/60"
    >
      <div className="relative h-1 w-full rounded-full bg-white/25 transition-[height] duration-150 group-hover/scrub:h-1.5">
        <div className="absolute inset-y-0 left-0 rounded-full bg-white" style={{ width: `${ratio * 100}%` }} />
      </div>
    </div>
  );
}

function Media({
  row,
  videoRef,
  playing,
  current,
  onPlayingChange,
  onTime,
  onSeek,
}: {
  row: TranscriptRow;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  playing: boolean;
  current: number | null;
  onPlayingChange: (playing: boolean) => void;
  onTime: (seconds: number) => void;
  onSeek: (seconds: number) => void;
}) {
  const [coverFailed, setCoverFailed] = useState(false);
  const [duration, setDuration] = useState(row.duration_seconds ?? 0);
  const started = current != null;

  return (
    <div className="group relative mx-auto flex aspect-[9/16] w-full max-w-[260px] items-center justify-center overflow-hidden rounded-[24px] bg-ink shadow-[0_1px_2px_rgba(16,24,40,0.08),0_24px_48px_-24px_rgba(16,24,40,0.35)] md:max-w-[calc((100dvh-7rem)*0.5625)]">
      {row.video_url ? (
        <>
          <video
            ref={videoRef}
            src={row.video_url}
            poster={row.cover_url || undefined}
            playsInline
            onPlay={() => onPlayingChange(true)}
            onPause={() => onPlayingChange(false)}
            onLoadedMetadata={(event) => {
              if (Number.isFinite(event.currentTarget.duration)) setDuration(event.currentTarget.duration);
            }}
            onTimeUpdate={(event) => onTime(event.currentTarget.currentTime)}
            className="h-full w-full object-cover"
            {...VIDEO_REFERRER_POLICY}
          />
          <button
            type="button"
            onClick={() => {
              const el = videoRef.current;
              if (!el) return;
              if (el.paused) el.play().catch(() => {});
              else el.pause();
            }}
            aria-label={playing ? "Pause video" : "Play video"}
            className={cn(
              "absolute inset-0 flex items-center justify-center outline-none transition-opacity duration-200",
              playing ? "opacity-0 hover:opacity-100 focus-visible:opacity-100" : "bg-black/10 opacity-100"
            )}
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/95 shadow-[0_4px_16px_rgba(0,0,0,0.25)]">
              {playing ? (
                <Pause className="h-5 w-5 fill-ink text-ink" />
              ) : (
                <Play className="h-5 w-5 translate-x-0.5 fill-ink text-ink" />
              )}
            </span>
          </button>

          {/* Scrim + scrubber: shown once playback has started, or on hover. */}
          <div
            className={cn(
              "absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/70 via-black/25 to-transparent px-4 pb-3 pt-12 transition-opacity duration-200",
              started ? "opacity-100" : "opacity-0 group-hover:opacity-100"
            )}
          >
            <Scrubber current={current ?? 0} duration={duration} onSeek={onSeek} />
            <div className="mt-1.5 flex justify-between font-mono text-[11px] tabular-nums text-white/85">
              <span>{formatDuration(current ?? 0) ?? "0:00"}</span>
              <span>{formatDuration(duration) ?? "--:--"}</span>
            </div>
          </div>
        </>
      ) : row.embed_url ? (
        <iframe
          src={row.embed_url}
          title={row.title ?? "Video"}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="h-full w-full"
        />
      ) : row.cover_url && !coverFailed ? (
        <a href={row.source_url} target="_blank" rel="noopener noreferrer" className="group/cover relative h-full w-full">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={row.cover_url}
            alt={row.title ?? "Video cover"}
            referrerPolicy="no-referrer"
            onError={() => setCoverFailed(true)}
            decoding="async"
            className="h-full w-full object-cover"
          />
          <span className="absolute inset-0 flex items-center justify-center bg-black/15 transition-colors group-hover/cover:bg-black/25">
            <PlayCircle className="h-12 w-12 text-white/90" strokeWidth={1.5} />
          </span>
        </a>
      ) : (
        <PlayCircle className="h-12 w-12 text-white/60" strokeWidth={1.5} />
      )}
      <span className="pointer-events-none absolute inset-0 z-20 rounded-[inherit] ring-1 ring-inset ring-black/10 dark:ring-white/10" />
    </div>
  );
}

export function TranscriptReader({ row, onBack }: { row: TranscriptRow; onBack: () => void }) {
  const [mode, setMode] = useState<ViewMode>("timed");
  const [copied, flagCopied] = useFlag(1500);
  const [downloaded, flagDownloaded] = useFlag(1500);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState<number | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const lineRefs = useRef<(HTMLElement | null)[]>([]);
  const prevActiveRef = useRef(-1);

  const lines = useMemo(() => row.lines ?? [], [row.lines]);
  const starts = useMemo(() => lines.map((line) => timestampToSeconds(line.timestamp)), [lines]);
  const paragraphs = useMemo(() => toParagraphs(lines), [lines]);
  const { title, tags } = useMemo(
    () => splitCaption(row.title ?? displayUrl(row.source_url)),
    [row.title, row.source_url]
  );
  const seekable = Boolean(row.video_url);

  const wordCount = useMemo(() => lines.reduce((sum, line) => sum + countWords(line.text), 0), [lines]);
  const duration = formatDuration(row.duration_seconds);
  const pace =
    row.duration_seconds && row.duration_seconds >= 10 && wordCount > 0
      ? Math.round(wordCount / (row.duration_seconds / 60))
      : null;

  // The line being spoken: the last one whose timestamp has passed. Only
  // tracked once the video has actually started, so nothing is lit at rest.
  let activeIndex = -1;
  if (currentTime != null) {
    for (let i = 0; i < starts.length && starts[i] <= currentTime; i++) activeIndex = i;
  }

  // Follow the spoken line while the video plays -- but only if the reader
  // was following along (the previous line was on screen), so scrolling
  // away to read ahead isn't yanked back.
  useEffect(() => {
    const el = lineRefs.current[activeIndex];
    const prev = lineRefs.current[prevActiveRef.current];
    prevActiveRef.current = activeIndex;
    if (!playing || !el) return;
    const onScreen = (node: HTMLElement) => {
      const rect = node.getBoundingClientRect();
      return rect.bottom > 0 && rect.top < window.innerHeight;
    };
    if (prev && !onScreen(prev)) return;
    const rect = el.getBoundingClientRect();
    if (rect.top < 96 || rect.bottom > window.innerHeight - 96) el.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [activeIndex, playing]);

  // Copy and download follow the view: timestamped lines, or paragraphs.
  const exportText = mode === "timed" ? transcriptText(row, true) : paragraphText(lines);

  async function handleCopy() {
    if (!lines.length) return;
    await navigator.clipboard.writeText(exportText);
    flagCopied();
  }

  function handleDownload() {
    if (!lines.length) return;
    const blob = new Blob([exportText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${title.replace(/[\\/:*?"<>|]+/g, " ").trim() || "transcript"}.txt`;
    link.click();
    URL.revokeObjectURL(url);
    flagDownloaded();
  }

  function seekTo(seconds: number) {
    const el = videoRef.current;
    if (!el) return;
    el.currentTime = seconds;
    setCurrentTime(seconds);
  }

  function playFrom(index: number) {
    seekTo(starts[index]);
    videoRef.current?.play().catch(() => {});
  }

  if (row.status === "queued" || row.status === "processing") {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 pt-6 sm:pt-10">
        <BackLink onBack={onBack} />
        <BezelPanel innerClassName="flex flex-col items-center px-6 py-16 text-center">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <p className="mt-4 text-[15px] font-medium text-heading">Extracting transcript</p>
          <p className="mt-1 max-w-full truncate text-[13px] text-subtle">{displayUrl(row.source_url)}</p>
        </BezelPanel>
      </div>
    );
  }

  if (row.status === "failed") {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 pt-6 sm:pt-10">
        <BackLink onBack={onBack} />
        <BezelPanel innerClassName="flex flex-col items-center px-6 py-16 text-center">
          <AlertTriangle className="h-5 w-5 text-danger" strokeWidth={1.75} />
          <p className="mt-4 text-[15px] font-medium text-heading">Couldn&apos;t extract this transcript</p>
          <p className="mt-1 max-w-sm text-[13px] text-subtle">
            {row.error_message || "Try a different link."}
          </p>
          <button type="button" onClick={onBack} className={cn(INK_BUTTON, "mt-6 h-10 px-5 text-sm")}>
            Try another link
          </button>
        </BezelPanel>
      </div>
    );
  }

  // While the video plays, the spoken line stays bright and the rest step
  // back; paused or not started, everything reads at full contrast.
  const lineTone = (i: number) => (i === activeIndex || !playing ? "text-heading" : "text-subtle");

  return (
    <div className="flex flex-col gap-6 pt-6 sm:pt-10">
      <div className="flex items-center justify-between gap-4">
        <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-[14px] font-medium">
          <button
            type="button"
            onClick={onBack}
            className="-ml-1 inline-flex shrink-0 items-center gap-1.5 rounded-md px-1 text-subtle outline-none transition-colors hover:text-heading focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <ArrowLeft className="h-4 w-4 sm:hidden" />
            History
          </button>
          <ChevronRight className="hidden h-3.5 w-3.5 shrink-0 text-subtle sm:block" />
          <span className="hidden truncate text-heading sm:block">{title}</span>
        </nav>
        <div className="flex shrink-0 items-center gap-2">
          <button type="button" onClick={handleDownload} disabled={!lines.length} className={PILL_BUTTON}>
            {downloaded ? <Check className="h-3.5 w-3.5 text-success" /> : <Download className="h-3.5 w-3.5 text-subtle" />}
            <span className="hidden sm:inline">Download</span>
            <span className="sm:hidden">.txt</span>
          </button>
          <button
            type="button"
            onClick={handleCopy}
            disabled={!lines.length}
            className={cn(INK_BUTTON, "h-9 px-4 text-[13px]")}
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copied" : "Copy transcript"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 items-start gap-6 md:grid-cols-[280px_minmax(0,1fr)] lg:grid-cols-[360px_minmax(0,1fr)] lg:gap-10 xl:grid-cols-[400px_minmax(0,1fr)]">
        {/* The video fills its column, but never grows taller than the
            window (its max width tracks the viewport height), so the sticky
            player always fits on screen at 9:16. */}
        <div className="md:sticky md:top-6">
          <Media
            row={row}
            videoRef={videoRef}
            playing={playing}
            current={currentTime}
            onPlayingChange={setPlaying}
            onTime={setCurrentTime}
            onSeek={seekTo}
          />
        </div>

        <BezelPanel innerClassName="flex flex-col">
          <div className="px-5 pb-5 pt-5 sm:px-7 sm:pt-6">
            <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-heading sm:text-[26px]">
              {title}
            </h1>
            <p className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[13px] text-subtle">
              <TranscriptPlatformMark platform={row.platform} className="h-3.5 w-3.5" />
              <span>{TRANSCRIPT_PLATFORMS[row.platform].label}</span>
              <span aria-hidden>·</span>
              <span>{formatCreated(row.created_at)}</span>
              <span aria-hidden>·</span>
              <a
                href={row.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-0.5 font-medium text-body underline-offset-4 hover:text-heading hover:underline"
              >
                Original
                <ArrowUpRight className="h-3.5 w-3.5" />
              </a>
            </p>
            {tags.length > 0 && (
              <div className="mt-3.5 flex flex-wrap gap-1.5">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-md bg-(--app-fill) px-2 py-0.5 text-[12px] font-medium leading-5 text-body"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          <dl className="grid grid-cols-3 divide-x divide-hairline border-y border-hairline">
            {[
              { label: "Length", value: duration ?? "—" },
              { label: "Words", value: wordCount ? wordCount.toLocaleString() : "—" },
              { label: "Pace", value: pace ? String(pace) : "—", unit: pace ? "wpm" : undefined },
            ].map((stat) => (
              <div key={stat.label} className="px-5 py-4 sm:px-7">
                <dt className="text-[12px] leading-4 text-subtle">{stat.label}</dt>
                <dd className="mt-1.5 text-[20px] font-medium leading-7 tracking-[-0.01em] tabular-nums text-heading">
                  {stat.value}
                  {stat.unit && <span className="ml-1 text-[13px] font-normal tracking-normal text-subtle">{stat.unit}</span>}
                </dd>
              </div>
            ))}
          </dl>

          <div className="flex items-center justify-between gap-3 px-5 pb-1 pt-5 sm:px-7">
            <h2 className="text-[13px] font-medium text-heading">Transcript</h2>
            <div role="radiogroup" aria-label="View" className="flex rounded-lg bg-(--app-fill) p-0.5">
              {VIEW_MODES.map(({ value, label }) => {
                const active = mode === value;
                return (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setMode(value)}
                    className={cn(
                      "h-7 rounded-md px-3 text-[13px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/40",
                      active
                        ? "bg-surface text-heading shadow-[0_1px_2px_rgba(16,24,40,0.08),0_0_0_0.5px_rgba(16,24,40,0.08)] dark:bg-white/[0.1] dark:shadow-none"
                        : "text-subtle hover:text-heading"
                    )}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {lines.length === 0 ? (
            <p className="px-6 py-14 text-center text-[14px] text-subtle">No captions were found for this video</p>
          ) : mode === "timed" ? (
            <div className="flex flex-col gap-0.5 px-2 pb-4 pt-2 sm:px-4 sm:pb-5">
              {lines.map((line, i) => {
                const active = i === activeIndex;
                return (
                  <button
                    key={i}
                    ref={(node) => {
                      lineRefs.current[i] = node;
                    }}
                    type="button"
                    disabled={!seekable}
                    onClick={() => playFrom(i)}
                    className={cn(
                      "group/line grid grid-cols-[52px_minmax(0,1fr)] gap-3 rounded-xl px-3 py-2.5 text-left outline-none transition-colors duration-300 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/40 disabled:cursor-text",
                      active ? "bg-(--app-fill-strong)" : seekable && "hover:bg-(--app-fill)"
                    )}
                  >
                    <span
                      className={cn(
                        "pt-[3px] font-mono text-[12px] leading-5 tabular-nums transition-colors duration-300",
                        active ? "text-primary" : "text-subtle",
                        seekable && "group-hover/line:text-primary"
                      )}
                    >
                      {line.timestamp}
                    </span>
                    <span
                      className={cn("select-text text-[15px] leading-relaxed transition-colors duration-300", lineTone(i))}
                    >
                      {line.text}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col gap-5 px-5 pb-7 pt-3 sm:px-7">
              {paragraphs.map((paragraph, p) => (
                <p key={p} className="text-[16px] leading-[1.8]">
                  {paragraph.map((i) => {
                    const active = i === activeIndex;
                    return (
                      <span key={i}>
                        <span
                          ref={(node) => {
                            lineRefs.current[i] = node;
                          }}
                          role={seekable ? "button" : undefined}
                          tabIndex={seekable ? 0 : undefined}
                          title={seekable ? `Play from ${lines[i].timestamp}` : undefined}
                          onClick={seekable ? () => playFrom(i) : undefined}
                          onKeyDown={
                            seekable
                              ? (event) => {
                                  if (event.key === "Enter" || event.key === " ") {
                                    event.preventDefault();
                                    playFrom(i);
                                  }
                                }
                              : undefined
                          }
                          className={cn(
                            "rounded-[5px] outline-none transition-colors duration-300 [box-decoration-break:clone] focus-visible:ring-2 focus-visible:ring-primary/40",
                            lineTone(i),
                            active && "bg-primary/10",
                            seekable && !active && "cursor-pointer hover:bg-(--app-fill-strong)"
                          )}
                        >
                          {lines[i].text.trim()}
                        </span>{" "}
                      </span>
                    );
                  })}
                </p>
              ))}
            </div>
          )}
        </BezelPanel>
      </div>
    </div>
  );
}
