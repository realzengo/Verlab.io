"use client";

import { AnimatePresence, motion, useMotionValue, useSpring } from "framer-motion";
import {
  AlignLeft,
  Check,
  Clipboard,
  Copy,
  Download,
  GalleryVerticalEnd,
  ImageIcon,
  Info,
  LayoutGrid,
  Loader2,
  Minus,
  ImagePlus,
  MoreVertical,
  Plus,
  Search,
  Sparkles,
  SlidersHorizontal,
  Trash2,
  Upload,
  Video,
  Wand2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { PillDropdown } from "@/components/ui/PillDropdown";
import { PlasticButton } from "@/components/ui/plastic-button";
import { CreditCost } from "@/components/ui/CreditCost";
import { TopUpModal } from "@/components/TopUpModal";
import { BorderTrail } from "@/components/ui/BorderTrail";
import { notifyCreditsChanged } from "@/lib/client/credits-bus";
import { readHistoryCache, writeHistoryCache } from "@/lib/client/history-cache";
import { writeImageToVideoHandoff } from "@/lib/client/image-to-video-handoff";
import { fetchImageAsDataUrl } from "@/lib/client/lazy-image";
import { getImageGenerationCost, type ImageQuality, type ImageResolution } from "@/lib/config/pricing";
import { pollUntilSettled } from "@/lib/polling";
import { cn, formatDate, formatRelativeTime } from "@/lib/utils";

const GEMINI_ICON = "/logos/ai/gemini.svg";
const GPT_ICON = "/logos/ai/chatgpt.png";

export const MODEL_OPTIONS = [
  {
    value: "Nano Banana",
    label: "Nano Banana",
    icon: GEMINI_ICON,
    description: "Fast, lower quality — 1 credit",
  },
  {
    value: "Nano Banana 2",
    label: "Nano Banana 2",
    icon: GEMINI_ICON,
    description: "Recommended — 2-3 credits",
  },
  {
    value: "Nano Banana Pro",
    label: "Nano Banana Pro",
    icon: GEMINI_ICON,
    description: "Highest quality, slower — 3-4 credits",
  },
  {
    value: "Nano Banana 2 Lite",
    label: "Nano Banana 2 Lite",
    icon: GEMINI_ICON,
    description: "Fastest & cheapest — 1 credit",
  },
  {
    value: "GPT Image 2",
    label: "GPT Image 2",
    icon: GPT_ICON,
    invertDark: true,
    description: "Sharp detail, great prompt following — 3-4 credits",
  },
];

export const ASPECT_RATIOS = ["9:16", "16:9", "1:1", "4:3", "3:4", "3:2", "2:3", "4:5", "5:4", "21:9"];
export const ASPECT_RATIO_OPTIONS = ASPECT_RATIOS.map((value) => ({ value, label: value, ratio: value }));

export const OUTPUT_OPTIONS = [1, 2, 3, 4].map((value) => ({
  value: String(value),
  label: `${value} Output${value > 1 ? "s" : ""}`,
}));

export const QUALITY_OPTIONS = [
  { value: "auto", label: "Auto" },
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

// Models with a tunable Quality control -- Nano Banana 2 has no Replicate
// equivalent with a real quality knob, so its tiers swap to a better model
// instead (QUALITY_MODEL_LADDER in cloudflare-image.ts). GPT Image 2's real
// Replicate model has a genuine quality param, so its tiers apply directly
// without changing models. Nano Banana Pro (the top of the ladder) has
// nothing better to swap to and no native quality param either, so it
// doesn't get this control.
export const QUALITY_LADDER_MODELS = new Set(["Nano Banana 2", "GPT Image 2"]);

// Models where Resolution is a real, working lever server-side: the two
// ladder models above (via width/height scaling on their Cloudflare calls)
// plus Nano Banana Pro, whose Replicate model has a genuine 1K/2K/4K
// `resolution` param (see replicate-image.ts).
export const RESOLUTION_MODELS = new Set(["Nano Banana 2", "GPT Image 2", "Nano Banana Pro"]);

export const RESOLUTIONS = ["512px", "1K", "2K", "4K"] as const;

// Mirrors resolveQualityModel() in src/lib/server/cloudflare-image.ts (kept
// separate rather than imported, since that file is server-only and pulls in
// replicate-image.ts). Only used here to price the button correctly -- the
// real resolution that determines the actual charge always happens server-side.
const COST_QUALITY_LADDER: Record<string, string[]> = {
  "Nano Banana 2": ["Nano Banana 2", "Nano Banana Pro"],
};
const COST_QUALITY_TIER_INDEX: Record<string, number> = { auto: 0, low: 0, medium: 1, high: Infinity };
export function resolveModelForCost(model: string, quality: string): string {
  const ladder = COST_QUALITY_LADDER[model];
  if (!ladder) return model;
  const index = Math.min(COST_QUALITY_TIER_INDEX[quality] ?? 0, ladder.length - 1);
  return ladder[index];
}

interface ModelSettings {
  aspectRatio: string;
  outputs: number;
  quality: string;
  resolution: (typeof RESOLUTIONS)[number];
}

const DEFAULT_MODEL_SETTINGS: ModelSettings = {
  aspectRatio: "9:16",
  outputs: 1,
  quality: "auto",
  resolution: "1K",
};

interface GenerationHistoryItem {
  id: string;
  prompt: string;
  model: string;
  aspect_ratio: string;
  outputs: number;
  // Absent on list responses (GET with no ?id=) -- only the single-row
  // detail response (GET ?id=<row>) includes it. See LIST_SELECT /
  // DETAIL_SELECT in generate-image/route.ts.
  images?: string[];
  status: "generating" | "completed" | "failed";
  error_message: string | null;
  created_at: string;
}

type MosaicCell = { kind: "pending"; aspectRatio: string } | { kind: "item"; item: GenerationHistoryItem };

// One entry per in-flight generation -- generations no longer block each
// other, so several can be pending at once (each with its own count/aspect
// ratio) rather than a single global "is generating" flag.
type PendingBatch = { id: string; count: number; aspectRatio: string };

interface PreviewItem {
  id: string;
  index: number;
  src: string;
  prompt: string;
  model: string;
  aspectRatio: string;
  outputs: number;
  createdAt: string;
}

// Merges a freshly-fetched detail row (from GET ?id=) into the existing
// list -- replacing it in place if already present, otherwise prepending it.
// Never wholesale-replaces `prev`, unlike setHistory(singleRowArray) would.
function mergeHistoryRow(prev: GenerationHistoryItem[] | null, row: GenerationHistoryItem): GenerationHistoryItem[] {
  const list = prev ?? [];
  const index = list.findIndex((item) => item.id === row.id);
  if (index === -1) return [row, ...list];
  const next = [...list];
  next[index] = row;
  return next;
}

function getMimeType(dataUrl: string): string {
  return dataUrl.match(/^data:([^;]+);/)?.[1] ?? "unknown";
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function getDataUrlSize(dataUrl: string): string {
  const base64 = dataUrl.split(",")[1] ?? "";
  const padding = base64.match(/=+$/)?.[0].length ?? 0;
  const bytes = (base64.length * 3) / 4 - padding;
  return formatBytes(bytes);
}

const MAX_REFERENCE_IMAGE_BYTES = 8 * 1024 * 1024;

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}

function downloadDataUrl(dataUrl: string, filename: string) {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  link.click();
}

// Used by the preview modal's "Remix" action to hand a generated image back
// in as a reference image -- the reference-image slot takes a File (it's
// shared with the manual upload input), not a data URL.
function dataUrlToFile(dataUrl: string, filename: string): File {
  const [header, base64] = dataUrl.split(",");
  const mime = header.match(/^data:([^;]+);/)?.[1] ?? "image/jpeg";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], filename, { type: mime });
}

function PendingGenerationTile({ aspectRatio, fill = false }: { aspectRatio: string; fill?: boolean }) {
  const [w, h] = aspectRatio.split(":").map(Number);

  return (
    <div
      className="relative block w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 dark:border-zinc-800 dark:bg-zinc-900"
      style={fill ? { height: "100%" } : { aspectRatio: `${w} / ${h}` }}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-slate-200 via-slate-100 to-slate-200 dark:from-zinc-800 dark:via-zinc-900 dark:to-zinc-800" />
      <div className="absolute inset-y-0 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-white/70 to-transparent blur-sm dark:via-white/10 animate-shimmer-sweep" />
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="h-10 w-10 animate-craft-glow rounded-full bg-blue-400/60 blur-xl dark:bg-blue-500/40" />
        <Sparkles className="absolute h-5 w-5 animate-pulse text-slate-400 dark:text-slate-500" />
      </div>
    </div>
  );
}

function RatioIcon({ ratio, className }: { ratio: string; className?: string }) {
  const [w, h] = ratio.split(":").map(Number);
  const size = 14;
  const width = w >= h ? size : Math.max(3, Math.round((size * w) / h));
  const height = h >= w ? size : Math.max(3, Math.round((size * h) / w));

  return (
    <span
      aria-hidden="true"
      className={className}
      style={{ width, height, display: "inline-block", borderRadius: 2, border: "1.5px solid currentColor" }}
    />
  );
}

type HistoryTileAction = "download" | "remix" | "animate" | "addReference" | "delete";
const HISTORY_MENU_WIDTH = 192; // px -- w-48

