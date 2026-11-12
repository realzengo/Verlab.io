"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import useSWR, { useSWRConfig } from "swr";
import { ArrowRight, ChevronLeft, ChevronRight, Download, Flame, Loader2, Plus, Trash2, X } from "lucide-react";
import { INK_BUTTON, INK_TITLE } from "@/components/brand/BrandKit";
import { PlasticButton } from "@/components/ui/plastic-button";
import { Portal } from "@/components/ui/Portal";
import { Skeleton } from "@/components/ui/Skeleton";
import { ScoreChip, downloadBlob, fetchJson } from "@/components/clipping/parts";
import { BackButton, STAGES, useElapsedSeconds } from "@/components/clipping/ClipProjectView";
import { CopyIconButton, PendingFrame } from "@/components/clipping/ClipResults";
import { rendersAhead, useClipRenders, type RenderEntry } from "@/components/clipping/renderQueue";
import { exportsKey } from "@/components/clipping/useClipWorkspace";
import {
  formatClock,
  isClipProjectWorking,
  type ClipExport,
  type ClipMoment,
  type ClipProject,
} from "@/lib/clips";
import { cn } from "@/lib/utils";

const PROJECTS_KEY = "/api/clips?all=1";
const EXPORTS_KEY = "/api/clips/exports";
const POLL_MS = 3000;

type Tab = "clips" | "videos";

/** A saved clip with the moment it was cut from, when that project is loaded. */
interface ClipEntry {
  item: ClipExport;
  project: ClipProject | undefined;
  moment: ClipMoment | undefined;
}

const CLIP_GRID = "grid grid-cols-2 gap-x-3 gap-y-6 @2xl:grid-cols-3 @2xl:gap-x-4 @4xl:grid-cols-4 @5xl:grid-cols-5 @6xl:grid-cols-6";
const VIDEO_GRID = "grid grid-cols-1 gap-x-4 gap-y-6 @xl:grid-cols-2 @4xl:grid-cols-3 @6xl:grid-cols-4";

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

/**
 * Everything the user has made with Clipping: videos still being worked on,
 * every clip they saved, and every video they've clipped.
 */
