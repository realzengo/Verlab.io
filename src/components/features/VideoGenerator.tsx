"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Clapperboard, Loader2, Pencil, PersonStanding, Volume2, VolumeX, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { PillDropdown } from "@/components/ui/PillDropdown";
import { PlasticButton } from "@/components/ui/plastic-button";
import { CreditCost } from "@/components/ui/CreditCost";
import { TopUpModal } from "@/components/TopUpModal";
import { BorderTrail } from "@/components/ui/BorderTrail";
import { notifyCreditsChanged } from "@/lib/client/credits-bus";
import { DEFAULT_VIDEO_MODEL, VIDEO_MODELS, getVideoModel } from "@/lib/config/video-models";
import { getVideoGenerationCost } from "@/lib/config/pricing";
import { pollUntilSettled } from "@/lib/polling";
import { cn, formatDate } from "@/lib/utils";
import { VideoModelPicker } from "./video-generator/VideoModelPicker";
import { FrameImagePicker, EMPTY_FRAME_SLOT, type FrameSlotState } from "./video-generator/FrameImagePicker";

type VideoMode = "create" | "edit" | "motion";

const MODE_TABS: { id: VideoMode; label: string; icon: LucideIcon }[] = [
  { id: "create", label: "Create", icon: Clapperboard },
  { id: "edit", label: "Edit", icon: Pencil },
  { id: "motion", label: "Motion", icon: PersonStanding },
];

interface GenerationHistoryItem {
  id: string;
  mode: VideoMode;
  operation: string;
  model: string;
  prompt: string | null;
  params: { durationSeconds?: number; aspectRatio?: string; soundEnabled?: boolean };
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
  outputs: number;
  soundEnabled: boolean;
}

function defaultSettingsFor(modelId: string): ModelSettings {
  const model = getVideoModel(modelId) ?? VIDEO_MODELS[0];
  return {
    durationSeconds: model.durations[0],
    aspectRatio: model.aspectRatios.includes("9:16") ? "9:16" : model.aspectRatios[0],
    outputs: 1,
    soundEnabled: model.supportsAudio,
  };
}

const OUTPUT_OPTIONS = [1, 2, 3, 4].map((value) => ({ value: String(value), label: `${value} Output${value > 1 ? "s" : ""}` }));

