"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import NumberFlow from "@number-flow/react";
import {
  Check,
  Clock3,
  CloudUpload,
  Copy,
  Download,
  Loader2,
  Pencil,
  RotateCw,
  Share,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { INK_BUTTON } from "@/components/brand/BrandKit";
import { ScoreChip, clipFileName, downloadBlob, fetchJson, useMediaQuery } from "@/components/clipping/parts";
import { exportsKey, type ClipWorkspace, type RenderState } from "@/components/clipping/useClipWorkspace";
import Link from "next/link";
import { rendersAhead, useClipRenders } from "@/components/clipping/renderQueue";
import { ClipVideo } from "@/components/clipping/ClipVideo";
import { formatClock, type ClipExport, type ClipMoment, type ClipProject } from "@/lib/clips";
import { cn } from "@/lib/utils";

function postText(clip: ClipMoment): string {
  const tags = clip.hashtags.map((tag) => `#${tag}`).join(" ");
  return tags ? `${clip.caption}\n\n${tags}` : clip.caption;
}

const formatSize = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

const ASPECT_FRAME: Record<ClipExport["aspect"], string> = {
  "9:16": "aspect-[9/16]",
  "1:1": "aspect-square",
  "16:9": "aspect-video",
};

function CopyCaption({ clip }: { clip: ClipMoment }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(postText(clip));
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border border-hairline px-3.5 text-[13px] font-medium text-heading transition-colors hover:bg-(--app-fill) sm:h-9"
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? "Copied" : "Copy caption"}
    </button>
  );
}

/**
 * Touch devices: the finished clip as a file for the system share sheet, so
 * it can go straight to Photos (iOS "Save Video") or an app. Built ahead of
 * the tap, since Safari only shares from inside the tap itself.
 */
