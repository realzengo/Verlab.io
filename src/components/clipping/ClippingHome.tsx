"use client";

import { useEffect, useRef, useState } from "react";
import useSWR from "swr";
import { ArrowRight, Link2, X } from "lucide-react";
import { BEZEL_FIELD, BEZEL_FIELD_ROW, INK_TITLE } from "@/components/brand/BrandKit";
import { PlasticButton } from "@/components/ui/plastic-button";
import { CreditCost } from "@/components/ui/CreditCost";
import { YouTubeIcon } from "@/components/landing/PlatformIcons";
import { LinkFieldNote } from "@/components/transcripts/LinkFieldNote";
import { DiscoverGrid } from "@/components/clipping/DiscoverGrid";
import { fetchJson } from "@/components/clipping/parts";
import {
  CLIP_LENGTHS,
  DEFAULT_CLIP_OPTIONS,
  formatClock,
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

    setSubmitting(true);
    setError(null);
    try {
      const { project } = await fetchJson<{ project: ClipProject }>("/api/clips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: youtubeWatchUrl(videoId), options }),
      });
      mutateProjects((current) => ({ projects: [project, ...(current?.projects ?? [])] }), { revalidate: false });
      onOpenProject(project.id);
    } catch (caught) {
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

        {/* One line under the field: what's wrong, the video it found, or what works. */}
        <div className="mt-4 flex min-h-6 items-center justify-center text-sm">
          {error ? (
            <p className="text-center text-danger">{error}</p>
          ) : showPreview && preview ? (
            <div className="flex min-w-0 max-w-full items-center gap-2.5">
              {/* eslint-disable-next-line @next/next/no-img-element -- remote YouTube thumbnail */}
              <img
                src={preview.video.thumbnailUrl}
                alt=""
                className="h-6 w-[42px] shrink-0 rounded-[5px] object-cover"
              />
              <span className="min-w-0 truncate font-medium text-heading">{preview.video.title}</span>
              {preview.problem ? (
                <span className="shrink-0 text-danger">{preview.problem}</span>
              ) : (
                <span className="flex shrink-0 items-center gap-1.5 text-subtle">
                  <span className="font-mono text-[13px]">{formatClock(preview.video.durationSeconds)}</span>
                  <CreditCost amount={preview.credits} />
                </span>
              )}
            </div>
          ) : showPreview && previewError ? (
            <p className="text-center text-danger">{previewError.message}</p>
          ) : showPreview && previewLoading ? (
            <span className="text-subtle">Looking up the video…</span>
          ) : (
            <span className="flex items-center gap-1.5 text-subtle">
              <YouTubeIcon className="h-4 w-4" />
              Any YouTube video from 2 minutes to 3 hours
            </span>
          )}
        </div>

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
          <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-heading sm:text-[13px] sm:font-medium sm:tracking-normal">
            Your videos
          </h2>
          <div className="-mx-4 mt-3 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:mx-0 sm:snap-proximity sm:scroll-px-0 sm:gap-4 sm:px-0 sm:[scrollbar-width:thin]">
            {projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onOpen={() => onOpenProject(project.id)}
                onRemove={() => removeProject(project.id)}
              />
            ))}
          </div>
        </section>
      )}

      <DiscoverGrid onPick={pickVideo} />
    </div>
  );
}

function projectStatusLabel(project: ClipProject): string {
  if (isClipProjectWorking(project.status)) return "Finding clips…";
  if (project.status === "failed") return "Failed";
  const count = project.clips?.length ?? 0;
  return `${count} clip${count === 1 ? "" : "s"}`;
}

function ProjectCard({
  project,
  onOpen,
  onRemove,
}: {
  project: ClipProject;
  onOpen: () => void;
  onRemove: () => void;
}) {
  const working = isClipProjectWorking(project.status);
  return (
    <div className="group relative w-[62vw] max-w-56 shrink-0 snap-start sm:w-56">
      <button type="button" onClick={onOpen} className="block w-full text-left outline-none">
        <div className="relative aspect-video overflow-hidden rounded-xl bg-(--app-fill-strong) ring-primary/50 group-focus-visible:ring-2">
          {project.thumbnailUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- remote YouTube thumbnail
            <img src={project.thumbnailUrl} alt="" className="h-full w-full object-cover" />
          )}
          <span
            className={cn(
              "absolute bottom-2 left-2 inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-[12px] font-medium backdrop-blur-md",
              project.status === "failed" ? "bg-danger/90 text-white" : "bg-black/60 text-white"
            )}
          >
            {working && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />}
            {projectStatusLabel(project)}
          </span>
        </div>
        <p className="mt-2 line-clamp-2 text-[13px] font-medium leading-snug text-heading">{project.title}</p>
      </button>
      {/* A project still working can't be removed: its credits are already spent. */}
      {!working && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${project.title}`}
          className="absolute right-1 top-1 flex h-9 w-9 items-center justify-center rounded-full text-white opacity-0 transition-opacity before:absolute before:inset-1 before:rounded-full before:bg-black/55 before:backdrop-blur-md before:content-[''] focus-visible:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100"
        >
          <X className="relative h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
