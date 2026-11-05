"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  AlignLeft,
  Clapperboard,
  Clock,
  Copy,
  Download,
  Info,
  Loader2,
  Maximize2,
  MoreVertical,
  Pencil,
  RotateCcw,
  Trash2,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import useSWR from "swr";
import { GLASS_PILL_ACTIVE, GLASS_PILL_FOCUS, GLASS_PILL_IDLE, PillDropdown } from "@/components/ui/PillDropdown";
import { PlasticButton } from "@/components/ui/plastic-button";
import { CreditCost } from "@/components/ui/CreditCost";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { TopUpModal } from "@/components/TopUpModal";
import { UpgradeModal } from "@/components/pricing/UpgradeModal";
import { CREDITS_CHANGED_EVENT, notifyCreditsChanged } from "@/lib/client/credits-bus";
import { readHistoryCache, writeHistoryCache } from "@/lib/client/history-cache";
import { consumeImageToVideoHandoff } from "@/lib/client/image-to-video-handoff";
import {
  DEFAULT_VIDEO_MODEL,
  VIDEO_MODELS,
  getVideoModel,
  DEFAULT_EDIT_VIDEO_MODEL,
  EDIT_VIDEO_MODELS,
  getEditVideoModel,
  CLONE_TOOLS,
  CLONE_TOOL_MODES,
  cloneNeedsFrameStage,
  getCloneMode,
  getCloneTool,
  getCloneToolMode,
  type CloneRequest,
  type CloneRequestBase,
  type CloneResolution,
  type CloneToolId,
} from "@/lib/config/video-models";
import { getVideoCloneCost, getVideoGenerationCost, getVideoPromptEditCost } from "@/lib/config/pricing";
import { isSafeFreeText, FREE_TEXT_MAX } from "@/lib/validation";
import { pollUntilSettled } from "@/lib/polling";
import { cn, formatDate } from "@/lib/utils";
import { createClient as createBrowserClient } from "@/lib/supabase/client";
import { VideoModelPicker, ModelIcon } from "./video-generator/VideoModelPicker";
import { FrameImagePicker, EMPTY_FRAME_SLOT, type FrameSlotState } from "./video-generator/FrameImagePicker";
import { ReferencesPicker, ReferenceImageChips } from "./video-generator/ReferencesPicker";
import { MentionTextarea } from "./video-generator/MentionTextarea";
import { PromptExpandModal } from "./video-generator/PromptExpandModal";
import { ReferenceImagesPicker } from "./video-generator/ReferenceImagesPicker";
import { SourceVideoPicker } from "./video-generator/SourceVideoPicker";
import { MobileCreatePanel } from "./video-generator/MobileCreatePanel";
import { MobileEditPanel } from "./video-generator/MobileEditPanel";
import { LowCreditBanner } from "./video-generator/LowCreditBanner";
import { CloneComposer, type CloneSourceState } from "./video-generator/CloneComposer";
import type { NormalizedVideo } from "@/lib/client/video-normalize";

type VideoMode = "create" | "edit" | "motion";

const MODE_TABS: { id: VideoMode; label: string; icon: LucideIcon }[] = [
  { id: "create", label: "Create", icon: Clapperboard },
  { id: "edit", label: "Edit", icon: Pencil },
  // Stored as mode "motion" in video_generations -- "Clone" is the UI name.
  { id: "motion", label: "Clone", icon: Copy },
];

interface GenerationHistoryItem {
  id: string;
  mode: VideoMode;
  operation: string;
  model: string;
  prompt: string | null;
  params: {
    durationSeconds?: number;
    aspectRatio?: string;
    resolution?: string;
    soundEnabled?: boolean;
    sourceGenerationId?: string;
    keepOriginalSound?: boolean;
    matchBackground?: boolean;
  };
  output_video_path: string | null;
  thumbnail_path: string | null;
  status: "queued" | "processing" | "completed" | "failed";
  error_message: string | null;
  credits_quoted: number;
  created_at: string;
}

interface ModelSettings {
  durationSeconds: number;
  aspectRatio: string;
  resolution: string;
  outputs: number;
  soundEnabled: boolean;
}

function defaultSettingsFor(modelId: string): ModelSettings {
  const model = getVideoModel(modelId) ?? VIDEO_MODELS[0];
  return {
    durationSeconds: model.durations[0],
    aspectRatio: model.aspectRatios.includes("9:16") ? "9:16" : model.aspectRatios[0],
    resolution: model.resolutions?.[0] ?? "",
    outputs: 1,
    soundEnabled: model.supportsAudio,
  };
}

const OUTPUT_OPTIONS = [1, 2, 3, 4].map((value) => ({ value: String(value), label: `${value} Output${value > 1 ? "s" : ""}` }));

