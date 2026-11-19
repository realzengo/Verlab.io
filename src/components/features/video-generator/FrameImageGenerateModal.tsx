"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import {
  ArrowUp,
  Check,
  Download,
  History,
  ImageIcon,
  Loader2,
  Pencil,
  Plus,
  RotateCcw,
  SlidersHorizontal,
  Sparkle,
  Sparkles,
  SquarePlay,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { TopUpModal } from "@/components/TopUpModal";
import { notifyCreditsChanged } from "@/lib/client/credits-bus";
import { getImageGenerationCost, type ImageQuality, type ImageResolution } from "@/lib/config/pricing";
import { pollUntilSettled } from "@/lib/polling";
import { fetchImageAsDataUrl } from "@/lib/client/lazy-image";
import { cn, downloadDataUrl, formatDate, readFileAsDataUrl } from "@/lib/utils";
import {
  ASPECT_RATIOS,
  MODEL_OPTIONS,
  QUALITY_LADDER_MODELS,
  QUALITY_OPTIONS,
  RESOLUTIONS,
  RESOLUTION_MODELS,
  resolveModelForCost,
} from "@/components/features/ImageGenerator";
import { ChoicePill, COMPOSER_PILL_IDLE, COMPOSER_PILL_OPEN, COMPOSER_PILL_SHAPE, PopoverPanel, usePopover } from "./ComposerMenus";

const MAX_REFERENCE_IMAGE_BYTES = 8 * 1024 * 1024;
// Matches the backend's MAX_REFERENCE_IMAGES (generate-image/route.ts).
const MAX_REFERENCE_IMAGES = 4;

type FrameLabel = "first frame" | "last frame" | "reference image" | "character";

const FRAME_COPY: Record<FrameLabel, { title: string; description: string; purpose: "frame" | "reference" | "character" }> = {
  "first frame": { title: "First frame", description: "Your video opens on this image and animates from it.", purpose: "frame" },
  "last frame": { title: "Last frame", description: "Your video ends on this image.", purpose: "frame" },
  "reference image": {
    title: "Reference image",
    description: "This image guides the subject, style or setting of your video.",
    purpose: "reference",
  },
  character: {
    title: "Character image",
    description: "This image is the visual reference for the character in your video.",
    purpose: "character",
  },
};

