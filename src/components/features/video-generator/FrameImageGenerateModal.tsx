"use client";

import { motion } from "framer-motion";
import { Check, Download, ImageIcon, Loader2, Pencil, Plus, Sparkles, Upload, Wand2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { PillDropdown } from "@/components/ui/PillDropdown";
import { PlasticButton } from "@/components/ui/plastic-button";
import { CreditCost } from "@/components/ui/CreditCost";
import { TopUpModal } from "@/components/TopUpModal";
import { notifyCreditsChanged } from "@/lib/client/credits-bus";
import { getImageGenerationCost, type ImageQuality, type ImageResolution } from "@/lib/config/pricing";
import { pollUntilSettled } from "@/lib/polling";
import { fetchImageAsDataUrl } from "@/lib/client/lazy-image";
import { cn, downloadDataUrl, formatDate, readFileAsDataUrl } from "@/lib/utils";
import {
  ASPECT_RATIO_OPTIONS,
  MODEL_OPTIONS,
  OUTPUT_OPTIONS,
  QUALITY_LADDER_MODELS,
  QUALITY_OPTIONS,
  RESOLUTIONS,
  RESOLUTION_MODELS,
  resolveModelForCost,
} from "@/components/features/ImageGenerator";

const MAX_REFERENCE_IMAGE_BYTES = 8 * 1024 * 1024;
// Matches the backend's MAX_REFERENCE_IMAGES (generate-image/route.ts).
const MAX_REFERENCE_IMAGES = 4;

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
  /** Human label for the frame being filled, used in the empty-state copy. */
  frameLabel: "first frame" | "last frame" | "reference image";
  defaultAspectRatio: string;
  onClose: () => void;
  onSelect: (dataUrl: string) => void;
}

/**
 * Full-screen "generate an image for this frame" modal -- mirrors the
 * competitor's dedicated image-generator flyout that opens from the
 * Start/End frame tile's "AI Generate" menu item, instead of the cramped
 * inline prompt row this used to be. Shares its model/aspect-ratio/output
 * controls with the standalone ImageGenerator page (see the exports it
 * pulls in) so the two stay visually and behaviorally in sync.
 */