function useShareableFile(url: string | undefined, name: string): File | null {
  const touch = useMediaQuery("(pointer: coarse)");
  const [made, setMade] = useState<{ url: string; file: File } | null>(null);
  useEffect(() => {
    if (!touch || !url || typeof navigator.canShare !== "function") return;
    let live = true;
    fetch(url)
      .then((response) => response.blob())
      .then((blob) => {
        const file = new File([blob], name, { type: "video/mp4" });
        if (live && navigator.canShare({ files: [file] })) setMade({ url, file });
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [touch, url, name]);
  return touch && made && made.url === url ? made.file : null;
}

function SaveStatus({ render }: { render: RenderState | undefined }) {
  if (render?.status !== "done" || !render.saved) return null;
  const states = {
    saving: { icon: <Loader2 className="h-3 w-3 animate-spin" />, text: "Saving to your clips", tone: "text-subtle" },
    saved: { icon: <CloudUpload className="h-3 w-3" />, text: "Saved to your clips", tone: "text-subtle" },
    failed: { icon: <TriangleAlert className="h-3 w-3" />, text: "Not saved. Download it.", tone: "text-danger" },
    "too-large": {
      icon: <TriangleAlert className="h-3 w-3" />,
      text: "Too large to save. Download it.",
      tone: "text-danger",
    },
  }[render.saved];
  return (
    <span className={cn("inline-flex items-center gap-1 text-[12px]", states.tone)}>
      {states.icon}
      {states.text}
    </span>
  );
}

export function ClipResults({
  project,
  clips,
  workspace,
  onEdit,
}: {
  project: ClipProject;
  clips: ClipMoment[];
  workspace: ClipWorkspace;
  onEdit: () => void;
}) {
  const done = clips.filter((clip) => workspace.renders[clip.id]?.status === "done");
  // Renders run one at a time across projects, so the queue is global.
  const queue = useClipRenders();
  const aheadOf = (clip: ClipMoment) => {
    const entry = queue.find((item) => item.projectId === project.id && item.clip.id === clip.id);
    return entry ? rendersAhead(queue, entry) : -1;
  };
  const allDone = done.length === clips.length;

  const downloadAll = () => {
    done.forEach((clip, index) => {
      const render = workspace.renders[clip.id];
      // Browsers drop rapid back-to-back downloads; space them out.
      setTimeout(() => downloadBlob(render.url!, clipFileName(workspace.settingsFor(clip).title, index)), index * 400);
    });
  };

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-[22px] font-semibold tracking-[-0.02em] text-heading">
            {allDone ? "Ready to post" : clips.length > 1 ? "Rendering your clips" : "Rendering your clip"}
          </h2>
          <p className="mt-1 text-[14px] text-subtle">
            Keeps rendering if you leave. Each one is saved to{" "}
            <Link
              href="/clipping?view=all"
              className="font-medium text-heading underline decoration-hairline underline-offset-4 transition-colors hover:decoration-heading"
            >
              Your clips
            </Link>{" "}
            the moment it finishes
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex h-11 items-center gap-1.5 rounded-full border border-hairline px-4 text-[13px] font-medium text-heading transition-colors hover:bg-(--app-fill) sm:h-10"
          >
            <Pencil className="h-3.5 w-3.5" /> Edit
          </button>
          {done.length > 0 ? (
            <button
              type="button"
              onClick={downloadAll}
              className={cn(INK_BUTTON, "h-11 px-5 text-[13px] max-sm:flex-1 sm:h-10")}
            >
              <Download className="h-4 w-4" />
              {clips.length === 1 ? "Download" : allDone ? `Download all ${clips.length}` : `Download ${done.length} ready`}
            </button>
          ) : (
            // Nothing to download yet: say how far along it is instead of a dead button.
            <span className="inline-flex h-11 items-center gap-2 rounded-full bg-(--app-fill) px-4 text-[13px] font-medium text-body max-sm:flex-1 max-sm:justify-center sm:h-10">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-subtle" />
              <span className="tabular-nums">
                {done.length} of {clips.length} ready
              </span>
            </span>
          )}
        </div>
      </div>

      <div
        className={cn(
          "-mx-4 mt-6 flex snap-x snap-mandatory scroll-px-4 gap-4 overflow-x-auto px-4 pb-2 [scrollbar-width:none]",
          "sm:mx-0 sm:mt-8 sm:grid sm:snap-none sm:grid-cols-[repeat(auto-fill,minmax(260px,300px))] sm:items-start sm:gap-x-8 sm:gap-y-12 sm:overflow-visible sm:px-0 sm:pb-0",
          clips.length === 1 && "max-sm:justify-center"
        )}
      >
        {clips.map((clip, index) => (
          <ResultCard
            key={clip.id}
            clip={clip}
            index={index}
            ahead={aheadOf(clip)}
            workspace={workspace}
            thumbnailUrl={project.thumbnailUrl}
          />
        ))}
      </div>

      <SavedClips project={project} />
    </div>
  );
}

/** What a clip that isn't finished shows on its frame (`compact` on Your clips' small tiles). */
export function PendingFrame({
  render,
  ahead,
  onRetry,
  compact = false,
}: {
  render: (RenderState & { preparing?: boolean }) | undefined;
  ahead: number;
  onRetry?: () => void;
  compact?: boolean;
}) {
  if (render?.status === "error") {
    return (
      <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 rounded-2xl bg-black/55 p-4 text-center text-white ring-1 ring-white/10 backdrop-blur-xl">
        <TriangleAlert className="mx-auto h-5 w-5 text-white/80" strokeWidth={1.75} />
        <p className={cn("mt-2 leading-relaxed", compact ? "line-clamp-3 text-[12px]" : "text-[13px]")}>
          {render.error}
        </p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-3 inline-flex h-8 items-center gap-1.5 rounded-full bg-white px-3.5 text-[13px] font-medium text-[#0B0D12] transition-colors hover:bg-white/90"
          >
            <RotateCw className="h-3.5 w-3.5" /> Try again
          </button>
        )}
      </div>
    );
  }

  if (render?.status === "rendering") {
    const percent = Math.round(render.progress * 100);
    return (
      <>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
          <NumberFlow
            value={percent}
            suffix="%"
            className={cn(
              "font-mono font-medium leading-none tabular-nums tracking-[-0.02em]",
              compact ? "text-[30px]" : "text-[44px]"
            )}
          />
          <p className={cn("text-white/70", compact ? "mt-2 text-[12px]" : "mt-3 text-[13px]")}>
            {compact ? "Rendering" : "Rendering in full HD"}
          </p>
        </div>
        <div
          className={cn(
            "absolute h-[3px] overflow-hidden rounded-full bg-white/20",
            compact ? "inset-x-3 bottom-3" : "inset-x-5 bottom-5"
          )}
        >
          <div
            className="h-full origin-left rounded-full bg-white transition-transform duration-300 ease-out"
            style={{ transform: `scaleX(${percent / 100})` }}
          />
        </div>
      </>
    );
  }

  // Waiting: the first in line is being prepared, the rest count down.
  const preparing = Boolean(render?.preparing);
  const label = preparing
    ? "Preparing the clip"
    : ahead <= 0
      ? "Getting ready"
      : `${ahead} clip${ahead === 1 ? "" : "s"} ahead`;
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <span
        className={cn(
          "inline-flex items-center gap-2 whitespace-nowrap rounded-full bg-black/45 font-medium text-white ring-1 ring-white/15 backdrop-blur-md",
          compact ? "h-8 px-3 text-[12px]" : "h-9 px-4 text-[13px]"
        )}
      >
        {preparing || ahead <= 0 ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Clock3 className="h-3.5 w-3.5 text-white/70" strokeWidth={2} />
        )}
        {label}
      </span>
    </div>
  );
}

