"use client";

import { useEffect, useRef, useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { ArrowRight, Check, ChevronRight, Link2, Loader2, X, Zap } from "lucide-react";
import { BEZEL_FIELD, BEZEL_FIELD_ROW, INK_TITLE } from "@/components/brand/BrandKit";
import { PlasticButton } from "@/components/ui/plastic-button";
import { Skeleton } from "@/components/ui/Skeleton";
import { YouTubeIcon } from "@/components/landing/PlatformIcons";
import { LinkFieldNote } from "@/components/transcripts/LinkFieldNote";
import { DiscoverGrid } from "@/components/clipping/DiscoverGrid";
import { fetchJson } from "@/components/clipping/parts";
import {
  CLIP_LENGTHS,
  DEFAULT_CLIP_OPTIONS,
  formatClock,
  formatCompactNumber,
  isClipProjectWorking,
  parseYoutubeVideoId,
  youtubeWatchUrl,
  type ClipOptions,
  type ClipProject,
  type ClipSourceVideo,
} from "@/lib/clips";
import { cn } from "@/lib/utils";

interface PreviewResponse {
  video: ClipSourceVideo;
  credits: number;
  problem: string | null;
}

const PREVIEW_DEBOUNCE_MS = 350;

export function ClippingHome({ onOpenProject }: { onOpenProject: (id: string) => void }) {
  const [link, setLink] = useState("");
  const [debouncedId, setDebouncedId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [options, setOptions] = useState<ClipOptions>(DEFAULT_CLIP_OPTIONS);
  const inputRef = useRef<HTMLInputElement>(null);
  const fieldRef = useRef<HTMLDivElement>(null);
  // One request id per video + options the user means to clip: a double
  // submit, or trying again after a dropped answer, reuses it, so the server
  // makes one project and charges once. A new video or new options, or a
  // successful Create, gets a new one.
  const request = useRef<{ key: string; id: string } | null>(null);
  // State updates land a render later; a second click before then still sees `submitting` false.
  const inFlight = useRef(false);

  const videoId = parseYoutubeVideoId(link);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedId(videoId), PREVIEW_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [videoId]);

  const previewKey =
    videoId && debouncedId === videoId
      ? `/api/clips/preview?url=${encodeURIComponent(youtubeWatchUrl(videoId))}`
      : null;
  const {
    data: preview,
    error: previewError,
    isLoading: previewLoading,
  } = useSWR<PreviewResponse>(previewKey, fetchJson, {
    revalidateOnFocus: false,
    shouldRetryOnError: false,
  });

  const { data: projectsData, mutate: mutateProjects } = useSWR<{
    projects: ClipProject[];
  }>("/api/clips");
  const projects = projectsData?.projects ?? [];

  const handleGenerate = async () => {
    if (!videoId) {
      setError(link.trim() ? "That doesn't look like a YouTube video link" : "Paste a YouTube link first");
      inputRef.current?.focus();
      return;
    }
    if (preview?.problem && debouncedId === videoId) {
      setError(preview.problem);
      return;
    }

    if (inFlight.current) return;
    inFlight.current = true;
    const key = `${videoId}:${JSON.stringify(options)}`;
    if (request.current?.key !== key) request.current = { key, id: crypto.randomUUID() };
    setSubmitting(true);
    setError(null);
    try {
      const { project } = await fetchJson<{ project: ClipProject }>("/api/clips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: youtubeWatchUrl(videoId), options, requestId: request.current.id }),
      });
      request.current = null;
      mutateProjects(
        (current) => ({
          projects: [project, ...(current?.projects ?? []).filter((item) => item.id !== project.id)],
        }),
        { revalidate: false }
      );
      onOpenProject(project.id);
      inFlight.current = false;
    } catch (caught) {
      inFlight.current = false;
      const message = caught instanceof Error ? caught.message : "Could not start clipping";
      setError(
        message === "Insufficient credits"
          ? "You don't have enough credits for this video. Top up and try again."
          : message
      );
      setSubmitting(false);
    }
  };

  const pickVideo = (video: ClipSourceVideo) => {
    setLink(youtubeWatchUrl(video.id));
    setError(null);
    fieldRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    inputRef.current?.focus({ preventScroll: true });
  };

  const removeProject = async (id: string) => {
    await mutateProjects(
      async (current) => {
        const res = await fetch(`/api/clips/${id}`, { method: "DELETE" });
        if (!res.ok) throw new Error();
        return {
          projects: (current?.projects ?? []).filter((p) => p.id !== id),
        };
      },
      {
        optimisticData: (current) => ({
          projects: (current?.projects ?? []).filter((p) => p.id !== id),
        }),
        rollbackOnError: true,
        revalidate: false,
      }
    ).catch(() => {});
  };

  const showPreview = videoId && debouncedId === videoId;

  return (
    <div className="@container flex w-full flex-col pb-20">
      <section className="flex flex-col items-center pt-10 text-center sm:pt-28">
        <h1
          className={`${INK_TITLE} max-w-3xl text-balance text-[36px] leading-[1.04] tracking-[-0.045em] sm:text-[56px]`}
        >
          Turn YouTube videos <br className="hidden sm:block" />
          into viral clips
        </h1>
      </section>

      <div ref={fieldRef} className="relative mx-auto mt-8 w-full max-w-2xl scroll-mt-6 sm:mt-12">
        <LinkFieldNote>
          Turn one video
          <br />
          into a week of clips
        </LinkFieldNote>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!submitting) handleGenerate();
          }}
          className={BEZEL_FIELD}
        >
          <div className={BEZEL_FIELD_ROW}>
            <span className="flex h-5 w-5 shrink-0 items-center justify-center">
              {videoId ? (
                <YouTubeIcon className="h-[18px] w-[18px]" />
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
              value={link}
              onChange={(event) => {
                setLink(event.target.value);
                if (error) setError(null);
              }}
              placeholder="Paste a YouTube link"
              aria-label="YouTube video link"
              aria-invalid={Boolean(error)}
              className="h-11 min-w-0 flex-1 bg-transparent text-[16px] text-heading outline-none placeholder:text-subtle sm:text-[15px]"
            />
            <PlasticButton
              type="submit"
              className="mb-1 h-11 shrink-0"
              text="Generate"
              trailing={<ArrowRight className="h-4 w-4" strokeWidth={2} />}
              loading={submitting}
              loadingText="Starting"
            />
          </div>
        </form>

        {/* Under the field: what's wrong, or (with no video yet) what works... */}
        {(error || !showPreview || (previewError && !preview)) && (
          <div className="mt-4 flex min-h-6 items-center justify-center text-sm">
            {error ? (
              <p className="text-center text-danger">{error}</p>
            ) : showPreview && previewError ? (
              <p className="text-center text-danger">{previewError.message}</p>
            ) : (
              <span className="flex items-center gap-1.5 text-subtle">
                <YouTubeIcon className="h-4 w-4" />
                Any YouTube video from 2 minutes to 3 hours
              </span>
            )}
          </div>
        )}

        {/* ...and the video the link points at, big, once it's looked up. */}
        {showPreview && preview ? (
          <VideoPreviewCard video={preview.video} credits={preview.credits} problem={preview.problem} />
        ) : showPreview && previewLoading ? (
          <VideoPreviewSkeleton />
        ) : null}

        {/* How long the clips should be */}
        <div className="mt-6 flex justify-center">
          <div
            role="radiogroup"
            aria-label="Clip length"
            className="flex w-full rounded-full bg-(--app-fill) p-[3px] sm:w-auto"
          >
            {CLIP_LENGTHS.map((option) => {
              const active = options.length === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setOptions((current) => ({ ...current, length: option.value }))}
                  className={cn(
                    "h-9 flex-1 whitespace-nowrap rounded-full px-3 text-[13px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/40 sm:h-8 sm:text-[12px]",
                    active
                      ? "bg-surface text-heading shadow-[0_1px_2px_rgba(16,24,40,0.08),0_0_0_0.5px_rgba(16,24,40,0.08)] dark:bg-white/[0.1] dark:shadow-none"
                      : "text-subtle hover:text-heading"
                  )}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {projects.length > 0 && (
        <section className="mx-auto mt-12 w-full max-w-5xl sm:mt-16">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-heading sm:text-[13px] sm:font-medium sm:tracking-normal">
              Your videos
            </h2>
            <Link
              href="/clipping?view=all"
              className="-mr-2 inline-flex h-9 items-center gap-0.5 rounded-full px-2 text-[13px] font-medium text-subtle outline-none transition-colors hover:text-heading focus-visible:ring-2 focus-visible:ring-primary/40 sm:h-8"
            >
              See all clips
              <ChevronRight className="h-3.5 w-3.5" strokeWidth={2} />
            </Link>
          </div>
          <div className="-mx-4 mt-3 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:mx-0 sm:snap-proximity sm:scroll-px-0 sm:gap-4 sm:px-0 sm:[scrollbar-width:thin]">
            {projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onOpen={() => onOpenProject(project.id)}
                onRemove={() => removeProject(project.id)}
                className="w-[62vw] max-w-56 shrink-0 snap-start sm:w-56"
              />
            ))}
          </div>
        </section>
      )}

      <DiscoverGrid onPick={pickVideo} />
    </div>
  );
}

