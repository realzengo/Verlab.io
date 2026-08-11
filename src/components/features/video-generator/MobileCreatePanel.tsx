"use client";

import { Check, Clock, Maximize2, Sparkles, Upload, Volume2, VolumeX, Wand2, X } from "lucide-react";
import { useRef, useState } from "react";
import { PlasticButton } from "@/components/ui/plastic-button";
import { CreditCost } from "@/components/ui/CreditCost";
import type { VideoModelConfig } from "@/lib/config/video-models";
import { cn } from "@/lib/utils";
import { ModelIcon } from "./VideoModelPicker";
import { EMPTY_FRAME_SLOT, MAX_FRAME_IMAGE_BYTES, processFrameImageFile, type FrameSlotState } from "./FrameImagePicker";
import { FrameImageGenerateModal } from "./FrameImageGenerateModal";

function MobileCard({ label, badge, children }: { label: string; badge?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-[1.75rem] border border-slate-200 bg-white p-4 dark:border-white/[0.08] dark:bg-[#131318]">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">{label}</span>
        {badge}
      </div>
      {children}
    </div>
  );
}

// First/last-frame section for the mobile Create panel -- always-visible
// "AI Generate" / "Upload" buttons instead of desktop's popover (FrameBox in
// FrameImagePicker.tsx), matching the competitor screenshot's inline layout.
// "AI Generate" opens the same full-screen generator modal as desktop.
function MobileFrameSection({
  title,
  frameLabel,
  slot,
  onChange,
  aspectRatio,
  disabled,
  disabledHint,
}: {
  title: string;
  frameLabel: "first frame" | "last frame";
  slot: FrameSlotState;
  onChange: (next: FrameSlotState) => void;
  aspectRatio: string;
  disabled?: boolean;
  disabledHint?: string;
}) {
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">{title}</span>
        {disabled && disabledHint && (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-400 dark:bg-white/[0.06] dark:text-slate-500">
            {disabledHint}
          </span>
        )}
      </div>

      {slot.dataUrl ? (
        <div className="relative h-32 w-full overflow-hidden rounded-2xl ring-1 ring-slate-200 dark:ring-white/10">
          {/* eslint-disable-next-line @next/next/no-img-element -- data URL preview, not a static asset */}
          <img
            src={slot.dataUrl}
            alt=""
            className="h-full w-full object-cover"
            onError={() => {
              onChange({ ...slot, dataUrl: null });
              setError("Couldn't preview that image. Try a JPG or PNG.");
            }}
          />
          <button
            type="button"
            onClick={() => {
              onChange({ ...slot, dataUrl: null });
              setError(null);
            }}
            aria-label={`Remove ${title.toLowerCase()}`}
            className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={disabled}
            onClick={() => setShowGenerateModal(true)}
            className="flex items-center justify-center gap-1.5 rounded-2xl border border-dashed border-slate-300 py-3.5 text-sm font-semibold text-slate-500 transition-colors disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:text-slate-400"
          >
            <Sparkles className="h-4 w-4" /> AI Generate
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center justify-center gap-1.5 rounded-2xl border border-dashed border-slate-300 py-3.5 text-sm font-semibold text-slate-500 transition-colors disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:text-slate-400"
          >
            <Upload className="h-4 w-4" /> Upload
          </button>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={async (event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;

          if (!file.type.startsWith("image/")) {
            setError("That file isn't an image.");
            return;
          }
          if (file.size > MAX_FRAME_IMAGE_BYTES) {
            setError(`Image is too large. Max size is ${MAX_FRAME_IMAGE_BYTES / (1024 * 1024)}MB.`);
            return;
          }

          try {
            const dataUrl = await processFrameImageFile(file);
            setError(null);
            onChange({ ...slot, dataUrl });
          } catch {
            setError("Couldn't read that file. Try a different image.");
          }
        }}
      />

      {error && (
        <p role="alert" className="mt-1.5 text-[11px] font-medium leading-tight text-red-500">
          {error}
        </p>
      )}

      {showGenerateModal && (
        <FrameImageGenerateModal
          frameLabel={frameLabel}
          defaultAspectRatio={aspectRatio}
          onClose={() => setShowGenerateModal(false)}
          onSelect={(dataUrl) => {
            setError(null);
            onChange({ dataUrl, mode: "ai" });
            setShowGenerateModal(false);
          }}
        />
      )}
    </div>
  );
}

interface MobileCreatePanelProps {
  prompt: string;
  onPromptChange: (value: string) => void;

  model: VideoModelConfig;
  models: VideoModelConfig[];
  selectedModel: string;
  onSelectModel: (id: string) => void;

  startFrame: FrameSlotState;
  onStartFrameChange: (next: FrameSlotState) => void;

  endFrame: FrameSlotState;
  onEndFrameChange: (next: FrameSlotState) => void;

  durationSeconds: number;
  durationOptions: { value: string; label: string }[];
  onDurationChange: (value: number) => void;

  resolution: string;
  resolutionOptions: { value: string; label: string }[];
  onResolutionChange: (value: string) => void;

  aspectRatio: string;
  onAspectRatioChange: (value: string) => void;

  soundEnabled: boolean;
  onSoundToggle: () => void;

  outputs: number;
  outputOptions: { value: string; label: string }[];
  onOutputsChange: (value: number) => void;

  isGenerating: boolean;
  canSubmit: boolean;
  estimatedCost: number;
  onGenerate: () => void;
  error: string | null;
}

/**
 * Phone-optimized Create tab -- stacked full-width cards (Prompt / Images /
 * Model / Format / Duration / Audio / Outputs) plus a sticky bottom action
 * bar, matching the competitor's mobile layout. Desktop keeps the existing
 * single-card side-by-side form (VideoGenerator.tsx renders this only below
 * the `lg` breakpoint).
 */
export function MobileCreatePanel({
  prompt,
  onPromptChange,
  model,
  models,
  selectedModel,
  onSelectModel,
  startFrame,
  onStartFrameChange,
  endFrame,
  onEndFrameChange,
  durationSeconds,
  durationOptions,
  onDurationChange,
  resolution,
  resolutionOptions,
  onResolutionChange,
  aspectRatio,
  onAspectRatioChange,
  soundEnabled,
  onSoundToggle,
  outputs,
  outputOptions,
  onOutputsChange,
  isGenerating,
  canSubmit,
  estimatedCost,
  onGenerate,
  error,
}: MobileCreatePanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [showBuilderNotice, setShowBuilderNotice] = useState(false);

  return (
    <div className="flex flex-col gap-3 pb-24">
      <MobileCard label="Prompt">
        <div className="relative rounded-2xl bg-slate-100 p-3 dark:bg-white/[0.04]">
          <textarea
            value={prompt}
            onChange={(event) => onPromptChange(event.target.value)}
            placeholder="Describe a new video"
            rows={expanded ? 12 : 5}
            className="w-full resize-none bg-transparent pr-6 text-sm font-bold leading-relaxed text-slate-900 outline-none placeholder:font-normal placeholder:text-slate-400 dark:text-white dark:placeholder:text-zinc-500"
          />
          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            aria-label={expanded ? "Collapse prompt" : "Expand prompt"}
            className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
        </div>
      </MobileCard>

      {model.supportsImageToVideo && (
        <MobileCard label="Images">
          <div className="flex flex-col gap-4">
            <MobileFrameSection
              title="First Frame"
              frameLabel="first frame"
              slot={startFrame}
              onChange={onStartFrameChange}
              aspectRatio={aspectRatio}
            />
            {model.supportsEndFrame && (
              <MobileFrameSection
                title="Last Frame"
                frameLabel="last frame"
                slot={startFrame.dataUrl ? endFrame : EMPTY_FRAME_SLOT}
                onChange={onEndFrameChange}
                aspectRatio={aspectRatio}
                disabled={!startFrame.dataUrl}
                disabledHint="Needs first frame"
              />
            )}
          </div>
        </MobileCard>
      )}

      <MobileCard label="Model">
        <div className="flex flex-col gap-1">
          {models.map((m) => {
            const selected = m.id === selectedModel;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => onSelectModel(m.id)}
                className={cn(
                  "flex items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors",
                  selected ? "bg-blue-50 ring-1 ring-blue-400 dark:bg-blue-500/10 dark:ring-blue-400/50" : "hover:bg-slate-50 dark:hover:bg-white/[0.04]"
                )}
              >
                <ModelIcon model={m} />
                <span className="min-w-0 flex-1">
                  <span className={cn("block text-sm font-semibold", selected ? "text-blue-600 dark:text-blue-400" : "text-slate-900 dark:text-white")}>
                    {m.id}
                  </span>
                  <span className="block truncate text-xs text-slate-400">{m.description}</span>
                </span>
                {selected && <Check className="h-4 w-4 shrink-0 text-blue-500 dark:text-blue-400" />}
              </button>
            );
          })}
        </div>
      </MobileCard>

      <MobileCard label="Format">
        <div className="flex gap-2 rounded-2xl bg-slate-100 p-1 dark:bg-white/[0.04]">
          {model.aspectRatios.map((ratio) => {
            const selected = ratio === aspectRatio;
            return (
              <button
                key={ratio}
                type="button"
                onClick={() => onAspectRatioChange(ratio)}
                className={cn(
                  "flex flex-1 items-center justify-center rounded-xl py-2.5 text-sm font-semibold transition-colors",
                  selected ? "bg-white text-blue-600 shadow-sm dark:bg-zinc-800 dark:text-blue-400" : "text-slate-500 dark:text-slate-400"
                )}
              >
                {ratio}
              </button>
            );
          })}
        </div>
      </MobileCard>

      <MobileCard label="Duration">
        <div className="flex gap-2">
          {durationOptions.map((option) => {
            const selected = option.value === String(durationSeconds);
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => onDurationChange(Number(option.value))}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 rounded-2xl border py-2.5 text-sm font-semibold transition-colors",
                  selected
                    ? "border-blue-400 bg-blue-50 text-blue-600 dark:border-blue-400/50 dark:bg-blue-500/10 dark:text-blue-400"
                    : "border-slate-200 text-slate-600 dark:border-white/10 dark:text-slate-300"
                )}
              >
                <Clock className="h-3.5 w-3.5" /> {option.label}
              </button>
            );
          })}
        </div>
      </MobileCard>

      {resolutionOptions.length > 0 && (
        <MobileCard label="Quality">
          <div className="flex gap-2">
            {resolutionOptions.map((option) => {
              const selected = option.value === resolution;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => onResolutionChange(option.value)}
                  className={cn(
                    "flex flex-1 items-center justify-center rounded-2xl border py-2.5 text-sm font-semibold transition-colors",
                    selected
                      ? "border-blue-400 bg-blue-50 text-blue-600 dark:border-blue-400/50 dark:bg-blue-500/10 dark:text-blue-400"
                      : "border-slate-200 text-slate-600 dark:border-white/10 dark:text-slate-300"
                  )}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </MobileCard>
      )}

      {model.supportsAudio && (
        <MobileCard label="Audio">
          <p className="mb-3 text-xs text-slate-400">Toggle generated sound for supported video models.</p>
          <button
            type="button"
            onClick={onSoundToggle}
            aria-pressed={soundEnabled}
            className={cn(
              "flex w-full items-center justify-between rounded-2xl px-4 py-3 text-sm font-semibold transition-colors",
              soundEnabled
                ? "bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400"
                : "bg-red-50 text-red-500 dark:bg-red-500/10 dark:text-red-400"
            )}
          >
            <span className="flex items-center gap-2">
              {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
              {soundEnabled ? "Sound on" : "Muted"}
            </span>
            <span className="text-xs font-medium opacity-70">Tap to {soundEnabled ? "disable" : "enable"}</span>
          </button>
        </MobileCard>
      )}

      <MobileCard label="Outputs">
        <p className="mb-3 text-xs text-slate-400">Generate multiple variations from the same prompt in one run.</p>
        <div className="grid grid-cols-2 gap-2">
          {outputOptions.map((option) => {
            const selected = option.value === String(outputs);
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => onOutputsChange(Number(option.value))}
                className={cn(
                  "flex items-center justify-center gap-1.5 rounded-2xl border py-2.5 text-sm font-semibold transition-colors",
                  selected
                    ? "border-blue-400 bg-blue-50 text-blue-600 dark:border-blue-400/50 dark:bg-blue-500/10 dark:text-blue-400"
                    : "border-slate-200 text-slate-600 dark:border-white/10 dark:text-slate-300"
                )}
              >
                + {option.label}
              </button>
            );
          })}
        </div>
      </MobileCard>

      {error && (
        <p className="text-sm font-medium text-red-500" role="alert">
          {error}
        </p>
      )}

      <div className="fixed inset-x-0 bottom-0 z-30 flex items-center gap-2 border-t border-slate-200/70 bg-white/90 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-xl dark:border-white/[0.08] dark:bg-zinc-950/90 lg:hidden">
        <button
          type="button"
          onClick={() => {
            setShowBuilderNotice(true);
            setTimeout(() => setShowBuilderNotice(false), 1500);
          }}
          className="flex shrink-0 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
        >
          <Wand2 className="h-4 w-4" /> {showBuilderNotice ? "Coming soon" : "Prompt Builder"}
        </button>
        <PlasticButton
          text="Generate"
          loading={isGenerating}
          disabled={!canSubmit}
          onClick={onGenerate}
          trailing={<CreditCost amount={estimatedCost} className="text-blue-200/80" />}
          className="!flex-1 !rounded-full !py-3 !text-sm font-semibold shadow-[0_10px_30px_-10px_rgba(37,99,235,0.6)]"
        />
      </div>
    </div>
  );
}