function ResultCard({
  clip,
  index,
  ahead,
  workspace,
  thumbnailUrl,
}: {
  clip: ClipMoment;
  index: number;
  /** How many waiting clips render before this one; -1 when it isn't waiting. */
  ahead: number;
  workspace: ClipWorkspace;
  thumbnailUrl: string | null;
}) {
  const settings = workspace.settingsFor(clip);
  const title = settings.title || clip.title;
  const render = workspace.renders[clip.id];
  const source = workspace.sources[clip.id];
  const duration = render?.duration ?? settings.end - settings.start;
  const fileName = clipFileName(title, index);
  const finished = render?.status === "done" && render.url;
  const shareable = useShareableFile(finished ? render.url : undefined, fileName);

  return (
    <article className="flex w-[min(80vw,300px)] shrink-0 snap-center flex-col sm:w-auto">
      <div
        className={cn(
          "relative w-full overflow-hidden rounded-[20px] bg-black shadow-[0_1px_2px_rgba(16,24,40,0.06),0_24px_48px_-28px_rgba(16,24,40,0.45)] ring-1 ring-black/[0.06] dark:shadow-none dark:ring-white/[0.08]",
          ASPECT_FRAME[settings.aspect]
        )}
      >
        {finished ? (
          <ClipVideo src={render.url!} label={title} className="h-full w-full" />
        ) : (
          <>
            {thumbnailUrl && (
              // eslint-disable-next-line @next/next/no-img-element -- remote YouTube thumbnail
              <img
                src={thumbnailUrl}
                alt=""
                className="absolute inset-0 h-full w-full scale-110 object-cover opacity-55 blur-lg"
              />
            )}
            <span className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/10 to-black/50" />
            <PendingFrame
              render={render}
              ahead={ahead}
              onRetry={() => {
                if (source?.status === "error") workspace.retrySource(clip);
                void workspace.exportClips([clip.id]);
              }}
            />
          </>
        )}
        <ScoreChip score={clip.score} className="pointer-events-none absolute left-3 top-3" />
      </div>

      <div className="mt-4 w-full">
        <div className="flex items-center justify-between gap-2">
          <p className="font-mono text-[11px] tabular-nums text-subtle">
            {String(index + 1).padStart(2, "0")} · {formatClock(duration)}
            {render?.size ? ` · ${formatSize(render.size)}` : ""}
          </p>
          <SaveStatus render={render} />
        </div>
        <h3 dir="auto" className="mt-1.5 line-clamp-2 text-[15px] font-semibold leading-snug tracking-[-0.01em] text-heading">
          {title}
        </h3>

        <div className="mt-3 rounded-[14px] bg-(--app-fill) px-3.5 py-3 text-[13px] leading-relaxed text-body">
          <p dir="auto" className="line-clamp-4 whitespace-pre-line">
            {clip.caption}
          </p>
          {clip.hashtags.length > 0 && (
            <p className="mt-1.5 truncate text-primary">{clip.hashtags.map((tag) => `#${tag}`).join(" ")}</p>
          )}
        </div>

        <div className="mt-3 flex gap-2">
          {shareable ? (
            <>
              <button
                type="button"
                onClick={() => void navigator.share({ files: [shareable] }).catch(() => {})}
                className={cn(INK_BUTTON, "h-10 min-w-0 flex-1 px-4 text-[13px]")}
              >
                <Share className="h-3.5 w-3.5" /> Save video
              </button>
              <button
                type="button"
                onClick={() => render?.url && downloadBlob(render.url, fileName)}
                aria-label="Download"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-hairline text-heading transition-colors hover:bg-(--app-fill)"
              >
                <Download className="h-4 w-4" />
              </button>
            </>
          ) : finished ? (
            <button
              type="button"
              onClick={() => downloadBlob(render.url!, fileName)}
              className={cn(INK_BUTTON, "h-10 min-w-0 flex-1 px-4 text-[13px] sm:h-9")}
            >
              <Download className="h-3.5 w-3.5" /> Download
            </button>
          ) : (
            // Inactive on purpose, in the neutral fill rather than a faded ink button.
            <span className="inline-flex h-10 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-full bg-(--app-fill) px-4 text-[13px] font-medium text-subtle sm:h-9">
              <Download className="h-3.5 w-3.5" /> Download
            </span>
          )}
          <CopyCaption clip={clip} />
        </div>
      </div>
    </article>
  );
}