export function ClipLibrary({
  onBack,
  onOpenProject,
}: {
  onBack: () => void;
  onOpenProject: (id: string) => void;
}) {
  const [tab, setTab] = useState<Tab>("clips");
  const [openId, setOpenId] = useState<string | null>(null);
  const { mutate: mutateKey } = useSWRConfig();
  const { data: projectsData, mutate: mutateProjects } = useSWR<{ projects: ClipProject[] }>(
    PROJECTS_KEY,
    fetchJson,
    {
      // Keeps the processing rows live; stops once nothing is working.
      refreshInterval: (latest) =>
        latest?.projects.some((project) => isClipProjectWorking(project.status)) ? POLL_MS : 0,
    }
  );
  const { data: exportsData, mutate: mutateExports } = useSWR<{ exports: ClipExport[] }>(EXPORTS_KEY, fetchJson, {
    revalidateOnFocus: false,
  });

  // Renders this tab is still working on (they keep going after the project
  // page is left), plus finished ones that didn't make it into the library.
  const queue = useClipRenders();
  const rendering = queue.filter(
    (entry) => entry.status !== "done" || (entry.saved !== "saved" && entry.saved !== undefined)
  );

  const loading = !projectsData || !exportsData;
  const projects = projectsData?.projects ?? [];
  const processing = projects.filter((project) => isClipProjectWorking(project.status));
  const videos = projects.filter((project) => !isClipProjectWorking(project.status));
  const projectById = new Map(projects.map((project) => [project.id, project]));
  const clips: ClipEntry[] = (exportsData?.exports ?? []).map((item) => {
    const project = projectById.get(item.projectId);
    return { item, project, moment: project?.clips?.find((clip) => clip.id === item.clipId) };
  });
  const savedByProject = new Map<string, number>();
  for (const { item } of clips) savedByProject.set(item.projectId, (savedByProject.get(item.projectId) ?? 0) + 1);

  const openIndex = clips.findIndex((entry) => entry.item.id === openId);

  const removeExport = async (item: ClipExport) => {
    const without = (current?: { exports: ClipExport[] }) => ({
      exports: (current?.exports ?? []).filter((entry) => entry.id !== item.id),
    });
    await mutateExports(
      async (current) => {
        const res = await fetch(`${exportsKey(item.projectId)}?exportId=${item.id}`, { method: "DELETE" });
        if (!res.ok) throw new Error();
        return without(current);
      },
      { optimisticData: without, rollbackOnError: true, revalidate: false }
    ).catch(() => {});
    mutateKey(exportsKey(item.projectId));
  };

  const removeProject = async (id: string) => {
    const without = (current?: { projects: ClipProject[] }) => ({
      projects: (current?.projects ?? []).filter((project) => project.id !== id),
    });
    await mutateProjects(
      async (current) => {
        const res = await fetch(`/api/clips/${id}`, { method: "DELETE" });
        if (!res.ok) throw new Error();
        return without(current);
      },
      { optimisticData: without, rollbackOnError: true, revalidate: false }
    ).catch(() => {});
    // Its saved clips go with it.
    mutateExports();
    mutateKey("/api/clips");
  };

  return (
    <div className="@container mx-auto flex w-full max-w-[1400px] flex-col pb-20 pt-1">
      <header className="flex items-center gap-3 sm:gap-4">
        <BackButton onClick={onBack} />
        <div className="min-w-0 flex-1">
          <h1 className={cn(INK_TITLE, "text-[30px] leading-[1.05] tracking-[-0.04em] sm:text-[40px]")}>Your clips</h1>
          <p className="mt-1 text-[14px] text-subtle">
            {loading ? (
              <span className="invisible">Loading</span>
            ) : (
              <>
                {plural(clips.length, "clip")} from {plural(videos.length, "video")}
              </>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={onBack}
          aria-label="Clip a video"
          className={cn(INK_BUTTON, "h-10 w-10 shrink-0 text-[14px] sm:w-auto sm:px-4")}
        >
          <Plus className="h-4 w-4" strokeWidth={2} />
          <span className="hidden sm:inline">Clip a video</span>
        </button>
      </header>

      {loading ? (
        <LibrarySkeleton />
      ) : !projects.length && !clips.length ? (
        <EmptyState
          title="No clips yet"
          body="Paste a YouTube link and Verlab finds its most viral moments. Every clip you export lands here."
          action={
            <PlasticButton
              text="Clip a video"
              trailing={<ArrowRight className="h-4 w-4" strokeWidth={2} />}
              onClick={onBack}
              className="h-11"
            />
          }
        />
      ) : (
        <>
          {processing.length > 0 && (
            <ProcessingPanel projects={processing} onOpen={onOpenProject} />
          )}

          <div role="tablist" aria-label="Your clips view" className="mt-10 flex gap-6 border-b border-hairline">
            {(
              [
                { id: "clips", label: "Clips", count: clips.length + rendering.length },
                { id: "videos", label: "Videos", count: videos.length },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={tab === item.id}
                onClick={() => setTab(item.id)}
                className={cn(
                  "-mb-px flex items-center gap-1.5 border-b-2 pb-2.5 text-[14px] font-medium outline-none transition-colors focus-visible:text-heading",
                  tab === item.id ? "border-heading text-heading" : "border-transparent text-subtle hover:text-heading"
                )}
              >
                {item.label}
                <span className="text-[13px] tabular-nums text-subtle">{item.count}</span>
              </button>
            ))}
          </div>

          {tab === "clips" ? (
            clips.length || rendering.length ? (
              <div className={cn(CLIP_GRID, "mt-6")}>
                {rendering.map((entry) => (
                  <RenderTile
                    key={entry.key}
                    entry={entry}
                    ahead={rendersAhead(queue, entry)}
                    onOpen={() => onOpenProject(entry.projectId)}
                  />
                ))}
                {clips.map((entry) => (
                  <ClipTile
                    key={entry.item.id}
                    entry={entry}
                    onOpen={() => setOpenId(entry.item.id)}
                    onRemove={() => removeExport(entry.item)}
                  />
                ))}
              </div>
            ) : (
              <EmptyState
                title="No saved clips yet"
                body="Open one of your videos, pick its best moments and export them. They’re kept here."
                action={
                  videos.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setTab("videos")}
                      className={cn(INK_BUTTON, "h-10 px-5 text-[14px]")}
                    >
                      Your videos
                      <ArrowRight className="h-4 w-4" strokeWidth={2} />
                    </button>
                  )
                }
              />
            )
          ) : videos.length ? (
            <div className={cn(VIDEO_GRID, "mt-6")}>
              {videos.map((project) => (
                <VideoTile
                  key={project.id}
                  project={project}
                  saved={savedByProject.get(project.id) ?? 0}
                  onOpen={() => onOpenProject(project.id)}
                  onRemove={() => removeProject(project.id)}
                />
              ))}
            </div>
          ) : (
            <EmptyState title="No finished videos yet" body="Videos show up here once their clips are found." />
          )}
        </>
      )}

      {openIndex >= 0 && (
        <ClipPlayer
          entry={clips[openIndex]}
          position={`${openIndex + 1} / ${clips.length}`}
          onPrev={openIndex > 0 ? () => setOpenId(clips[openIndex - 1].item.id) : undefined}
          onNext={openIndex < clips.length - 1 ? () => setOpenId(clips[openIndex + 1].item.id) : undefined}
          onClose={() => setOpenId(null)}
          onOpenProject={() => onOpenProject(clips[openIndex].item.projectId)}
          onRemove={() => {
            const { item } = clips[openIndex];
            const next = clips[openIndex + 1] ?? clips[openIndex - 1];
            setOpenId(next ? next.item.id : null);
            removeExport(item);
          }}
        />
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- pieces */

/**
 * A clip this tab is rendering (or just rendered but couldn't save): the
 * Download step's live frame, at tile size. Opens its project on Download.
 */
function RenderTile({ entry, ahead, onOpen }: { entry: RenderEntry; ahead: number; onOpen: () => void }) {
  const title = entry.settings.title || entry.clip.title;
  const done = entry.status === "done" && entry.url;
  return (
    <div className="group/clip flex min-w-0 flex-col">
      <div className="relative aspect-[9/16] overflow-hidden rounded-[14px] bg-black shadow-[0_1px_2px_rgba(16,24,40,0.06)] ring-1 ring-black/[0.04] dark:ring-white/[0.06]">
        {done ? (
          <video src={`${entry.url}#t=0.1`} muted playsInline preload="metadata" className="h-full w-full object-cover" />
        ) : (
          <>
            {entry.project.thumbnailUrl && (
              // eslint-disable-next-line @next/next/no-img-element -- remote YouTube thumbnail
              <img
                src={entry.project.thumbnailUrl}
                alt=""
                className="absolute inset-0 h-full w-full scale-110 object-cover opacity-55 blur-lg"
              />
            )}
            <span className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/10 to-black/50" />
          </>
        )}
        <button
          type="button"
          onClick={onOpen}
          aria-label={`Open “${title}”`}
          className="absolute inset-0 rounded-[14px] outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/80"
        >
          {done ? (
            // Rendered, but not in the library: still downloadable from this tab.
            <span className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-2 bg-gradient-to-t from-black/70 to-transparent px-3 pb-3 pt-10 text-center">
              <span className="text-[12px] font-medium text-white">
                {entry.saved === "saving" ? "Saving to Your clips" : "Not saved. Download it."}
              </span>
            </span>
          ) : (
            <PendingFrame render={entry} ahead={ahead} compact />
          )}
        </button>
        <ScoreChip score={entry.clip.score} className="pointer-events-none absolute left-2.5 top-2.5" />
        {done && entry.saved !== "saving" && (
          <a
            href={entry.url}
            download={`${title}.mp4`}
            aria-label={`Download ${title}`}
            className={cn(ON_VIDEO_BUTTON, "absolute right-2 top-2")}
          >
            <Download className="h-3.5 w-3.5" strokeWidth={2} />
          </a>
        )}
      </div>
      <button type="button" onClick={onOpen} className="mt-2.5 text-left outline-none" tabIndex={-1}>
        <p dir="auto" className="line-clamp-2 text-[13px] font-medium leading-snug text-heading">
          {title}
        </p>
      </button>
      <span className="mt-1 flex min-w-0 items-center gap-1.5 text-[12px] text-subtle">
        {entry.project.thumbnailUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- remote YouTube thumbnail
          <img src={entry.project.thumbnailUrl} alt="" className="h-3 w-5 shrink-0 rounded-[2px] object-cover" />
        )}
        <span dir="auto" className="truncate">
          {entry.project.title}
        </span>
      </span>
    </div>
  );
}

/** Frosted controls sitting on a video. */
const ON_VIDEO_BUTTON =
  "flex h-8 w-8 items-center justify-center rounded-full bg-black/45 text-white ring-1 ring-white/15 backdrop-blur-md transition-colors hover:bg-black/65 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70";

function ClipTile({ entry, onOpen, onRemove }: { entry: ClipEntry; onOpen: () => void; onRemove: () => void }) {
  const { item, project, moment } = entry;
  const videoRef = useRef<HTMLVideoElement>(null);

  // Fine pointers get a silent preview on hover; it rewinds when the pointer leaves.
  const preview = (play: boolean) => {
    const video = videoRef.current;
    if (!video || !window.matchMedia("(hover: hover)").matches) return;
    if (play) {
      video.currentTime = 0;
      video.play().catch(() => {});
    } else {
      video.pause();
      video.currentTime = 0.1;
    }
  };

  return (
    <div className="group/clip flex min-w-0 flex-col" onMouseEnter={() => preview(true)} onMouseLeave={() => preview(false)}>
      <div className="relative aspect-[9/16] overflow-hidden rounded-[14px] bg-black shadow-[0_1px_2px_rgba(16,24,40,0.06)] ring-1 ring-black/[0.04] dark:ring-white/[0.06]">
        <video
          ref={videoRef}
          src={`${item.url}#t=0.1`}
          muted
          loop
          playsInline
          preload="metadata"
          className="h-full w-full object-cover"
        />
        <button
          type="button"
          onClick={onOpen}
          aria-label={`Play “${item.title}”`}
          className="absolute inset-0 rounded-[14px] outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/80"
        >
          <span className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/55 to-transparent" />
          {moment && <ScoreChip score={moment.score} className="absolute bottom-2.5 left-2.5" />}
          <span className="absolute bottom-2.5 right-2.5 font-mono text-[11px] font-medium tabular-nums text-white/90 [text-shadow:0_1px_2px_rgba(0,0,0,0.5)]">
            {formatClock(item.durationSeconds)}
          </span>
        </button>
        <div className="absolute right-2 top-2 flex gap-1.5 opacity-0 transition-opacity group-hover/clip:opacity-100 has-[:focus-visible]:opacity-100 [@media(hover:none)]:opacity-100">
          <a href={item.downloadUrl} aria-label={`Download ${item.title}`} className={ON_VIDEO_BUTTON}>
            <Download className="h-3.5 w-3.5" strokeWidth={2} />
          </a>
          <button type="button" onClick={onRemove} aria-label={`Delete ${item.title}`} className={ON_VIDEO_BUTTON}>
            <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
          </button>
        </div>
      </div>
      <button type="button" onClick={onOpen} className="mt-2.5 text-left outline-none" tabIndex={-1}>
        <p dir="auto" className="line-clamp-2 text-[13px] font-medium leading-snug text-heading">
          {item.title}
        </p>
      </button>
      {project && <SourceLine project={project} className="mt-1" />}
    </div>
  );
}

/** The long video a clip came from: its thumbnail and title, quiet. */
function SourceLine({ project, className }: { project: ClipProject; className?: string }) {
  return (
    <span className={cn("flex min-w-0 items-center gap-1.5 text-[12px] text-subtle", className)}>
      {project.thumbnailUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- remote YouTube thumbnail
        <img src={project.thumbnailUrl} alt="" className="h-3 w-5 shrink-0 rounded-[2px] object-cover" />
      )}
      <span dir="auto" className="truncate">
        {project.title}
      </span>
    </span>
  );
}

function VideoTile({
  project,
  saved,
  onOpen,
  onRemove,
}: {
  project: ClipProject;
  saved: number;
  onOpen: () => void;
  onRemove: () => void;
}) {
  const found = project.clips?.length ?? 0;
  const failed = project.status === "failed";
  return (
    <div className="group/video relative min-w-0">
      <button type="button" onClick={onOpen} className="block w-full text-left outline-none">
        <div className="relative aspect-video overflow-hidden rounded-[14px] bg-(--app-fill-strong) ring-1 ring-black/[0.04] group-focus-visible/video:ring-2 group-focus-visible/video:ring-primary/50 dark:ring-white/[0.06]">
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
        <p dir="auto" className="mt-2.5 line-clamp-2 text-[14px] font-medium leading-snug text-heading">
          {project.title}
        </p>
        <p className="mt-1 text-[12px] tabular-nums text-subtle">
          {failed ? (
            <span className="text-danger">Failed</span>
          ) : (
            <>
              {plural(found, "clip")} found
              {saved > 0 && <> · {saved} saved</>}
            </>
          )}
          {" · "}
          {shortDate(project.createdAt)}
        </p>
      </button>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${project.title}`}
        className={cn(
          ON_VIDEO_BUTTON,
          "absolute right-2 top-2 opacity-0 group-hover/video:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100"
        )}
      >
        <X className="h-3.5 w-3.5" strokeWidth={2} />
      </button>
    </div>
  );
}

/** Videos still being worked on: one quiet panel of live rows. */
function ProcessingPanel({ projects, onOpen }: { projects: ClipProject[]; onOpen: (id: string) => void }) {
  return (
    <section className="mt-8 overflow-hidden rounded-[20px] border border-hairline bg-surface shadow-[0_1px_2px_rgba(16,24,40,0.04),0_12px_32px_-18px_rgba(16,24,40,0.14)] dark:bg-white/[0.03] dark:shadow-none">
      <div className="flex items-center gap-2 border-b border-hairline px-4 py-3 sm:px-5">
        <Loader2 className="h-4 w-4 animate-spin text-primary" strokeWidth={2} />
        <h2 className="text-[14px] font-medium text-heading">Processing</h2>
        <span className="text-[13px] tabular-nums text-subtle">{projects.length}</span>
      </div>
      <ul className="divide-y divide-hairline">
        {projects.map((project) => (
          <li key={project.id}>
            <ProcessingRow project={project} onOpen={() => onOpen(project.id)} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function ProcessingRow({ project, onOpen }: { project: ClipProject; onOpen: () => void }) {
  const elapsed = useElapsedSeconds(project.createdAt);
  const index = Math.max(
    0,
    STAGES.findIndex((stage) => stage.status === project.status)
  );
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center gap-3 px-4 py-3 text-left outline-none transition-colors hover:bg-(--app-fill)/60 focus-visible:bg-(--app-fill) sm:gap-4 sm:px-5"
    >
      <span className="relative aspect-video w-20 shrink-0 overflow-hidden rounded-[8px] bg-(--app-fill-strong) sm:w-24">
        {project.thumbnailUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- remote YouTube thumbnail
          <img src={project.thumbnailUrl} alt="" className="h-full w-full object-cover" />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span dir="auto" className="block truncate text-[14px] font-medium text-heading">
          {project.title}
        </span>
        <span className="mt-0.5 block truncate text-[13px] text-subtle">
          {STAGES[index].label}
          <span className="hidden sm:inline">
            {" "}
            · Step {index + 1} of {STAGES.length}
          </span>
        </span>
        <span className="mt-2 block h-1 max-w-80 overflow-hidden rounded-full bg-(--app-fill-strong)">
          <span
            className="block h-full rounded-full bg-primary transition-[width] duration-700"
            style={{ width: `${((index + 0.5) / STAGES.length) * 100}%` }}
          />
        </span>
      </span>
      <span className="hidden shrink-0 font-mono text-[12px] tabular-nums text-subtle sm:block">
        {formatClock(elapsed)}
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-subtle" strokeWidth={2} />
    </button>
  );
}

function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="mx-auto mt-16 flex max-w-sm flex-col items-center text-center">
      <p className="text-[17px] font-medium text-heading">{title}</p>
      <p className="mt-1.5 text-[14px] leading-relaxed text-subtle">{body}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

/* ---------------------------------------------------------------- player */

/** One clip, large: the video, its score and caption, and what to do with it. */
function ClipPlayer({
  entry,
  position,
  onPrev,
  onNext,
  onClose,
  onOpenProject,
  onRemove,
}: {
  entry: ClipEntry;
  position: string;
  onPrev?: () => void;
  onNext?: () => void;
  onClose: () => void;
  onOpenProject: () => void;
  onRemove: () => void;
}) {
  const { item, project, moment } = entry;

  const onKey = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      else if (event.key === "ArrowLeft") onPrev?.();
      else if (event.key === "ArrowRight") onNext?.();
    },
    [onClose, onPrev, onNext]
  );
  useEffect(() => {
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onKey]);
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  return (
    <Portal>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={item.title}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-0 backdrop-blur-sm sm:p-6"
        onClick={onClose}
      >
        {/* prev / next, outside the sheet on wide screens */}
        {onPrev && (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onPrev();
            }}
            aria-label="Previous clip"
            className="absolute left-6 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white ring-1 ring-white/15 transition-colors hover:bg-white/20 lg:flex"
          >
            <ChevronLeft className="h-5 w-5" strokeWidth={2} />
          </button>
        )}
        {onNext && (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onNext();
            }}
            aria-label="Next clip"
            className="absolute right-6 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white ring-1 ring-white/15 transition-colors hover:bg-white/20 lg:flex"
          >
            <ChevronRight className="h-5 w-5" strokeWidth={2} />
          </button>
        )}

        <div
          onClick={(event) => event.stopPropagation()}
          className="relative flex h-full w-full flex-col overflow-y-auto bg-surface sm:h-auto sm:max-h-full sm:w-auto sm:flex-row sm:overflow-hidden sm:rounded-[24px] sm:shadow-[0_32px_80px_-24px_rgba(0,0,0,0.6)] dark:bg-[#0E0E10] dark:sm:ring-1 dark:sm:ring-white/10"
        >
          <div className="relative shrink-0 bg-black">
            {/* phones: the panel's own close button scrolls away, so one rides on the video */}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className={cn(ON_VIDEO_BUTTON, "absolute right-3 top-[max(12px,env(safe-area-inset-top))] z-10 h-10 w-10 sm:hidden")}
            >
              <X className="h-4 w-4" strokeWidth={2} />
            </button>
            <video
              key={item.id}
              src={item.url}
              controls
              autoPlay
              playsInline
              className="mx-auto aspect-[9/16] h-[min(72dvh,640px)] max-w-full bg-black object-contain sm:h-[min(calc(100dvh-3rem),720px)]"
            />
          </div>

          <div className="flex w-full flex-col sm:w-[340px]">
            <div className="flex items-center justify-between gap-3 border-b border-hairline px-5 py-3">
              <span className="font-mono text-[12px] tabular-nums text-subtle">{position}</span>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="-mr-2 hidden h-9 w-9 items-center justify-center rounded-full text-subtle sm:flex transition-colors hover:bg-(--app-fill) hover:text-heading"
              >
                <X className="h-4 w-4" strokeWidth={2} />
              </button>
            </div>

            <div className="flex flex-1 flex-col gap-5 p-5 sm:overflow-y-auto">
              <div>
                <div className="flex items-center gap-2">
                  {moment && (
                    <span className="inline-flex h-7 items-center gap-1 rounded-full bg-(--app-fill) px-2.5 text-[13px] font-semibold tabular-nums text-heading">
                      <Flame className="h-3.5 w-3.5 fill-[#335cff] text-[#335cff]" strokeWidth={2} />
                      {moment.score}
                    </span>
                  )}
                  <span className="font-mono text-[12px] tabular-nums text-subtle">
                    {formatClock(item.durationSeconds)} · {item.aspect}
                  </span>
                </div>
                <h2 dir="auto" className="mt-3 text-[18px] font-semibold leading-snug tracking-[-0.015em] text-heading">
                  {item.title}
                </h2>
                {project && (
                  <button
                    type="button"
                    onClick={onOpenProject}
                    className="mt-2 flex max-w-full items-center gap-1 text-left transition-colors hover:[&_span]:text-heading"
                  >
                    <SourceLine project={project} />
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-subtle" strokeWidth={2} />
                  </button>
                )}
              </div>

              {moment?.caption && (
                <div className="rounded-[14px] bg-(--app-fill) p-3.5">
                  <div className="-mr-1.5 -mt-1.5 flex items-center justify-between gap-2">
                    <p className="text-[12px] font-medium text-subtle">Caption</p>
                    <CopyIconButton clip={moment} />
                  </div>
                  <p dir="auto" className="mt-1 whitespace-pre-line text-[13px] leading-relaxed text-body">
                    {moment.caption}
                  </p>
                  {moment.hashtags.length > 0 && (
                    <p className="mt-2 text-[13px] leading-relaxed text-primary">
                      {moment.hashtags.map((tag) => `#${tag}`).join(" ")}
                    </p>
                  )}
                </div>
              )}

              {moment?.reason && (
                <div>
                  <p className="text-[12px] font-medium text-subtle">Why it works</p>
                  <p dir="auto" className="mt-1 text-[13px] leading-relaxed text-body">
                    {moment.reason}
                  </p>
                </div>
              )}
            </div>

            <div className="sticky bottom-0 flex items-center gap-2 border-t border-hairline bg-surface p-4 pb-[max(16px,env(safe-area-inset-bottom))] dark:bg-[#0E0E10]">
              <PlasticButton
                text="Download"
                trailing={<Download className="h-4 w-4" strokeWidth={2} />}
                onClick={() => downloadBlob(item.downloadUrl, `${item.title}.mp4`)}
                className="h-11 flex-1"
              />
              <button
                type="button"
                onClick={onRemove}
                aria-label="Delete clip"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-hairline text-subtle transition-colors hover:bg-(--app-fill) hover:text-danger"
              >
                <Trash2 className="h-4 w-4" strokeWidth={2} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </Portal>
  );
}

/* -------------------------------------------------------------- skeleton */

function LibrarySkeleton() {
  return (
    <div role="status" aria-label="Loading">
      <div className="mt-10 flex gap-6 border-b border-hairline pb-2.5">
        <Skeleton className="h-4 w-14 rounded-full" />
        <Skeleton className="h-4 w-16 rounded-full" />
      </div>
      <div className={cn(CLIP_GRID, "mt-6")}>
        {Array.from({ length: 10 }, (_, index) => (
          <div key={index} className="flex flex-col">
            <Skeleton className="aspect-[9/16] w-full rounded-[14px]" />
            <Skeleton className="mt-2.5 h-3.5 w-4/5 rounded-full" />
            <Skeleton className="mt-2 h-3 w-1/2 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