// Video renders genuinely take a couple of minutes (see STALE_JOB_MS in
// generate-video/route.ts) -- a bare spinner with no sense of progress reads
// as hung well before that. Ticks once a second while `active`, resetting
// whenever a new generation starts.
function useElapsedSeconds(active: boolean): number {
  const [seconds, setSeconds] = useState(0);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    if (!active) {
      startRef.current = null;
      return;
    }
    startRef.current = Date.now();
    const id = setInterval(() => {
      if (startRef.current) setSeconds(Math.floor((Date.now() - startRef.current) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [active]);

  return active ? seconds : 0;
}

function formatElapsed(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

// Uploaded/generated clips rarely land on a whole second, so printing
// item.params.durationSeconds directly shows noise like "8.333333s" -- round
// to one decimal and drop it entirely for whole seconds ("8s" not "8.0s").
function formatClipSeconds(seconds: number): string {
  const rounded = Math.round(seconds * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded}` : rounded.toFixed(1);
}

function aspectRatioLabel(ratio: string | undefined): string {
  if (!ratio) return "N/A";
  if (ratio === "9:16") return `Portrait (${ratio})`;
  if (ratio === "16:9") return `Landscape (${ratio})`;
  if (ratio === "1:1") return `Square (${ratio})`;
  return ratio;
}

// Upload limits. Every source clip is re-encoded in the browser before it's
// stored (see video-normalize.ts), so the original can be large -- it's read
// lazily, never held whole in memory -- but the converted file must fit
// Supabase's project-wide ~50MB Storage cap, which rejects bigger uploads
// regardless of the videos bucket's own limit. The JSON payload cap keeps the
// frame + up to 12 references under Vercel's ~4.5MB request-body limit.
const SOURCE_MAX_INPUT_BYTES = 2 * 1024 * 1024 * 1024;
const SOURCE_MAX_STORED_BYTES = 50 * 1024 * 1024;
const SOURCE_VIDEO_EXTENSIONS = /\.(mp4|mov|m4v|webm|mkv)$/i;
const CLONE_MAX_PAYLOAD_CHARS = 4_000_000;
const CLONE_FRAME_MAX_DIMENSION = 1280;
const CLONE_ASPECT_RATIOS = ["9:16", "3:4", "1:1", "4:3", "16:9"];
// The source clip is shared across tools, so uploads are gated on the
// loosest bounds any tool accepts; each tool then flags a clip outside its own.
const CLONE_MIN_SOURCE_SECONDS = Math.min(...CLONE_TOOL_MODES.map((mode) => mode.minSourceDurationSeconds));
const CLONE_MAX_SOURCE_SECONDS = Math.max(...CLONE_TOOL_MODES.map((mode) => mode.maxSourceDurationSeconds));

/** The attached clip plus what the submit path needs: its first frame, ratio hint and pixel size (checked per model). */
type CloneSourceDetails = CloneSourceState & { frameImage: string; aspectRatio: string; width: number; height: number };

/** Each Clone tool keeps its own inputs, so switching tools never mangles another's (12 references vs one character photo). */
interface CloneToolDraft {
  images: string[];
  prompt: string;
  resolution: CloneResolution;
}

function initialCloneDrafts(): Record<CloneToolId, CloneToolDraft> {
  const drafts = {} as Record<CloneToolId, CloneToolDraft>;
  for (const tool of CLONE_TOOLS) {
    drafts[tool.id] = { images: [], prompt: "", resolution: getCloneToolMode(tool, true).resolutions[0] };
  }
  return drafts;
}

function nearestAspectRatio(width: number, height: number): string {
  const target = Math.log(width / height);
  return CLONE_ASPECT_RATIOS.reduce((best, ratio) => {
    const [w, h] = ratio.split(":").map(Number);
    const [bw, bh] = best.split(":").map(Number);
    return Math.abs(Math.log(w / h) - target) < Math.abs(Math.log(bw / bh) - target) ? ratio : best;
  });
}

// Reads a clip's duration, size and first frame in the browser -- the server
// has no ffmpeg, and the Clone pipeline's frame stage starts from that first
// frame (see video-clone.ts). Takes a fresh upload's object URL or a
// same-origin library URL alike (same-origin keeps the canvas untainted).
function inspectVideoSource(src: string): Promise<{ durationSeconds: number; width: number; height: number; frameDataUrl: string }> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    const release = () => {
      video.removeAttribute("src");
      video.load();
    };
    const fail = () => {
      release();
      reject(new Error("Couldn't read this video in your browser. Try an MP4 (H.264) file."));
    };
    video.onerror = fail;
    video.onloadedmetadata = () => {
      if (!video.videoWidth || !Number.isFinite(video.duration)) return fail();
      // A hair past 0 -- some encoders leave the very first frame black.
      video.currentTime = Math.min(0.05, video.duration / 2);
    };
    video.onseeked = () => {
      const scale = Math.min(1, CLONE_FRAME_MAX_DIMENSION / Math.max(video.videoWidth, video.videoHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) return fail();
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const result = { durationSeconds: video.duration, width: video.videoWidth, height: video.videoHeight, frameDataUrl: canvas.toDataURL("image/jpeg", 0.88) };
      release();
      resolve(result);
    };
    video.src = src;
  });
}

// Compact form ("14h ago") for the preview panel -- formatRelativeTime's
// "14 hours ago" is too wide for the sidebar's two-column info grid.
function formatCompactRelative(iso: string): string {
  const diffSeconds = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (diffSeconds < 60) return "just now";
  const diffMinutes = Math.round(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.round(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  return formatDate(iso);
}

// Round-robins items across N columns (left-to-right, then wraps) instead of
// filling one column at a time, so newest-first order still reads across the
// row -- see the column-count comment above where `galleryColumns` is set.
// Always renders the full column count, even with fewer items than columns
// -- collapsing to items.length columns made a lone generation (e.g. a first
// failed render) stretch across the whole page instead of sitting at the
// same tile size as every other result.
function distributeColumns<T>(items: T[], columnCount: number): T[][] {
  const columns: T[][] = Array.from({ length: columnCount }, () => []);
  items.forEach((item, index) => columns[index % columnCount].push(item));
  return columns;
}

const VIDEO_TILE_MENU_WIDTH = 128; // px -- w-32

function VideoTile({
  item,
  elapsedSeconds,
  onPreview,
  onRecreate,
  onEdit,
  onDownload,
  onDelete,
}: {
  item: GenerationHistoryItem;
  elapsedSeconds: number;
  onPreview: () => void;
  onRecreate: () => void;
  onEdit: () => void;
  onDownload: () => void;
  onDelete: () => void;
}) {
  const aspectRatio = item.params.aspectRatio ?? "16:9";
  const [w, h] = aspectRatio.split(":").map(Number);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  // The stored aspect ratio is the preset picked at generation time, which
  // doesn't always match the actual output (e.g. a source video's native
  // ratio surviving an edit) -- once the real video loads, correct the tile
  // to its true ratio instead of leaving it in the wrong-shaped box.
  const [naturalAspect, setNaturalAspect] = useState<number | null>(null);
  const tileAspectRatio = naturalAspect ?? w / h;

  // The "more" menu used to render as an absolutely-positioned child of the
  // tile itself, clipped to that tile's own bounds -- on a short/portrait
  // clip the dropdown had nowhere to go but overlap the bottom action bar
  // inside the same card. Portaling it to <body> and positioning it from the
  // button's real screen coordinates (mirrors ImageGenerator.tsx's
  // HistoryTile menu) lets it float above every tile instead of being
  // trapped inside one.
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const [portalTarget, setPortalTarget] = useState<Element | null>(null);
  const moreButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => setPortalTarget(document.body), []);

  useEffect(() => {
    if (!menuOpen) return;
    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (menuRef.current?.contains(target) || moreButtonRef.current?.contains(target)) return;
      setMenuOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [menuOpen]);

  function toggleMenu(event: React.MouseEvent) {
    event.stopPropagation();
    if (!menuOpen && moreButtonRef.current) {
      const rect = moreButtonRef.current.getBoundingClientRect();
      setMenuPos({
        top: rect.bottom + 6,
        left: Math.max(8, Math.min(rect.right - VIDEO_TILE_MENU_WIDTH, window.innerWidth - VIDEO_TILE_MENU_WIDTH - 8)),
      });
    }
    setMenuOpen((prev) => !prev);
  }

  if (item.status === "queued" || item.status === "processing") {
    const isRendering = item.status === "processing";
    return (
      <div
        className="relative block w-full overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-b from-slate-50 to-slate-100 dark:border-zinc-800 dark:from-zinc-900 dark:to-zinc-950"
        style={{ aspectRatio: `${w} / ${h}` }}
      >
        <div className="absolute -left-1/4 -top-1/4 h-3/4 w-3/4 rounded-full bg-indigo-300/25 blur-3xl animate-render-drift dark:bg-indigo-500/10" />
        <div className="absolute -bottom-1/4 -right-1/4 h-3/4 w-3/4 rounded-full bg-sky-300/20 blur-3xl animate-render-drift-alt dark:bg-sky-500/10" />

        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
          <div className="relative flex h-9 w-9 items-center justify-center">
            <div className="absolute inset-0 rounded-full bg-indigo-400/20 blur-lg animate-craft-glow" />
            <div className="absolute inset-0 rounded-full bg-white/80 ring-1 ring-slate-200/70 dark:bg-white/5 dark:ring-white/10" />
            <div className="absolute inset-0 rounded-full animate-render-orb" />
          </div>

          <div className="flex flex-col items-center gap-1">
            <span className="flex items-center gap-1 text-[12px] font-semibold tracking-tight text-slate-600 dark:text-slate-300">
              {item.status === "queued" ? "Queued" : "Rendering"}
              {isRendering && (
                <span className="ml-0.5 flex items-center gap-0.5" aria-hidden>
                  <span className="h-1 w-1 rounded-full bg-current opacity-30 animate-dot-pulse [animation-delay:0ms]" />
                  <span className="h-1 w-1 rounded-full bg-current opacity-30 animate-dot-pulse [animation-delay:200ms]" />
                  <span className="h-1 w-1 rounded-full bg-current opacity-30 animate-dot-pulse [animation-delay:400ms]" />
                </span>
              )}
            </span>
            {isRendering && (
              <span className="text-[10px] tabular-nums text-slate-400 dark:text-slate-500">
                {formatElapsed(elapsedSeconds)} · usually takes 2–4 min
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (item.status === "failed") {
    return (
      <div
        className="group relative flex w-full flex-col items-center justify-center gap-1.5 overflow-hidden rounded-2xl border border-red-200 bg-red-50 p-3 text-center dark:border-red-500/20 dark:bg-red-500/5"
        style={{ aspectRatio: `${w} / ${h}` }}
      >
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onDelete();
          }}
          aria-label="Delete"
          className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-white/80 text-red-500 opacity-0 backdrop-blur-sm transition-opacity duration-150 hover:bg-white group-hover:opacity-100 dark:bg-black/40 dark:hover:bg-black/60"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
        <span className="text-[11px] font-medium text-red-500">{item.error_message ?? "Generation failed"}</span>
      </div>
    );
  }

  const model = getVideoModel(item.model) ?? getEditVideoModel(item.model) ?? getCloneMode(item.model);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onPreview}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") onPreview();
      }}
      className="group relative block w-full cursor-pointer overflow-hidden rounded-2xl border border-slate-200 bg-black outline-none dark:border-zinc-800"
      style={{ aspectRatio: String(tileAspectRatio) }}
    >
      <video
        src={`/api/library/video/${item.id}`}
        poster={item.thumbnail_path ? `/api/library/video/${item.id}?variant=thumbnail` : undefined}
        muted
        loop
        playsInline
        preload="metadata"
        onLoadedMetadata={(event) => {
          const { videoWidth, videoHeight } = event.currentTarget;
          if (videoWidth > 0 && videoHeight > 0) setNaturalAspect(videoWidth / videoHeight);
        }}
        onMouseEnter={(event) => void event.currentTarget.play().catch(() => {})}
        onMouseLeave={(event) => event.currentTarget.pause()}
        className="h-full w-full object-cover"
      />

      {model && (
        <div className="pointer-events-none absolute left-2 top-2 flex items-center gap-1.5 rounded-full bg-black/60 px-2 py-1 opacity-0 backdrop-blur-sm transition-opacity duration-150 group-hover:opacity-100">
          <ModelIcon model={model} small />
          <span className="truncate text-[11px] font-semibold text-white">{model.id}</span>
          {item.params.durationSeconds && <span className="shrink-0 text-[11px] text-white/60">· {formatClipSeconds(item.params.durationSeconds)}s</span>}
          {item.params.resolution && <span className="shrink-0 text-[11px] text-white/60">· {item.params.resolution}</span>}
        </div>
      )}

      <div className="absolute right-2 top-2 flex flex-col gap-1.5 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onPreview();
          }}
          aria-label="Expand"
          className="flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm transition-colors hover:bg-black/80"
        >
          <Maximize2 className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onDownload();
          }}
          aria-label="Download"
          className="flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm transition-colors hover:bg-black/80"
        >
          <Download className="h-3.5 w-3.5" />
        </button>
        <button
          ref={moreButtonRef}
          type="button"
          onClick={toggleMenu}
          aria-label="More options"
          aria-expanded={menuOpen}
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm transition-colors hover:bg-black/80",
            menuOpen && "bg-black/80"
          )}
        >
          <MoreVertical className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="absolute inset-x-2 bottom-2 flex items-center gap-1.5 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onRecreate();
          }}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1.5 text-[11px] font-semibold text-white backdrop-blur-sm transition-colors hover:bg-black/80"
        >
          <RotateCcw className="h-3 w-3" /> Recreate
        </button>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onEdit();
          }}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1.5 text-[11px] font-semibold text-white backdrop-blur-sm transition-colors hover:bg-black/80"
        >
          <Pencil className="h-3 w-3" /> Edit
        </button>
      </div>

      {portalTarget &&
        menuPos &&
        createPortal(
          <AnimatePresence>
            {menuOpen && (
              <motion.div
                ref={menuRef}
                initial={{ opacity: 0, y: -4, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.97 }}
                transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
                style={{ top: menuPos.top, left: menuPos.left, width: VIDEO_TILE_MENU_WIDTH }}
                className="fixed z-[110] origin-top-right overflow-hidden rounded-xl border border-slate-200/70 bg-white/95 shadow-[0_20px_45px_-12px_rgba(15,23,42,0.18)] backdrop-blur-xl dark:border-white/[0.08] dark:bg-zinc-900/95"
                onClick={(event) => event.stopPropagation()}
              >
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onEdit();
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/[0.06]"
                >
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onDelete();
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-red-500 transition-colors hover:bg-red-50 dark:hover:bg-red-500/10"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </button>
              </motion.div>
            )}
          </AnimatePresence>,
          portalTarget
        )}
    </div>
  );
}

export function VideoGenerator() {
  const [activeTab, setActiveTab] = useState<VideoMode>("create");
  // Mobile-only Generate/History toggle (competitor-parity phone layout,
  // see MobileCreatePanel) -- desktop never surfaces the control that
  // changes this, so it stays "generate" there for the lifetime of the page.
  const [mobileView, setMobileView] = useState<"generate" | "history">("generate");

  const [prompt, setPrompt] = useState("");
  const [selectedModel, setSelectedModel] = useState(DEFAULT_VIDEO_MODEL);
  const [modelSettings, setModelSettings] = useState<Record<string, ModelSettings>>({});
  const model = getVideoModel(selectedModel) ?? VIDEO_MODELS[0];

  // Derived directly from render rather than corrected in an effect: a
  // stored duration/aspect-ratio that isn't valid for the *current* model
  // (e.g. switching from an 8s-only model to a 5s/10s one) falls back to
  // that model's default on the spot, no extra render/setState round trip.
  const settings = useMemo(() => {
    const stored = modelSettings[selectedModel];
    const fallback = defaultSettingsFor(selectedModel);
    if (!stored) return fallback;
    return {
      ...stored,
      durationSeconds: model.durations.includes(stored.durationSeconds) ? stored.durationSeconds : fallback.durationSeconds,
      aspectRatio: model.aspectRatios.includes(stored.aspectRatio) ? stored.aspectRatio : fallback.aspectRatio,
      resolution: model.resolutions?.includes(stored.resolution) ? stored.resolution : fallback.resolution,
    };
  }, [modelSettings, selectedModel, model]);
  const { durationSeconds, aspectRatio, resolution, outputs, soundEnabled } = settings;

  function updateSettings(patch: Partial<ModelSettings>) {
    setModelSettings((prev) => ({ ...prev, [selectedModel]: { ...(prev[selectedModel] ?? defaultSettingsFor(selectedModel)), ...patch } }));
  }

  const [startFrame, setStartFrame] = useState<FrameSlotState>(EMPTY_FRAME_SLOT);
  const [endFrame, setEndFrame] = useState<FrameSlotState>(EMPTY_FRAME_SLOT);
  // Style/subject reference images -- separate input from startFrame/endFrame
  // above (see ReferencesPicker's module comment): guides likeness/style
  // rather than pinning a specific frame, sent as its own field to the model.
  const [referenceImages, setReferenceImages] = useState<string[]>([]);
  const [showPromptModal, setShowPromptModal] = useState(false);

  // Recent Generations renders as independent flex columns (see
  // distributeColumns below) instead of a CSS grid so items keep their own
  // aspect ratio instead of stretching to match the tallest tile in their
  // row -- a fixed grid leaves dead space under every shorter tile in a row
  // once a portrait clip sets that row's height. Column count tracks the
  // same breakpoints the old `sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5`
  // classes used (plus a 6th column at 2xl so tiles stay a sensible size on
  // very wide screens), since the distribution has to happen in JS.
  const [galleryColumns, setGalleryColumns] = useState(2);
  useEffect(() => {
    function updateGalleryColumns() {
      const width = window.innerWidth;
      setGalleryColumns(width >= 1536 ? 6 : width >= 1280 ? 5 : width >= 1024 ? 4 : width >= 640 ? 3 : 2);
    }
    updateGalleryColumns();
    window.addEventListener("resize", updateGalleryColumns);
    return () => window.removeEventListener("resize", updateGalleryColumns);
  }, []);

  const [isGenerating, setIsGenerating] = useState(false);
  const createElapsedSeconds = useElapsedSeconds(isGenerating);
  const [pendingCount, setPendingCount] = useState(0);
  const [pendingAspectRatio, setPendingAspectRatio] = useState(aspectRatio);
  const [error, setError] = useState<string | null>(null);
  const [showTopUp, setShowTopUp] = useState(false);
  const [isPro, setIsPro] = useState(false);
  const [isScale, setIsScale] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);

  const { data: creditsSummary, mutate: mutateCredits } = useSWR<{ balance: number }>("/api/credits/summary");
  const creditBalance = creditsSummary?.balance ?? null;
  useEffect(() => {
    const handleCreditsChanged = () => void mutateCredits();
    window.addEventListener(CREDITS_CHANGED_EVENT, handleCreditsChanged);
    return () => window.removeEventListener(CREDITS_CHANGED_EVENT, handleCreditsChanged);
  }, [mutateCredits]);

  const {
    data: historyData,
    mutate: mutateHistory,
  } = useSWR<{ generations: GenerationHistoryItem[] }>("/api/generate-video?mode=create", {
    fallbackData: (() => {
      const cached = readHistoryCache<GenerationHistoryItem>("video-create");
      return cached ? { generations: cached } : undefined;
    })(),
    onSuccess: (data) => {
      const items = data.generations ?? [];
      const stillPending = items.filter((item) => item.status === "queued" || item.status === "processing").map((item) => item.id);
      if (stillPending.length > 0 && !pollCancelRef.current) {
        setIsGenerating(true);
        pollGenerationStatus(stillPending);
      }
    },
  });
  const history = historyData?.generations ?? null;
  const [previewItem, setPreviewItem] = useState<GenerationHistoryItem | null>(null);
  // Portal target for the preview modal -- deferred to an effect (not read
  // at module/render time) so the initial server render never touches
  // `document`, which doesn't exist there.
  const [previewPortalTarget, setPreviewPortalTarget] = useState<Element | null>(null);
  useEffect(() => setPreviewPortalTarget(document.body), []);
  const [promptCopied, setPromptCopied] = useState(false);
  // Purely a same-tick UI affordance -- the actual download is a same-origin
  // navigation (see downloadVideo), which we can't observe completion of, so
  // this just gives the dock button a brief pressed/spinner state instead of
  // looking like a dead click.
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  function copyPreviewPrompt() {
    if (!previewItem?.prompt) return;
    void navigator.clipboard.writeText(previewItem.prompt).then(() => {
      setPromptCopied(true);
      setTimeout(() => setPromptCopied(false), 1500);
    });
  }
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const pollCancelRef = useRef<(() => void) | null>(null);
  const pendingIdsRef = useRef<Set<string>>(new Set());

  const promptTooLong = Boolean(model.maxPromptLength) && prompt.length > model.maxPromptLength!;
  // Character-safety gate (control chars / raw HTML tags) -- separate from
  // the length check above, which already has its own message/UI. Skipped
  // when the prompt is empty (an empty prompt is legal when a start/end
  // frame is attached) so this never blocks image-to-video-only submits.
  const promptUnsafe = prompt.trim().length > 0 && !isSafeFreeText(prompt, model.maxPromptLength ?? FREE_TEXT_MAX);
  const canSubmit =
    (prompt.trim().length > 0 || Boolean(startFrame.dataUrl) || Boolean(endFrame.dataUrl)) &&
    !isGenerating &&
    !promptTooLong &&
    !promptUnsafe;
  const estimatedCost = getVideoGenerationCost({ model: selectedModel, durationSeconds, outputs, resolution: model.resolutions ? resolution : undefined }) || 0;

  function pollGenerationStatus(ids: string[]) {
    pollCancelRef.current?.();
    pendingIdsRef.current = new Set(ids);
    setPendingCount(pendingIdsRef.current.size);

    pollCancelRef.current = pollUntilSettled<GenerationHistoryItem[]>(
      async () => {
        const response = await fetch("/api/generate-video?mode=create");
        if (!response.ok) throw new Error();
        const data = await response.json();
        return data.generations ?? [];
      },
      () => pendingIdsRef.current.size === 0,
      (items) => {
        mutateHistory({ generations: items }, { revalidate: false });

        const settled = [...pendingIdsRef.current].filter((id) => {
          const match = items.find((item) => item.id === id);
          return match && match.status !== "queued" && match.status !== "processing";
        });

        if (settled.length > 0) {
          for (const id of settled) pendingIdsRef.current.delete(id);
          notifyCreditsChanged();

          const failed = settled.map((id) => items.find((item) => item.id === id)).find((item) => item?.status === "failed");
          if (failed) setError(failed.error_message ?? "Something went wrong. Try again.");
        }

        setPendingCount(pendingIdsRef.current.size);
        if (pendingIdsRef.current.size === 0) setIsGenerating(false);
      },
      {
        intervalMs: 4000,
        // Video renders regularly take minutes -- much longer than the
        // image tool's poll timeout -- but the server-side backstop
        // (STALE_JOB_MS in generate-video/route.ts) guarantees every row
        // leaves queued/processing well inside this window either way.
        timeoutMs: 21 * 60 * 1000,
        onTimeout: () => {
          setError("This is taking longer than expected. Please try again.");
          setIsGenerating(false);
          setPendingCount(0);
        },
      }
    );
  }

  useEffect(() => {
    return () => pollCancelRef.current?.();
  }, []);

  // Gates Scale-only models (Sora 2, Seedance 2.5) in the model pickers below.
  useEffect(() => {
    const supabase = createBrowserClient();
    supabase.auth.getUser().then(({ data }) => {
      const userId = data.user?.id;
      if (!userId) return;
      supabase
        .from("profiles")
        .select("plan")
        .eq("id", userId)
        .single()
        .then(({ data: profile }) => {
          setIsPro(profile?.plan === "pro" || profile?.plan === "scale");
          setIsScale(profile?.plan === "scale");
        });
    });
  }, []);

  // Mirrors every history update into localStorage so the next mount (tab
  // revisit, full refresh) can hydrate its initial state from here instead
  // of rendering an empty grid until the fetch above resolves.
  useEffect(() => {
    if (history) writeHistoryCache("video-create", history);
  }, [history]);

  // Picks up an image handed off from the Image Generator's "Animate" action
  // (see ImageGenerator.tsx) -- lands it as the Create tab's start frame,
  // ready for image-to-video. Must run post-mount, not as a lazy useState
  // initializer: this component is server-rendered first (sessionStorage
  // doesn't exist there), and reading browser storage during the initial
  // client render would create a hydration mismatch against that empty
  // server-rendered output.
  useEffect(() => {
    const handoff = consumeImageToVideoHandoff();
    if (!handoff) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydration from sessionStorage, not a derived/external sync
    setActiveTab("create");
    setMobileView("generate");
    setStartFrame({ dataUrl: handoff.imageDataUrl, mode: "upload" });
  }, []);

  // ── Edit tab state ───────────────────────────────────────────────────
  // Mirrors the Create tab's history/poll pattern above (own state, own
  // pollUntilSettled loop) rather than a shared generic -- only two tabs
  // need this, and Create's version stays untouched/provably-working this way.
  const [editSource, setEditSource] = useState<GenerationHistoryItem | null>(null);
  const [editPrompt, setEditPrompt] = useState("");
  const [editModel, setEditModel] = useState(DEFAULT_EDIT_VIDEO_MODEL);
  const [editReferenceImages, setEditReferenceImages] = useState<string[]>([]);
  const [isGeneratingEditReference, setIsGeneratingEditReference] = useState(false);
  const [editOutputs, setEditOutputs] = useState(1);
  const [editIsGenerating, setEditIsGenerating] = useState(false);
  const editElapsedSeconds = useElapsedSeconds(editIsGenerating);
  const [editPendingCount, setEditPendingCount] = useState(0);
  const [editError, setEditError] = useState<string | null>(null);
  const editPollCancelRef = useRef<(() => void) | null>(null);
  const editPendingIdsRef = useRef<Set<string>>(new Set());

  const {
    data: editHistoryData,
    mutate: mutateEditHistory,
  } = useSWR<{ generations: GenerationHistoryItem[] }>("/api/generate-video?mode=edit", {
    fallbackData: (() => {
      const cached = readHistoryCache<GenerationHistoryItem>("video-edit");
      return cached ? { generations: cached } : undefined;
    })(),
    onSuccess: (data) => {
      const items = data.generations ?? [];
      const stillPending = items.filter((item) => item.status === "queued" || item.status === "processing").map((item) => item.id);
      if (stillPending.length > 0 && !editPollCancelRef.current) {
        setEditIsGenerating(true);
        pollEditGenerationStatus(stillPending);
      }
    },
  });
  const editHistory = editHistoryData?.generations ?? null;
  const [isUploadingSource, setIsUploadingSource] = useState(false);

  const editModelConfig = getEditVideoModel(editModel) ?? EDIT_VIDEO_MODELS[0];
  const editSourceDurationSeconds = editSource?.params.durationSeconds ?? null;
  const editSourceDurationValid =
    editSourceDurationSeconds != null &&
    editSourceDurationSeconds >= editModelConfig.minSourceDurationSeconds &&
    editSourceDurationSeconds <= editModelConfig.maxSourceDurationSeconds;
  // Edit models have no confirmed per-model prompt-length cap (see
  // PromptEditModelConfig in video-models.ts), so this only enforces
  // character safety plus the shared free-text default length.
  const editPromptUnsafe = editPrompt.trim().length > 0 && !isSafeFreeText(editPrompt, FREE_TEXT_MAX);
  const canSubmitEdit =
    Boolean(editSource) && editPrompt.trim().length > 0 && editSourceDurationValid && !editIsGenerating && !editPromptUnsafe;
  const estimatedEditCost = editSourceDurationSeconds
    ? getVideoPromptEditCost({ model: editModel, sourceDurationSeconds: editSourceDurationSeconds, outputs: editOutputs })
    : 0;

  function pollEditGenerationStatus(ids: string[]) {
    editPollCancelRef.current?.();
    editPendingIdsRef.current = new Set(ids);
    setEditPendingCount(editPendingIdsRef.current.size);

    editPollCancelRef.current = pollUntilSettled<GenerationHistoryItem[]>(
      async () => {
        const response = await fetch("/api/generate-video?mode=edit");
        if (!response.ok) throw new Error();
        const data = await response.json();
        return data.generations ?? [];
      },
      () => editPendingIdsRef.current.size === 0,
      (items) => {
        mutateEditHistory({ generations: items }, { revalidate: false });

        const settled = [...editPendingIdsRef.current].filter((id) => {
          const match = items.find((item) => item.id === id);
          return match && match.status !== "queued" && match.status !== "processing";
        });

        if (settled.length > 0) {
          for (const id of settled) editPendingIdsRef.current.delete(id);
          notifyCreditsChanged();

          const failed = settled.map((id) => items.find((item) => item.id === id)).find((item) => item?.status === "failed");
          if (failed) setEditError(failed.error_message ?? "Something went wrong. Try again.");
        }

        setEditPendingCount(editPendingIdsRef.current.size);
        if (editPendingIdsRef.current.size === 0) setEditIsGenerating(false);
      },
      {
        intervalMs: 4000,
        timeoutMs: 21 * 60 * 1000,
        onTimeout: () => {
          setEditError("This is taking longer than expected. Please try again.");
          setEditIsGenerating(false);
          setEditPendingCount(0);
        },
      }
    );
  }

  useEffect(() => {
    return () => editPollCancelRef.current?.();
  }, []);

  useEffect(() => {
    if (editHistory) writeHistoryCache("video-edit", editHistory);
  }, [editHistory]);

  async function handleGenerateEdit() {
    if (!canSubmitEdit || !editSource) return;

    setEditIsGenerating(true);
    setEditError(null);

    try {
      const response = await fetch("/api/generate-video/edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceGenerationId: editSource.id,
          prompt: editPrompt.trim(),
          model: editModel,
          referenceImages: editReferenceImages,
          outputs: editOutputs,
        }),
      });

      if (response.status === 402) {
        setShowTopUp(true);
        setEditIsGenerating(false);
        return;
      }

      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error ?? "Failed to start edit.");

      pollEditGenerationStatus(data.ids);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Something went wrong. Try again.");
      setEditIsGenerating(false);
      setEditPendingCount(0);
    }
  }

  // Re-encodes a picked clip into the one shape every video model accepts
  // (H.264, square pixels, rotation baked in, <=1080p/30fps -- see
  // video-normalize.ts for the failures this prevents), entirely in the
  // browser. Shared by the Edit and Clone uploads so neither can store a file
  // a model will later refuse.
  async function prepareSourceVideo(
    file: File,
    options: { minSeconds: number; maxSeconds: number; onProgress?: (progress: number) => void }
  ): Promise<NormalizedVideo> {
    if (!file.type.startsWith("video/") && !SOURCE_VIDEO_EXTENSIONS.test(file.name)) {
      throw new Error("That file isn't a video. Upload an MP4, MOV or WebM.");
    }
    if (file.size > SOURCE_MAX_INPUT_BYTES) throw new Error("That video is too large. Trim it under 2GB first.");

    const { normalizeVideoForProviders } = await import("@/lib/client/video-normalize");
    const normalized = await normalizeVideoForProviders(file, {
      onProgress: options.onProgress,
      beforeConvert: ({ durationSeconds }) => {
        if (durationSeconds < options.minSeconds || durationSeconds > options.maxSeconds) {
          throw new Error(`The video must be ${options.minSeconds} to ${options.maxSeconds} seconds (this one is ${formatClipSeconds(durationSeconds)}s).`);
        }
      },
    });
    if (normalized.file.size > SOURCE_MAX_STORED_BYTES) {
      throw new Error("This clip is still over 50MB after optimizing. Trim it shorter and try again.");
    }
    return normalized;
  }

  // Uploads an already-prepared clip straight to Supabase Storage via a
  // signed URL (see upload-source/route.ts) rather than through this app's
  // own API -- a video file would blow past Vercel's serverless request-body
  // limit if sent as a JSON body the way reference images are. `mode` decides
  // which tab's history the uploaded clip's row is filed under.
  async function uploadSourceVideo(video: NormalizedVideo, mode: "edit" | "motion"): Promise<{ id: string; path: string }> {
    const prepResponse = await fetch("/api/generate-video/edit/upload-source", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ durationSeconds: video.durationSeconds, mode, normalized: true, width: video.width, height: video.height }),
    });
    const prepData = await prepResponse.json().catch(() => null);
    if (!prepResponse.ok) throw new Error(prepData?.error ?? "Could not start upload.");

    const { id, path, token } = prepData as { id: string; path: string; token: string };
    const supabase = createBrowserClient();
    const { error: uploadError } = await supabase.storage.from("videos").uploadToSignedUrl(path, token, video.file);
    if (uploadError) throw new Error(uploadError.message || "Upload failed.");

    const confirmResponse = await fetch("/api/generate-video/edit/upload-source", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (!confirmResponse.ok) {
      const confirmData = await confirmResponse.json().catch(() => null);
      throw new Error(confirmData?.error ?? "Could not confirm upload.");
    }

    return { id, path };
  }

  async function handleUploadSourceVideo(file: File) {
    setIsUploadingSource(true);
    setEditError(null);
    try {
      // The Edit models' own per-model length limits are checked at submit;
      // this only rejects clips no edit model could take.
      const video = await prepareSourceVideo(file, { minSeconds: 1, maxSeconds: 120 });
      const durationSeconds = video.durationSeconds;
      const { id, path } = await uploadSourceVideo(video, "edit");

      setEditSource({
        id,
        mode: "edit",
        operation: "uploaded",
        model: "Uploaded video",
        prompt: null,
        params: { durationSeconds },
        output_video_path: path,
        thumbnail_path: null,
        status: "completed",
        error_message: null,
        credits_quoted: 0,
        created_at: new Date().toISOString(),
      });
      mutateEditHistory();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Could not upload that video.");
    } finally {
      setIsUploadingSource(false);
    }
  }

  // Backs both the "Edit" and "Recreate" tile actions (Create-tab and
  // Edit-tab tiles alike): attaches `item` as the video to edit. Only
  // repopulates the prompt/model when `prefill` is true (Recreate on an
  // Edit-tab tile, re-running the same instruction) -- `item.model` only
  // ever matches an edit model for edit-mode items, so this is a no-op for
  // Create-tab items without needing to branch on item.mode.
  function attachSourceForEdit(item: GenerationHistoryItem, prefill: boolean) {
    setActiveTab("edit");
    setMobileView("generate");
    setEditSource(item);
    setEditReferenceImages([]);
    setEditPrompt(prefill ? (item.prompt ?? "") : "");
    if (prefill && getEditVideoModel(item.model)) setEditModel(item.model);
  }

  // ── Clone tab state ──────────────────────────────────────────────────
  // Same own-state/own-poll-loop pattern as Create and Edit above. Every
  // clone is one video_generations row (mode "motion"); which tool/model ran
  // it is the row's `model` (see CLONE_MODES and video-clone.ts).
  const [cloneToolId, setCloneToolId] = useState<CloneToolId>("motion_transfer");
  const [cloneDrafts, setCloneDrafts] = useState(initialCloneDrafts);
  const [cloneKeepOriginalSound, setCloneKeepOriginalSound] = useState(true);
  const [cloneMatchBackground, setCloneMatchBackground] = useState(true);
  const cloneTool = getCloneTool(cloneToolId) ?? CLONE_TOOLS[0];
  const cloneDraft = cloneDrafts[cloneTool.id];
  // No model picker: each tool runs on its own model (Character's follows the background choice).
  const cloneMode = getCloneToolMode(cloneTool, cloneMatchBackground);
  // Derived rather than corrected in an effect: a resolution the current
  // model doesn't offer (e.g. after a background switch) falls back to its default.
  const cloneResolution = cloneMode.resolutions.includes(cloneDraft.resolution) ? cloneDraft.resolution : cloneMode.resolutions[0];
  const cloneImages = cloneDraft.images;
  const clonePrompt = cloneDraft.prompt;
  const [cloneSource, setCloneSource] = useState<CloneSourceDetails | null>(null);
  const [isPreparingCloneSource, setIsPreparingCloneSource] = useState(false);
  const [cloneSourceStatus, setCloneSourceStatus] = useState<{ label: string; progress: number | null } | null>(null);
  const [cloneIsGenerating, setCloneIsGenerating] = useState(false);
  const cloneElapsedSeconds = useElapsedSeconds(cloneIsGenerating);
  const [clonePendingCount, setClonePendingCount] = useState(0);
  const [clonePendingAspectRatio, setClonePendingAspectRatio] = useState("9:16");
  const [cloneError, setCloneError] = useState<string | null>(null);
  const clonePollCancelRef = useRef<(() => void) | null>(null);
  const clonePendingIdsRef = useRef<Set<string>>(new Set());
  // Tracks the current upload's object URL so it can be revoked on replace/unmount.
  const cloneBlobUrlRef = useRef<string | null>(null);

  function updateCloneDraft(patch: Partial<CloneToolDraft>) {
    setCloneDrafts((prev) => ({ ...prev, [cloneTool.id]: { ...prev[cloneTool.id], ...patch } }));
  }

  const {
    data: cloneHistoryData,
    mutate: mutateCloneHistory,
  } = useSWR<{ generations: GenerationHistoryItem[] }>("/api/generate-video?mode=motion", {
    fallbackData: (() => {
      const cached = readHistoryCache<GenerationHistoryItem>("video-clone");
      return cached ? { generations: cached } : undefined;
    })(),
    onSuccess: (data) => {
      const items = data.generations ?? [];
      const stillPending = items
        .filter((item) => item.operation !== "uploaded" && (item.status === "queued" || item.status === "processing"))
        .map((item) => item.id);
      if (stillPending.length > 0 && !clonePollCancelRef.current) {
        setCloneIsGenerating(true);
        pollCloneGenerationStatus(stillPending);
      }
    },
  });
  const cloneHistory = cloneHistoryData?.generations ?? null;

  const cloneDurationValid =
    cloneSource !== null &&
    cloneSource.durationSeconds >= cloneMode.minSourceDurationSeconds &&
    cloneSource.durationSeconds <= cloneMode.maxSourceDurationSeconds;
  const cloneSourceTooSmall =
    cloneSource !== null && cloneMode.minSourceSidePx !== undefined && Math.min(cloneSource.width, cloneSource.height) < cloneMode.minSourceSidePx;
  const clonePromptTooLong = clonePrompt.trim().length > cloneMode.maxPromptLength;
  const clonePromptUnsafe = clonePrompt.trim().length > 0 && !isSafeFreeText(clonePrompt, FREE_TEXT_MAX);
  const cloneHasRequiredInputs =
    cloneTool.id === "object_swap"
      ? clonePrompt.trim().length > 0
      : cloneTool.id === "character"
        ? cloneImages.length === 1
        : clonePrompt.trim().length > 0 || cloneImages.length > 0;
  // Images stay attached when switching to a model with a lower cap, so the
  // user decides which to drop rather than losing the newest ones silently.
  const cloneTooManyImages = cloneImages.length > cloneMode.maxReferenceImages;
  const canSubmitClone =
    cloneDurationValid &&
    !cloneSourceTooSmall &&
    !isPreparingCloneSource &&
    cloneHasRequiredInputs &&
    !cloneTooManyImages &&
    !cloneIsGenerating &&
    !clonePromptUnsafe &&
    !clonePromptTooLong;
  const cloneMatchBackgroundActive = cloneTool.id === "character" && cloneMatchBackground;
  // Before a clip is attached, prices are quoted for the shortest clip the
  // model accepts ("from N").
  const cloneCostSeconds = cloneSource?.durationSeconds ?? cloneMode.minSourceDurationSeconds;
  const cloneResolutionOptions = cloneMode.resolutions.map((value) => ({
    value,
    label: value === "auto" ? "Auto" : value,
    cost: getVideoCloneCost({ mode: cloneMode.id, sourceDurationSeconds: cloneCostSeconds, resolution: value, matchBackground: cloneMatchBackgroundActive }),
  }));
  const estimatedCloneCost = cloneResolutionOptions.find((option) => option.value === cloneResolution)?.cost ?? 0;

  function pollCloneGenerationStatus(ids: string[]) {
    clonePollCancelRef.current?.();
    clonePendingIdsRef.current = new Set(ids);
    setClonePendingCount(clonePendingIdsRef.current.size);

    clonePollCancelRef.current = pollUntilSettled<GenerationHistoryItem[]>(
      async () => {
        const response = await fetch("/api/generate-video?mode=motion");
        if (!response.ok) throw new Error();
        const data = await response.json();
        return data.generations ?? [];
      },
      () => clonePendingIdsRef.current.size === 0,
      (items) => {
        mutateCloneHistory({ generations: items }, { revalidate: false });

        const settled = [...clonePendingIdsRef.current].filter((id) => {
          const match = items.find((item) => item.id === id);
          return match && match.status !== "queued" && match.status !== "processing";
        });

        if (settled.length > 0) {
          for (const id of settled) clonePendingIdsRef.current.delete(id);
          notifyCreditsChanged();

          const failed = settled.map((id) => items.find((item) => item.id === id)).find((item) => item?.status === "failed");
          if (failed) setCloneError(failed.error_message ?? "Something went wrong. Try again.");
        }

        setClonePendingCount(clonePendingIdsRef.current.size);
        if (clonePendingIdsRef.current.size === 0) setCloneIsGenerating(false);
      },
      {
        intervalMs: 5000,
        // Two renders back to back (frame, then up to 30s of motion
        // transfer) -- matches CLONE_STALE_JOB_MS in generate-video/route.ts.
        timeoutMs: 41 * 60 * 1000,
        onTimeout: () => {
          setCloneError("This is taking longer than expected. It'll show up here once it finishes.");
          setCloneIsGenerating(false);
          setClonePendingCount(0);
        },
      }
    );
  }

  useEffect(() => {
    return () => {
      clonePollCancelRef.current?.();
      if (cloneBlobUrlRef.current) URL.revokeObjectURL(cloneBlobUrlRef.current);
    };
  }, []);

  useEffect(() => {
    if (cloneHistory) writeHistoryCache("video-clone", cloneHistory);
  }, [cloneHistory]);

  function replaceCloneSource(next: CloneSourceDetails | null) {
    if (cloneBlobUrlRef.current && cloneBlobUrlRef.current !== next?.previewUrl) URL.revokeObjectURL(cloneBlobUrlRef.current);
    cloneBlobUrlRef.current = next?.previewUrl.startsWith("blob:") ? next.previewUrl : null;
    setCloneSource(next);
  }

  async function handleUploadCloneVideo(file: File) {
    setCloneError(null);
    setIsPreparingCloneSource(true);
    setCloneSourceStatus({ label: "Optimizing video…", progress: 0 });
    let previewUrl: string | null = null;
    try {
      const video = await prepareSourceVideo(file, {
        minSeconds: CLONE_MIN_SOURCE_SECONDS,
        maxSeconds: CLONE_MAX_SOURCE_SECONDS,
        onProgress: (progress) => setCloneSourceStatus({ label: "Optimizing video…", progress }),
      });
      setCloneSourceStatus({ label: "Uploading video…", progress: null });
      previewUrl = URL.createObjectURL(video.file);
      // The first frame is captured from the converted file, so it matches
      // exactly what the models receive (rotation and pixel shape included).
      const info = await inspectVideoSource(previewUrl);
      const { id } = await uploadSourceVideo(video, "motion");
      replaceCloneSource({
        id,
        previewUrl,
        durationSeconds: video.durationSeconds,
        frameImage: info.frameDataUrl,
        aspectRatio: nearestAspectRatio(video.width, video.height),
        width: video.width,
        height: video.height,
      });
      mutateCloneHistory();
    } catch (err) {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setCloneError(err instanceof Error ? err.message : "Could not upload that video.");
    } finally {
      setIsPreparingCloneSource(false);
      setCloneSourceStatus(null);
    }
  }

  // Re-attaches a previously uploaded clip (Recreate on a Clone tile) --
  // its first frame is re-captured from the library copy since only the
  // generated frame, not the original one, is stored server-side.
  async function attachCloneSourceFromLibrary(id: string) {
    setIsPreparingCloneSource(true);
    setCloneError(null);
    try {
      const previewUrl = `/api/library/video/${id}`;
      const info = await inspectVideoSource(previewUrl);
      replaceCloneSource({
        id,
        previewUrl,
        durationSeconds: info.durationSeconds,
        frameImage: info.frameDataUrl,
        aspectRatio: nearestAspectRatio(info.width, info.height),
        width: info.width,
        height: info.height,
      });
    } catch {
      setCloneError("Couldn't load the original video. Upload it again.");
    } finally {
      setIsPreparingCloneSource(false);
    }
  }

  function recreateClone(item: GenerationHistoryItem) {
    const mode = getCloneMode(item.model);
    const toolId = mode?.tool ?? "motion_transfer";
    setActiveTab("motion");
    setMobileView("generate");
    setCloneToolId(toolId);
    setCloneDrafts((prev) => ({
      ...prev,
      [toolId]: {
        prompt: item.prompt ?? "",
        // References/character photos aren't stored server-side -- re-add them.
        images: [],
        resolution: (item.params.resolution as CloneResolution | undefined) ?? prev[toolId].resolution,
      },
    }));
    if (mode?.tool === "character") {
      setCloneKeepOriginalSound(item.params.keepOriginalSound ?? true);
      setCloneMatchBackground(item.params.matchBackground ?? true);
    }
    if (item.params.sourceGenerationId) void attachCloneSourceFromLibrary(item.params.sourceGenerationId);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleGenerateClone() {
    if (!canSubmitClone || !cloneSource) return;

    // Only models that start with a frame pre-pass need the captured first frame.
    const frameImage = cloneNeedsFrameStage(cloneMode, cloneMatchBackgroundActive) ? cloneSource.frameImage : undefined;
    const payloadChars = (frameImage?.length ?? 0) + cloneImages.reduce((sum, image) => sum + image.length, 0);
    if (payloadChars > CLONE_MAX_PAYLOAD_CHARS) {
      setCloneError("Those images are too large to send together. Remove a few and try again.");
      return;
    }

    setCloneIsGenerating(true);
    setCloneError(null);
    setClonePendingAspectRatio(cloneSource.aspectRatio);

    // The tool, not the model: the route picks the model (getCloneToolMode).
    const base: CloneRequestBase = {
      sourceGenerationId: cloneSource.id,
      referenceImages: cloneImages,
      prompt: clonePrompt.trim() || undefined,
      resolution: cloneResolution,
      aspectRatio: cloneSource.aspectRatio,
      frameImage,
    };
    const cloneRequest: CloneRequest =
      cloneTool.id === "character"
        ? { ...base, tool: "character", keepOriginalSound: cloneKeepOriginalSound, matchBackground: cloneMatchBackgroundActive }
        : cloneTool.id === "object_swap"
          ? { ...base, tool: "object_swap", prompt: clonePrompt.trim() }
          : { ...base, tool: "motion_transfer" };

    try {
      const response = await fetch("/api/generate-video/clone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cloneRequest),
      });

      if (response.status === 402) {
        setShowTopUp(true);
        setCloneIsGenerating(false);
        return;
      }

      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error ?? "Failed to start clone.");

      pollCloneGenerationStatus(data.ids);
    } catch (err) {
      setCloneError(err instanceof Error ? err.message : "Something went wrong. Try again.");
      setCloneIsGenerating(false);
      setClonePendingCount(0);
    }
  }

  async function handleGenerate() {
    if (!canSubmit) return;

    setIsGenerating(true);
    setError(null);
    setPendingAspectRatio(aspectRatio);

    try {
      const response = await fetch("/api/generate-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: prompt.trim() || undefined,
          model: selectedModel,
          durationSeconds,
          aspectRatio,
          resolution: model.resolutions ? resolution : undefined,
          outputs,
          soundEnabled: model.supportsAudio ? soundEnabled : undefined,
          startFrameImage: startFrame.dataUrl ?? undefined,
          endFrameImage: endFrame.dataUrl ?? undefined,
          referenceImages: model.supportsReferenceImages && referenceImages.length > 0 ? referenceImages : undefined,
        }),
      });

      if (response.status === 402) {
        setShowTopUp(true);
        setIsGenerating(false);
        return;
      }

      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error ?? "Failed to generate video.");

      pollGenerationStatus(data.ids);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
      setIsGenerating(false);
      setPendingCount(0);
    }
  }

  // Mirrors the old prompt-based frame generator but appends to the Edit tab's
  // reference-image list instead of setting a single frame slot -- backs
  // MobileEditPanel's "Generate Reference with AI" button (competitor-parity
  // affordance the desktop ReferenceImagesPicker doesn't expose, since it's
  // deliberately upload-only there).
  function generateReferenceImage(prompt: string) {
    setIsGeneratingEditReference(true);
    fetch("/api/generate-image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, model: "Nano Banana 2", aspectRatio: "1:1", outputs: 1, quality: "auto", resolution: "1K" }),
    })
      .then(async (response) => {
        const data = await response.json().catch(() => null);
        if (response.status === 402) {
          setShowTopUp(true);
          throw new Error("__handled__");
        }
        if (!response.ok) throw new Error(data?.error ?? "Could not generate reference image");

        return new Promise<void>((resolve, reject) => {
          pollUntilSettled<{ id: string; status: string; images: string[]; error_message: string | null }[]>(
            async () => {
              // Targeted lookup (not the plain list) -- this is the one place
              // that genuinely needs the full `images` array for a row it
              // already knows the id of. See the LIST_SELECT / DETAIL_SELECT
              // comment in generate-image/route.ts.
              const r = await fetch(`/api/generate-image?id=${data.id}`);
              const d = await r.json();
              return d.generations ?? [];
            },
            (items) => {
              const match = items.find((item) => item.id === data.id);
              return !!match && match.status !== "generating";
            },
            (items) => {
              const match = items.find((item) => item.id === data.id);
              if (!match || match.status === "generating") return;
              if (match.status === "failed") {
                reject(new Error(match.error_message ?? "Could not generate reference image"));
                return;
              }
              setEditReferenceImages((prev) => [...prev, match.images[0]]);
              notifyCreditsChanged();
              resolve();
            },
            { intervalMs: 2500, timeoutMs: 2 * 60 * 1000, onTimeout: () => reject(new Error("Timed out generating the reference image.")) }
          );
        });
      })
      .catch((err) => {
        if (err instanceof Error && err.message !== "__handled__") setEditError(err.message);
      })
      .finally(() => setIsGeneratingEditReference(false));
  }

  function recreateFromHistory(item: GenerationHistoryItem) {
    setActiveTab("create");
    setMobileView("generate");
    setPrompt(item.prompt ?? "");
    if (getVideoModel(item.model)) {
      setSelectedModel(item.model);
      const fallback = defaultSettingsFor(item.model);
      setModelSettings((prev) => ({
        ...prev,
        [item.model]: {
          durationSeconds: item.params.durationSeconds ?? fallback.durationSeconds,
          aspectRatio: item.params.aspectRatio ?? fallback.aspectRatio,
          resolution: item.params.resolution ?? fallback.resolution,
          outputs: 1,
          soundEnabled: item.params.soundEnabled ?? fallback.soundEnabled,
        },
      }));
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function downloadVideo(id: string) {
    setDownloadingId(id);
    const link = document.createElement("a");
    link.href = `/api/library/video/${id}?download=1`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    // Same-origin navigation, not a fetch -- there's no completion event to
    // wait on, so this just holds the pressed/spinner state long enough to
    // read as a deliberate action rather than clearing it instantly.
    setTimeout(() => setDownloadingId((current) => (current === id ? null : current)), 1000);
  }

  async function deleteGeneration(id: string) {
    const response = await fetch(`/api/library/video/${id}`, { method: "DELETE" });
    if (!response.ok) {
      setError("Could not delete video. Try again.");
      return;
    }
    mutateHistory((current) => (current ? { generations: current.generations.filter((item) => item.id !== id) } : current), {
      revalidate: false,
    });
    mutateEditHistory((current) => (current ? { generations: current.generations.filter((item) => item.id !== id) } : current), {
      revalidate: false,
    });
    mutateCloneHistory((current) => (current ? { generations: current.generations.filter((item) => item.id !== id) } : current), {
      revalidate: false,
    });
    setEditSource((prev) => (prev?.id === id ? null : prev));
    if (cloneSource?.id === id) replaceCloneSource(null);
  }

  const durationOptions = useMemo(() => model.durations.map((d) => ({ value: String(d), label: `${d}s` })), [model]);
  const aspectRatioOptions = useMemo(() => model.aspectRatios.map((r) => ({ value: r, label: r, ratio: r })), [model]);
  const resolutionOptions = useMemo(() => (model.resolutions ?? []).map((r) => ({ value: r, label: r })), [model]);

  const pendingTiles: GenerationHistoryItem[] = Array.from({ length: pendingCount }, (_, i) => ({
    id: `pending-${i}`,
    mode: "create",
    operation: "text_to_video",
    model: selectedModel,
    prompt: null,
    params: { aspectRatio: pendingAspectRatio },
    output_video_path: null,
    thumbnail_path: null,
    status: "processing",
    error_message: null,
    credits_quoted: 0,
    created_at: new Date().toISOString(),
  }));

  const galleryItems = [...pendingTiles, ...(history?.filter((item) => item.status !== "queued" && item.status !== "processing") ?? [])];

  const editPendingTiles: GenerationHistoryItem[] = Array.from({ length: editPendingCount }, (_, i) => ({
    id: `edit-pending-${i}`,
    mode: "edit",
    operation: "prompt_edit",
    model: editModel,
    prompt: editPrompt || null,
    params: { aspectRatio: editSource?.params.aspectRatio ?? "9:16" },
    output_video_path: null,
    thumbnail_path: null,
    status: "processing",
    error_message: null,
    credits_quoted: 0,
    created_at: new Date().toISOString(),
  }));

  // Edit tab's gallery mixes in Create's completed generations too (not
  // just past edits) -- there's usually no edit history yet the first time
  // someone opens this tab, and the reference product always shows recent
  // generations here regardless of which tab produced them.
  const completedForEditGallery = [
    ...(history?.filter((item) => item.status !== "queued" && item.status !== "processing") ?? []),
    ...(editHistory?.filter((item) => item.status !== "queued" && item.status !== "processing") ?? []),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const editGalleryItems = [...editPendingTiles, ...completedForEditGallery];

  const clonePendingTiles: GenerationHistoryItem[] = Array.from({ length: clonePendingCount }, (_, i) => ({
    id: `clone-pending-${i}`,
    mode: "motion",
    operation: "motion_transfer",
    model: cloneMode.id,
    prompt: null,
    params: { aspectRatio: clonePendingAspectRatio },
    output_video_path: null,
    thumbnail_path: null,
    status: "processing",
    error_message: null,
    credits_quoted: 0,
    created_at: new Date().toISOString(),
  }));

  // Uploaded source clips share mode "motion" but aren't results -- keep
  // them out of the gallery.
  const completedCloneItems =
    cloneHistory?.filter((item) => item.operation !== "uploaded" && item.status !== "queued" && item.status !== "processing") ?? [];
  const cloneGalleryItems = [...clonePendingTiles, ...completedCloneItems];

  return (
    <div className="relative">
      <div className="relative isolate">
        <div className="relative w-full px-0 pt-8 pb-20 sm:px-6 sm:pt-12">
          <div className="mx-auto w-full max-w-6xl">
            <div>
              <h1 className="bg-gradient-to-br from-heading via-heading to-primary bg-clip-text text-3xl font-extrabold tracking-tight text-transparent sm:text-4xl">
                AI Video Generator
              </h1>
              <p className="mt-2 text-[13px] font-medium text-body/60 sm:text-sm sm:tracking-wide">
                Generate stunning, watermark-free AI videos.
              </p>
            </div>

            {/* Generate/History -- mobile only (desktop shows history as the
                "Recent Generations" grid below the form). Underline tabs,
                not a second segmented control, so this page-level switch
                reads a level above the Create/Edit/Clone mode control. */}
            <div role="tablist" aria-label="View" className="mt-5 flex gap-6 border-b border-hairline lg:hidden">
              {(["generate", "history"] as const).map((view) => (
                <button
                  key={view}
                  type="button"
                  role="tab"
                  aria-selected={mobileView === view}
                  onClick={() => setMobileView(view)}
                  className={cn(
                    "-mb-px border-b-2 pb-2.5 text-sm font-semibold capitalize outline-none transition-colors focus-visible:text-heading",
                    mobileView === view ? "border-heading text-heading" : "border-transparent text-subtle"
                  )}
                >
                  {view}
                </button>
              ))}
            </div>

            <div className="mt-4 flex flex-col gap-4 lg:mt-6 lg:flex-row lg:items-start">
              {/* Mode rail -- desktop */}
              <div className="hidden shrink-0 flex-col gap-1 rounded-2xl border border-slate-200/70 bg-white p-1.5 dark:border-white/[0.08] dark:bg-zinc-950 lg:flex">
                {MODE_TABS.map((tab) => {
                  const active = tab.id === activeTab;
                  return (
                    <motion.button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      whileTap={{ scale: 0.95 }}
                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                      className={cn(
                        "relative flex flex-col items-center gap-1 rounded-xl px-4 py-2 text-xs",
                        active
                          ? "font-bold text-slate-900 dark:text-white"
                          : "font-medium text-slate-400 transition-colors duration-300 ease-out hover:bg-slate-50 hover:text-slate-500 dark:text-slate-500 dark:hover:bg-white/[0.06] dark:hover:text-slate-400"
                      )}
                    >
                      {active && (
                        <motion.span
                          layoutId="mode-tab-desktop-active"
                          transition={{ type: "spring", stiffness: 450, damping: 38, mass: 0.9 }}
                          className="absolute inset-0 rounded-xl bg-white shadow-[0_1px_2px_rgba(15,23,42,0.06),0_4px_10px_-4px_rgba(15,23,42,0.15),inset_0_1px_0_0_#ffffff,inset_0_-1px_0_0_rgba(16,24,40,0.14)] ring-1 ring-slate-900/[0.04] dark:bg-white/10 dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.09),inset_0_-1px_0_0_rgba(0,0,0,0.55)] dark:ring-white/[0.06]"
                        />
                      )}
                      <span className="relative z-10 flex flex-col items-center gap-1">
                        <tab.icon className="h-4 w-4" />
                        {tab.label}
                      </span>
                    </motion.button>
                  );
                })}
              </div>

              {/* Mode tabs -- mobile, full width. Hidden in the History view: that's
                  just a plain gallery of everything, not scoped per-tab. */}
              {/* Track radius 14 = the pill's 10 + the 4px padding. */}
              <div
                role="tablist"
                aria-label="Mode"
                className={cn(
                  "w-full gap-1 rounded-[14px] bg-slate-100 p-1 dark:bg-white/[0.06] lg:hidden",
                  mobileView === "history" ? "hidden" : "flex"
                )}
              >
                {MODE_TABS.map((tab) => {
                  const active = tab.id === activeTab;
                  return (
                    <motion.button
                      key={tab.id}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => setActiveTab(tab.id)}
                      whileTap={{ scale: 0.96 }}
                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                      className={cn(
                        // outline-none: iOS draws its own focus ring on a
                        // tapped button; keyboard focus keeps a ring.
                        "relative flex h-9 flex-1 items-center justify-center rounded-[10px] text-[13px] font-semibold outline-none focus-visible:ring-2 focus-visible:ring-blue-400/50",
                        active ? "text-slate-900 dark:text-white" : "text-slate-500 transition-colors duration-300 ease-out dark:text-slate-400"
                      )}
                    >
                      {active && (
                        <motion.span
                          layoutId="mode-tab-mobile-active"
                          transition={{ type: "spring", stiffness: 450, damping: 38, mass: 0.9 }}
                          className="absolute inset-0 rounded-[10px] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.08),0_0_0_1px_rgba(15,23,42,0.04)] dark:bg-white/[0.12] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                        />
                      )}
                      <span className="relative z-10 flex items-center justify-center gap-1.5">
                        <tab.icon className="h-4 w-4" />
                        {tab.label}
                      </span>
                    </motion.button>
                  );
                })}
              </div>

              <div className={cn("min-w-0 flex-1", mobileView === "history" && "hidden lg:block")}>
                {activeTab === "motion" ? (
                  // pb-8 on phones clears CloneComposer's fixed action bar.
                  <div className="relative isolate z-20 pb-8 lg:pb-0">
                    <CloneComposer
                      tools={CLONE_TOOLS}
                      tool={cloneTool}
                      onToolChange={(id) => {
                        setCloneToolId(id);
                        setCloneError(null);
                      }}
                      mode={cloneMode}
                      source={cloneSource}
                      isUploadingSource={isPreparingCloneSource}
                      sourceStatus={cloneSourceStatus}
                      onPickVideo={(file) => void handleUploadCloneVideo(file)}
                      onClearSource={() => replaceCloneSource(null)}
                      images={cloneImages}
                      onImagesChange={(images) => updateCloneDraft({ images })}
                      prompt={clonePrompt}
                      onPromptChange={(prompt) => updateCloneDraft({ prompt })}
                      resolution={cloneResolution}
                      resolutionOptions={cloneResolutionOptions}
                      onResolutionChange={(value) => updateCloneDraft({ resolution: value as CloneResolution })}
                      keepOriginalSound={cloneKeepOriginalSound}
                      onKeepOriginalSoundChange={setCloneKeepOriginalSound}
                      matchBackground={cloneMatchBackgroundActive}
                      onMatchBackgroundChange={setCloneMatchBackground}
                      cost={estimatedCloneCost}
                      costIsStartingPrice={!cloneSource}
                      canSubmit={canSubmitClone}
                      isGenerating={cloneIsGenerating}
                      onSubmit={handleGenerateClone}
                      onError={setCloneError}
                    />

                    {cloneSource && !cloneDurationValid && (
                      <p className="mt-4 text-sm font-medium text-amber-500" role="alert">
                        {cloneTool.label} needs a {cloneMode.minSourceDurationSeconds}-{Math.floor(cloneMode.maxSourceDurationSeconds)}s video (this one is{" "}
                        {formatClipSeconds(cloneSource.durationSeconds)}s).
                      </p>
                    )}
                    {cloneSourceTooSmall && cloneSource && (
                      <p className="mt-4 text-sm font-medium text-amber-500" role="alert">
                        {cloneTool.label} needs a video at least {cloneMode.minSourceSidePx}px on each side (this one is {cloneSource.width}×
                        {cloneSource.height}). Upload it again and it&apos;ll be scaled up automatically.
                      </p>
                    )}
                    {cloneTooManyImages && (
                      <p className="mt-4 text-sm font-medium text-amber-500" role="alert">
                        {cloneTool.label} takes up to {cloneMode.maxReferenceImages} images -- remove{" "}
                        {cloneImages.length - cloneMode.maxReferenceImages} to use it.
                      </p>
                    )}
                    {clonePromptTooLong && (
                      <p className="mt-4 text-sm font-medium text-red-500" role="alert">
                        {clonePrompt.trim().length} / {cloneMode.maxPromptLength} characters -- shorten the prompt a little.
                      </p>
                    )}
                    {clonePromptUnsafe && (
                      <p className="mt-4 text-sm font-medium text-red-500" role="alert">
                        Prompt contains characters that aren&apos;t allowed (e.g. raw HTML tags or control characters)
                      </p>
                    )}
                    {cloneError && (
                      <p className="mt-4 text-sm font-medium text-red-500" role="alert">
                        {cloneError}
                      </p>
                    )}
                    {creditBalance !== null && cloneSource && creditBalance < estimatedCloneCost && (
                      <LowCreditBanner balance={creditBalance} cost={estimatedCloneCost} onTopUp={() => setShowTopUp(true)} />
                    )}
                  </div>
                ) : activeTab === "edit" ? (
                  <>
                  <div className="relative isolate z-20 hidden lg:block">
                    <div
                      className={cn(
                        "flex w-full min-h-[180px] flex-col gap-4 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm",
                        "dark:border-white/[0.08] dark:bg-[#131318]"
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <SourceVideoPicker
                          source={
                            editSource
                              ? { id: editSource.id, thumbnail_path: editSource.thumbnail_path, durationSeconds: editSourceDurationSeconds }
                              : null
                          }
                          onSelect={(id) => {
                            const picked = completedForEditGallery.find((item) => item.id === id);
                            if (picked) setEditSource(picked);
                          }}
                          onClear={() => setEditSource(null)}
                          onUploadFile={handleUploadSourceVideo}
                          isUploading={isUploadingSource}
                          durationRange={{ min: editModelConfig.minSourceDurationSeconds, max: editModelConfig.maxSourceDurationSeconds }}
                          library={completedForEditGallery
                            .filter((item) => item.status === "completed" && item.output_video_path)
                            .map((item) => ({
                              id: item.id,
                              thumbnail_path: item.thumbnail_path,
                              durationSeconds: item.params.durationSeconds ?? null,
                            }))}
                        />

                        <MentionTextarea
                          value={editPrompt}
                          onChange={setEditPrompt}
                          images={editReferenceImages}
                          placeholder="Describe how you want to edit this video. Type @ to insert attached refs."
                          className="h-28 w-full resize-none bg-transparent text-sm font-normal leading-relaxed text-slate-900 outline-none placeholder:font-normal placeholder:text-slate-400 dark:text-white dark:placeholder:text-zinc-500"
                        />
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <VideoModelPicker value={editModel} onChange={setEditModel} models={EDIT_VIDEO_MODELS} />
                        <ReferenceImagesPicker
                          images={editReferenceImages}
                          onChange={setEditReferenceImages}
                          max={editModelConfig.maxReferenceImages}
                        />
                        <PillDropdown value={String(editOutputs)} options={OUTPUT_OPTIONS} onChange={(value) => setEditOutputs(Number(value))} />

                        <PlasticButton
                          text="Generate"
                          loading={editIsGenerating}
                          disabled={!canSubmitEdit}
                          onClick={handleGenerateEdit}
                          trailing={<CreditCost amount={estimatedEditCost} className="text-blue-200/80" />}
                          className="ml-auto shrink-0 !px-6 !py-2.5 !text-sm font-semibold"
                        />
                      </div>
                    </div>

                    {editSource && !editSourceDurationValid && (
                      <p className="mt-4 text-sm font-medium text-amber-500" role="alert">
                        {editModelConfig.id} needs a {editModelConfig.minSourceDurationSeconds}-{editModelConfig.maxSourceDurationSeconds}s source
                        video (this one is {editSourceDurationSeconds}s).
                      </p>
                    )}
                    {editPromptUnsafe && (
                      <p className="mt-4 text-sm font-medium text-red-500" role="alert">
                        Prompt contains characters that aren&apos;t allowed (e.g. raw HTML tags or control characters)
                      </p>
                    )}
                    {editError && (
                      <p className="mt-4 text-sm font-medium text-red-500" role="alert">
                        {editError}
                      </p>
                    )}
                    {creditBalance !== null && creditBalance < estimatedEditCost && (
                      <LowCreditBanner balance={creditBalance} cost={estimatedEditCost} onTopUp={() => setShowTopUp(true)} />
                    )}
                  </div>

                  <div className="lg:hidden">
                    <MobileEditPanel
                      source={
                        editSource
                          ? { id: editSource.id, thumbnail_path: editSource.thumbnail_path, durationSeconds: editSourceDurationSeconds }
                          : null
                      }
                      onSelectSource={(id) => {
                        const picked = completedForEditGallery.find((item) => item.id === id);
                        if (picked) setEditSource(picked);
                      }}
                      onClearSource={() => setEditSource(null)}
                      onUploadSourceFile={handleUploadSourceVideo}
                      isUploadingSource={isUploadingSource}
                      sourceLibrary={completedForEditGallery
                        .filter((item) => item.status === "completed" && item.output_video_path)
                        .map((item) => ({
                          id: item.id,
                          thumbnail_path: item.thumbnail_path,
                          durationSeconds: item.params.durationSeconds ?? null,
                        }))}
                      durationWarning={
                        editSource && !editSourceDurationValid
                          ? `${editModelConfig.id} needs a ${editModelConfig.minSourceDurationSeconds}-${editModelConfig.maxSourceDurationSeconds}s source video (this one is ${editSourceDurationSeconds}s).`
                          : null
                      }
                      editPrompt={editPrompt}
                      onEditPromptChange={setEditPrompt}
                      referenceImages={editReferenceImages}
                      onReferenceImagesChange={setEditReferenceImages}
                      maxReferenceImages={editModelConfig.maxReferenceImages}
                      onGenerateReference={generateReferenceImage}
                      isGeneratingReference={isGeneratingEditReference}
                      model={editModel}
                      models={EDIT_VIDEO_MODELS}
                      onSelectModel={setEditModel}
                      outputs={editOutputs}
                      outputOptions={OUTPUT_OPTIONS}
                      onOutputsChange={setEditOutputs}
                      isGenerating={editIsGenerating}
                      canSubmit={canSubmitEdit}
                      estimatedCost={estimatedEditCost}
                      onGenerate={handleGenerateEdit}
                      error={editError}
                      creditBalance={creditBalance}
                      onTopUp={() => setShowTopUp(true)}
                    />
                  </div>
                  </>
                ) : (
                  <>
                  <div className="relative isolate z-20 hidden lg:block">
                    <div
                      className={cn(
                        "flex w-full min-h-[180px] gap-4 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm",
                        "dark:border-white/[0.08] dark:bg-[#131318]"
                      )}
                    >
                      <AnimatePresence>
                        {showPromptModal && (
                          <PromptExpandModal
                            value={prompt}
                            onChange={setPrompt}
                            images={referenceImages}
                            onImagesChange={setReferenceImages}
                            placeholder="Describe a new video..."
                            onClose={() => setShowPromptModal(false)}
                            maxLength={model.maxPromptLength}
                          />
                        )}
                      </AnimatePresence>

                      {/* Left column: prompt textarea + config pills, locked to the bottom */}
                      <div className="flex min-w-0 flex-grow flex-col justify-between">
                        <div className="relative flex flex-col">
                          <button
                            type="button"
                            onClick={() => setShowPromptModal(true)}
                            aria-label="Expand prompt"
                            className="absolute right-0 top-0 z-10 flex h-7 w-7 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:text-slate-500 dark:hover:bg-white/[0.06] dark:hover:text-slate-300"
                          >
                            <Maximize2 className="h-3.5 w-3.5" />
                          </button>
                          <div className="pr-8">
                            <ReferenceImageChips images={referenceImages} onChange={setReferenceImages} />
                          </div>
                          {/* Fixed height regardless of prompt length -- a contenteditable div has no
                              intrinsic "hug ~2 rows" sizing the way a plain <textarea> did, so without this
                              cap a long prompt would balloon the whole docked card instead of scrolling
                              inside it. Full content is still one click away via the expand button above. */}
                          <div className="h-24">
                            <MentionTextarea
                              value={prompt}
                              onChange={setPrompt}
                              images={referenceImages}
                              placeholder={referenceImages.length > 0 ? "Describe a new video... Type @ to insert a reference" : "Describe a new video..."}
                              className="h-full w-full resize-none bg-transparent text-sm font-normal leading-relaxed text-slate-900 outline-none placeholder:font-normal placeholder:text-slate-400 dark:text-white dark:placeholder:text-zinc-500"
                            />
                          </div>
                          {promptTooLong && (
                            <p className="mt-1 text-xs font-medium text-red-500">
                              {prompt.length} / {model.maxPromptLength} -- tap the expand icon above to trim it
                            </p>
                          )}
                          {!promptTooLong && promptUnsafe && (
                            <p className="mt-1 text-xs font-medium text-red-500">
                              Prompt contains characters that aren&apos;t allowed (e.g. raw HTML tags or control characters)
                            </p>
                          )}
                        </div>

                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <VideoModelPicker
                            value={selectedModel}
                            onChange={setSelectedModel}
                            models={VIDEO_MODELS}
                            isPro={isPro}
                            isScale={isScale}
                            onRequestUpgrade={() => setShowUpgrade(true)}
                          />
                          <PillDropdown
                            icon={Clock}
                            value={String(durationSeconds)}
                            options={durationOptions}
                            onChange={(value) => updateSettings({ durationSeconds: Number(value) })}
                          />
                          {model.resolutions && (
                            <PillDropdown value={resolution} options={resolutionOptions} onChange={(value) => updateSettings({ resolution: value })} />
                          )}
                          <PillDropdown value={aspectRatio} options={aspectRatioOptions} onChange={(value) => updateSettings({ aspectRatio: value })} />
                          {model.supportsAudio && (
                            <button
                              type="button"
                              onClick={() => updateSettings({ soundEnabled: !soundEnabled })}
                              aria-pressed={soundEnabled}
                              aria-label="Toggle sound"
                              className={cn(
                                "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border outline-none transition-all duration-200 active:scale-[0.96]",
                                GLASS_PILL_IDLE,
                                GLASS_PILL_FOCUS,
                                soundEnabled && GLASS_PILL_ACTIVE
                              )}
                            >
                              {soundEnabled ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
                            </button>
                          )}
                          {model.supportsReferenceImages && (
                            <ReferencesPicker images={referenceImages} onChange={setReferenceImages} max={model.maxReferenceImages ?? 4} />
                          )}
                          <PillDropdown
                            value={String(outputs)}
                            options={OUTPUT_OPTIONS}
                            onChange={(value) => updateSettings({ outputs: Number(value) })}
                          />
                        </div>
                      </div>

                      {/* Right column: frame pickers + Generate button, locked to the bottom */}
                      <div className="flex shrink-0 flex-col items-end justify-between">
                        <div className="flex items-start gap-2">
                          {model.supportsImageToVideo && (
                            <FrameImagePicker
                              startFrame={startFrame}
                              onStartFrameChange={setStartFrame}
                              endFrame={endFrame}
                              onEndFrameChange={setEndFrame}
                              supportsEndFrame={model.supportsEndFrame}
                              aspectRatio={aspectRatio}
                            />
                          )}
                        </div>

                        <PlasticButton
                          text="Generate"
                          loading={isGenerating}
                          disabled={!canSubmit}
                          onClick={handleGenerate}
                          trailing={<CreditCost amount={estimatedCost} className="text-blue-200/80" />}
                          className="mt-3 shrink-0 !px-6 !py-2.5 !text-sm font-semibold"
                        />
                      </div>
                    </div>

                    {error && (
                      <p className="mt-4 text-sm font-medium text-red-500" role="alert">
                        {error}
                      </p>
                    )}
                    {creditBalance !== null && creditBalance < estimatedCost && (
                      <LowCreditBanner balance={creditBalance} cost={estimatedCost} onTopUp={() => setShowTopUp(true)} />
                    )}
                  </div>

                  <div className="lg:hidden">
                    <MobileCreatePanel
                      prompt={prompt}
                      onPromptChange={setPrompt}
                      model={model}
                      models={VIDEO_MODELS}
                      selectedModel={selectedModel}
                      onSelectModel={setSelectedModel}
                      isPro={isPro}
                      isScale={isScale}
                      onRequestUpgrade={() => setShowUpgrade(true)}
                      startFrame={startFrame}
                      onStartFrameChange={setStartFrame}
                      endFrame={endFrame}
                      onEndFrameChange={setEndFrame}
                      durationSeconds={durationSeconds}
                      durationOptions={durationOptions}
                      onDurationChange={(value) => updateSettings({ durationSeconds: value })}
                      resolution={resolution}
                      resolutionOptions={resolutionOptions}
                      onResolutionChange={(value) => updateSettings({ resolution: value })}
                      aspectRatio={aspectRatio}
                      onAspectRatioChange={(value) => updateSettings({ aspectRatio: value })}
                      soundEnabled={soundEnabled}
                      onSoundToggle={() => updateSettings({ soundEnabled: !soundEnabled })}
                      outputs={outputs}
                      outputOptions={OUTPUT_OPTIONS}
                      onOutputsChange={(value) => updateSettings({ outputs: value })}
                      isGenerating={isGenerating}
                      canSubmit={canSubmit}
                      estimatedCost={estimatedCost}
                      onGenerate={handleGenerate}
                      error={error}
                      creditBalance={creditBalance}
                      onTopUp={() => setShowTopUp(true)}
                    />
                  </div>
                  </>
                )}
              </div>

              {mobileView === "history" && (
                <div className="lg:hidden">
                  {(() => {
                    // Unscoped by tab (the mode tabs are hidden in this view,
                    // see above) -- pending tiles from both tabs plus every
                    // completed generation, newest first.
                    const items = [
                      ...pendingTiles,
                      ...editPendingTiles,
                      ...clonePendingTiles,
                      ...[...completedForEditGallery, ...completedCloneItems].sort(
                        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                      ),
                    ];
                    if (items.length === 0) {
                      return <p className="py-16 text-center text-sm text-slate-400">No generations yet.</p>;
                    }
                    return (
                      <div className="grid grid-cols-2 gap-3">
                        {items.map((item) => (
                          <VideoTile
                            key={item.id}
                            item={item}
                            elapsedSeconds={
                              item.mode === "edit" ? editElapsedSeconds : item.mode === "motion" ? cloneElapsedSeconds : createElapsedSeconds
                            }
                            onPreview={() => setPreviewItem(item)}
                            onRecreate={() =>
                              item.mode === "edit"
                                ? attachSourceForEdit(item, true)
                                : item.mode === "motion"
                                  ? recreateClone(item)
                                  : recreateFromHistory(item)
                            }
                            onEdit={() => attachSourceForEdit(item, false)}
                            onDownload={() => downloadVideo(item.id)}
                            onDelete={() => setDeleteTargetId(item.id)}
                          />
                        ))}
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          </div>

          {activeTab === "create" && galleryItems.length > 0 && (
            <div className="mt-10 hidden w-full px-4 sm:px-8 lg:block">
              <h2 className="mb-4 text-sm font-semibold text-slate-500">Recent Generations</h2>
              <div className="flex w-full gap-4">
                {distributeColumns(galleryItems, galleryColumns).map((column, columnIndex) => (
                  <div key={columnIndex} className="flex flex-1 flex-col gap-4">
                    {column.map((item) => (
                      <VideoTile
                        key={item.id}
                        item={item}
                        elapsedSeconds={createElapsedSeconds}
                        onPreview={() => setPreviewItem(item)}
                        onRecreate={() => recreateFromHistory(item)}
                        onEdit={() => attachSourceForEdit(item, false)}
                        onDownload={() => downloadVideo(item.id)}
                        onDelete={() => setDeleteTargetId(item.id)}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === "motion" && cloneGalleryItems.length > 0 && (
            <div className="mt-10 hidden w-full px-4 sm:px-8 lg:block">
              <h2 className="mb-4 text-sm font-semibold text-slate-500">Recent Generations</h2>
              <div className="flex w-full gap-4">
                {distributeColumns(cloneGalleryItems, galleryColumns).map((column, columnIndex) => (
                  <div key={columnIndex} className="flex flex-1 flex-col gap-4">
                    {column.map((item) => (
                      <VideoTile
                        key={item.id}
                        item={item}
                        elapsedSeconds={cloneElapsedSeconds}
                        onPreview={() => setPreviewItem(item)}
                        onRecreate={() => recreateClone(item)}
                        onEdit={() => attachSourceForEdit(item, false)}
                        onDownload={() => downloadVideo(item.id)}
                        onDelete={() => setDeleteTargetId(item.id)}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === "edit" && editGalleryItems.length > 0 && (
            <div className="mt-10 hidden w-full px-4 sm:px-8 lg:block">
              <h2 className="mb-4 text-sm font-semibold text-slate-500">Recent Generations</h2>
              <div className="flex w-full gap-4">
                {distributeColumns(editGalleryItems, galleryColumns).map((column, columnIndex) => (
                  <div key={columnIndex} className="flex flex-1 flex-col gap-4">
                    {column.map((item) => (
                      <VideoTile
                        key={item.id}
                        item={item}
                        elapsedSeconds={editElapsedSeconds}
                        onPreview={() => setPreviewItem(item)}
                        onRecreate={() => attachSourceForEdit(item, true)}
                        onEdit={() => attachSourceForEdit(item, false)}
                        onDownload={() => downloadVideo(item.id)}
                        onDelete={() => setDeleteTargetId(item.id)}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {previewPortalTarget &&
        createPortal(
        <AnimatePresence>
          {previewItem &&
            (() => {
              const previewModel = getVideoModel(previewItem.model) ?? getEditVideoModel(previewItem.model) ?? getCloneMode(previewItem.model);
              const videoSrc = `/api/library/video/${previewItem.id}`;
              const closePreview = () => setPreviewItem(null);
              return (
                <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 overflow-hidden bg-black"
                onClick={closePreview}
              >
                {/* Ambient backdrop: the same clip, blown up and blurred, gives the
                    modal its color -- frozen on its first frame (no controls, no
                    autoplay/loop) so it reads as a still photo, not a second video playing. */}
                <div className="absolute inset-0">
                  <video
                    src={videoSrc}
                    poster={previewItem.thumbnail_path ? `/api/library/video/${previewItem.id}?variant=thumbnail` : undefined}
                    muted
                    playsInline
                    preload="auto"
                    className="h-full w-full scale-125 object-cover opacity-80 blur-[90px]"
                  />
                  <div
                    className="absolute inset-0"
                    style={{ background: "radial-gradient(ellipse at center, transparent 0%, rgba(0,0,0,0.35) 65%, rgba(0,0,0,0.8) 100%)" }}
                  />
                </div>

                <button
                  type="button"
                  onClick={closePreview}
                  className="absolute right-4 top-4 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 lg:hidden"
                >
                  <X className="h-4 w-4" />
                </button>

                <div className="relative z-10 flex h-full w-full" onClick={(event) => event.stopPropagation()}>
                  <div className="relative flex flex-1 items-center justify-center p-6 pb-28 lg:p-10 lg:pb-28">
                    <video
                      src={videoSrc}
                      poster={previewItem.thumbnail_path ? `/api/library/video/${previewItem.id}?variant=thumbnail` : undefined}
                      controls
                      autoPlay
                      loop
                      preload="auto"
                      className="max-h-full max-w-full rounded-2xl shadow-[0_50px_140px_-30px_rgba(0,0,0,0.9)]"
                    />

                    <div
                      className="absolute bottom-6 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1 rounded-2xl border border-white/10 bg-black/60 p-1.5 backdrop-blur-xl"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <button
                        type="button"
                        disabled={downloadingId === previewItem.id}
                        onClick={() => downloadVideo(previewItem.id)}
                        className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-60"
                      >
                        {downloadingId === previewItem.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Download className="h-3.5 w-3.5" />
                        )}
                        {downloadingId === previewItem.id ? "Downloading" : "Download"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          closePreview();
                          attachSourceForEdit(previewItem, false);
                        }}
                        className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white"
                      >
                        <Pencil className="h-3.5 w-3.5" /> Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          closePreview();
                          // Mirrors the grid tiles' branch (see onRecreate above):
                          // an edit-mode item has no standalone create-tab
                          // equivalent to "recreate", so re-attach it as an edit
                          // source with its prompt/model prefilled instead.
                          if (previewItem.mode === "edit") {
                            attachSourceForEdit(previewItem, true);
                          } else if (previewItem.mode === "motion") {
                            recreateClone(previewItem);
                          } else {
                            recreateFromHistory(previewItem);
                          }
                        }}
                        className="flex items-center gap-1.5 rounded-xl bg-white px-3.5 py-2 text-xs font-semibold text-black transition-colors hover:bg-white/90"
                      >
                        <RotateCcw className="h-3.5 w-3.5" /> Recreate
                      </button>
                    </div>
                  </div>

                  <div className="hidden h-full w-[380px] shrink-0 flex-col gap-5 overflow-y-auto border-l border-white/10 bg-black/30 p-6 backdrop-blur-2xl lg:flex">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {previewModel ? (
                          <ModelIcon model={previewModel} small />
                        ) : (
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/10 text-[9px] font-bold text-white">
                            {previewItem.model.slice(0, 1)}
                          </span>
                        )}
                        <span className="text-sm font-semibold text-white">{previewModel?.id ?? previewItem.model}</span>
                      </div>
                      <button
                        type="button"
                        onClick={closePreview}
                        className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {previewItem.prompt && (
                      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-white/40">
                            <AlignLeft className="h-3.5 w-3.5" /> Prompt
                          </div>
                          <button
                            type="button"
                            onClick={copyPreviewPrompt}
                            className="flex items-center gap-1 text-[11px] font-medium text-white/60 transition-colors hover:text-white"
                          >
                            <Copy className="h-3 w-3" /> {promptCopied ? "Copied" : "Copy"}
                          </button>
                        </div>
                        <p className="mt-2 text-sm leading-relaxed text-white/90">{previewItem.prompt}</p>
                      </div>
                    )}

                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-white/40">
                        <Info className="h-3.5 w-3.5" /> Information
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-y-4">
                        <div>
                          <div className="text-[11px] text-white/40">Duration</div>
                          <div className="mt-0.5 text-sm font-medium text-white">
                            {previewItem.params.durationSeconds ? `${previewItem.params.durationSeconds}s` : "N/A"}
                          </div>
                        </div>
                        <div>
                          <div className="text-[11px] text-white/40">Aspect Ratio</div>
                          <div className="mt-0.5 text-sm font-medium text-white">{aspectRatioLabel(previewItem.params.aspectRatio)}</div>
                        </div>
                        <div>
                          <div className="text-[11px] text-white/40">Credits</div>
                          <div className="mt-0.5 text-sm font-medium text-white">{previewItem.credits_quoted}</div>
                        </div>
                        <div>
                          <div className="text-[11px] text-white/40">Created</div>
                          <div className="mt-0.5 text-sm font-medium text-white">{formatCompactRelative(previewItem.created_at)}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                </motion.div>
              );
            })()}
        </AnimatePresence>,
        previewPortalTarget
      )}

      <TopUpModal isOpen={showTopUp} onClose={() => setShowTopUp(false)} />

      <UpgradeModal isOpen={showUpgrade} onClose={() => setShowUpgrade(false)} initialTab="plan" />

      <ConfirmDialog
        isOpen={deleteTargetId !== null}
        onClose={() => setDeleteTargetId(null)}
        onConfirm={() => {
          if (deleteTargetId) void deleteGeneration(deleteTargetId);
        }}
        title="Delete this video?"
        description="This permanently deletes the video and can't be undone."
        confirmLabel="Delete"
        danger
      />
    </div>
  );
}