/** Clips saved in earlier sessions (and this one), served from Storage. */
export function SavedClips({ project, className }: { project: ClipProject; className?: string }) {
  const { data, mutate } = useSWR<{ exports: ClipExport[] }>(exportsKey(project.id), fetchJson, {
    revalidateOnFocus: false,
  });
  const saved = data?.exports ?? [];
  if (!saved.length) return null;

  const remove = async (id: string) => {
    await mutate(
      async (current) => {
        const res = await fetch(`${exportsKey(project.id)}?exportId=${id}`, { method: "DELETE" });
        if (!res.ok) throw new Error();
        return { exports: (current?.exports ?? []).filter((item) => item.id !== id) };
      },
      {
        optimisticData: (current) => ({ exports: (current?.exports ?? []).filter((item) => item.id !== id) }),
        rollbackOnError: true,
        revalidate: false,
      }
    ).catch(() => {});
  };

  return (
    <section className={cn("mt-14 border-t border-hairline pt-8 sm:mt-20 sm:pt-10", className)}>
      <h2 className="flex items-baseline gap-2 text-[17px] font-semibold tracking-[-0.01em] text-heading">
        Saved clips <span className="text-[14px] font-normal tabular-nums text-subtle">{saved.length}</span>
      </h2>
      <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 sm:gap-x-4 lg:grid-cols-4 xl:grid-cols-5">
        {saved.map((item) => {
          const clip = project.clips?.find((c) => c.id === item.clipId);
          return (
            <div key={item.id} className="group flex flex-col">
              <div className="relative aspect-[9/16] overflow-hidden rounded-[14px] bg-black shadow-[0_1px_2px_rgba(16,24,40,0.06)] ring-1 ring-black/[0.04] dark:ring-white/[0.06]">
                <ClipVideo src={item.url} label={item.title} fit="contain" compact className="h-full w-full" />
              </div>
              <p dir="auto" className="mt-2.5 line-clamp-2 text-[13px] font-medium leading-snug text-heading">
                {item.title}
              </p>
              <p className="mt-1 font-mono text-[11px] tabular-nums text-subtle">
                {item.aspect} · {formatClock(item.durationSeconds)} · {formatSize(item.sizeBytes)}
              </p>
              <div className="mt-2 flex items-center gap-1.5">
                <a
                  href={item.downloadUrl}
                  className="inline-flex h-9 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-full bg-(--app-fill) text-[12px] font-medium text-heading transition-colors hover:bg-(--app-fill-strong) sm:h-8"
                >
                  <Download className="h-3.5 w-3.5" /> Download
                </a>
                {clip && <CopyIconButton clip={clip} />}
                <button
                  type="button"
                  onClick={() => remove(item.id)}
                  aria-label={`Delete ${item.title}`}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-subtle transition-colors hover:bg-(--app-fill) hover:text-danger sm:h-8 sm:w-8"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function CopyIconButton({ clip }: { clip: ClipMoment }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(postText(clip));
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      aria-label="Copy caption"
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-subtle transition-colors hover:bg-(--app-fill) hover:text-heading sm:h-8 sm:w-8"
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}
