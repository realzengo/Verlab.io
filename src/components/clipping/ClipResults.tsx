"use client";

import { useState } from "react";
import useSWR from "swr";
import { Check, CloudUpload, Copy, Download, Loader2, Pencil, RotateCw, Trash2, TriangleAlert } from "lucide-react";
import { INK_BUTTON } from "@/components/brand/BrandKit";
import { clipFileName, downloadBlob, fetchJson } from "@/components/clipping/parts";
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
      className="inline-flex h-9 items-center gap-1.5 rounded-full border border-hairline px-3.5 text-[13px] font-medium text-heading transition-colors hover:bg-(--app-fill)"
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? "Copied" : "Copy caption"}
    </button>
  );
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
          <h3 className="text-[20px] font-semibold tracking-[-0.02em] text-heading">Your clips</h3>
          <p className="mt-1 text-sm text-subtle">Each one is saved here as soon as it finishes rendering.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex h-10 items-center gap-1.5 rounded-full border border-hairline px-4 text-[13px] font-medium text-heading transition-colors hover:bg-(--app-fill)"
          >
            <Pencil className="h-3.5 w-3.5" /> Edit
          </button>
          <button
            type="button"
            onClick={downloadAll}
            disabled={!done.length}
            className={cn(INK_BUTTON, "h-10 px-5 text-[13px]")}
          >
            <Download className="h-4 w-4" />
            {clips.length > 1 ? `Download all (${done.length}/${clips.length})` : "Download"}
          </button>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 xl:grid-cols-3">
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

  return (
    <article className="flex flex-col">
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
        <h4 className="mt-1 line-clamp-2 text-[15px] font-semibold leading-snug text-heading">{title}</h4>

        <div className="mt-3 rounded-xl bg-(--app-fill) p-3 text-[13px] leading-relaxed text-body">
          <p className="whitespace-pre-line">{clip.caption}</p>
          {clip.hashtags.length > 0 && (
            <p className="mt-1.5 text-primary">{clip.hashtags.map((tag) => `#${tag}`).join(" ")}</p>
          )}
        </div>

        <div className="mt-3 flex gap-2">
          <button
            type="button"
            disabled={render?.status !== "done"}
            onClick={() => render?.url && downloadBlob(render.url, clipFileName(title, index))}
            className={cn(INK_BUTTON, "h-9 flex-1 px-4 text-[13px]")}
          >
            <Download className="h-3.5 w-3.5" /> Download
          </button>
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
    <section className={cn("mt-16", className)}>
      <h3 className="text-[17px] font-semibold text-heading">
        Saved clips <span className="font-normal text-subtle">· {saved.length}</span>
      </h3>
      <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
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
                  className="inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-full bg-(--app-fill) text-[12px] font-medium text-heading transition-colors hover:bg-(--app-fill-strong)"
                >
                  <Download className="h-3.5 w-3.5" /> Download
                </a>
                {clip && <CopyIconButton clip={clip} />}
                <button
                  type="button"
                  onClick={() => remove(item.id)}
                  aria-label={`Delete ${item.title}`}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-subtle transition-colors hover:bg-(--app-fill) hover:text-danger"
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

function CopyIconButton({ clip }: { clip: ClipMoment }) {
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
      className="flex h-8 w-8 items-center justify-center rounded-full text-subtle transition-colors hover:bg-(--app-fill) hover:text-heading"
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}
