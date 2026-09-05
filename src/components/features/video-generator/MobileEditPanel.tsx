"use client";

import { Check, Loader2, Maximize2, Sparkles, Upload, Wand2, X } from "lucide-react";
import { useRef, useState } from "react";
import { PlasticButton } from "@/components/ui/plastic-button";
import { CreditCost } from "@/components/ui/CreditCost";
import type { PromptEditModelConfig } from "@/lib/config/video-models";
import { cn } from "@/lib/utils";
import { readFileAsDataUrl } from "./FrameImagePicker";
import { SourceVideoPicker, type SourceVideoOption } from "./SourceVideoPicker";
import { LowCreditBanner } from "./LowCreditBanner";

const MAX_REFERENCE_IMAGE_BYTES = 8 * 1024 * 1024;

function MobileCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[1.75rem] border border-slate-200 bg-white p-4 dark:border-white/[0.08] dark:bg-[#131318]">
      <span className="mb-3 block text-[11px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">{label}</span>
      {children}
    </div>
  );
}

interface MobileEditPanelProps {
  source: { id: string; thumbnail_path: string | null; durationSeconds: number | null } | null;
  onSelectSource: (id: string) => void;
  onClearSource: () => void;
  onUploadSourceFile: (file: File) => void;
  isUploadingSource: boolean;
  sourceLibrary: SourceVideoOption[];
  durationWarning: string | null;

  editPrompt: string;
  onEditPromptChange: (value: string) => void;

  referenceImages: string[];
  onReferenceImagesChange: (next: string[]) => void;
  maxReferenceImages: number;
  onGenerateReference: (prompt: string) => void;
  isGeneratingReference: boolean;

  model: string;
  models: PromptEditModelConfig[];
  onSelectModel: (id: string) => void;

  outputs: number;
  outputOptions: { value: string; label: string }[];
  onOutputsChange: (value: number) => void;

  isGenerating: boolean;
  canSubmit: boolean;
  estimatedCost: number;
  onGenerate: () => void;
  error: string | null;

  creditBalance: number | null;
  onTopUp: () => void;
}

/**
 * Phone-optimized Edit tab -- same stacked-card / sticky-bar pattern as
 * MobileCreatePanel, sized for the "video to edit" attachment plus
 * reference images instead of start/end frames. Desktop keeps the existing
 * single-card side-by-side Edit form (VideoGenerator.tsx renders this only
 * below the `lg` breakpoint).
 */