// The preview card sits in the same double bezel as the link field above it
// (gray rim, white sheet), so the two read as one piece: thumbnail left and
// title right on wider screens, stacked on phones.
const PREVIEW_RIM =
  "clip-preview-in mt-4 rounded-[22px] border border-[#EBEDF0] bg-[#F5F6F8] p-1.5 text-left dark:border-white/[0.06] dark:bg-white/[0.025]";
const PREVIEW_SHEET =
  "flex flex-col gap-4 rounded-2xl border border-[#E6E8EC] bg-white p-2 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_24px_48px_-32px_rgba(16,24,40,0.18)] sm:flex-row sm:items-stretch sm:gap-5 sm:p-2.5 dark:border-white/[0.07] dark:bg-[#0E0E10]";
const PREVIEW_THUMB_BOX = "relative aspect-video w-full shrink-0 overflow-hidden rounded-xl sm:w-[288px]";
const PREVIEW_THUMB = cn(
  PREVIEW_THUMB_BOX,
  "bg-(--app-fill-strong) ring-1 ring-inset ring-black/[0.06] dark:ring-white/[0.06]"
);

function VideoPreviewCard({
  video,
  credits,
  problem,
}: {
  video: ClipSourceVideo;
  credits: number;
  problem: string | null;
}) {
  const views = formatCompactNumber(video.views);
  return (
    <div className={PREVIEW_RIM}>
      <div className={PREVIEW_SHEET}>
        <div className={PREVIEW_THUMB}>
          {/* eslint-disable-next-line @next/next/no-img-element -- remote YouTube thumbnail */}
          <img
            src={video.thumbnailUrl}
            alt=""
            className={cn("h-full w-full object-cover", problem && "opacity-60 grayscale")}
          />
          <span className="absolute bottom-2 right-2 rounded-md bg-black/75 px-1.5 py-0.5 font-mono text-[12px] font-medium tabular-nums text-white">
            {formatClock(video.durationSeconds)}
          </span>
        </div>

        <div className="flex min-w-0 flex-1 flex-col px-1.5 pb-1.5 sm:px-0 sm:py-1.5 sm:pr-2">
          <p
            dir="auto"
            className="line-clamp-3 text-[17px] font-semibold leading-[1.35] tracking-[-0.012em] text-heading sm:text-[18px]"
          >
            {video.title}
          </p>

          <div className="mt-2.5 flex min-w-0 items-center gap-2 text-[13px] text-subtle">
            {video.channelAvatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- remote YouTube avatar
              <img
                src={video.channelAvatarUrl}
                alt=""
                className="h-5 w-5 shrink-0 rounded-full bg-(--app-fill-strong) object-cover"
              />
            ) : (
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-(--app-fill-strong) text-[10px] font-semibold uppercase text-body">
                {video.channelTitle.charAt(0)}
              </span>
            )}
            <span dir="auto" className="min-w-0 truncate font-medium text-body">
              {video.channelTitle}
            </span>
            {views && (
              <span className="shrink-0 tabular-nums">
                <span aria-hidden="true">· </span>
                {views} views
              </span>
            )}
          </div>

          {/* What clipping it costs -- or why it can't be clipped. */}
          <div className="mt-4 flex items-center gap-2 border-t border-hairline pt-3 text-[13px] sm:mt-auto">
            {problem ? (
              <span className="text-danger">{problem}</span>
            ) : (
              <>
                <span className="flex items-center gap-1.5 font-medium text-heading">
                  <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" strokeWidth={2.5} />
                  Ready to clip
                </span>
                <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-(--app-fill) px-2.5 py-1 font-medium tabular-nums text-body">
                  <Zap className="h-3.5 w-3.5 text-primary" strokeWidth={2} />
                  {credits} credits
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Holds the card's exact shape while the video is looked up, so nothing jumps. */
function VideoPreviewSkeleton() {
  return (
    <div role="status" aria-label="Looking up the video" className={PREVIEW_RIM}>
      <div className={PREVIEW_SHEET}>
        <Skeleton className={PREVIEW_THUMB_BOX} />
        <div className="flex min-w-0 flex-1 flex-col px-1.5 pb-1.5 sm:px-0 sm:py-1.5 sm:pr-2">
          <Skeleton className="h-[18px] w-11/12 rounded-full" />
          <Skeleton className="mt-2 h-[18px] w-2/3 rounded-full" />
          <div className="mt-3.5 flex items-center gap-2">
            <Skeleton className="h-5 w-5 rounded-full" />
            <Skeleton className="h-3 w-28 rounded-full" />
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-hairline pt-3 sm:mt-auto">
            <Skeleton className="h-3 w-24 rounded-full" />
            <Skeleton className="h-[26px] w-24 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
}

function ProjectCard({
  project,
  onOpen,
  onRemove,
  className,
}: {
  project: ClipProject;
  onOpen: () => void;
  onRemove: () => void;
  className?: string;
}) {
  const working = isClipProjectWorking(project.status);
  const failed = project.status === "failed";
  const count = project.clips?.length ?? 0;
  return (
    <div className={cn("group relative", className)}>
      <button type="button" onClick={onOpen} className="block w-full text-left outline-none">
        <div className="relative aspect-video overflow-hidden rounded-[14px] bg-(--app-fill-strong) ring-1 ring-black/[0.04] group-focus-visible:ring-2 group-focus-visible:ring-primary/50 dark:ring-white/[0.06]">
          {project.thumbnailUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- remote YouTube thumbnail
            <img
              src={project.thumbnailUrl}
              alt=""
              className={cn("h-full w-full object-cover", failed && "opacity-50 grayscale")}
            />
          )}
          <span className="absolute bottom-2 right-2 rounded-md bg-black/70 px-1.5 py-0.5 font-mono text-[11px] font-medium tabular-nums text-white">
            {formatClock(project.durationSeconds)}
          </span>
        </div>
        <p dir="auto" className="mt-2.5 line-clamp-2 text-[13px] font-medium leading-snug text-heading">
          {project.title}
        </p>
        <p className="mt-1 flex items-center gap-1.5 text-[12px] tabular-nums text-subtle">
          {working ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin text-primary" strokeWidth={2.5} />
              Finding clips
            </>
          ) : failed ? (
            <span className="text-danger">Failed</span>
          ) : (
            <>
              {count} clip{count === 1 ? "" : "s"} found
            </>
          )}
        </p>
      </button>
      {/* A project still working can't be removed: its credits are already spent. */}
      {!working && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${project.title}`}
          className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/45 text-white opacity-0 ring-1 ring-white/15 backdrop-blur-md transition-[opacity,background-color] hover:bg-black/65 focus-visible:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100"
        >
          <X className="h-3.5 w-3.5" strokeWidth={2} />
        </button>
      )}
    </div>
  );
}
