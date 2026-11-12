"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import {
  Check,
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
import { clipFileName, downloadBlob, fetchJson, useMediaQuery } from "@/components/clipping/parts";
import { exportsKey, type ClipWorkspace, type RenderState } from "@/components/clipping/useClipWorkspace";
import { formatClock, type ClipExport, type ClipMoment, type ClipProject } from "@/lib/clips";
import { cn } from "@/lib/utils";

function postText(clip: ClipMoment): string {
  const tags = clip.hashtags.map((tag) => `#${tag}`).join(" ");
  return tags ? `${clip.caption}\n\n${tags}` : clip.caption;
}

const formatSize = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

const ASPECT_FRAME: Record<ClipExport["aspect"], string> = {
  "9:16": "aspect-[9/16] max-w-[300px]",
  "1:1": "aspect-square max-w-[340px]",
  "16:9": "aspect-video max-w-[420px]",
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
          <h3 className="text-[22px] font-semibold tracking-[-0.02em] text-heading sm:text-[20px]">Your clips</h3>
          <p className="mt-1 text-sm text-subtle">Each one is saved here as soon as it finishes rendering.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex h-11 items-center gap-1.5 rounded-full border border-hairline px-4 text-[13px] font-medium text-heading transition-colors hover:bg-(--app-fill) sm:h-10"
          >
            <Pencil className="h-3.5 w-3.5" /> Edit
          </button>
          <button
            type="button"
            onClick={downloadAll}
            disabled={!done.length}
            className={cn(INK_BUTTON, "h-11 px-5 text-[13px] max-sm:flex-1 sm:h-10")}
          >
            <Download className="h-4 w-4" />
            {clips.length > 1 ? `Download all (${done.length}/${clips.length})` : "Download"}
          </button>
        </div>
      </div>

      <div
        className={cn(
          "-mx-4 mt-6 flex snap-x snap-mandatory scroll-px-4 gap-4 overflow-x-auto px-4 pb-2 [scrollbar-width:none]",
          "sm:mx-0 sm:mt-8 sm:grid sm:snap-none sm:grid-cols-2 sm:gap-x-6 sm:gap-y-10 sm:overflow-visible sm:px-0 sm:pb-0 xl:grid-cols-3",
          clips.length === 1 && "max-sm:justify-center"
        )}
      >
        {clips.map((clip, index) => (
          <ResultCard
            key={clip.id}
            clip={clip}
            index={index}
            workspace={workspace}
            thumbnailUrl={project.thumbnailUrl}
          />
        ))}
      </div>

      <SavedClips project={project} />
    </div>
  );
}

function ResultCard({
  clip,
  index,
  workspace,
  thumbnailUrl,
}: {
  clip: ClipMoment;
  index: number;
  workspace: ClipWorkspace;
  thumbnailUrl: string | null;
}) {
  const settings = workspace.settingsFor(clip);
  const title = settings.title || clip.title;
  const render = workspace.renders[clip.id];
  const source = workspace.sources[clip.id];
  const percent = Math.round((render?.progress ?? 0) * 100);
  const duration = render?.duration ?? settings.end - settings.start;
  const fileName = clipFileName(title, index);
  const shareable = useShareableFile(render?.status === "done" ? render.url : undefined, fileName);

  return (
    <article className="flex w-[min(80vw,300px)] shrink-0 snap-center flex-col sm:w-auto">
      <div
        className={cn(
          "relative mx-auto w-full overflow-hidden rounded-[24px] bg-black shadow-[0_0_0_1px_rgba(16,24,40,0.08),0_24px_48px_-28px_rgba(16,24,40,0.45)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.08)]",
          ASPECT_FRAME[settings.aspect]
        )}
      >
        {render?.status === "done" && render.url ? (
          <video src={render.url} controls playsInline preload="metadata" className="h-full w-full object-cover" />
        ) : (
          <>
            {thumbnailUrl && (
              // eslint-disable-next-line @next/next/no-img-element -- remote YouTube thumbnail
              <img
                src={thumbnailUrl}
                alt=""
                className="absolute inset-0 h-full w-full object-cover opacity-40 blur-[2px]"
              />
            )}
            <div className="absolute inset-x-5 top-1/2 -translate-y-1/2 rounded-2xl bg-black/60 p-4 text-center text-white backdrop-blur-xl">
              {render?.status === "error" ? (
                <>
                  <p className="text-[13px] leading-relaxed">{render.error}</p>
                  <button
                    type="button"
                    onClick={() => {
                      if (source?.status === "error") workspace.retrySource(clip);
                      void workspace.exportClips([clip.id]);
                    }}
                    className="mt-3 inline-flex h-8 items-center gap-1.5 rounded-full bg-white px-3.5 text-[13px] font-medium text-[#0B0D12]"
                  >
                    <RotateCw className="h-3.5 w-3.5" /> Try again
                  </button>
                </>
              ) : render?.status === "rendering" ? (
                <>
                  <p className="font-mono text-[28px] font-semibold tabular-nums">{percent}%</p>
                  <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/15">
                    <div
                      className="h-full rounded-full bg-white transition-[width] duration-300"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                  <p className="mt-2.5 text-[12px] text-white/60">Rendering</p>
                </>
              ) : (
                <>
                  <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                  <p className="mt-2.5 text-[13px] font-medium">
                    {source?.status === "loading" ? "Cutting the clip" : "Waiting its turn"}
                  </p>
                </>
              )}
            </div>
          </>
        )}
      </div>

      <div className="mx-auto mt-4 w-full max-w-[300px]">
        <div className="flex items-center justify-between gap-2">
          <p className="font-mono text-[11px] text-subtle">
            {String(index + 1).padStart(2, "0")} · {Math.round(duration)}s
            {render?.size ? ` · ${formatSize(render.size)}` : ""}
          </p>
          <SaveStatus render={render} />
        </div>
        <h4 dir="auto" className="mt-1 line-clamp-2 text-[15px] font-semibold leading-snug text-heading">
          {title}
        </h4>

        <div className="mt-3 rounded-xl bg-(--app-fill) p-3 text-[13px] leading-relaxed text-body">
          <p dir="auto" className="whitespace-pre-line">
            {clip.caption}
          </p>
          {clip.hashtags.length > 0 && (
            <p className="mt-1.5 text-primary">{clip.hashtags.map((tag) => `#${tag}`).join(" ")}</p>
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
          ) : (
            <button
              type="button"
              disabled={render?.status !== "done"}
              onClick={() => render?.url && downloadBlob(render.url, fileName)}
              className={cn(INK_BUTTON, "h-10 min-w-0 flex-1 px-4 text-[13px] sm:h-9")}
            >
              <Download className="h-3.5 w-3.5" /> Download
            </button>
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
    <section className={cn("mt-12 sm:mt-16", className)}>
      <h3 className="text-[17px] font-semibold text-heading">
        Saved clips <span className="font-normal text-subtle">· {saved.length}</span>
      </h3>
      <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 sm:gap-x-4 lg:grid-cols-4 xl:grid-cols-5">
        {saved.map((item) => {
          const clip = project.clips?.find((c) => c.id === item.clipId);
          return (
            <div key={item.id} className="group flex flex-col">
              <div className="relative aspect-[9/16] overflow-hidden rounded-2xl bg-black">
                <video
                  src={item.url}
                  controls
                  playsInline
                  preload="metadata"
                  className="h-full w-full object-contain"
                />
              </div>
              <p className="mt-2 line-clamp-2 text-[13px] font-medium leading-snug text-heading">{item.title}</p>
              <p className="mt-0.5 font-mono text-[11px] text-subtle">
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