export function MobileEditPanel({
  source,
  onSelectSource,
  onClearSource,
  onUploadSourceFile,
  isUploadingSource,
  sourceLibrary,
  durationWarning,
  editPrompt,
  onEditPromptChange,
  referenceImages,
  onReferenceImagesChange,
  maxReferenceImages,
  onGenerateReference,
  isGeneratingReference,
  model,
  models,
  onSelectModel,
  outputs,
  outputOptions,
  onOutputsChange,
  isGenerating,
  canSubmit,
  estimatedCost,
  onGenerate,
  error,
  creditBalance,
  onTopUp,
}: MobileEditPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [showBuilderNotice, setShowBuilderNotice] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const atMax = referenceImages.length >= maxReferenceImages;

  return (
    <div className="flex flex-col gap-3 pb-24">
      <MobileCard label="Video to edit">
        <SourceVideoPicker
          size="lg"
          source={source}
          onSelect={onSelectSource}
          onClear={onClearSource}
          onUploadFile={onUploadSourceFile}
          isUploading={isUploadingSource}
          library={sourceLibrary}
        />
        {durationWarning && (
          <p className="mt-3 text-xs font-medium text-amber-500" role="alert">
            {durationWarning}
          </p>
        )}
      </MobileCard>

      <MobileCard label="Prompt">
        <div className="relative rounded-2xl bg-slate-100 p-3 dark:bg-white/[0.04]">
          <textarea
            value={editPrompt}
            onChange={(event) => onEditPromptChange(event.target.value)}
            placeholder="Describe how you want to edit this video. Type @ to insert attached refs."
            rows={expanded ? 12 : 5}
            className="w-full resize-none bg-transparent pr-6 text-sm font-normal leading-relaxed text-slate-900 outline-none placeholder:font-normal placeholder:text-slate-400 dark:text-white dark:placeholder:text-zinc-500"
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

      <MobileCard label="Images">
        <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">
          Edit reference images
        </span>
        <p className="mb-3 text-xs text-slate-400">Type @ in the prompt to insert attached refs.</p>

        {referenceImages.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {referenceImages.map((image, index) => (
              <div key={index} className="group/ref relative h-16 w-16 shrink-0 overflow-hidden rounded-xl ring-1 ring-slate-200 dark:ring-white/10">
                {/* eslint-disable-next-line @next/next/no-img-element -- data URL preview, not a static asset */}
                <img src={image} alt="" className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => onReferenceImagesChange(referenceImages.filter((_, i) => i !== index))}
                  aria-label={`Remove reference image ${index + 1}`}
                  className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {!atMax &&
          (aiOpen ? (
            <div className="flex items-center gap-1.5">
              <input
                value={aiPrompt}
                onChange={(event) => setAiPrompt(event.target.value)}
                placeholder="Describe the reference..."
                disabled={isGeneratingReference}
                autoFocus
                className="min-w-0 flex-1 rounded-xl bg-slate-100 px-3 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 disabled:opacity-60 dark:bg-white/[0.04] dark:text-white dark:placeholder:text-zinc-500"
              />
              <button
                type="button"
                disabled={isGeneratingReference || !aiPrompt.trim()}
                onClick={() => {
                  onGenerateReference(aiPrompt);
                  setAiPrompt("");
                  setAiOpen(false);
                }}
                className="flex shrink-0 items-center justify-center rounded-xl bg-blue-500 px-3 py-2.5 text-white transition-colors hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isGeneratingReference ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              </button>
              <button
                type="button"
                onClick={() => setAiOpen(false)}
                aria-label="Cancel"
                className="flex shrink-0 items-center justify-center rounded-xl border border-slate-200 px-2.5 py-2.5 text-slate-400 dark:border-white/10"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setAiOpen(true)}
                className="flex items-center justify-center gap-1.5 rounded-2xl border border-dashed border-slate-300 py-3.5 text-sm font-semibold text-slate-500 transition-colors dark:border-zinc-700 dark:text-slate-400"
              >
                <Sparkles className="h-4 w-4" /> Generate Reference with AI
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center justify-center gap-1.5 rounded-2xl border border-dashed border-slate-300 py-3.5 text-sm font-semibold text-slate-500 transition-colors dark:border-zinc-700 dark:text-slate-400"
              >
                <Upload className="h-4 w-4" /> Upload
              </button>
            </div>
          ))}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={async (event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (!file) return;
            if (file.size > MAX_REFERENCE_IMAGE_BYTES) return;
            onReferenceImagesChange([...referenceImages, await readFileAsDataUrl(file)]);
          }}
        />
      </MobileCard>

      <MobileCard label="Model">
        <div className="flex flex-col gap-1">
          {models.map((m) => {
            const selected = m.id === model;
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
                <span
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ring-1 ring-slate-900/[0.04] dark:ring-white/[0.06]",
                    selected ? "bg-blue-500 text-white" : "bg-slate-100 text-slate-500 dark:bg-white/[0.06] dark:text-slate-400"
                  )}
                >
                  {m.id.slice(0, 1)}
                </span>
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
      {creditBalance !== null && creditBalance < estimatedCost && (
        <LowCreditBanner balance={creditBalance} cost={estimatedCost} onTopUp={onTopUp} />
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
          className="!flex-1 !py-3 !text-sm font-semibold"
        />
      </div>
    </div>
  );
}