// "Today" / "Yesterday" / calendar date -- groups the history sidebar the
// same way the competitor's does, instead of one flat list.
function dateGroupLabel(iso: string): string {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  if (isSameDay(date, today)) return "Today";
  if (isSameDay(date, yesterday)) return "Yesterday";
  return formatDate(iso);
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

/**
 * A blank image with the ratio's intrinsic size. Placeholders then size
 * exactly like the real images they stand in for (max-h/max-w-full keeps
 * a replaced element's ratio), with no layout math.
 */
function placeholderSrc(ratio: string): string {
  const [w, h] = ratio.split(":").map(Number);
  return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${w * 100}" height="${h * 100}"/>`)}`;
}

/** Small outlined rectangle in the ratio's shape, for the aspect pill. */
function RatioGlyph({ ratio }: { ratio: string }) {
  const [w, h] = ratio.split(":").map(Number);
  const size = 14;
  return (
    <span
      aria-hidden="true"
      className="inline-block shrink-0 rounded-[3px] border-[1.5px] border-current"
      style={{
        width: w >= h ? size : Math.max(5, Math.round((size * w) / h)),
        height: h >= w ? size : Math.max(5, Math.round((size * h) / w)),
      }}
    />
  );
}

function SettingRow({ label, value, options, onChange }: { label: string; value: string; options: { value: string; label: string }[]; onChange: (value: string) => void }) {
  return (
    <div>
      <p className="mb-1.5 px-1 text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
      <div className="grid grid-cols-4 gap-1 rounded-xl bg-slate-100 p-1 dark:bg-white/[0.06]">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            role="menuitemradio"
            aria-checked={option.value === value}
            onClick={() => onChange(option.value)}
            className={cn(
              "h-8 rounded-lg text-[13px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-blue-400/50",
              option.value === value
                ? "bg-white text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.1)] dark:bg-white/[0.14] dark:text-white"
                : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Quality and resolution, for the models where either is a real lever (see ImageGenerator's sets). */
function SettingsPill({
  quality,
  onQualityChange,
  resolution,
  onResolutionChange,
  showQuality,
  showResolution,
}: {
  quality: string;
  onQualityChange: (value: string) => void;
  resolution: string;
  onResolutionChange: (value: string) => void;
  showQuality: boolean;
  showResolution: boolean;
}) {
  const { open, setOpen, ref } = usePopover();
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className={cn(COMPOSER_PILL_SHAPE, "px-3.5", open ? COMPOSER_PILL_OPEN : COMPOSER_PILL_IDLE)}
      >
        <SlidersHorizontal className="h-4 w-4" />
        Settings
      </button>
      <PopoverPanel open={open} onClose={() => setOpen(false)} title="Settings" placement="above" className="w-72">
        <div className="flex flex-col gap-3 p-1.5">
          {showQuality && <SettingRow label="Quality" value={quality} options={QUALITY_OPTIONS} onChange={onQualityChange} />}
          {showResolution && (
            <SettingRow label="Resolution" value={resolution} options={RESOLUTIONS.map((value) => ({ value, label: value }))} onChange={onResolutionChange} />
          )}
        </div>
      </PopoverPanel>
    </div>
  );
}

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

// Merges a freshly-fetched detail row (from GET ?id=) into the existing
// list -- replacing it in place if already present (e.g. re-polling a
// pending generation), otherwise prepending it (a brand new row that
// predates the initial list fetch). Never wholesale-replaces `prev`, unlike
// just calling setHistory(singleRowArray) would.
function mergeHistoryRow(prev: GenerationHistoryItem[] | null, row: GenerationHistoryItem): GenerationHistoryItem[] {
  const list = prev ?? [];
  const index = list.findIndex((item) => item.id === row.id);
  if (index === -1) return [row, ...list];
  const next = [...list];
  next[index] = row;
  return next;
}

interface FrameImageGenerateModalProps {
  /** What the image is for -- picks the default header copy and how Enhance rewrites the prompt. */
  frameLabel: FrameLabel;
  defaultAspectRatio: string;
  onClose: () => void;
  onSelect: (dataUrl: string) => void;
  title?: string;
  description?: string;
  /** The staged image's primary action. Defaults to "Use image". */
  confirmLabel?: string;
}

/**
 * Full-screen "make an image for this slot" dialog -- competitor-parity
 * layout: header, generation history on the left, the staged image(s) in
 * the middle and a prompt bar along the bottom. An image gets staged by
 * generating it, picking it from history, or attaching one; the primary
 * action hands the staged pick to `onSelect`. Shares its model list and
 * pricing with the standalone ImageGenerator page.
 */
export function FrameImageGenerateModal({
  frameLabel,
  defaultAspectRatio,
  onClose,
  onSelect,
  title,
  description,
  confirmLabel = "Use image",
}: FrameImageGenerateModalProps) {
  const copy = FRAME_COPY[frameLabel];
  const [prompt, setPrompt] = useState("");
  // Set right after an Enhance, so it can be undone; any manual edit clears it.
  const [promptBeforeEnhance, setPromptBeforeEnhance] = useState<string | null>(null);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [selectedModel, setSelectedModel] = useState("Nano Banana 2");
  const [aspectRatio, setAspectRatio] = useState(defaultAspectRatio);
  const [outputs, setOutputs] = useState(1);
  const [quality, setQuality] = useState("auto");
  const [resolution, setResolution] = useState<(typeof RESOLUTIONS)[number]>("1K");
  const [refImages, setRefImages] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [isGenerating, setIsGenerating] = useState(false);
  // Snapshot of the request being generated, so the placeholders and the
  // sidebar's pending row don't change if the controls do mid-generation.
  const [pending, setPending] = useState<{ prompt: string; outputs: number; aspectRatio: string } | null>(null);
  const [staged, setStaged] = useState<string[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [showTopUp, setShowTopUp] = useState(false);
  // True while fetching a history row's full-resolution images on demand
  // (the sidebar only has small lazily-loaded thumbnails -- see the
  // LIST_SELECT comment in generate-image/route.ts).
  const [loadingHistory, setLoadingHistory] = useState<{ outputs: number; aspectRatio: string } | null>(null);

  const [history, setHistory] = useState<GenerationHistoryItem[] | null>(null);
  // The history row currently staged, so the sidebar can highlight it.
  const [activeHistoryId, setActiveHistoryId] = useState<string | null>(null);
  const pollCancelRef = useRef<(() => void) | null>(null);

  const canSubmit = prompt.trim().length > 0 && !isGenerating && !isEnhancing;
  const showQuality = QUALITY_LADDER_MODELS.has(selectedModel);
  const showResolution = RESOLUTION_MODELS.has(selectedModel);
  const estimatedCost = getImageGenerationCost({
    model: resolveModelForCost(selectedModel, quality),
    resolution: resolution as ImageResolution,
    quality: quality as ImageQuality,
    outputs,
    hasReferenceImage: refImages.length > 0,
  });

  useEffect(() => {
    fetch("/api/generate-image")
      .then(async (response) => {
        const data = await response.json().catch(() => null);
        if (!response.ok) throw new Error();
        setHistory(data.generations ?? []);
      })
      .catch(() => setHistory([]));
    return () => pollCancelRef.current?.();
  }, []);

  useEffect(() => {
    // On window, after the prompt bar's menus (on document) have had the
    // chance to claim Escape for themselves.
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !event.defaultPrevented && !showTopUp) onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, showTopUp]);

  function stage(images: string[], historyId: string | null) {
    setStaged(images);
    setSelectedIndex(0);
    setActiveHistoryId(historyId);
  }

  function pollGenerationStatus(id: string) {
    pollCancelRef.current?.();
    pollCancelRef.current = pollUntilSettled<GenerationHistoryItem[]>(
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
          stage(match.images ?? [], match.id);
          notifyCreditsChanged();
        }
        setIsGenerating(false);
        setPending(null);
      },
      {
        intervalMs: 3000,
        timeoutMs: 6.5 * 60 * 1000,
        onTimeout: () => {
          setError("This is taking longer than expected. Please try again.");
          setIsGenerating(false);
          setPending(null);
        },
      }
    );
  }

  async function handleGenerate() {
    if (!canSubmit) return;

    setIsGenerating(true);
    setPending({ prompt: prompt.trim(), outputs, aspectRatio });
    setError(null);
    stage([], null);

    try {
      const response = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          model: selectedModel,
          aspectRatio,
          outputs,
          quality: showQuality ? quality : "auto",
          resolution: showResolution ? resolution : "1K",
          referenceImages: refImages.length > 0 ? refImages : undefined,
        }),
      });

      if (response.status === 402) {
        setShowTopUp(true);
        setIsGenerating(false);
        setPending(null);
        return;
      }

      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error ?? "Failed to generate images.");

      pollGenerationStatus(data.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
      setIsGenerating(false);
      setPending(null);
    }
  }

  async function handleEnhance() {
    const original = prompt.trim();
    if (!original || isEnhancing || isGenerating) return;
    setIsEnhancing(true);
    setError(null);
    try {
      const response = await fetch("/api/generate-image/enhance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: original, purpose: copy.purpose }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || typeof data?.prompt !== "string") throw new Error(data?.error ?? "Couldn't enhance that prompt.");
      setPromptBeforeEnhance(prompt);
      setPrompt(data.prompt);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't enhance that prompt.");
    } finally {
      setIsEnhancing(false);
    }
  }

  async function openHistoryItem(item: GenerationHistoryItem) {
    setPrompt(item.prompt);
    setPromptBeforeEnhance(null);
    if (ASPECT_RATIOS.includes(item.aspect_ratio)) setAspectRatio(item.aspect_ratio);
    if (MODEL_OPTIONS.some((option) => option.value === item.model)) setSelectedModel(item.model);
    setError(null);
    stage([], item.id);
    const count = Math.max(1, item.outputs);
    setLoadingHistory({ outputs: count, aspectRatio: item.aspect_ratio });
    try {
      const images = await Promise.all(Array.from({ length: count }, (_, index) => fetchImageAsDataUrl(item.id, index)));
      stage(images, item.id);
    } catch {
      setError("Could not load that image.");
    } finally {
      setLoadingHistory(null);
    }
  }

  function startNew() {
    setPrompt("");
    setPromptBeforeEnhance(null);
    setError(null);
    setRefImages([]);
    stage([], null);
    textareaRef.current?.focus();
  }

  // Appends to the reference set (up to MAX_REFERENCE_IMAGES). With nothing
  // else on the canvas, the attachment is also staged, so a photo the user
  // already has can be used as-is without generating anything.
  async function handleAttachFiles(files: File[]) {
    const room = MAX_REFERENCE_IMAGES - refImages.length;
    if (room <= 0) {
      setError(`You can attach up to ${MAX_REFERENCE_IMAGES} images.`);
      return;
    }
    const images = files.filter((file) => file.type.startsWith("image/"));
    if (images.length === 0) {
      setError("Those files aren't images.");
      return;
    }
    if (images.some((file) => file.size > MAX_REFERENCE_IMAGE_BYTES)) {
      setError("Images must be under 8MB each.");
      return;
    }
    try {
      const added = await Promise.all(images.slice(0, room).map((file) => readFileAsDataUrl(file)));
      setRefImages((prev) => [...prev, ...added].slice(0, MAX_REFERENCE_IMAGES));
      setError(images.length > room ? `Only the first ${room} image${room === 1 ? "" : "s"} were attached (max ${MAX_REFERENCE_IMAGES}).` : null);
      if (!isGenerating && !loadingHistory && staged.length === 0 && !prompt.trim()) stage([added[added.length - 1]], null);
    } catch {
      setError("Could not read that image.");
    }
  }

  // Carries the staged pick forward as a reference for a follow-up edit and
  // hands focus to the prompt, ready for the user to describe the change.
  function editStaged() {
    const image = staged[selectedIndex];
    if (!image) return;
    setRefImages((prev) => (prev.includes(image) || prev.length >= MAX_REFERENCE_IMAGES ? prev : [...prev, image]));
    stage([], null);
    setError(null);
    textareaRef.current?.focus();
  }

  const historyLoading = history === null;
  const completedHistory = history?.filter((item) => item.status === "completed" && item.outputs > 0) ?? [];

  // Pending generation (if any) + completed history, with "Today" /
  // "Yesterday" / date headers interleaved.
  type SidebarRow = { kind: "header"; label: string } | { kind: "pending" } | { kind: "item"; item: GenerationHistoryItem };
  const sidebarRows: SidebarRow[] = [];
  {
    const rawRows: Extract<SidebarRow, { kind: "pending" | "item" }>[] = [
      ...(isGenerating ? [{ kind: "pending" as const }] : []),
      ...completedHistory.map((item) => ({ kind: "item" as const, item })),
    ];
    let lastLabel: string | null = null;
    for (const row of rawRows) {
      const label = dateGroupLabel(row.kind === "pending" ? new Date().toISOString() : row.item.created_at);
      if (label !== lastLabel) {
        sidebarRows.push({ kind: "header", label });
        lastLabel = label;
      }
      sidebarRows.push(row);
    }
  }

  const placeholder = pending ?? loadingHistory;
  const pickIsMulti = staged.length > 1;

  // Portaled to <body> -- this can be opened from deep inside a `relative
  // isolate` ancestor (e.g. VideoGenerator's glow-scoping wrapper), which
  // traps a nested `fixed` element's z-index inside that stacking context
  // and stops it from painting above the app shell's header/sidebar.
  return createPortal(
    <div className="fixed inset-0 z-[60] flex bg-black/50 p-2 backdrop-blur-sm sm:p-3">
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="frame-image-title"
        initial={{ opacity: 0, scale: 0.98, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
        className="flex min-h-0 w-full flex-col overflow-hidden rounded-2xl bg-white shadow-2xl sm:rounded-3xl dark:bg-[#131318]"
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 px-4 py-3 sm:px-5 dark:border-white/[0.08]">
          <div className="min-w-0">
            <h2 id="frame-image-title" className="text-[17px] font-semibold text-slate-900 dark:text-white">
              {title ?? copy.title}
            </h2>
            <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{description ?? copy.description}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-1.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-500 outline-none transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-blue-400/50 dark:text-slate-400 dark:hover:bg-white/[0.06] dark:hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex min-h-0 flex-1">
          {/* History */}
          <aside className="hidden w-[272px] shrink-0 flex-col border-r border-slate-200 sm:flex dark:border-white/[0.08]">
            <div className="flex h-11 shrink-0 items-center justify-between border-b border-slate-200 pl-4 pr-2 dark:border-white/[0.08]">
              <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500 dark:text-slate-400">History</span>
              <button
                type="button"
                onClick={startNew}
                aria-label="New generation"
                title="New generation"
                className="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 outline-none transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-blue-400/50 dark:text-slate-400 dark:hover:bg-white/[0.06] dark:hover:text-white"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-2">
              {historyLoading ? (
                <div className="flex flex-col gap-1">
                  {Array.from({ length: 6 }, (_, index) => (
                    <div key={index} className="flex items-center gap-2.5 p-2">
                      <span className="h-11 w-11 shrink-0 animate-pulse rounded-lg bg-(--app-fill-strong)" />
                      <span className="flex-1 space-y-1.5">
                        <span className="block h-3 w-full animate-pulse rounded bg-(--app-fill-strong)" />
                        <span className="block h-3 w-1/2 animate-pulse rounded bg-(--app-fill-strong)" />
                      </span>
                    </div>
                  ))}
                </div>
              ) : sidebarRows.length === 0 ? (
                <div className="flex flex-col items-center px-4 pt-6 text-center">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-500 dark:bg-white/[0.06] dark:text-slate-400">
                    <History className="h-[18px] w-[18px]" />
                  </span>
                  <p className="mt-3 text-sm font-semibold text-slate-900 dark:text-white">No generations yet</p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">Images you generate collect here, ready to reuse.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-0.5">
                  {sidebarRows.map((row, index) => {
                    if (row.kind === "header") {
                      return (
                        <p
                          key={`header-${row.label}-${index}`}
                          className={cn("px-2 pb-1 text-[11px] font-medium text-slate-400 dark:text-slate-500", index > 0 ? "pt-3" : "pt-1")}
                        >
                          {row.label}
                        </p>
                      );
                    }

                    if (row.kind === "pending") {
                      return (
                        <div key="pending" className="flex items-center gap-2.5 rounded-xl bg-slate-100 p-2 dark:bg-white/[0.06]">
                          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-white dark:bg-white/[0.06]">
                            <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="line-clamp-2 text-[13px] font-medium leading-snug text-slate-900 dark:text-white">{pending?.prompt || "Generating…"}</span>
                            <span className="block text-xs text-slate-500 dark:text-slate-400">Generating…</span>
                          </span>
                        </div>
                      );
                    }

                    const active = activeHistoryId === row.item.id;
                    return (
                      <button
                        key={row.item.id}
                        type="button"
                        onClick={() => void openHistoryItem(row.item)}
                        className={cn(
                          "flex items-center gap-2.5 rounded-xl p-2 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-blue-400/50",
                          active ? "bg-slate-100 dark:bg-white/[0.07]" : "hover:bg-slate-50 dark:hover:bg-white/[0.04]"
                        )}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element -- lazily-resized thumbnail served by /api/library/image, not a static asset */}
                        <img
                          src={`/api/library/image/${row.item.id}/0?w=96`}
                          alt=""
                          loading="lazy"
                          decoding="async"
                          className="h-11 w-11 shrink-0 rounded-lg bg-slate-100 object-cover dark:bg-white/[0.05]"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="line-clamp-2 text-[13px] font-medium leading-snug text-slate-800 dark:text-slate-100">{row.item.prompt}</span>
                          <span className="block text-xs text-slate-400 dark:text-slate-500">
                            {formatTime(row.item.created_at)}
                            {row.item.outputs > 1 && ` · ${row.item.outputs} variations`}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </aside>

          {/* Stage + prompt bar */}
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="relative min-h-0 flex-1">
              <div className="absolute inset-0 flex items-center justify-center gap-3 p-4 sm:gap-4 sm:p-8">
                {placeholder ? (
                  Array.from({ length: placeholder.outputs }, (_, index) => (
                    <div key={index} className="flex h-full min-w-0 flex-1 items-center justify-center">
                      {/* eslint-disable-next-line @next/next/no-img-element -- inline sizing placeholder, not a real asset */}
                      <img src={placeholderSrc(placeholder.aspectRatio)} alt="" className="max-h-full max-w-full animate-pulse rounded-[20px] bg-(--app-fill-strong)" />
                    </div>
                  ))
                ) : staged.length > 0 ? (
                  staged.map((src, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => setSelectedIndex(index)}
                      onDoubleClick={() => onSelect(src)}
                      aria-label={pickIsMulti ? `Choose variation ${index + 1}` : "Staged image"}
                      aria-pressed={pickIsMulti ? index === selectedIndex : undefined}
                      className={cn("flex h-full min-w-0 flex-1 items-center justify-center outline-none", !pickIsMulti && "cursor-default")}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element -- generated image arrives as a data URL, not a static asset */}
                      <img
                        src={src}
                        alt={`Image ${index + 1}`}
                        className={cn(
                          "max-h-full max-w-full rounded-[20px] border border-slate-200 bg-slate-50 shadow-sm transition-[box-shadow,opacity] duration-150 dark:border-white/[0.08] dark:bg-white/[0.03]",
                          pickIsMulti && index === selectedIndex && "ring-2 ring-blue-500 ring-offset-4 ring-offset-white dark:ring-offset-[#131318]",
                          pickIsMulti && index !== selectedIndex && "opacity-70 hover:opacity-100"
                        )}
                      />
                    </button>
                  ))
                ) : (
                  <div className="flex max-w-sm flex-col items-center text-center">
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500 dark:bg-white/[0.06] dark:text-slate-400">
                      <ImageIcon className="h-5 w-5" />
                    </span>
                    <p className="mt-4 text-[17px] font-semibold text-slate-900 dark:text-white">Nothing staged yet</p>
                    <p className="mt-1.5 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                      Describe an image below, or attach one you already have, to use as your {frameLabel}.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {(staged.length > 0 || placeholder) && (
              <div className="flex h-14 shrink-0 items-center justify-center gap-2 px-4">
                {placeholder ? (
                  <span className="flex items-center gap-2 text-sm font-medium text-slate-500 dark:text-slate-400">
                    <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                    {pending ? "Generating…" : "Loading…"}
                  </span>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={editStaged}
                      title="Use as a reference and describe a change"
                      className={cn(COMPOSER_PILL_SHAPE, COMPOSER_PILL_IDLE, "px-4")}
                    >
                      <Pencil className="h-4 w-4" />
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => downloadDataUrl(staged[selectedIndex], `${frameLabel.replace(/\s+/g, "-")}.png`)}
                      className={cn(COMPOSER_PILL_SHAPE, COMPOSER_PILL_IDLE, "px-4")}
                    >
                      <Download className="h-4 w-4" />
                      Download
                    </button>
                    <button
                      type="button"
                      onClick={() => onSelect(staged[selectedIndex])}
                      className="flex h-9 items-center gap-1.5 rounded-full bg-btn-primary px-4 text-sm font-semibold text-white outline-none transition-colors hover:bg-btn-primary-hover focus-visible:ring-2 focus-visible:ring-blue-400/60 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#131318]"
                    >
                      <Check className="h-4 w-4" strokeWidth={2.5} />
                      {confirmLabel}
                    </button>
                  </>
                )}
              </div>
            )}

            {error && (
              <p className="px-5 pb-2 text-center text-sm font-medium text-red-500" role="alert">
                {error}
              </p>
            )}

            {/* Prompt bar */}
            <div className="shrink-0 px-3 pb-3 sm:px-4 sm:pb-4">
              <div className="rounded-[22px] border border-slate-200 bg-white p-2.5 shadow-sm transition-[border-color,box-shadow] duration-200 focus-within:border-blue-500 focus-within:shadow-[0_0_0_4px_rgba(51,92,255,0.12)] dark:border-white/[0.08] dark:bg-white/[0.02] dark:focus-within:border-blue-500/70">
                {refImages.length > 0 && (
                  <div className="flex gap-2 px-1.5 pb-1 pt-1">
                    {refImages.map((image, index) => (
                      <div key={index} className="group/ref relative h-14 w-14 shrink-0 overflow-hidden rounded-xl ring-1 ring-slate-200 dark:ring-white/10">
                        {/* eslint-disable-next-line @next/next/no-img-element -- attached image held as a data URL */}
                        <img src={image} alt={`Attached image ${index + 1}`} className="h-full w-full object-cover" />
                        <button
                          type="button"
                          onClick={() => setRefImages((prev) => prev.filter((_, i) => i !== index))}
                          aria-label={`Remove attached image ${index + 1}`}
                          className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity focus-visible:opacity-100 group-hover/ref:opacity-100 pointer-coarse:opacity-100"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <textarea
                  ref={textareaRef}
                  value={prompt}
                  readOnly={isEnhancing}
                  onChange={(event) => {
                    setPrompt(event.target.value);
                    setPromptBeforeEnhance(null);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                      event.preventDefault();
                      void handleGenerate();
                    }
                  }}
                  placeholder="Describe the image you want to generate..."
                  rows={3}
                  className={cn(
                    "block max-h-48 min-h-[76px] w-full resize-none bg-transparent px-2 pt-1.5 text-[15px] leading-relaxed text-slate-900 outline-none placeholder:text-slate-400 dark:text-white dark:placeholder:text-zinc-500",
                    isEnhancing && "animate-pulse"
                  )}
                />

                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={refImages.length >= MAX_REFERENCE_IMAGES}
                    aria-label="Attach images"
                    title="Attach images"
                    className={cn(COMPOSER_PILL_SHAPE, COMPOSER_PILL_IDLE, "w-9 justify-center")}
                  >
                    <Plus className="h-[18px] w-[18px]" strokeWidth={1.75} />
                  </button>
                  <ChoicePill
                    ariaLabel="Model"
                    placement="above"
                    value={selectedModel}
                    onChange={setSelectedModel}
                    triggerIcon={<Sparkle className="h-3.5 w-3.5 fill-current" />}
                    panelClassName="w-[min(320px,calc(100vw-3rem))]"
                    options={MODEL_OPTIONS.map((option) => ({
                      value: option.value,
                      label: option.label,
                      description: option.description,
                      icon: <Image src={option.icon} alt="" width={16} height={16} className={cn("h-4 w-4", option.invertDark && "dark:invert")} />,
                    }))}
                  />
                  <ChoicePill
                    ariaLabel="Aspect ratio"
                    placement="above"
                    value={aspectRatio}
                    onChange={setAspectRatio}
                    triggerIcon={<RatioGlyph ratio={aspectRatio} />}
                    panelClassName="max-h-80 w-40 overflow-y-auto"
                    options={ASPECT_RATIOS.map((value) => ({ value, label: value }))}
                  />
                  <ChoicePill
                    ariaLabel="Variations"
                    placement="above"
                    value={String(outputs)}
                    onChange={(value) => setOutputs(Number(value))}
                    panelClassName="w-44"
                    options={[1, 2, 3, 4].map((value) => ({ value: String(value), label: `${value} variation${value > 1 ? "s" : ""}` }))}
                  />
                  {(showQuality || showResolution) && (
                    <SettingsPill
                      quality={quality}
                      onQualityChange={setQuality}
                      resolution={resolution}
                      onResolutionChange={(value) => setResolution(value as (typeof RESOLUTIONS)[number])}
                      showQuality={showQuality}
                      showResolution={showResolution}
                    />
                  )}

                  <div className="ml-auto flex items-center gap-1.5">
                    {promptBeforeEnhance !== null && (
                      <button
                        type="button"
                        onClick={() => {
                          setPrompt(promptBeforeEnhance);
                          setPromptBeforeEnhance(null);
                        }}
                        className={cn(COMPOSER_PILL_SHAPE, "px-3 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/[0.07]")}
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        Undo
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => void handleEnhance()}
                      disabled={!prompt.trim() || isEnhancing || isGenerating}
                      title="Rewrite your prompt with more detail"
                      className={cn(COMPOSER_PILL_SHAPE, COMPOSER_PILL_IDLE, "px-3.5 text-slate-600 dark:text-slate-300")}
                    >
                      {isEnhancing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                      Enhance
                    </button>
                    <div className="flex h-10 items-center gap-2 rounded-full bg-slate-100 py-1 pl-3 pr-1 dark:bg-white/[0.07]">
                      <span className="flex items-center gap-1.5 text-sm font-medium tabular-nums text-slate-800 dark:text-slate-100" title={`${estimatedCost} credits`}>
                        <SquarePlay className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        {estimatedCost}
                      </span>
                      <button
                        type="button"
                        onClick={() => void handleGenerate()}
                        disabled={!canSubmit}
                        aria-label="Generate"
                        className="flex h-8 w-8 items-center justify-center rounded-full bg-[radial-gradient(160%_160%_at_30%_20%,#6d9bff_0%,#335cff_60%,#1c3fd6_100%)] text-white shadow-[0_4px_12px_-4px_rgba(51,92,255,0.7),inset_0_1px_0_rgba(255,255,255,0.45)] transition-[transform,opacity] duration-200 active:scale-95 disabled:pointer-events-none disabled:opacity-45"
                      >
                        {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" strokeWidth={2.5} />}
                      </button>
                    </div>
                  </div>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(event) => {
                    const files = Array.from(event.target.files ?? []);
                    event.target.value = "";
                    if (files.length > 0) void handleAttachFiles(files);
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      <TopUpModal isOpen={showTopUp} onClose={() => setShowTopUp(false)} />
    </div>,
    document.body
  );
}