// A "Recent Generations" gallery card. Hovering raises a dark quick-action
// overlay (model/time badges, download/copy/more, and a Remix/Animate bar)
// on top of the thumbnail -- mirrors the competitor gallery pattern the user
// referenced, without needing to open the full preview modal for common
// actions. Shared between the Mosaic and Grid layouts, which only differ in
// how they size the tile (aspect-ratio style vs. a fixed aspect-square class).
function HistoryTile({
  item,
  style,
  className,
  loading,
  onOpen,
  onDownload,
  onCopyPrompt,
  onRemix,
  onAnimate,
  onAddAsReference,
  onDelete,
  onError,
}: {
  item: GenerationHistoryItem;
  style?: React.CSSProperties;
  className?: string;
  loading: boolean;
  onOpen: () => void;
  onDownload: () => Promise<void>;
  onCopyPrompt: () => void;
  onRemix: () => Promise<void>;
  onAnimate: () => Promise<void>;
  onAddAsReference: () => Promise<void>;
  onDelete: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const [busyAction, setBusyAction] = useState<HistoryTileAction | null>(null);
  const [copied, setCopied] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const [portalTarget, setPortalTarget] = useState<Element | null>(null);
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => setPortalTarget(document.body), []);

  useEffect(() => {
    if (!menuOpen) return;
    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (menuRef.current?.contains(target) || moreButtonRef.current?.contains(target)) return;
      setMenuOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [menuOpen]);

  async function runAction(action: HistoryTileAction, fn: () => Promise<void>) {
    setBusyAction(action);
    try {
      await fn();
    } catch {
      onError("Something went wrong. Try again.");
    } finally {
      setBusyAction(null);
    }
  }

  function toggleMenu(event: React.MouseEvent) {
    event.stopPropagation();
    if (!menuOpen && moreButtonRef.current) {
      const rect = moreButtonRef.current.getBoundingClientRect();
      setMenuPos({
        top: rect.bottom + 6,
        left: Math.max(8, Math.min(rect.right - HISTORY_MENU_WIDTH, window.innerWidth - HISTORY_MENU_WIDTH - 8)),
      });
    }
    setMenuOpen((prev) => !prev);
  }

  return (
    <div
      className={cn(
        "group relative w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md dark:border-zinc-800 dark:bg-zinc-950",
        className
      )}
      style={style}
    >
      <button type="button" disabled={loading} onClick={onOpen} className="absolute inset-0 block h-full w-full">
        {/* eslint-disable-next-line @next/next/no-img-element -- lazily-resized thumbnail served by /api/library/image, not a static asset */}
        <img src={`/api/library/image/${item.id}/0?w=640`} alt="" className="h-full w-full object-cover" />
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/60 dark:bg-black/50">
            <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
          </div>
        )}
      </button>

      {/* Always pointer-events-none: the gradient/badges/caption must let
          clicks fall through to the "open" button above -- only the actual
          buttons inside (each explicitly pointer-events-auto) intercept. */}
      <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-black/50" />

        <div className="absolute left-2.5 top-2.5 flex items-center gap-1.5">
          <span className="flex items-center gap-1 whitespace-nowrap rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur-md">
            <Sparkles className="h-3 w-3 shrink-0" />
            {item.model}
          </span>
          <span className="whitespace-nowrap rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-medium text-white/80 backdrop-blur-md">
            {formatRelativeTime(item.created_at)}
          </span>
        </div>

        <div className="pointer-events-auto absolute right-2.5 top-2.5 flex flex-col gap-1.5">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              void runAction("download", onDownload);
            }}
            disabled={busyAction !== null}
            aria-label="Download"
            className="flex h-8 w-8 items-center justify-center rounded-xl bg-black/60 text-white backdrop-blur-md transition-colors hover:bg-black/80 disabled:opacity-60"
          >
            {busyAction === "download" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onCopyPrompt();
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
            aria-label="Copy prompt"
            className="flex h-8 w-8 items-center justify-center rounded-xl bg-black/60 text-white backdrop-blur-md transition-colors hover:bg-black/80"
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Clipboard className="h-3.5 w-3.5" />}
          </button>
          <button
            ref={moreButtonRef}
            type="button"
            onClick={toggleMenu}
            aria-label="More options"
            aria-expanded={menuOpen}
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-xl bg-black/60 text-white backdrop-blur-md transition-colors hover:bg-black/80",
              menuOpen && "bg-black/80"
            )}
          >
            <MoreVertical className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="pointer-events-auto absolute inset-x-0 bottom-0 p-2.5">
          <p className="mb-2 line-clamp-2 text-xs font-medium leading-snug text-white/90">{item.prompt}</p>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                void runAction("remix", onRemix);
              }}
              disabled={busyAction !== null}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-white/10 px-2 py-1.5 text-xs font-medium text-white backdrop-blur-md transition-colors hover:bg-white/20 disabled:opacity-60"
            >
              {busyAction === "remix" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
              Remix
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                void runAction("animate", onAnimate);
              }}
              disabled={busyAction !== null}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-white/10 px-2 py-1.5 text-xs font-medium text-white backdrop-blur-md transition-colors hover:bg-white/20 disabled:opacity-60"
            >
              {busyAction === "animate" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Video className="h-3.5 w-3.5" />}
              Animate
            </button>
          </div>
        </div>
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
                exit={{ opacity: 0, y: -4, scale: 0.98 }}
                transition={{ duration: 0.12, ease: [0.16, 1, 0.3, 1] }}
                style={{ top: menuPos.top, left: menuPos.left, width: HISTORY_MENU_WIDTH }}
                className="fixed z-[110] overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/95 py-1.5 shadow-2xl backdrop-blur-xl"
                onClick={(event) => event.stopPropagation()}
              >
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onCopyPrompt();
                  }}
                  className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm font-medium text-white/90 transition-colors hover:bg-white/10"
                >
                  <Copy className="h-4 w-4" />
                  Copy prompt
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    void runAction("addReference", onAddAsReference);
                  }}
                  className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm font-medium text-white/90 transition-colors hover:bg-white/10"
                >
                  <ImagePlus className="h-4 w-4" />
                  Add as reference
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    void runAction("delete", onDelete);
                  }}
                  className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm font-medium text-red-400 transition-colors hover:bg-red-500/10 hover:text-red-300"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </button>
              </motion.div>
            )}
          </AnimatePresence>,
          portalTarget
        )}
    </div>
  );
}

const REF_PREVIEW_MAX_DIM = 280; // px -- the floating hover preview's longer side is capped here
const REF_PREVIEW_MARGIN = 16; // keep the floating preview clear of viewport edges

// The small reference-image chip that sits in the toolbar once a file is
// attached. Hovering it raises a large floating preview that tracks the
// cursor (spring-smoothed, not 1:1) -- clicking the thumbnail re-opens the
// file picker to swap the image, while the corner "x" removes it.
function RefPreviewThumbnail({ src, onRemove, onReplace }: { src: string; onRemove: () => void; onReplace: () => void }) {
  const [hovering, setHovering] = useState(false);
  const [portalTarget, setPortalTarget] = useState<Element | null>(null);
  // The floating preview should show the reference image at its own aspect
  // ratio (not force-cropped into a square), so its natural size is loaded
  // up front rather than discovered mid-hover.
  const [naturalDims, setNaturalDims] = useState<{ width: number; height: number } | null>(null);
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const springX = useSpring(mouseX, { stiffness: 350, damping: 32, mass: 0.6 });
  const springY = useSpring(mouseY, { stiffness: 350, damping: 32, mass: 0.6 });

  // Portals render as a plain function-call side effect during SSR too, where
  // `document` doesn't exist -- deferring the target to an effect keeps this
  // safe for any caller that might render it during the initial (server) pass.
  useEffect(() => setPortalTarget(document.body), []);

  useEffect(() => {
    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (!cancelled) setNaturalDims({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.src = src;
    return () => {
      cancelled = true;
    };
  }, [src]);

  const ratio = naturalDims ? naturalDims.width / naturalDims.height : 1;
  const previewWidth = Math.round(ratio >= 1 ? REF_PREVIEW_MAX_DIM : REF_PREVIEW_MAX_DIM * ratio);
  const previewHeight = Math.round(ratio >= 1 ? REF_PREVIEW_MAX_DIM / ratio : REF_PREVIEW_MAX_DIM);

  function handleMouseMove(event: React.MouseEvent) {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    // Prefer above-right of the cursor; flip to whichever side keeps the
    // preview fully on-screen when the cursor is near an edge.
    const left =
      event.clientX + REF_PREVIEW_MARGIN + previewWidth <= vw
        ? event.clientX + REF_PREVIEW_MARGIN
        : event.clientX - REF_PREVIEW_MARGIN - previewWidth;
    const top =
      event.clientY - previewHeight - REF_PREVIEW_MARGIN >= 0
        ? event.clientY - previewHeight - REF_PREVIEW_MARGIN
        : Math.min(event.clientY + REF_PREVIEW_MARGIN, vh - previewHeight - REF_PREVIEW_MARGIN);
    mouseX.set(left);
    mouseY.set(top);
  }

  return (
    <div
      className="group relative shrink-0"
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      onMouseMove={handleMouseMove}
    >
      <button
        type="button"
        onClick={onReplace}
        aria-label="Replace reference image"
        className="block h-9 w-9 overflow-hidden rounded-xl border border-slate-200 shadow-sm outline-none transition-colors duration-150 hover:border-slate-300 dark:border-white/[0.1] dark:hover:border-white/[0.2]"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview, not a static asset */}
        <img src={src} alt="Reference" className="h-full w-full object-cover" />
      </button>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onRemove();
        }}
        aria-label="Remove reference image"
        className="absolute -right-1.5 -top-1.5 flex h-4.5 w-4.5 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 opacity-0 shadow-sm transition-opacity duration-150 group-hover:opacity-100 hover:text-slate-800 dark:border-white/[0.12] dark:bg-zinc-800 dark:text-slate-400 dark:hover:text-slate-200"
      >
        <X className="h-2.5 w-2.5" />
      </button>

      {portalTarget &&
        createPortal(
          <AnimatePresence>
            {hovering && (
              <motion.div
                aria-hidden="true"
                className="pointer-events-none fixed z-[100]"
                style={{ left: springX, top: springY, width: previewWidth, height: previewHeight }}
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview, not a static asset */}
                <img
                  src={src}
                  alt=""
                  className="h-full w-full rounded-2xl border-[3px] border-white object-cover shadow-2xl ring-1 ring-black/10 dark:ring-white/10"
                />
              </motion.div>
            )}
          </AnimatePresence>,
          portalTarget
        )}
    </div>
  );
}