function VideoTile({ item, onClick }: { item: GenerationHistoryItem; onClick: () => void }) {
  const aspectRatio = item.params.aspectRatio ?? "16:9";
  const [w, h] = aspectRatio.split(":").map(Number);

  if (item.status === "queued" || item.status === "processing") {
    return (
      <div
        className="relative block w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 dark:border-zinc-800 dark:bg-zinc-900"
        style={{ aspectRatio: `${w} / ${h}` }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-slate-200 via-slate-100 to-slate-200 dark:from-zinc-800 dark:via-zinc-900 dark:to-zinc-800" />
        <div className="absolute inset-y-0 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-white/70 to-transparent blur-sm dark:via-white/10 animate-shimmer-sweep" />
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-400 dark:text-slate-500">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span className="text-[11px] font-medium">{item.status === "queued" ? "Queued" : "Rendering..."}</span>
        </div>
      </div>
    );
  }

  if (item.status === "failed") {
    return (
      <div
        className="flex w-full flex-col items-center justify-center gap-1.5 overflow-hidden rounded-2xl border border-red-200 bg-red-50 p-3 text-center dark:border-red-500/20 dark:bg-red-500/5"
        style={{ aspectRatio: `${w} / ${h}` }}
      >
        <span className="text-[11px] font-medium text-red-500">{item.error_message ?? "Generation failed"}</span>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative block w-full overflow-hidden rounded-2xl border border-slate-200 bg-black dark:border-zinc-800"
      style={{ aspectRatio: `${w} / ${h}` }}
    >
      <video
        src={`/api/library/video/${item.id}`}
        poster={item.thumbnail_path ? `/api/library/video/${item.id}?variant=thumbnail` : undefined}
        muted
        loop
        playsInline
        preload="metadata"
        onMouseEnter={(event) => void event.currentTarget.play().catch(() => {})}
        onMouseLeave={(event) => event.currentTarget.pause()}
        className="h-full w-full object-cover"
      />
    </button>
  );
}

export function VideoGenerator() {
  const [activeTab, setActiveTab] = useState<VideoMode>("create");

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
    };
  }, [modelSettings, selectedModel, model]);
  const { durationSeconds, aspectRatio, outputs, soundEnabled } = settings;

  function updateSettings(patch: Partial<ModelSettings>) {
    setModelSettings((prev) => ({ ...prev, [selectedModel]: { ...(prev[selectedModel] ?? defaultSettingsFor(selectedModel)), ...patch } }));
  }

  const [startFrame, setStartFrame] = useState<FrameSlotState>(EMPTY_FRAME_SLOT);
  const [endFrame, setEndFrame] = useState<FrameSlotState>(EMPTY_FRAME_SLOT);
  const [isGeneratingStartFrame, setIsGeneratingStartFrame] = useState(false);
  const [isGeneratingEndFrame, setIsGeneratingEndFrame] = useState(false);

  const [isGenerating, setIsGenerating] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [pendingAspectRatio, setPendingAspectRatio] = useState(aspectRatio);
  const [error, setError] = useState<string | null>(null);
  const [showTopUp, setShowTopUp] = useState(false);

  const [history, setHistory] = useState<GenerationHistoryItem[] | null>(null);
  const [previewItem, setPreviewItem] = useState<GenerationHistoryItem | null>(null);

  const pollCancelRef = useRef<(() => void) | null>(null);
  const pendingIdsRef = useRef<Set<string>>(new Set());

  const canSubmit = (prompt.trim().length > 0 || Boolean(startFrame.dataUrl)) && !isGenerating;
  const estimatedCost = getVideoGenerationCost({ model: selectedModel, durationSeconds, outputs }) || 0;

  function loadHistory() {
    return fetch("/api/generate-video?mode=create")
      .then(async (response) => {
        const data = await response.json().catch(() => null);
        if (!response.ok) throw new Error(data?.error);
        return data;
      })
      .then((data) => {
        const items: GenerationHistoryItem[] = data.generations ?? [];
        setHistory(items);
        const stillPending = items.filter((item) => item.status === "queued" || item.status === "processing").map((item) => item.id);
        if (stillPending.length > 0 && !pollCancelRef.current) {
          setIsGenerating(true);
          pollGenerationStatus(stillPending);
        }
      })
      .catch(() => {});
  }

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
        setHistory(items);

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
    loadHistory();
    return () => pollCancelRef.current?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
          outputs,
          soundEnabled: model.supportsAudio ? soundEnabled : undefined,
          startFrameImage: startFrame.dataUrl ?? undefined,
          endFrameImage: endFrame.dataUrl ?? undefined,
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

  function generateFrameImage(prompt: string, target: "start" | "end") {
    const setState = target === "start" ? setStartFrame : setEndFrame;
    const setGeneratingState = target === "start" ? setIsGeneratingStartFrame : setIsGeneratingEndFrame;

    setGeneratingState(true);
    fetch("/api/generate-image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, model: "Nano Banana 2", aspectRatio, outputs: 1, quality: "auto", resolution: "1K" }),
    })
      .then(async (response) => {
        const data = await response.json().catch(() => null);
        if (response.status === 402) {
          setShowTopUp(true);
          throw new Error("__handled__");
        }
        if (!response.ok) throw new Error(data?.error ?? "Could not generate frame");

        return new Promise<void>((resolve, reject) => {
          pollUntilSettled<{ id: string; status: string; images: string[]; error_message: string | null }[]>(
            async () => {
              const r = await fetch("/api/generate-image");
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
                reject(new Error(match.error_message ?? "Could not generate frame"));
                return;
              }
              setState((prev) => ({ ...prev, dataUrl: match.images[0] }));
              notifyCreditsChanged();
              resolve();
            },
            { intervalMs: 2500, timeoutMs: 2 * 60 * 1000, onTimeout: () => reject(new Error("Timed out generating the frame.")) }
          );
        });
      })
      .catch((err) => {
        if (err instanceof Error && err.message !== "__handled__") setError(err.message);
      })
      .finally(() => setGeneratingState(false));
  }

  const durationOptions = useMemo(() => model.durations.map((d) => ({ value: String(d), label: `${d}s` })), [model]);
  const aspectRatioOptions = useMemo(() => model.aspectRatios.map((r) => ({ value: r, label: r, ratio: r })), [model]);

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

  return (
    <div className="relative">
      <div className="relative isolate">
        <div className="relative w-full px-0 pt-8 pb-20 sm:px-6 sm:pt-12">
          <div className="mx-auto w-full max-w-6xl">
            <div>
              <h1 className="bg-gradient-to-br from-heading via-heading to-primary bg-clip-text text-3xl font-extrabold tracking-tight text-transparent sm:text-4xl">
                AI Video Generator
              </h1>
              <p className="mt-2 text-xs font-medium tracking-wide text-body/60 sm:text-sm">
                Generate stunning, watermark-free AI videos.
              </p>
            </div>

            <div className="mt-6 flex gap-4">
              {/* Mode rail */}
              <div className="flex shrink-0 flex-row gap-1 rounded-2xl border border-slate-200 bg-white p-1.5 dark:border-zinc-800 dark:bg-zinc-950 sm:flex-col">
                {MODE_TABS.map((tab) => {
                  const active = tab.id === activeTab;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      className={cn(
                        "flex flex-1 flex-col items-center gap-1 rounded-xl px-3 py-2.5 text-xs font-semibold transition-colors sm:flex-none sm:px-4",
                        active
                          ? "bg-blue-500/10 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400"
                          : "text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/[0.06]"
                      )}
                    >
                      <tab.icon className="h-4.5 w-4.5" />
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              <div className="min-w-0 flex-1">
                {activeTab !== "create" ? (
                  <div className="flex h-full min-h-[240px] flex-col items-center justify-center gap-2 rounded-3xl border border-dashed border-slate-200 bg-white/60 p-8 text-center dark:border-zinc-800 dark:bg-zinc-950/40">
                    <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                      {activeTab === "edit" ? "Edit" : "Motion"} is coming in the next update.
                    </p>
                    <p className="max-w-xs text-xs text-slate-400">
                      {activeTab === "edit"
                        ? "Upscale, reframe, and extend your generated videos."
                        : "Drive a character image using a reference video's motion."}
                    </p>
                  </div>
                ) : (
                  <div className="group relative isolate z-20">
                    <div
                      className={cn(
                        "relative rounded-[28px] border-2 border-transparent shadow-[0_12px_32px_-16px_rgba(37,99,235,0.18)] transition-shadow duration-300",
                        "dark:shadow-[0_1px_0_rgba(255,255,255,0.03),0_0_0_1px_rgba(255,255,255,0.06),0_24px_60px_-20px_rgba(0,0,0,0.65)]"
                      )}
                    >
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
                          "relative flex w-full flex-col rounded-[26px] bg-white/60 px-6 py-5 backdrop-blur-2xl backdrop-saturate-150 sm:px-9 sm:py-6",
                          "dark:bg-[#131318] dark:bg-gradient-to-b dark:from-white/[0.04] dark:to-transparent"
                        )}
                      >
                        <textarea
                          value={prompt}
                          onChange={(event) => setPrompt(event.target.value)}
                          placeholder="Describe a new video..."
                          className="min-h-[100px] w-full resize-none bg-transparent text-sm leading-relaxed text-slate-900 outline-none placeholder:text-slate-400 dark:text-white dark:placeholder:text-zinc-500"
                        />

                        <div className="mt-4 flex flex-wrap items-center gap-2">
                          <VideoModelPicker value={selectedModel} onChange={setSelectedModel} />
                          <PillDropdown
                            value={String(durationSeconds)}
                            options={durationOptions}
                            onChange={(value) => updateSettings({ durationSeconds: Number(value) })}
                          />
                          <PillDropdown value={aspectRatio} options={aspectRatioOptions} onChange={(value) => updateSettings({ aspectRatio: value })} />
                          {model.supportsAudio && (
                            <button
                              type="button"
                              onClick={() => updateSettings({ soundEnabled: !soundEnabled })}
                              aria-pressed={soundEnabled}
                              aria-label="Toggle sound"
                              className={cn(
                                "flex shrink-0 items-center justify-center rounded-xl border p-2 shadow-sm outline-none transition-colors duration-150 active:scale-[0.97]",
                                "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50",
                                "dark:border-white/[0.07] dark:bg-white/[0.06] dark:text-slate-200 dark:hover:border-white/[0.12] dark:hover:bg-white/[0.1]",
                                soundEnabled && "border-blue-400 bg-blue-50/60 text-blue-600 dark:border-blue-400/50 dark:bg-blue-500/10 dark:text-blue-400"
                              )}
                            >
                              {soundEnabled ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
                            </button>
                          )}
                          <PillDropdown
                            value={String(outputs)}
                            options={OUTPUT_OPTIONS}
                            onChange={(value) => updateSettings({ outputs: Number(value) })}
                          />
                          {model.supportsImageToVideo && (
                            <FrameImagePicker
                              startFrame={startFrame}
                              onStartFrameChange={setStartFrame}
                              onGenerateStartFrame={(p) => generateFrameImage(p, "start")}
                              isGeneratingStartFrame={isGeneratingStartFrame}
                              endFrame={endFrame}
                              onEndFrameChange={setEndFrame}
                              onGenerateEndFrame={(p) => generateFrameImage(p, "end")}
                              isGeneratingEndFrame={isGeneratingEndFrame}
                              supportsEndFrame={model.supportsEndFrame}
                            />
                          )}

                          <PlasticButton
                            text="Generate"
                            loading={isGenerating}
                            disabled={!canSubmit}
                            onClick={handleGenerate}
                            trailing={<CreditCost amount={estimatedCost} className="text-blue-200/80" />}
                            className="ml-auto shrink-0 !rounded-2xl !px-5 !py-2.5 font-semibold shadow-[0_10px_30px_-10px_rgba(37,99,235,0.6)]"
                          />
                        </div>
                      </div>
                    </div>

                    {error && (
                      <p className="mt-4 text-sm font-medium text-red-500" role="alert">
                        {error}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {activeTab === "create" && galleryItems.length > 0 && (
              <div className="mt-10">
                <h2 className="mb-4 text-sm font-semibold text-slate-500">Recent Generations</h2>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                  {galleryItems.map((item) => (
                    <VideoTile key={item.id} item={item} onClick={() => setPreviewItem(item)} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {previewItem && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
            onClick={() => setPreviewItem(null)}
          >
            <div className="relative max-h-[85vh] max-w-3xl" onClick={(event) => event.stopPropagation()}>
              <button
                type="button"
                onClick={() => setPreviewItem(null)}
                className="absolute -top-10 right-0 flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
              >
                <X className="h-4 w-4" />
              </button>
              <video src={`/api/library/video/${previewItem.id}`} controls autoPlay loop className="max-h-[85vh] max-w-full rounded-2xl" />
              {previewItem.prompt && (
                <p className="mt-3 text-sm text-white/70">
                  {previewItem.prompt} <span className="text-white/40">· {previewItem.model} · {formatDate(previewItem.created_at)}</span>
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <TopUpModal isOpen={showTopUp} onClose={() => setShowTopUp(false)} />
    </div>
  );
}
