"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  Check,
  Copy,
  Download,
  ExternalLink,
  GalleryVerticalEnd,
  ImageIcon,
  LayoutGrid,
  Loader2,
  Minus,
  Plus,
  Search,
  Sparkles,
  SlidersHorizontal,
  Upload,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { PillDropdown } from "@/components/ui/PillDropdown";
import { PlasticButton } from "@/components/ui/plastic-button";
import { CreditCost } from "@/components/ui/CreditCost";
import { TopUpModal } from "@/components/TopUpModal";
import { BorderTrail } from "@/components/ui/BorderTrail";
import { notifyCreditsChanged } from "@/lib/client/credits-bus";
import { getImageGenerationCost, type ImageQuality, type ImageResolution } from "@/lib/config/pricing";
import { pollUntilSettled } from "@/lib/polling";
import { cn, formatDate } from "@/lib/utils";

const GEMINI_ICON = "/logos/ai/gemini.png";
const GPT_ICON = "/logos/ai/chatgpt.png";

const MODEL_OPTIONS = [
  { value: "Nano Banana", label: "Nano Banana", icon: GEMINI_ICON, description: "Fast, lower quality — 1 credit" },
  { value: "Nano Banana 2", label: "Nano Banana 2", icon: GEMINI_ICON, description: "Recommended — 2-3 credits" },
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

const ASPECT_RATIOS = ["9:16", "16:9", "1:1", "4:3", "3:4", "3:2", "2:3", "4:5", "5:4", "21:9"];
const ASPECT_RATIO_OPTIONS = ASPECT_RATIOS.map((value) => ({ value, label: value, ratio: value }));

const OUTPUT_OPTIONS = [1, 2, 3, 4].map((value) => ({
  value: String(value),
  label: `${value} Output${value > 1 ? "s" : ""}`,
}));

const QUALITY_OPTIONS = [
  { value: "auto", label: "Auto" },
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

// Models with a tunable Quality control -- Nano Banana 2 has no fal.ai
// equivalent with a real quality knob, so its tiers swap to a better model
// instead (QUALITY_MODEL_LADDER in cloudflare-image.ts). GPT Image 2's real
// fal.ai model has a genuine quality param, so its tiers apply directly
// without changing models. Nano Banana Pro (the top of the ladder) has
// nothing better to swap to and no native quality param either, so it
// doesn't get this control.
const QUALITY_LADDER_MODELS = new Set(["Nano Banana 2", "GPT Image 2"]);

// Models where Resolution is a real, working lever server-side: the two
// ladder models above (via width/height scaling on their Cloudflare calls)
// plus Nano Banana Pro, whose fal.ai endpoint has a genuine 1K/2K/4K
// `resolution` param (see fal-image.ts).
const RESOLUTION_MODELS = new Set(["Nano Banana 2", "GPT Image 2", "Nano Banana Pro"]);

const RESOLUTIONS = ["512px", "1K", "2K", "4K"] as const;

// Mirrors resolveQualityModel() in src/lib/server/cloudflare-image.ts (kept
// separate rather than imported, since that file is server-only and pulls in
// fal-image.ts). Only used here to price the button correctly -- the real
// resolution that determines the actual charge always happens server-side.
const COST_QUALITY_LADDER: Record<string, string[]> = {
  "Nano Banana 2": ["Nano Banana 2", "Nano Banana Pro"],
};
const COST_QUALITY_TIER_INDEX: Record<string, number> = { auto: 0, low: 0, medium: 1, high: Infinity };
function resolveModelForCost(model: string, quality: string): string {
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
  images: string[];
  status: "generating" | "completed" | "failed";
  error_message: string | null;
  created_at: string;
}

type MosaicCell = { kind: "pending" } | { kind: "item"; item: GenerationHistoryItem };

interface PreviewItem {
  src: string;
  prompt: string;
  model: string;
  createdAt: string;
}

function getMimeType(dataUrl: string): string {
  return dataUrl.match(/^data:([^;]+);/)?.[1] ?? "unknown";
}

function getDataUrlSize(dataUrl: string): string {
  const base64 = dataUrl.split(",")[1] ?? "";
  const padding = base64.match(/=+$/)?.[0].length ?? 0;
  const bytes = (base64.length * 3) / 4 - padding;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
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

function openDataUrlInNewTab(dataUrl: string) {
  const [header, base64] = dataUrl.split(",");
  const mime = header.match(/^data:([^;]+);/)?.[1] ?? "image/jpeg";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const url = URL.createObjectURL(new Blob([bytes], { type: mime }));
  window.open(url, "_blank");
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

export function ImageGenerator() {
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
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showTopUp, setShowTopUp] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<"generate" | "history">("generate");
  const [history, setHistory] = useState<GenerationHistoryItem[] | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const [previewItem, setPreviewItem] = useState<PreviewItem | null>(null);
  const [previewDims, setPreviewDims] = useState<{ width: number; height: number } | null>(null);
  const [promptCopied, setPromptCopied] = useState(false);

  const [pendingCount, setPendingCount] = useState(0);
  const [pendingAspectRatio, setPendingAspectRatio] = useState(aspectRatio);

  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [galleryLayout, setGalleryLayout] = useState<"Grid" | "Mosaic">("Mosaic");
  const [galleryZoom, setGalleryZoom] = useState(50);
  const [filterGenerations, setFilterGenerations] = useState(true);
  const [filterUpscales, setFilterUpscales] = useState(false);
  const [filterUploads, setFilterUploads] = useState(false);
  const filterMenuRef = useRef<HTMLDivElement>(null);

  const pollCancelRef = useRef<(() => void) | null>(null);

  const canSubmit = prompt.trim().length > 0 && !isGenerating;

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
      ...Array.from({ length: pendingCount }, (): MosaicCell => ({ kind: "pending" })),
      ...(visibleHistory ?? []).map((item): MosaicCell => ({ kind: "item", item })),
    ];
    const columns: MosaicCell[][] = Array.from({ length: galleryColumns }, () => []);
    cells.forEach((cell, index) => {
      columns[index % galleryColumns].push(cell);
    });
    return columns;
  }, [pendingCount, visibleHistory, galleryColumns]);

  useEffect(() => {
    loadHistory();
    return () => pollCancelRef.current?.();
  }, []);

  useEffect(() => {
    setPromptCopied(false);
  }, [previewItem]);

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
      .then((response) => {
        if (!response.ok) throw new Error();
        return response.json();
      })
      .then((data) => {
        const items: GenerationHistoryItem[] = data.generations ?? [];
        setHistory(items);

        // A generation that's still running (e.g. the page was reloaded, or
        // the previous poll loop was interrupted) has no client-side poller
        // watching it -- resume one so it doesn't get stuck looking finished.
        const stillGenerating = items.find((item) => item.status === "generating");
        if (stillGenerating && !pollCancelRef.current) {
          setIsGenerating(true);
          setPendingAspectRatio(stillGenerating.aspect_ratio);
          setPendingCount(stillGenerating.outputs);
          pollGenerationStatus(stillGenerating.id);
        }
      })
      .catch(() => setHistoryError("Couldn't load your generation history."))
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
  function pollGenerationStatus(id: string) {
    pollCancelRef.current?.();
    pollCancelRef.current = pollUntilSettled<GenerationHistoryItem[]>(
      async () => {
        const response = await fetch("/api/generate-image");
        if (!response.ok) throw new Error();
        const data = await response.json();
        return data.generations ?? [];
      },
      (items) => {
        const match = items.find((item) => item.id === id);
        return !!match && match.status !== "generating";
      },
      (items) => {
        setHistory(items);

        const match = items.find((item) => item.id === id);
        if (!match || match.status === "generating") return;

        if (match.status === "failed") {
          setError(match.error_message ?? "Something went wrong. Try again.");
        } else {
          setGeneratedImages(match.images);
          // The charge for this generation lands right before the row flips
          // to "completed" (see generate-image/route.ts's after() block) --
          // safe to signal now rather than waiting for the header's next poll.
          notifyCreditsChanged();
        }
        setIsGenerating(false);
        setPendingCount(0);
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
          setIsGenerating(false);
          setPendingCount(0);
        },
      }
    );
  }

  async function handleGenerate() {
    if (!canSubmit) return;

    setIsGenerating(true);
    setError(null);
    setGeneratedImages([]);
    setPendingAspectRatio(aspectRatio);
    setPendingCount(outputs);

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
          referenceImage,
        }),
      });

      if (response.status === 402) {
        setShowTopUp(true);
        setIsGenerating(false);
        setPendingCount(0);
        return;
      }

      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error ?? "Failed to generate images.");

      pollGenerationStatus(data.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
      setIsGenerating(false);
      setPendingCount(0);
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
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          "flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl border px-3 py-2 text-sm font-medium tracking-[-0.01em] shadow-sm outline-none transition-colors duration-150 active:scale-[0.97]",
          "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50",
          "dark:border-white/[0.07] dark:bg-white/[0.06] dark:text-slate-200 dark:shadow-none dark:hover:border-white/[0.12] dark:hover:bg-white/[0.1]",
          "focus-visible:ring-2 focus-visible:ring-blue-400/50 focus-visible:ring-offset-1 focus-visible:ring-offset-white dark:focus-visible:ring-blue-500/40 dark:focus-visible:ring-offset-zinc-950"
        )}
      >
        <Upload className="h-3.5 w-3.5 shrink-0" />
        {refImage ? refImage.name : "Ref Image"}
      </button>
      {refImage && (
        <button
          type="button"
          onClick={() => {
            setRefImage(null);
            if (fileInputRef.current) fileInputRef.current.value = "";
          }}
          aria-label="Remove reference image"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 shadow-sm transition-colors duration-150 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-800 active:scale-[0.97] dark:border-white/[0.07] dark:bg-white/[0.06] dark:text-slate-400 dark:shadow-none dark:hover:border-white/[0.12] dark:hover:bg-white/[0.1] dark:hover:text-slate-200"
        >
          <X className="h-3.5 w-3.5" />
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
      <div className="relative w-full px-6 pt-8 pb-20 sm:pt-12">
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
            <div className="mt-6 flex flex-col gap-4 pb-28">
              <section className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
                <h2 className="text-xs font-semibold tracking-wide text-slate-500">PROMPT</h2>
                <textarea
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  placeholder="Describe the image you want to generate..."
                  className="mt-3 min-h-[140px] w-full resize-none rounded-2xl bg-slate-100 p-4 text-slate-900 outline-none placeholder:text-slate-400 dark:bg-zinc-900 dark:text-white"
                />
              </section>

              <section className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
                <h2 className="text-xs font-semibold tracking-wide text-slate-500">REFERENCE IMAGE</h2>
                <p className="mt-1 text-sm text-slate-400">{refImage ? "1 of 1" : "0 of 1"} reference image added.</p>
                <div className="mt-3 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex flex-1 items-center gap-3 rounded-2xl border border-dashed border-slate-300 p-4 text-left dark:border-zinc-700"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 dark:bg-zinc-900">
                      <Upload className="h-4 w-4 text-slate-500" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-slate-900 dark:text-white">
                        {refImage ? refImage.name : "Upload reference image"}
                      </span>
                      <span className="block text-xs text-slate-400">PNG, JPG, WebP, or GIF</span>
                    </span>
                    <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500 dark:bg-zinc-900">
                      {refImage ? "1/1" : "0/1"}
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

              {error && (
                <p className="text-sm font-medium text-red-500" role="alert">
                  {error}
                </p>
              )}

              {generatedImages.length > 0 && (
                <div className={`grid gap-3 ${outputs === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
                  {generatedImages.map((src, index) => (
                    <div
                      key={index}
                      className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element -- generated images arrive as data URLs, not static assets */}
                      <img src={src} alt={`Generated image ${index + 1}`} className="h-full w-full object-cover" />
                    </div>
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
                      onClick={() =>
                        setPreviewItem({
                          src: item.images[0],
                          prompt: item.prompt,
                          model: item.model,
                          createdAt: item.created_at,
                        })
                      }
                      className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 text-left dark:border-zinc-800 dark:bg-zinc-950"
                    >
                      {item.images[0] && (
                        // eslint-disable-next-line @next/next/no-img-element -- generation history thumbnail from stored data URL
                        <img
                          src={item.images[0]}
                          alt=""
                          className="h-14 w-14 shrink-0 rounded-xl object-cover"
                        />
                      )}
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
            <div className="fixed inset-x-4 bottom-4 z-20">
              <PlasticButton
                text="Generate"
                loading={isGenerating}
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
                // Crisp hairline ring + dark ambient shadow for definition
                // against the black page -- no colored glow bloom.
                "dark:shadow-[0_1px_0_rgba(255,255,255,0.03),0_0_0_1px_rgba(255,255,255,0.06),0_24px_60px_-20px_rgba(0,0,0,0.65)]"
              )}
            >
              {/* Gradient stroke, masked to the border ring only so it never
                  bleeds into the semi-transparent white panel beneath it. */}
              <div
                aria-hidden="true"
                className={cn(
                  "pointer-events-none absolute inset-0 rounded-[inherit] border-2 border-transparent bg-gradient-to-br from-sky-400 to-cyan-300",
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
                  "relative flex w-full flex-col rounded-[26px] bg-white/60 px-9 py-6 backdrop-blur-2xl backdrop-saturate-150",
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
              className="min-h-[120px] w-full resize-none bg-transparent text-sm leading-relaxed text-slate-900 outline-none placeholder:text-slate-400 dark:text-white dark:placeholder:text-zinc-500"
            />

            <div className="mt-4 flex flex-nowrap items-center gap-2">
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
                      "flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl border px-3 py-2 text-sm font-medium tracking-[-0.01em] shadow-sm outline-none transition-colors duration-150 active:scale-[0.97]",
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
                loading={isGenerating}
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
                              aspectRatio={pendingAspectRatio}
                            />
                          );
                        }
                        const { item } = cell;
                        const [w, h] = item.aspect_ratio.split(":").map(Number);
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() =>
                              setPreviewItem({
                                src: item.images[0],
                                prompt: item.prompt,
                                model: item.model,
                                createdAt: item.created_at,
                              })
                            }
                            className="group block w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md dark:border-zinc-800 dark:bg-zinc-950"
                          >
                            {item.images[0] && (
                              // eslint-disable-next-line @next/next/no-img-element -- generation history thumbnail from stored data URL
                              <img
                                src={item.images[0]}
                                alt=""
                                style={{ aspectRatio: `${w} / ${h}` }}
                                className="w-full object-cover"
                              />
                            )}
                          </button>
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
                    <button
                      key={item.id}
                      type="button"
                      onClick={() =>
                        setPreviewItem({
                          src: item.images[0],
                          prompt: item.prompt,
                          model: item.model,
                          createdAt: item.created_at,
                        })
                      }
                      className="group aspect-square overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md dark:border-zinc-800 dark:bg-zinc-950"
                    >
                      {item.images[0] && (
                        // eslint-disable-next-line @next/next/no-img-element -- generation history thumbnail from stored data URL
                        <img src={item.images[0]} alt="" className="h-full w-full object-cover" />
                      )}
                    </button>
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
            !isGenerating && (
              <div className="mt-6 flex h-48 flex-col items-center justify-center gap-2 rounded-2xl bg-slate-50 text-slate-400 dark:bg-zinc-900/50">
                <ImageIcon className="h-8 w-8" />
                <p className="text-sm font-medium">Nothing Here!</p>
              </div>
            )
          )}
        </div>
      </div>
      </div>

      <AnimatePresence>
        {previewItem && (
          <motion.div
            key="preview-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-md sm:overflow-y-auto sm:p-10 dark:bg-black/80"
            onClick={() => setPreviewItem(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 4 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              onClick={(event) => event.stopPropagation()}
              className="relative flex h-[100dvh] w-full flex-col-reverse overflow-hidden bg-white dark:bg-[#0b0b0e] sm:h-auto sm:max-h-[min(88vh,880px)] sm:w-fit sm:max-w-full sm:flex-row sm:overflow-y-auto sm:rounded-[28px] sm:border sm:border-slate-200 sm:shadow-[0_40px_120px_-24px_rgba(15,23,42,0.25),0_0_0_1px_rgba(15,23,42,0.03)] dark:sm:border-white/10 dark:sm:shadow-[0_40px_120px_-24px_rgba(0,0,0,0.85),0_0_0_1px_rgba(255,255,255,0.05)]"
            >
              {/* Metadata panel — a mobile bottom sheet (rounded top, grab handle,
                  safe-area padding) that becomes a plain side panel at sm+ */}
              <div className="relative z-[1] -mt-5 flex max-h-[46dvh] w-full shrink-0 flex-col gap-5 overflow-y-auto rounded-t-[24px] bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-[0_-16px_32px_-24px_rgba(15,23,42,0.25)] dark:bg-[#0b0b0e] dark:shadow-[0_-16px_32px_-24px_rgba(0,0,0,0.7)] sm:z-auto sm:mt-0 sm:max-h-none sm:w-[292px] sm:gap-6 sm:rounded-none sm:p-6 sm:pb-6 sm:shadow-none">
                <div className="mx-auto h-1 w-9 shrink-0 rounded-full bg-slate-200 dark:bg-white/15 sm:hidden" />

                <div className="flex items-start justify-between gap-3">
                  <h2 className="line-clamp-2 text-[13px] font-semibold uppercase tracking-[0.08em] text-slate-900 dark:text-white/90">
                    {previewItem.prompt}
                  </h2>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(previewItem.prompt).then(() => {
                        setPromptCopied(true);
                        setTimeout(() => setPromptCopied(false), 1500);
                      });
                    }}
                    aria-label="Copy prompt"
                    className="shrink-0 rounded-full p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-white/40 dark:hover:bg-white/10 dark:hover:text-white"
                  >
                    {promptCopied ? <Check className="h-3.5 w-3.5 text-emerald-500 dark:text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                </div>

                <dl className="flex flex-col gap-2.5 border-t border-slate-200 pt-5 text-[13px] dark:border-white/[0.08]">
                  {(
                    [
                      ["Model", previewItem.model],
                      ["Dimensions", previewDims ? `${previewDims.width} × ${previewDims.height}` : "—"],
                      ["File size", getDataUrlSize(previewItem.src)],
                      ["Media type", getMimeType(previewItem.src)],
                      ["Created on", formatDate(previewItem.createdAt)],
                    ] as const
                  ).map(([label, value]) => (
                    <div key={label} className="flex items-center justify-between gap-4">
                      <dt className="text-slate-400 dark:text-white/40">{label}</dt>
                      <dd className="text-right font-medium text-slate-700 dark:text-white/85">{value}</dd>
                    </div>
                  ))}
                </dl>

                <div className="mt-auto flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      const extension = getMimeType(previewItem.src).split("/")[1] ?? "jpg";
                      const slug = previewItem.prompt.trim().slice(0, 40).replace(/\s+/g, "-") || "image";
                      downloadDataUrl(previewItem.src, `${slug}.${extension}`);
                    }}
                    className="flex flex-1 items-center justify-center gap-2 rounded-full bg-blue-500 px-4 py-3 text-sm font-semibold text-white shadow-[0_1px_0_rgba(255,255,255,0.25)_inset,0_8px_20px_-8px_rgba(59,130,246,0.6)] transition-colors hover:bg-blue-400 active:scale-[0.98] sm:py-2.5"
                  >
                    <Download className="h-4 w-4" />
                    Download
                  </button>
                  <button
                    type="button"
                    onClick={() => openDataUrlInNewTab(previewItem.src)}
                    className="flex flex-1 items-center justify-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-100 active:scale-[0.98] dark:border-white/15 dark:bg-white/[0.04] dark:text-white/90 dark:hover:border-white/25 dark:hover:bg-white/[0.08] sm:py-2.5"
                  >
                    <ExternalLink className="h-4 w-4" />
                    View
                  </button>
                </div>
              </div>

              {/* Image, sized to its own aspect ratio rather than cropped into a fixed box.
                  flex-1 + a height floor on mobile: it always fills whatever the bottom
                  sheet leaves behind, so a long prompt can never push the close button
                  off-screen, and non-matching ratios simply letterbox (as in Photos/Google Photos). */}
              <div className="relative flex min-h-[30dvh] flex-1 items-center justify-center bg-slate-100 p-3 pt-[max(0.75rem,env(safe-area-inset-top))] dark:bg-black sm:max-h-[min(88vh,880px)] sm:min-h-0 sm:flex-none sm:shrink-0 sm:p-6">
                <button
                  type="button"
                  onClick={() => setPreviewItem(null)}
                  aria-label="Close"
                  className="absolute right-3 top-[max(0.75rem,env(safe-area-inset-top))] z-10 flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white/90 text-slate-600 shadow-sm backdrop-blur-md transition-colors hover:bg-white hover:text-slate-900 active:scale-[0.96] dark:border-white/10 dark:bg-black/50 dark:text-white/70 dark:hover:bg-black/70 dark:hover:text-white sm:top-3 sm:h-8 sm:w-8"
                >
                  <X className="h-4 w-4" />
                </button>
                {/* eslint-disable-next-line @next/next/no-img-element -- generated image preview from a stored data URL */}
                <img
                  src={previewItem.src}
                  alt=""
                  className="h-auto max-h-full w-auto max-w-full object-contain sm:max-h-[min(80vh,780px)] sm:max-w-[min(64vw,780px)] sm:rounded-xl"
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <TopUpModal isOpen={showTopUp} onClose={() => setShowTopUp(false)} />
    </div>
  );
}