export function FrameImageGenerateModal({ frameLabel, defaultAspectRatio, onClose, onSelect }: FrameImageGenerateModalProps) {
  const [prompt, setPrompt] = useState("");
  const [selectedModel, setSelectedModel] = useState("Nano Banana 2");
  const [aspectRatio, setAspectRatio] = useState(defaultAspectRatio);
  const [outputs, setOutputs] = useState(1);
  const [quality, setQuality] = useState("auto");
  const [resolution, setResolution] = useState<(typeof RESOLUTIONS)[number]>("1K");
  const [refImages, setRefImages] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showTopUp, setShowTopUp] = useState(false);
  // True while fetching a history row's full-resolution image on demand
  // (the sidebar only has a small lazily-loaded thumbnail -- see the
  // LIST_SELECT comment in generate-image/route.ts).
  const [isLoadingHistoryPreview, setIsLoadingHistoryPreview] = useState(false);

  const [history, setHistory] = useState<GenerationHistoryItem[] | null>(null);
  // Tracks which history row is currently previewed in the main canvas, so
  // the sidebar can highlight it -- cleared once the user moves on (new
  // generation, edit-as-reference, or "+ New").
  const [activeHistoryId, setActiveHistoryId] = useState<string | null>(null);
  const pollCancelRef = useRef<(() => void) | null>(null);

  const canSubmit = prompt.trim().length > 0 && !isGenerating;
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
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
          setGeneratedImages(match.images ?? []);
          notifyCreditsChanged();
        }
        setIsGenerating(false);
      },
      {
        intervalMs: 3000,
        timeoutMs: 6.5 * 60 * 1000,
        onTimeout: () => {
          setError("This is taking longer than expected. Please try again.");
          setIsGenerating(false);
        },
      }
    );
  }

  async function handleGenerate() {
    if (!canSubmit) return;

    setIsGenerating(true);
    setError(null);
    setGeneratedImages([]);
    setActiveHistoryId(null);

    try {
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
          referenceImages: refImages.length > 0 ? refImages : undefined,
        }),
      });

      if (response.status === 402) {
        setShowTopUp(true);
        setIsGenerating(false);
        return;
      }

      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error ?? "Failed to generate images.");

      pollGenerationStatus(data.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
      setIsGenerating(false);
    }
  }

  function startNew() {
    setPrompt("");
    setGeneratedImages([]);
    setError(null);
    setActiveHistoryId(null);
    setRefImages([]);
  }

  // Appends to the reference set (up to MAX_REFERENCE_IMAGES) rather than
  // replacing it -- this used to overwrite the single stored reference,
  // silently dropping the previous one whenever a second was added.
  async function handleRefImageChange(file: File | null) {
    if (!file) return;
    if (refImages.length >= MAX_REFERENCE_IMAGES) {
      setError(`You can attach up to ${MAX_REFERENCE_IMAGES} reference images.`);
      return;
    }
    if (file.size > MAX_REFERENCE_IMAGE_BYTES) {
      setError("Reference image is too large (max 8MB).");
      return;
    }
    try {
      const dataUrl = await readFileAsDataUrl(file);
      setError(null);
      setRefImages((prev) => [...prev, dataUrl]);
    } catch {
      setError("Could not read that image.");
    }
  }

  // Carries the currently-previewed image (fresh generation or a history
  // pick) forward as an added reference for a follow-up edit -- clears the
  // preview so the prompt bar is the focus again, ready for the user to
  // describe what should change.
  function applyAsReference(dataUrl: string) {
    setRefImages((prev) => (prev.includes(dataUrl) || prev.length >= MAX_REFERENCE_IMAGES ? prev : [...prev, dataUrl]));
    setGeneratedImages([]);
    setActiveHistoryId(null);
    setError(null);
  }

  const [w, h] = aspectRatio.split(":").map(Number);
  const historyLoading = history === null;
  const completedHistory = history?.filter((item) => item.status === "completed" && item.outputs > 0) ?? [];

  // Flattens the pending generation (if any) + completed history into a
  // single ordered list with "Today" / "Yesterday" / date section headers
  // interleaved -- mirrors the competitor's grouped sidebar instead of one
  // undifferentiated list.
  type SidebarRow = { kind: "header"; label: string } | { kind: "pending" } | { kind: "item"; item: GenerationHistoryItem };
  const sidebarRows: SidebarRow[] = [];
  {
    const rawRows: (Extract<SidebarRow, { kind: "pending" | "item" }>)[] = [
      ...(isGenerating ? [{ kind: "pending" as const }] : []),
      ...completedHistory.map((item) => ({ kind: "item" as const, item })),
    ];
    let lastLabel: string | null = null;
    for (const row of rawRows) {
      const createdAt = row.kind === "pending" ? new Date().toISOString() : row.item.created_at;
      const label = dateGroupLabel(createdAt);
      if (label !== lastLabel) {
        sidebarRows.push({ kind: "header", label });
        lastLabel = label;
      }
      sidebarRows.push(row);
    }
  }

  // Portaled to <body> -- this can be opened from deep inside a `relative
  // isolate` ancestor (e.g. VideoGenerator's glow-scoping wrapper), which
  // traps a nested `fixed` element's z-index inside that stacking context
  // and stops it from painting above the app shell's header/sidebar.
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
        className="flex h-full max-h-[880px] w-[96vw] max-w-[1900px] overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-[#131318]"
      >
        {/* History sidebar */}
        <div className="hidden w-60 shrink-0 flex-col border-r border-slate-200 p-4 dark:border-white/[0.08] sm:flex">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">History</span>
            <button
              type="button"
              onClick={startNew}
              aria-label="New generation"
              className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50 dark:border-white/10 dark:text-slate-400 dark:hover:bg-white/[0.06]"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {historyLoading ? (
              <div className="flex h-32 flex-col items-center justify-center gap-2 text-slate-300 dark:text-slate-600">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : !isGenerating && completedHistory.length === 0 ? (
              <div className="flex h-32 flex-col items-center justify-center gap-2 text-slate-300 dark:text-slate-600">
                <ImageIcon className="h-6 w-6" />
                <span className="text-xs font-medium">No generations yet</span>
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                {sidebarRows.map((row, index) => {
                  if (row.kind === "header") {
                    return (
                      <p
                        key={`header-${row.label}-${index}`}
                        className={cn(
                          "px-2 pb-1 text-[10px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500",
                          index > 0 && "mt-2"
                        )}
                      >
                        {row.label}
                      </p>
                    );
                  }

                  if (row.kind === "pending") {
                    return (
                      <div key="pending" className="flex items-start gap-2.5 rounded-xl bg-blue-50 p-2 dark:bg-blue-500/10">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white dark:bg-white/[0.08]">
                          <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="line-clamp-2 text-xs font-semibold leading-snug text-blue-600 dark:text-blue-400">
                            {prompt || "Generating..."}
                          </span>
                          <span className="block text-[11px] text-blue-400/80 dark:text-blue-400/70">Generating...</span>
                        </span>
                      </div>
                    );
                  }

                  return (
                    <button
                      key={row.item.id}
                      type="button"
                      onClick={async () => {
                        setActiveHistoryId(row.item.id);
                        setPrompt(row.item.prompt);
                        if (ASPECT_RATIO_OPTIONS.some((option) => option.value === row.item.aspect_ratio)) {
                          setAspectRatio(row.item.aspect_ratio);
                        }
                        if (MODEL_OPTIONS.some((option) => option.value === row.item.model)) {
                          setSelectedModel(row.item.model);
                        }
                        setError(null);
                        setGeneratedImages([]);
                        setIsLoadingHistoryPreview(true);
                        try {
                          const dataUrl = await fetchImageAsDataUrl(row.item.id, 0);
                          setGeneratedImages([dataUrl]);
                        } catch {
                          setError("Could not load that image.");
                        } finally {
                          setIsLoadingHistoryPreview(false);
                        }
                      }}
                      className={cn(
                        "flex items-start gap-2.5 rounded-xl p-2 text-left transition-colors hover:bg-slate-50 dark:hover:bg-white/[0.06]",
                        activeHistoryId === row.item.id && "bg-blue-50 dark:bg-blue-500/10"
                      )}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element -- lazily-resized thumbnail served by /api/library/image, not a static asset */}
                      <img
                        src={`/api/library/image/${row.item.id}/0?w=80`}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        className="h-10 w-10 shrink-0 rounded-lg object-cover"
                      />
                      <span className="min-w-0 flex-1">
                        <span
                          className={cn(
                            "line-clamp-2 text-xs font-medium leading-snug",
                            activeHistoryId === row.item.id ? "text-blue-600 dark:text-blue-400" : "text-slate-700 dark:text-slate-200"
                          )}
                        >
                          {row.item.prompt}
                        </span>
                        <span className="block text-[11px] text-slate-400">{formatDate(row.item.created_at)}</span>
                      </span>
                    </button>
                  );
                })}
                {completedHistory.length > 0 && (
                  <p className="mt-2 pb-1 text-center text-[11px] text-slate-300 dark:text-slate-600">You&apos;ve reached the end</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Main */}
        <div className="relative flex min-w-0 flex-1 flex-col">
          <div className="flex items-center justify-end gap-2 border-b border-slate-200 p-4 dark:border-white/[0.08]">
            {!isGenerating && generatedImages.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={() => applyAsReference(generatedImages[0])}
                  className="flex items-center gap-1.5 rounded-full border border-slate-200 px-4 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/[0.06]"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => downloadDataUrl(generatedImages[0], `${frameLabel.replace(/\s+/g, "-")}.png`)}
                  className="flex items-center gap-1.5 rounded-full border border-slate-200 px-4 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/[0.06]"
                >
                  <Download className="h-3.5 w-3.5" />
                  Download
                </button>
                <button
                  type="button"
                  onClick={() => onSelect(generatedImages[0])}
                  className="flex items-center gap-1.5 rounded-full bg-blue-500 px-4 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-blue-600"
                >
                  <Check className="h-3.5 w-3.5" />
                  Select
                </button>
              </>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-slate-200 px-4 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/[0.06]"
            >
              Close
            </button>
          </div>

          <div className="flex flex-1 items-center justify-center overflow-y-auto p-8">
            {isGenerating ? (
              <div className="flex flex-col items-center gap-4">
                <div
                  className="grid place-items-center gap-3"
                  style={{ gridTemplateColumns: `repeat(${Math.min(outputs, 2)}, 1fr)` }}
                >
                  {Array.from({ length: outputs }, (_, i) => (
                    <div
                      key={i}
                      className="max-h-[55vh] max-w-full rounded-[28px] bg-gradient-to-br from-slate-100 via-slate-50 to-slate-200 dark:from-zinc-800 dark:via-zinc-900 dark:to-zinc-800"
                      style={{ aspectRatio: `${w} / ${h}` }}
                    />
                  ))}
                </div>
                <div className="flex items-center gap-2 text-sm font-medium text-slate-400 dark:text-slate-500">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500" />
                  Generating...
                </div>
              </div>
            ) : isLoadingHistoryPreview ? (
              <div
                className="max-h-[55vh] max-w-full animate-pulse rounded-[28px] bg-gradient-to-br from-slate-100 via-slate-50 to-slate-200 dark:from-zinc-800 dark:via-zinc-900 dark:to-zinc-800"
                style={{ aspectRatio: `${w} / ${h}` }}
              />
            ) : generatedImages.length > 0 ? (
              <div
                className="grid place-items-center gap-3"
                style={{ gridTemplateColumns: `repeat(${Math.min(outputs, 2)}, 1fr)` }}
              >
                {generatedImages.map((src, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => onSelect(src)}
                    className="group relative max-h-[55vh] max-w-full overflow-hidden rounded-[28px] border border-slate-200 shadow-sm transition-transform hover:scale-[1.02] dark:border-zinc-800"
                    style={{ aspectRatio: `${w} / ${h}` }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- generated image arrives as a data URL, not a static asset */}
                    <img src={src} alt={`Generated image ${index + 1}`} className="h-full w-full object-cover" />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all duration-150 group-hover:bg-black/40 group-hover:opacity-100">
                      <span className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-900">Use this image</span>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 text-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 dark:bg-blue-500/10">
                  <Sparkles className="h-6 w-6 text-blue-500" />
                </span>
                <div>
                  <p className="text-base font-bold text-slate-900 dark:text-white">Generate an image</p>
                  <p className="mt-1 text-sm text-slate-400">Describe an image to use as a {frameLabel}.</p>
                </div>
              </div>
            )}
          </div>

          {error && (
            <p className="px-6 pb-2 text-sm font-medium text-red-500" role="alert">
              {error}
            </p>
          )}

          {/* Prompt + controls */}
          <div className="border-t border-slate-200 p-4 dark:border-white/[0.08]">
            {refImages.length > 0 && (
              <div className="mb-2 flex items-center gap-2">
                {refImages.map((image, index) => (
                  <div
                    key={index}
                    className="group/ref relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl ring-1 ring-slate-200 dark:ring-white/10"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- reference-image thumbnail from a stored data URL */}
                    <img src={image} alt="" className="h-full w-full object-cover" />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all duration-150 group-hover/ref:bg-black/40 group-hover/ref:opacity-100">
                      <button
                        type="button"
                        onClick={() => setRefImages((prev) => prev.filter((_, i) => i !== index))}
                        aria-label={`Remove reference image ${index + 1}`}
                        className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-slate-700 shadow-sm hover:bg-slate-100"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))}
                {refImages.length < MAX_REFERENCE_IMAGES && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    aria-label="Add reference image"
                    className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-dashed border-slate-300 text-slate-400 transition-colors hover:border-blue-400 hover:text-blue-500 dark:border-zinc-700 dark:text-slate-500 dark:hover:border-blue-400/50 dark:hover:text-blue-400"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                )}
              </div>
            )}

            <textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="Describe the image you want to generate..."
              className="min-h-[140px] w-full resize-none rounded-2xl bg-slate-100 p-3 text-sm font-bold leading-relaxed text-slate-900 outline-none placeholder:font-normal placeholder:text-slate-400 dark:bg-white/[0.04] dark:text-white dark:placeholder:text-zinc-500"
            />

            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <PillDropdown value={selectedModel} options={MODEL_OPTIONS} onChange={setSelectedModel} openUp />
              <PillDropdown value={aspectRatio} options={ASPECT_RATIO_OPTIONS} onChange={setAspectRatio} openUp />
              {QUALITY_LADDER_MODELS.has(selectedModel) && (
                <PillDropdown value={quality} options={QUALITY_OPTIONS} onChange={setQuality} labelPrefix="Quality" openUp />
              )}
              <PillDropdown value={String(outputs)} options={OUTPUT_OPTIONS} onChange={(value) => setOutputs(Number(value))} openUp />

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  "flex shrink-0 items-center gap-1 whitespace-nowrap rounded-xl border px-2.5 py-1.5 text-xs font-medium shadow-sm outline-none transition-colors duration-150 active:scale-[0.97]",
                  refImages.length > 0
                    ? "border-blue-200 bg-blue-50 text-blue-600 dark:border-blue-400/30 dark:bg-blue-500/10 dark:text-blue-400"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-white/[0.07] dark:bg-white/[0.06] dark:text-slate-200 dark:hover:border-white/[0.12] dark:hover:bg-white/[0.1]"
                )}
              >
                {refImages.length === 0 && <Upload className="h-3 w-3 shrink-0" />}
                {refImages.length > 0 ? `${refImages.length} Ref${refImages.length > 1 ? "s" : ""}` : "Ref Image"}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => void handleRefImageChange(event.target.files?.[0] ?? null)}
              />

              {RESOLUTION_MODELS.has(selectedModel) && (
                <PillDropdown
                  value={resolution}
                  options={RESOLUTIONS.map((value) => ({ value, label: value }))}
                  onChange={(value) => setResolution(value as (typeof RESOLUTIONS)[number])}
                  labelPrefix="Settings"
                  openUp
                />
              )}

              <button
                type="button"
                disabled
                aria-disabled="true"
                className="flex shrink-0 cursor-not-allowed items-center gap-1 whitespace-nowrap rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-300 opacity-60 dark:border-white/[0.07] dark:bg-white/[0.06] dark:text-slate-500"
              >
                <Wand2 className="h-3 w-3 shrink-0" />
                Enhance Prompt
              </button>

              <PlasticButton
                text="Generate"
                loading={isGenerating}
                disabled={!canSubmit}
                onClick={handleGenerate}
                trailing={<CreditCost amount={estimatedCost} className="text-blue-200/80" />}
                className="ml-auto shrink-0 !rounded-xl !px-4 !py-2 !text-sm font-semibold"
              />
            </div>
          </div>
        </div>
      </motion.div>

      <TopUpModal isOpen={showTopUp} onClose={() => setShowTopUp(false)} />
    </div>,
    document.body
  );
}