export function ImageGenerator() {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [selectedModel, setSelectedModel] = useState("Nano Banana 2");

  // Aspect ratio / outputs / quality / resolution are per-model: switching
  // models restores whatever this specific model was last set to (falling
  // back to defaults the first time a model is picked), instead of one
  // shared value bleeding across models that don't even support the same
  // controls (e.g. a Nano Banana 2 Quality pick showing up on GPT Image 2).
  const [modelSettings, setModelSettings] = useState<Record<string, ModelSettings>>({});
  const { aspectRatio, outputs, quality, resolution } = modelSettings[selectedModel] ?? DEFAULT_MODEL_SETTINGS;

  function updateModelSettings(patch: Partial<ModelSettings>) {
    setModelSettings((prev) => ({
      ...prev,
      [selectedModel]: { ...(prev[selectedModel] ?? DEFAULT_MODEL_SETTINGS), ...patch },
    }));
  }

  const setAspectRatio = (value: string) => updateModelSettings({ aspectRatio: value });
  const setOutputs = (value: number) => updateModelSettings({ outputs: value });
  const setQuality = (value: string) => updateModelSettings({ quality: value });
  const setResolution = (value: (typeof RESOLUTIONS)[number]) => updateModelSettings({ resolution: value });
  // Inert for now -- see Web Search toggle below.
  const [webSearchEnabled] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const settingsMenuRef = useRef<HTMLDivElement>(null);
  const [refImage, setRefImage] = useState<File | null>(null);
  const [refImagePreviewUrl, setRefImagePreviewUrl] = useState<string | null>(null);
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showTopUp, setShowTopUp] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<"generate" | "history">("generate");
  const [history, setHistory] = useState<GenerationHistoryItem[] | null>(() => readHistoryCache("image"));
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const [previewItem, setPreviewItem] = useState<PreviewItem | null>(null);
  const [previewDims, setPreviewDims] = useState<{ width: number; height: number } | null>(null);
  const [promptCopied, setPromptCopied] = useState(false);
  // History-tab thumbnails are byte-light (no `images` field -- see the
  // GenerationHistoryItem comment), so opening a preview has to fetch the
  // full image on demand. These track that in-flight fetch.
  const [loadingPreviewId, setLoadingPreviewId] = useState<string | null>(null);
  const [previewLoadError, setPreviewLoadError] = useState<string | null>(null);
  // The DB row backing whatever's currently in `generatedImages` -- lets the
  // fresh-generation grid's preview clicks carry a real id/aspect-ratio/
  // outputs (for Delete/Reuse) the same way history-tab previews do.
  const [generatedRow, setGeneratedRow] = useState<GenerationHistoryItem | null>(null);
  const [isDeletingPreview, setIsDeletingPreview] = useState(false);
  const [previewActionError, setPreviewActionError] = useState<string | null>(null);

  const [pendingBatches, setPendingBatches] = useState<PendingBatch[]>([]);
  const pendingCount = useMemo(() => pendingBatches.reduce((sum, batch) => sum + batch.count, 0), [pendingBatches]);

  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [galleryLayout, setGalleryLayout] = useState<"Grid" | "Mosaic">("Mosaic");
  const [galleryZoom, setGalleryZoom] = useState(50);
  const [filterGenerations, setFilterGenerations] = useState(true);
  const [filterUpscales, setFilterUpscales] = useState(false);
  const [filterUploads, setFilterUploads] = useState(false);
  const filterMenuRef = useRef<HTMLDivElement>(null);

  // Keyed by generation id so multiple concurrent generations each get their
  // own poll loop -- starting a new one must not cancel an older still-running
  // generation's poll.
  const pollCancelsRef = useRef<Map<string, () => void>>(new Map());

  const canSubmit = prompt.trim().length > 0;

  const estimatedCost = getImageGenerationCost({
    model: resolveModelForCost(selectedModel, quality),
    resolution: resolution as ImageResolution,
    quality: quality as ImageQuality,
    outputs,
    hasReferenceImage: Boolean(refImage),
  });

  const galleryColumns = Math.max(2, Math.min(6, Math.round(6 - (galleryZoom / 100) * 4)));

  const visibleHistory = history?.filter((item) => filterGenerations && item.status === "completed") ?? null;

  // CSS multi-column layout fills one column top-to-bottom before starting the
  // next, so the most recent items would visually run down the first column
  // instead of across the row. Distributing cells round-robin across columns
  // keeps newest-first reading order left-to-right, then top-to-bottom.
  const mosaicColumns = useMemo(() => {
    const cells: MosaicCell[] = [
      ...pendingBatches.flatMap((batch) =>
        Array.from({ length: batch.count }, (): MosaicCell => ({ kind: "pending", aspectRatio: batch.aspectRatio }))
      ),
      ...(visibleHistory ?? []).map((item): MosaicCell => ({ kind: "item", item })),
    ];
    // Cap column count to the number of cells so a handful of items fill the
    // available width instead of leaving empty flex-1 columns beside them.
    const columnCount = cells.length > 0 ? Math.min(galleryColumns, cells.length) : galleryColumns;
    const columns: MosaicCell[][] = Array.from({ length: columnCount }, () => []);
    cells.forEach((cell, index) => {
      columns[index % columnCount].push(cell);
    });
    return columns;
  }, [pendingBatches, visibleHistory, galleryColumns]);

  useEffect(() => {
    loadHistory();
    const pollCancels = pollCancelsRef.current;
    return () => pollCancels.forEach((cancel) => cancel());
  }, []);

  // Mirrors every history update into localStorage so the next mount (tab
  // revisit, full refresh) can hydrate its initial state from here instead
  // of rendering an empty grid until the fetch above resolves.
  useEffect(() => {
    if (history) writeHistoryCache("image", history);
  }, [history]);

  useEffect(() => {
    setPromptCopied(false);
  }, [previewItem]);

  useEffect(() => {
    if (!refImage) {
      setRefImagePreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(refImage);
    setRefImagePreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [refImage]);

  useEffect(() => {
    if (!previewItem) {
      setPreviewDims(null);
      return;
    }
    const img = new Image();
    img.onload = () => setPreviewDims({ width: img.naturalWidth, height: img.naturalHeight });
    img.src = previewItem.src;
  }, [previewItem]);

  useEffect(() => {
    if (!previewItem) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setPreviewItem(null);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [previewItem]);

  useEffect(() => {
    if (!isFilterOpen) return;
    function onPointerDown(event: MouseEvent) {
      if (filterMenuRef.current && !filterMenuRef.current.contains(event.target as Node)) {
        setIsFilterOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [isFilterOpen]);

  useEffect(() => {
    if (!isSettingsOpen) return;
    function onPointerDown(event: MouseEvent) {
      if (settingsMenuRef.current && !settingsMenuRef.current.contains(event.target as Node)) {
        setIsSettingsOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [isSettingsOpen]);

  function loadHistory() {
    setHistoryLoading(true);
    setHistoryError(null);
    return fetch("/api/generate-image")
      .then(async (response) => {
        const data = await response.json().catch(() => null);
        if (!response.ok) throw new Error(data?.error);
        return data;
      })
      .then((data) => {
        const items: GenerationHistoryItem[] = data.generations ?? [];
        setHistory(items);

        // Generations still running (e.g. the page was reloaded, or a poll
        // loop was interrupted) have no client-side poller watching them --
        // resume one per row so none gets stuck looking finished.
        items
          .filter((item) => item.status === "generating" && !pollCancelsRef.current.has(item.id))
          .forEach((item) => {
            setPendingBatches((prev) => [...prev, { id: item.id, count: item.outputs, aspectRatio: item.aspect_ratio }]);
            pollGenerationStatus(item.id, item.id);
          });
      })
      .catch((err) => setHistoryError(err instanceof Error && err.message ? err.message : "Couldn't load your generation history."))
      .finally(() => setHistoryLoading(false));
  }

  // Generation can take minutes, especially for slower models -- rather than
  // holding a single fetch open for that whole time (fragile: proxies,
  // gateways, and the browser itself can kill a long-idle connection well
  // before the server is done, silently orphaning the request), the POST
  // below only kicks the job off and returns its id immediately. This polls
  // the same history endpoint until that row's status leaves "generating",
  // so the UI stays correct even if the tab is backgrounded or reloaded
  // mid-generation.
  // `pendingId` identifies the pendingBatches entry to clear once this
  // generation settles -- usually the same as `id`, except when handleGenerate
  // starts polling before the server id is known (see there).
  function pollGenerationStatus(id: string, pendingId: string) {
    pollCancelsRef.current.get(id)?.();
    const settle = () => {
      pollCancelsRef.current.delete(id);
      setPendingBatches((prev) => prev.filter((batch) => batch.id !== pendingId));
    };
    pollCancelsRef.current.set(
      id,
      pollUntilSettled<GenerationHistoryItem[]>(
        async () => {
          // Targeted lookup (not the plain list) -- this is the one place that
          // genuinely needs the full `images` array for a row it already
          // knows the id of, to show right after generation finishes.
          const response = await fetch(`/api/generate-image?id=${id}`);
          if (!response.ok) throw new Error();
          const data = await response.json();
          return data.generations ?? [];
        },
        (items) => {
          const match = items.find((item) => item.id === id);
          return !!match && match.status !== "generating";
        },
        (items) => {
          const match = items.find((item) => item.id === id);
          if (!match) return;
          setHistory((prev) => mergeHistoryRow(prev, match));
          if (match.status === "generating") return;

          if (match.status === "failed") {
            setError(match.error_message ?? "Something went wrong. Try again.");
          } else {
            setGeneratedImages(match.images ?? []);
            setGeneratedRow(match);
            // The charge for this generation lands right before the row flips
            // to "completed" (see generate-image/route.ts's after() block) --
            // safe to signal now rather than waiting for the header's next poll.
            notifyCreditsChanged();
          }
          settle();
        },
        {
          intervalMs: 3000,
          // Backstop for the client: the server already sweeps rows stuck in
          // "generating" past 6 minutes to "failed" (see the GET handler in
          // generate-image/route.ts), so this poll should always see that by
          // the next tick. This timeout exists so the UI itself can never spin
          // forever even if that sweep is somehow missed -- the user always
          // lands on an actionable error instead of a silent infinite spinner.
          timeoutMs: 6.5 * 60 * 1000,
          onTimeout: () => {
            setError("This is taking longer than expected. Please try again.");
            settle();
          },
        }
      )
    );
  }

  // History rows come back byte-light (no `images` field -- see the
  // GenerationHistoryItem comment above), so opening a preview fetches the
  // one image it actually needs on demand instead.
  async function openHistoryPreview(item: GenerationHistoryItem) {
    setLoadingPreviewId(item.id);
    setPreviewLoadError(null);
    try {
      const src = item.images?.[0] ?? (await fetchImageAsDataUrl(item.id, 0));
      setPreviewItem({
        id: item.id,
        index: 0,
        src,
        prompt: item.prompt,
        model: item.model,
        aspectRatio: item.aspect_ratio,
        outputs: item.outputs,
        createdAt: item.created_at,
      });
    } catch {
      setPreviewLoadError("Could not load that image.");
      setTimeout(() => setPreviewLoadError(null), 3000);
    } finally {
      setLoadingPreviewId(null);
    }
  }

  // Deletes the single image the preview modal has open. `image_generations`
  // rows can hold multiple outputs, so this only drops one -- the API
  // removes the whole row once its last image goes (see
  // /api/library/image/[id]/[index]/route.ts).
  async function deletePreviewImage() {
    if (!previewItem) return;
    const target = previewItem;
    setIsDeletingPreview(true);
    setPreviewActionError(null);
    try {
      const response = await fetch(`/api/library/image/${target.id}/${target.index}`, { method: "DELETE" });
      if (!response.ok) throw new Error();
      if (generatedRow?.id === target.id) {
        setGeneratedImages((prev) => prev.filter((_, index) => index !== target.index));
      }
      setHistory((prev) =>
        prev
          ? prev.map((row) => (row.id === target.id ? { ...row, outputs: row.outputs - 1 } : row)).filter((row) => row.outputs > 0)
          : prev
      );
      setPreviewItem(null);
    } catch {
      setPreviewActionError("Could not delete this image. Try again.");
      setTimeout(() => setPreviewActionError(null), 3000);
    } finally {
      setIsDeletingPreview(false);
    }
  }

  function copyPreviewPrompt() {
    if (!previewItem) return;
    navigator.clipboard.writeText(previewItem.prompt).then(() => {
      setPromptCopied(true);
      setTimeout(() => setPromptCopied(false), 1500);
    });
  }

  // Repopulates the generate form with this image's exact prompt/model/
  // aspect-ratio/outputs and scrolls to it -- mirrors VideoGenerator's
  // recreateFromHistory. Writes directly into modelSettings by
  // `item.model` rather than going through updateModelSettings (which
  // closes over `selectedModel`, still the *old* value on this same tick
  // since setSelectedModel hasn't committed yet).
  function reuseFromPreview() {
    if (!previewItem) return;
    const item = previewItem;
    setActiveTab("generate");
    if (MODEL_OPTIONS.some((option) => option.value === item.model)) {
      setSelectedModel(item.model);
    }
    setModelSettings((prev) => ({
      ...prev,
      [item.model]: { ...(prev[item.model] ?? DEFAULT_MODEL_SETTINGS), aspectRatio: item.aspectRatio, outputs: item.outputs },
    }));
    setPrompt(item.prompt);
    setPreviewItem(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // Attaches this image as the reference image for a new generation (the
  // same mechanism as the manual "Ref Image" upload), carrying its prompt
  // over as a starting point the user can tweak.
  function remixFromPreview() {
    if (!previewItem) return;
    const item = previewItem;
    const extension = getMimeType(item.src).split("/")[1] ?? "png";
    setActiveTab("generate");
    setRefImage(dataUrlToFile(item.src, `remix-source.${extension}`));
    setPrompt(item.prompt);
    setPreviewItem(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // Hands the image off to the Video Generator as an image-to-video start
  // frame -- see image-to-video-handoff.ts.
  function animateFromPreview() {
    if (!previewItem) return;
    writeImageToVideoHandoff({ imageDataUrl: previewItem.src });
    router.push("/app/video-generator");
  }

  // Gallery-tile equivalents of the three actions above, invoked straight
  // from the "Recent Generations" hover overlay instead of the full preview
  // modal -- so they work off a byte-light history row and fetch the full
  // image on demand, same as openHistoryPreview does.
  async function downloadHistoryItem(item: GenerationHistoryItem) {
    const src = item.images?.[0] ?? (await fetchImageAsDataUrl(item.id, 0));
    const extension = getMimeType(src).split("/")[1] ?? "jpg";
    const slug = item.prompt.trim().slice(0, 40).replace(/\s+/g, "-") || "image";
    downloadDataUrl(src, `${slug}.${extension}`);
  }

  async function remixFromHistoryItem(item: GenerationHistoryItem) {
    const src = item.images?.[0] ?? (await fetchImageAsDataUrl(item.id, 0));
    const extension = getMimeType(src).split("/")[1] ?? "png";
    setRefImage(dataUrlToFile(src, `remix-source.${extension}`));
    setPrompt(item.prompt);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function animateFromHistoryItem(item: GenerationHistoryItem) {
    const src = item.images?.[0] ?? (await fetchImageAsDataUrl(item.id, 0));
    writeImageToVideoHandoff({ imageDataUrl: src });
    router.push("/app/video-generator");
  }

  // Unlike Remix, this only attaches the image as a reference -- it leaves
  // whatever prompt the user has already typed alone.
  async function addAsReferenceFromHistoryItem(item: GenerationHistoryItem) {
    const src = item.images?.[0] ?? (await fetchImageAsDataUrl(item.id, 0));
    const extension = getMimeType(src).split("/")[1] ?? "png";
    setRefImage(dataUrlToFile(src, `reference.${extension}`));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // Deletes every output of this generation (not just one image), then drops
  // the whole row. The API only exposes a per-index DELETE, so this repeats
  // it against index 0 -- each delete compacts the remaining array, so the
  // next output always lands back at index 0 -- sequentially awaited to
  // avoid two overlapping requests racing on the same stored array.
  async function deleteHistoryItem(item: GenerationHistoryItem) {
    for (let i = 0; i < item.outputs; i++) {
      const response = await fetch(`/api/library/image/${item.id}/0`, { method: "DELETE" });
      if (!response.ok) throw new Error();
    }
    setHistory((prev) => prev?.filter((row) => row.id !== item.id) ?? prev);
    if (generatedRow?.id === item.id) {
      setGeneratedImages([]);
      setGeneratedRow(null);
    }
  }

  function reportGalleryActionError(message: string) {
    setPreviewLoadError(message);
    setTimeout(() => setPreviewLoadError(null), 3000);
  }

  async function handleGenerate() {
    if (!canSubmit) return;

    setError(null);
    setGeneratedImages([]);

    // A generation no longer blocks the next one, so this run's placeholder
    // is tracked by a local id rather than a single global pending flag --
    // it's added right away (before the request even lands) so the button
    // stays responsive, and removed by that id whether this run fails fast
    // or eventually settles via pollGenerationStatus.
    const pendingId = crypto.randomUUID();
    setPendingBatches((prev) => [...prev, { id: pendingId, count: outputs, aspectRatio }]);

    try {
      const referenceImage = refImage ? await readFileAsDataUrl(refImage) : undefined;

      const response = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          model: selectedModel,
          aspectRatio,
          outputs,
          quality: QUALITY_LADDER_MODELS.has(selectedModel) ? quality : "auto",
          resolution: RESOLUTION_MODELS.has(selectedModel) ? resolution : "1K",
          referenceImages: referenceImage ? [referenceImage] : undefined,
        }),
      });

      if (response.status === 402) {
        setShowTopUp(true);
        setPendingBatches((prev) => prev.filter((batch) => batch.id !== pendingId));
        return;
      }

      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error ?? "Failed to generate images.");

      pollGenerationStatus(data.id, pendingId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
      setPendingBatches((prev) => prev.filter((batch) => batch.id !== pendingId));
    }
  }

  function handleRefImageChange(file: File | null) {
    if (file && file.size > MAX_REFERENCE_IMAGE_BYTES) {
      setError("Reference image is too large (max 8MB).");
      return;
    }
    setError(null);
    setRefImage(file);
  }

  const refImageButton = (
    <>
      {refImage && refImagePreviewUrl ? (
        <RefPreviewThumbnail
          src={refImagePreviewUrl}
          onReplace={() => fileInputRef.current?.click()}
          onRemove={() => {
            setRefImage(null);
            if (fileInputRef.current) fileInputRef.current.value = "";
          }}
        />
      ) : (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            "flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl border px-3 py-2 text-sm font-medium tracking-[-0.01em] shadow-sm outline-none transition-colors duration-150 active:scale-[0.97]",
            "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50",
            "dark:border-white/[0.07] dark:bg-white/[0.06] dark:text-slate-200 dark:shadow-none dark:hover:border-white/[0.12] dark:hover:bg-white/[0.1]",
            "focus-visible:ring-2 focus-visible:ring-blue-400/50 focus-visible:ring-offset-1 focus-visible:ring-offset-white dark:focus-visible:ring-blue-500/40 dark:focus-visible:ring-offset-zinc-950"
          )}
        >
          <Upload className="h-3.5 w-3.5 shrink-0" />
          Ref Image
        </button>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => handleRefImageChange(event.target.files?.[0] ?? null)}
      />
    </>
  );

  return (
    <div className="relative">
      {/* isolate scopes these -z-10 glows to this subtree only -- it must not
          wrap the fixed-position modals below, or their z-50 gets trapped
          inside this stacking context and can no longer paint (and blur)
          above the sidebar, which sits in the page's root stacking context. */}
      <div className="relative isolate">
      <div className="relative w-full px-0 pt-8 pb-20 sm:px-6 sm:pt-12">
        <div className="mx-auto w-full max-w-4xl md:w-fit md:max-w-full">
        <div>
          <h1 className="bg-gradient-to-br from-heading via-heading to-primary bg-clip-text text-3xl font-extrabold tracking-tight text-transparent sm:text-4xl">
            AI Image Generator
          </h1>
          <p className="mt-2 text-xs font-medium tracking-wide text-body/60 sm:text-sm">Generate stunning images by AI.</p>
        </div>

        {/* ---------------- Mobile layout (< md) ---------------- */}
        <div className="mt-6 md:hidden">
          <div className="flex rounded-full bg-slate-100 p-1 dark:bg-zinc-900">
            <button
              type="button"
              onClick={() => setActiveTab("generate")}
              className={`flex-1 rounded-full py-2 text-sm font-semibold transition-colors ${
                activeTab === "generate"
                  ? "bg-white text-slate-900 shadow-sm dark:bg-zinc-800 dark:text-white"
                  : "text-slate-500 dark:text-slate-400"
              }`}
            >
              Generate
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("history")}
              className={`flex-1 rounded-full py-2 text-sm font-semibold transition-colors ${
                activeTab === "history"
                  ? "bg-white text-slate-900 shadow-sm dark:bg-zinc-800 dark:text-white"
                  : "text-slate-500 dark:text-slate-400"
              }`}
            >
              History
            </button>
          </div>

          {activeTab === "generate" ? (
            <div className="mt-6 flex flex-col gap-4 pb-36">
              <section className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
                <h2 className="text-xs font-semibold tracking-wide text-slate-500">PROMPT</h2>
                <textarea
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  placeholder="Describe the image you want to generate..."
                  className="mt-3 min-h-[140px] w-full resize-none rounded-2xl bg-slate-100 p-4 font-bold text-slate-900 outline-none placeholder:font-normal placeholder:text-slate-400 dark:bg-zinc-900 dark:text-white"
                />
              </section>

              <section className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
                <h2 className="text-xs font-semibold tracking-wide text-slate-500">REFERENCE IMAGE</h2>
                <p className="mt-1 text-sm text-slate-400">{refImage ? "1 of 1" : "0 of 1"} reference image added.</p>
                <div className="mt-3 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl border border-dashed border-slate-300 p-4 text-left dark:border-zinc-700"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 dark:bg-zinc-900">
                      <Upload className="h-4 w-4 text-slate-500" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-slate-900 dark:text-white">
                        {refImage ? refImage.name : "Upload reference image"}
                      </span>
                      <span className="block truncate text-xs text-slate-400">
                        {refImage ? formatBytes(refImage.size) : "PNG, JPG, WebP, or GIF"}
                      </span>
                    </span>
                  </button>
                  {refImage && (
                    <button
                      type="button"
                      onClick={() => {
                        setRefImage(null);
                        if (fileInputRef.current) fileInputRef.current.value = "";
                      }}
                      aria-label="Remove reference image"
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 dark:bg-zinc-900 dark:text-slate-400"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => handleRefImageChange(event.target.files?.[0] ?? null)}
                />
              </section>

              <section className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
                <h2 className="text-xs font-semibold tracking-wide text-slate-500">MODEL</h2>
                <div className="mt-3 flex flex-col gap-2">
                  {MODEL_OPTIONS.map((option) => {
                    const selected = option.value === selectedModel;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setSelectedModel(option.value)}
                        className={`flex items-center gap-3 rounded-2xl border p-3 text-left transition-colors ${
                          selected
                            ? "border-blue-400 bg-blue-50 dark:border-blue-500/50 dark:bg-blue-500/10"
                            : "border-transparent bg-slate-50 dark:bg-zinc-900"
                        }`}
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white shadow-sm dark:bg-zinc-800">
                          {/* eslint-disable-next-line @next/next/no-img-element -- decorative small model icon */}
                          <img
                            src={option.icon}
                            alt=""
                            className={`h-4 w-4 object-contain ${option.invertDark ? "dark:invert" : ""}`}
                          />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span
                            className={`block text-sm font-semibold ${selected ? "text-blue-600 dark:text-blue-400" : "text-slate-900 dark:text-white"}`}
                          >
                            {option.label}
                          </span>
                          <span className={`block text-xs ${selected ? "text-blue-500/80 dark:text-blue-400/70" : "text-slate-500"}`}>
                            {option.description}
                          </span>
                        </span>
                        {selected && <Check className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />}
                      </button>
                    );
                  })}
                </div>
              </section>

              {QUALITY_LADDER_MODELS.has(selectedModel) && (
                <section className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
                  <h2 className="text-xs font-semibold tracking-wide text-slate-500">QUALITY</h2>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {QUALITY_OPTIONS.map((option) => {
                      const selected = option.value === quality;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setQuality(option.value)}
                          className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                            selected
                              ? "border border-blue-400 bg-blue-50 text-blue-600 dark:border-blue-500/50 dark:bg-blue-500/10 dark:text-blue-400"
                              : "border border-transparent bg-slate-100 text-slate-700 dark:bg-zinc-900 dark:text-slate-300"
                          }`}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                </section>
              )}

              <section className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
                <h2 className="text-xs font-semibold tracking-wide text-slate-500">ASPECT RATIO</h2>
                <div className="mt-3 flex flex-wrap gap-2">
                  {ASPECT_RATIOS.map((ratio) => {
                    const selected = ratio === aspectRatio;
                    return (
                      <button
                        key={ratio}
                        type="button"
                        onClick={() => setAspectRatio(ratio)}
                        className={`flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium transition-colors ${
                          selected
                            ? "border border-blue-400 bg-blue-50 text-blue-600 dark:border-blue-500/50 dark:bg-blue-500/10 dark:text-blue-400"
                            : "border border-transparent bg-slate-100 text-slate-700 dark:bg-zinc-900 dark:text-slate-300"
                        }`}
                      >
                        <RatioIcon ratio={ratio} />
                        {ratio}
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
                <h2 className="text-xs font-semibold tracking-wide text-slate-500">OUTPUTS</h2>
                <p className="mt-1 text-sm text-slate-400">Generate multiple variations from the same prompt in one run.</p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {[1, 2, 3, 4].map((count) => {
                    const selected = count === outputs;
                    return (
                      <button
                        key={count}
                        type="button"
                        onClick={() => setOutputs(count)}
                        className={`flex items-center justify-center gap-1.5 rounded-full px-3 py-2.5 text-sm font-medium transition-colors ${
                          selected
                            ? "border border-blue-400 bg-blue-50 text-blue-600 dark:border-blue-500/50 dark:bg-blue-500/10 dark:text-blue-400"
                            : "border border-transparent bg-slate-100 text-slate-700 dark:bg-zinc-900 dark:text-slate-300"
                        }`}
                      >
                        <Plus className="h-3.5 w-3.5" />
                        {count} Output{count > 1 ? "s" : ""}
                      </button>
                    );
                  })}
                </div>
              </section>

              {RESOLUTION_MODELS.has(selectedModel) && (
                <section className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
                  <h2 className="text-xs font-semibold tracking-wide text-slate-500">RESOLUTION</h2>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {RESOLUTIONS.map((value) => {
                      const selected = value === resolution;
                      return (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setResolution(value)}
                          className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                            selected
                              ? "border border-blue-400 bg-blue-50 text-blue-600 dark:border-blue-500/50 dark:bg-blue-500/10 dark:text-blue-400"
                              : "border border-transparent bg-slate-100 text-slate-700 dark:bg-zinc-900 dark:text-slate-300"
                          }`}
                        >
                          {value}
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-4 flex items-center justify-between rounded-2xl bg-slate-50 p-3 dark:bg-white/[0.04]">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-slate-900/[0.04] dark:bg-zinc-800 dark:ring-white/[0.06]">
                        <Search className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
                      </span>
                      <div>
                        <p className="text-sm font-medium text-slate-900 dark:text-white">Web Search</p>
                        <p className="text-xs text-slate-500">Coming soon</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled
                      aria-disabled="true"
                      aria-label="Web Search (coming soon)"
                      className="relative h-5 w-9 shrink-0 cursor-not-allowed rounded-full bg-slate-200 opacity-60 dark:bg-zinc-700"
                    >
                      <span className="absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow-sm dark:bg-zinc-400" />
                    </button>
                  </div>
                </section>
              )}

              {error && (
                <p className="text-sm font-medium text-red-500" role="alert">
                  {error}
                </p>
              )}

              {generatedImages.length > 0 && (
                <div className={`grid gap-3 ${outputs === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
                  {generatedImages.map((src, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() =>
                        generatedRow &&
                        setPreviewItem({
                          id: generatedRow.id,
                          index,
                          src,
                          prompt,
                          model: selectedModel,
                          aspectRatio: generatedRow.aspect_ratio,
                          outputs: generatedRow.outputs,
                          createdAt: new Date().toISOString(),
                        })
                      }
                      className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element -- generated images arrive as data URLs, not static assets */}
                      <img src={src} alt={`Generated image ${index + 1}`} className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="mt-6 pb-10">
              {historyLoading ? (
                <div className="flex h-48 items-center justify-center text-slate-400">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : historyError ? (
                <p className="mt-4 text-center text-sm font-medium text-red-500">{historyError}</p>
              ) : !history || history.filter((item) => item.status === "completed").length === 0 ? (
                <div className="flex h-48 flex-col items-center justify-center gap-2 rounded-2xl bg-slate-50 text-slate-400 dark:bg-zinc-900/50">
                  <ImageIcon className="h-8 w-8" />
                  <p className="text-sm font-medium">Nothing Here!</p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {history.filter((item) => item.status === "completed").map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      disabled={loadingPreviewId === item.id}
                      onClick={() => openHistoryPreview(item)}
                      className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 text-left dark:border-zinc-800 dark:bg-zinc-950"
                    >
                      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-slate-100 dark:bg-zinc-900">
                        {/* eslint-disable-next-line @next/next/no-img-element -- lazily-resized thumbnail served by /api/library/image, not a static asset */}
                        <img
                          src={`/api/library/image/${item.id}/0?w=112`}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                        {loadingPreviewId === item.id && (
                          <div className="absolute inset-0 flex items-center justify-center bg-white/60 dark:bg-black/50">
                            <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 text-sm font-medium text-slate-900 dark:text-white">{item.prompt}</p>
                        <p className="mt-0.5 text-xs text-slate-400">
                          {item.model} · {formatDate(item.created_at)}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "generate" && (
            <div className="fixed inset-x-0 bottom-0 z-20 bg-gradient-to-t from-app via-app/95 to-transparent pt-8">
              <div className="px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
                <PlasticButton
                  text="Generate"
                  disabled={!canSubmit}
                  onClick={handleGenerate}
                  className="w-full py-3.5 shadow-lg"
                  trailing={
                    <>
                      <Sparkles className="h-4 w-4" />
                      {outputs}
                      <CreditCost amount={estimatedCost} className="text-blue-200/80" />
                    </>
                  }
                />
              </div>
            </div>
          )}
        </div>

        {/* ---------------- Desktop layout (>= md) ---------------- */}
        <div className="hidden md:block">
          <div className="group relative isolate z-20 mt-8">
            {/* Border wrapper — a thin gradient stroke (light blue to lighter
                blue; dark blue to darker blue in dark mode) plus an animated
                light trail that travels the perimeter for a premium, "alive" edge. */}
            <div
              className={cn(
                "relative rounded-[28px] border-2 border-transparent shadow-[0_12px_32px_-16px_rgba(37,99,235,0.18)] transition-shadow duration-300",
                // Focus ring: a soft blue glow that appears the moment the
                // textarea is focused, so it's obvious where typing lands.
                "focus-within:shadow-[0_0_0_4px_rgba(59,130,246,0.16),0_16px_40px_-16px_rgba(37,99,235,0.4)]",
                // Crisp hairline ring + dark ambient shadow for definition
                // against the black page -- no colored glow bloom.
                "dark:shadow-[0_1px_0_rgba(255,255,255,0.03),0_0_0_1px_rgba(255,255,255,0.06),0_24px_60px_-20px_rgba(0,0,0,0.65)]",
                "dark:focus-within:shadow-[0_0_0_4px_rgba(59,130,246,0.28),0_1px_0_rgba(255,255,255,0.03),0_0_0_1px_rgba(255,255,255,0.08),0_24px_60px_-20px_rgba(0,0,0,0.65)]"
              )}
            >
              {/* Gradient stroke, masked to the border ring only so it never
                  bleeds into the semi-transparent white panel beneath it.
                  Dimmed until the textarea is focused, then brightens to a
                  crisp premium edge so the active box is unmistakable. */}
              <div
                aria-hidden="true"
                className={cn(
                  "pointer-events-none absolute inset-0 rounded-[inherit] border-2 border-transparent bg-gradient-to-br from-sky-400 to-cyan-300 opacity-60 transition-opacity duration-300 group-focus-within:opacity-100",
                  "[mask-clip:padding-box,border-box] [mask-composite:exclude] [mask-image:linear-gradient(#000,#000),linear-gradient(#000,#000)]",
                  "[-webkit-mask-clip:padding-box,border-box] [-webkit-mask-composite:xor] [-webkit-mask-image:linear-gradient(#000,#000),linear-gradient(#000,#000)]",
                  "dark:from-blue-500 dark:to-cyan-400"
                )}
              />
              <BorderTrail
                size={90}
                className="bg-gradient-to-l from-blue-200 via-blue-500 to-blue-200 opacity-80 blur-[1px] dark:from-blue-400 dark:via-blue-300 dark:to-blue-400"
                transition={{ repeat: Infinity, duration: 7, ease: "linear" }}
              />

              <div
                className={cn(
                  "relative flex w-full flex-col rounded-[26px] bg-white/60 px-9 py-5 backdrop-blur-2xl backdrop-saturate-150",
                  // Lighter than the page background (not near-black-on-black)
                  // plus a faint top sheen, so the panel reads as a distinct
                  // raised surface -- the glass-card look of premium SaaS UIs.
                  "dark:bg-[#131318] dark:bg-gradient-to-b dark:from-white/[0.04] dark:to-transparent"
                )}
              >
            <textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="Describe the image you want to create..."
              className="min-h-[96px] w-full resize-none bg-transparent text-sm font-bold leading-relaxed text-slate-900 outline-none placeholder:font-normal placeholder:text-slate-400 dark:text-white dark:placeholder:text-zinc-500"
            />

            <div className="mt-3 flex flex-nowrap items-center gap-2">
              <div className="flex flex-nowrap items-center gap-1.5">
                <PillDropdown value={selectedModel} options={MODEL_OPTIONS} onChange={setSelectedModel} />
                <PillDropdown value={aspectRatio} options={ASPECT_RATIO_OPTIONS} onChange={setAspectRatio} />
                {QUALITY_LADDER_MODELS.has(selectedModel) && (
                  <PillDropdown value={quality} options={QUALITY_OPTIONS} onChange={setQuality} labelPrefix="Quality" />
                )}
                <PillDropdown
                  value={String(outputs)}
                  options={OUTPUT_OPTIONS}
                  onChange={(value) => setOutputs(Number(value))}
                />
                {refImageButton}

                {RESOLUTION_MODELS.has(selectedModel) && (
                <div ref={settingsMenuRef} className="relative">
                  <button
                    type="button"
                    onClick={() => setIsSettingsOpen((prev) => !prev)}
                    aria-expanded={isSettingsOpen}
                    className={cn(
                      "flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl border px-3 py-2 text-sm font-medium tracking-[-0.01em] shadow-sm outline-none transition-colors duration-150 active:scale-[0.97]",
                      "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50",
                      "dark:border-white/[0.07] dark:bg-white/[0.06] dark:text-slate-200 dark:shadow-none dark:hover:border-white/[0.12] dark:hover:bg-white/[0.1]",
                      "focus-visible:ring-2 focus-visible:ring-blue-400/50 focus-visible:ring-offset-1 focus-visible:ring-offset-white dark:focus-visible:ring-blue-500/40 dark:focus-visible:ring-offset-zinc-950",
                      isSettingsOpen && "border-blue-400 bg-blue-50/60 dark:border-blue-400/50 dark:bg-blue-500/10"
                    )}
                  >
                    <SlidersHorizontal className={cn("h-3.5 w-3.5 transition-colors", isSettingsOpen && "text-blue-500 dark:text-blue-400")} />
                    Settings
                  </button>

                  <AnimatePresence>
                    {isSettingsOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: -6, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -4, scale: 0.98 }}
                        transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
                        className={cn(
                          "absolute top-full right-0 z-50 mt-2 flex w-64 origin-top-right flex-col gap-4 rounded-2xl border p-4",
                          "border-slate-200/70 bg-white/95 shadow-[0_20px_45px_-12px_rgba(15,23,42,0.18)] backdrop-blur-xl",
                          "dark:border-white/[0.08] dark:bg-zinc-900/95 dark:shadow-[0_24px_60px_-12px_rgba(0,0,0,0.65),0_0_0_1px_rgba(255,255,255,0.03)]"
                        )}
                      >
                        <div>
                          <h3 className="mb-2 text-xs font-semibold tracking-wide text-slate-500 dark:text-slate-400">Resolution</h3>
                          <div className="flex flex-wrap gap-1">
                            {RESOLUTIONS.map((value) => (
                              <button
                                key={value}
                                type="button"
                                onClick={() => setResolution(value)}
                                className={
                                  resolution === value
                                    ? "rounded-lg bg-blue-500 px-3 py-1 text-sm font-semibold text-white shadow-[0_1px_0_rgba(255,255,255,0.25)_inset,0_2px_6px_rgba(37,99,235,0.35)]"
                                    : "cursor-pointer rounded-lg px-3 py-1 text-sm text-slate-600 transition-colors duration-150 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/[0.06]"
                                }
                              >
                                {value}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="mt-2 flex items-center justify-between rounded-xl bg-slate-50 p-3 dark:bg-white/[0.04]">
                          <div className="flex items-center gap-2.5">
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-slate-900/[0.04] dark:bg-zinc-800 dark:ring-white/[0.06]">
                              <Search className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
                            </span>
                            <div>
                              <p className="text-sm font-medium text-slate-900 dark:text-white">Web Search</p>
                              <p className="text-xs text-slate-500">Coming soon</p>
                            </div>
                          </div>
                          <button
                            type="button"
                            disabled
                            aria-disabled="true"
                            aria-label="Web Search (coming soon)"
                            className="relative h-5 w-9 shrink-0 cursor-not-allowed rounded-full bg-slate-200 opacity-60 dark:bg-zinc-700"
                          >
                            <span
                              className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-all dark:bg-zinc-400 ${
                                webSearchEnabled ? "left-4" : "left-0.5"
                              }`}
                            />
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                )}
              </div>

              <PlasticButton
                text="Generate"
                disabled={!canSubmit}
                onClick={handleGenerate}
                trailing={<CreditCost amount={estimatedCost} className="text-blue-200/80" />}
                className="ml-8 shrink-0 !rounded-2xl !px-5 !py-2.5 font-semibold shadow-[0_10px_30px_-10px_rgba(37,99,235,0.6)]"
              />
            </div>
              </div>
            </div>
          </div>

          {error && (
            <p className="mt-4 text-sm font-medium text-red-500" role="alert">
              {error}
            </p>
          )}
        </div>
        </div>

        <div className="hidden md:block mt-12">
          {pendingCount > 0 || (history && history.length > 0) ? (
            <div className="mt-10">
              <div className="mb-4 flex w-full items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-500">Recent Generations</h2>

                <div ref={filterMenuRef} className="relative">
                  <button
                    type="button"
                    onClick={() => setIsFilterOpen((prev) => !prev)}
                    aria-label="Gallery settings & filters"
                    aria-expanded={isFilterOpen}
                    className="relative flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl border border-transparent bg-zinc-100 transition-all hover:border-slate-200 dark:bg-zinc-900 dark:hover:border-zinc-700"
                  >
                    <SlidersHorizontal className="h-4 w-4 text-slate-600 dark:text-zinc-400" />
                  </button>

                  {isFilterOpen && (
                    <div className="absolute right-0 top-12 z-50 flex w-72 flex-col gap-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-zinc-800 dark:bg-[#1C1C1E]">
                      <div>
                        <h3 className="mb-3 text-sm font-medium text-slate-900 dark:text-zinc-100">Filter by</h3>
                        <div className="flex flex-col gap-2.5">
                          <label className="flex cursor-pointer items-center gap-3 text-sm text-slate-600 select-none dark:text-zinc-300">
                            <input
                              type="checkbox"
                              checked={filterGenerations}
                              onChange={(event) => setFilterGenerations(event.target.checked)}
                              className="peer sr-only"
                            />
                            <span
                              className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-md border transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-zinc-400 dark:peer-focus-visible:ring-offset-[#1C1C1E] ${
                                filterGenerations
                                  ? "border-zinc-900 bg-zinc-900 dark:border-white dark:bg-white"
                                  : "border-slate-300 bg-white dark:border-zinc-600 dark:bg-transparent"
                              }`}
                            >
                              {filterGenerations && <Check className="h-3 w-3 text-white dark:text-zinc-900" strokeWidth={3} />}
                            </span>
                            Generations
                          </label>
                          <label className="flex cursor-pointer items-center gap-3 text-sm text-slate-600 select-none dark:text-zinc-300">
                            <input
                              type="checkbox"
                              checked={filterUpscales}
                              onChange={(event) => setFilterUpscales(event.target.checked)}
                              className="peer sr-only"
                            />
                            <span
                              className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-md border transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-zinc-400 dark:peer-focus-visible:ring-offset-[#1C1C1E] ${
                                filterUpscales
                                  ? "border-zinc-900 bg-zinc-900 dark:border-white dark:bg-white"
                                  : "border-slate-300 bg-white dark:border-zinc-600 dark:bg-transparent"
                              }`}
                            >
                              {filterUpscales && <Check className="h-3 w-3 text-white dark:text-zinc-900" strokeWidth={3} />}
                            </span>
                            Upscales
                          </label>
                          <label className="flex cursor-pointer items-center gap-3 text-sm text-slate-600 select-none dark:text-zinc-300">
                            <input
                              type="checkbox"
                              checked={filterUploads}
                              onChange={(event) => setFilterUploads(event.target.checked)}
                              className="peer sr-only"
                            />
                            <span
                              className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-md border transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-zinc-400 dark:peer-focus-visible:ring-offset-[#1C1C1E] ${
                                filterUploads
                                  ? "border-zinc-900 bg-zinc-900 dark:border-white dark:bg-white"
                                  : "border-slate-300 bg-white dark:border-zinc-600 dark:bg-transparent"
                              }`}
                            >
                              {filterUploads && <Check className="h-3 w-3 text-white dark:text-zinc-900" strokeWidth={3} />}
                            </span>
                            Uploads
                          </label>
                        </div>
                      </div>

                      <div>
                        <h3 className="mb-3 text-sm font-medium text-slate-900 dark:text-zinc-100">Layout</h3>

                        <div className="mb-4 flex gap-1 rounded-xl bg-slate-100 p-1 dark:bg-[#2C2C2E]">
                          <button
                            type="button"
                            onClick={() => setGalleryLayout("Grid")}
                            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium transition-colors ${
                              galleryLayout === "Grid"
                                ? "bg-white text-slate-900 shadow-sm dark:bg-[#4A4A4C] dark:text-white"
                                : "text-slate-500 dark:text-zinc-400"
                            }`}
                          >
                            <LayoutGrid className="h-3.5 w-3.5" />
                            Grid
                          </button>
                          <button
                            type="button"
                            onClick={() => setGalleryLayout("Mosaic")}
                            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium transition-colors ${
                              galleryLayout === "Mosaic"
                                ? "bg-white text-slate-900 shadow-sm dark:bg-[#4A4A4C] dark:text-white"
                                : "text-slate-500 dark:text-zinc-400"
                            }`}
                          >
                            <GalleryVerticalEnd className="h-3.5 w-3.5" />
                            Mosaic
                          </button>
                        </div>

                        <div className="flex items-center gap-2">
                          <Minus className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                          <input
                            type="range"
                            min={0}
                            max={100}
                            value={galleryZoom}
                            onChange={(event) => setGalleryZoom(Number(event.target.value))}
                            className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-white dark:bg-zinc-700"
                          />
                          <Plus className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {galleryLayout === "Mosaic" ? (
                <div className="flex w-full gap-4">
                  {mosaicColumns.map((column, columnIndex) => (
                    <div key={columnIndex} className="flex flex-1 flex-col gap-4">
                      {column.map((cell, cellIndex) => {
                        if (cell.kind === "pending") {
                          return (
                            <PendingGenerationTile
                              key={`pending-${columnIndex}-${cellIndex}`}
                              aspectRatio={cell.aspectRatio}
                            />
                          );
                        }
                        const { item } = cell;
                        const [w, h] = item.aspect_ratio.split(":").map(Number);
                        return (
                          <HistoryTile
                            key={item.id}
                            item={item}
                            style={{ aspectRatio: `${w} / ${h}` }}
                            loading={loadingPreviewId === item.id}
                            onOpen={() => openHistoryPreview(item)}
                            onDownload={() => downloadHistoryItem(item)}
                            onCopyPrompt={() => navigator.clipboard.writeText(item.prompt)}
                            onRemix={() => remixFromHistoryItem(item)}
                            onAnimate={() => animateFromHistoryItem(item)}
                            onAddAsReference={() => addAsReferenceFromHistoryItem(item)}
                            onDelete={() => deleteHistoryItem(item)}
                            onError={reportGalleryActionError}
                          />
                        );
                      })}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
                  {Array.from({ length: pendingCount }).map((_, index) => (
                    <div key={`pending-${index}`} className="aspect-square overflow-hidden rounded-2xl">
                      <PendingGenerationTile aspectRatio="1:1" fill />
                    </div>
                  ))}
                  {visibleHistory?.map((item) => (
                    <HistoryTile
                      key={item.id}
                      item={item}
                      className="aspect-square"
                      loading={loadingPreviewId === item.id}
                      onOpen={() => openHistoryPreview(item)}
                      onDownload={() => downloadHistoryItem(item)}
                      onCopyPrompt={() => navigator.clipboard.writeText(item.prompt)}
                      onRemix={() => remixFromHistoryItem(item)}
                      onAnimate={() => animateFromHistoryItem(item)}
                      onAddAsReference={() => addAsReferenceFromHistoryItem(item)}
                      onDelete={() => deleteHistoryItem(item)}
                      onError={reportGalleryActionError}
                    />
                  ))}
                </div>
              )}

              {pendingCount === 0 && history && history.length > 0 && visibleHistory?.length === 0 && (
                <div className="mt-6 flex h-32 items-center justify-center text-sm text-slate-400">
                  No results match your filters.
                </div>
              )}
            </div>
          ) : historyLoading ? (
            <div className="mt-6 flex h-48 items-center justify-center text-slate-400">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            <div className="mt-6 flex h-48 flex-col items-center justify-center gap-2 rounded-2xl bg-slate-50 text-slate-400 dark:bg-zinc-900/50">
              <ImageIcon className="h-8 w-8" />
              <p className="text-sm font-medium">Nothing Here!</p>
            </div>
          )}
        </div>
      </div>
      </div>

      <AnimatePresence>
        {previewItem &&
          (() => {
            const previewModel = MODEL_OPTIONS.find((option) => option.value === previewItem.model);
            const closePreview = () => setPreviewItem(null);
            return (
              <motion.div
                key="preview-backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 overflow-hidden bg-black"
                onClick={closePreview}
              >
                {/* Ambient backdrop: the same image, blown up and blurred, gives the
                    modal its color -- mirrors the video preview's cinematic treatment */}
                <div className="absolute inset-0">
                  {/* eslint-disable-next-line @next/next/no-img-element -- decorative blurred backdrop copy */}
                  <img src={previewItem.src} alt="" className="h-full w-full scale-125 object-cover opacity-80 blur-[90px]" />
                  <div
                    className="absolute inset-0"
                    style={{
                      background: "radial-gradient(ellipse at center, transparent 0%, rgba(0,0,0,0.35) 65%, rgba(0,0,0,0.8) 100%)",
                    }}
                  />
                </div>

                <button
                  type="button"
                  onClick={closePreview}
                  aria-label="Close"
                  className="absolute right-4 top-4 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 lg:hidden"
                >
                  <X className="h-4 w-4" />
                </button>

                <div className="relative z-10 flex h-full w-full" onClick={(event) => event.stopPropagation()}>
                  <div className="relative flex flex-1 items-center justify-center p-6 pb-28 lg:p-10 lg:pb-28">
                    {/* eslint-disable-next-line @next/next/no-img-element -- generated image preview from a stored data URL */}
                    <img
                      src={previewItem.src}
                      alt=""
                      className="max-h-full max-w-full rounded-2xl object-contain shadow-[0_50px_140px_-30px_rgba(0,0,0,0.9)]"
                    />

                    {/* Floating dark-glass action bar, bottom-center */}
                    <div
                      className="absolute bottom-6 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1 rounded-2xl border border-white/10 bg-black/60 p-1.5 backdrop-blur-xl"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          const extension = getMimeType(previewItem.src).split("/")[1] ?? "jpg";
                          const slug = previewItem.prompt.trim().slice(0, 40).replace(/\s+/g, "-") || "image";
                          downloadDataUrl(previewItem.src, `${slug}.${extension}`);
                        }}
                        className="flex items-center gap-1.5 rounded-xl bg-white px-3.5 py-2 text-xs font-semibold text-black transition-colors hover:bg-white/90"
                      >
                        <Download className="h-3.5 w-3.5" />
                        Download
                      </button>
                      <button
                        type="button"
                        onClick={remixFromPreview}
                        className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white"
                      >
                        <Wand2 className="h-3.5 w-3.5" />
                        Remix
                      </button>
                      <button
                        type="button"
                        onClick={animateFromPreview}
                        className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white"
                      >
                        <Video className="h-3.5 w-3.5" />
                        Animate
                      </button>
                      <div className="mx-0.5 h-5 w-px shrink-0 bg-white/10" />
                      <button
                        type="button"
                        onClick={reuseFromPreview}
                        className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white"
                      >
                        <Copy className="h-3.5 w-3.5" />
                        Reuse
                      </button>
                      <button
                        type="button"
                        onClick={copyPreviewPrompt}
                        className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white"
                      >
                        {promptCopied ? <Check className="h-3.5 w-3.5" /> : <Clipboard className="h-3.5 w-3.5" />}
                        {promptCopied ? "Copied" : "Copy Prompt"}
                      </button>
                      <button
                        type="button"
                        disabled={isDeletingPreview}
                        onClick={deletePreviewImage}
                        className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium text-red-400 transition-colors hover:bg-red-500/10 hover:text-red-300 disabled:opacity-60"
                      >
                        {isDeletingPreview ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                        Delete
                      </button>
                    </div>
                  </div>

                  {/* Right-hand floating dark glass info panel (desktop only) */}
                  <div className="hidden h-full w-[380px] shrink-0 flex-col gap-5 overflow-y-auto border-l border-white/10 bg-black/30 p-6 backdrop-blur-2xl lg:flex">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {previewModel && (
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white p-1">
                            {/* eslint-disable-next-line @next/next/no-img-element -- small model badge icon */}
                            <img src={previewModel.icon} alt="" className="h-full w-full object-contain" />
                          </span>
                        )}
                        <span className="text-sm font-semibold text-white">{previewItem.model}</span>
                      </div>
                      <button
                        type="button"
                        onClick={closePreview}
                        aria-label="Close"
                        className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-white/40">
                          <AlignLeft className="h-3.5 w-3.5" />
                          Prompt
                        </div>
                        <button
                          type="button"
                          onClick={copyPreviewPrompt}
                          className="flex items-center gap-1 text-[11px] font-medium text-white/60 transition-colors hover:text-white"
                        >
                          {promptCopied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                          {promptCopied ? "Copied" : "Copy"}
                        </button>
                      </div>
                      <p className="mt-2 text-sm leading-relaxed text-white/90">{previewItem.prompt}</p>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-white/40">
                        <Info className="h-3.5 w-3.5" />
                        Information
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-y-4">
                        <div>
                          <div className="text-[11px] text-white/40">Dimensions</div>
                          <div className="mt-0.5 text-sm font-medium text-white">
                            {previewDims ? `${previewDims.width} × ${previewDims.height}` : "—"}
                          </div>
                        </div>
                        <div>
                          <div className="text-[11px] text-white/40">File size</div>
                          <div className="mt-0.5 text-sm font-medium text-white">{getDataUrlSize(previewItem.src)}</div>
                        </div>
                        <div>
                          <div className="text-[11px] text-white/40">Media type</div>
                          <div className="mt-0.5 text-sm font-medium text-white">{getMimeType(previewItem.src)}</div>
                        </div>
                        <div>
                          <div className="text-[11px] text-white/40">Created</div>
                          <div className="mt-0.5 text-sm font-medium text-white">{formatDate(previewItem.createdAt)}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })()}
      </AnimatePresence>

      {(previewLoadError || previewActionError) && (
        <div className="fixed inset-x-0 bottom-6 z-[60] mx-auto w-fit rounded-full bg-red-500 px-4 py-2 text-sm font-medium text-white shadow-lg">
          {previewLoadError || previewActionError}
        </div>
      )}

      <TopUpModal isOpen={showTopUp} onClose={() => setShowTopUp(false)} />
    </div>
  );
}
