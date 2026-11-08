"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  Check,
  ChevronDown,
  Download,
  Loader2,
  Pause,
  Play,
  Plus,
  RotateCcw,
  SkipBack,
  SkipForward,
  X,
} from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { CreditCost } from "@/components/ui/CreditCost";
import { PlasticButton } from "@/components/ui/plastic-button";
import { TRAY_CHIP, TRAY_CHIP_OPEN } from "@/components/ui/PillDropdown";
import { COMPOSER_RIM, COMPOSER_SHEET, COMPOSER_SHEET_STATIC, SHEET_RULE, SubmitHint } from "@/components/ui/ComposerKit";
import { INK_TITLE } from "@/components/brand/BrandKit";
import { IconButton } from "@/components/ui/IconButton";
import { ProgressiveFluxLoader } from "@/components/ui/ProgressiveFluxLoader";
import { HistoryPanel } from "@/components/features/voiceover-generator/HistoryPanel";
import { CloneVoiceModal } from "@/components/features/voiceover-generator/CloneVoiceModal";
import { VoiceLibraryModal } from "@/components/features/voiceover-generator/VoiceLibraryModal";
import { ScriptTextarea } from "@/components/features/voiceover-generator/ScriptTextarea";
import { VOICE_CLONING_ENABLED, type VoiceCloneSummary } from "@/lib/config/voices";
import {
  DEFAULT_MODEL_ID,
  DEFAULT_VOICE,
  DEFAULT_VOICE_SETTINGS,
  DISCRETE_STABILITY_OPTIONS,
  DEFAULT_LANGUAGE_CODE,
  ELEVENLABS_MODELS,
  LANGUAGES,
  SPEED_MAX,
  SPEED_MIN,
  hasDiscreteStability,
  supportsAudioTags,
  getVoice,
  isElevenLabsVoiceId,
  voiceMeta,
  nearestDiscreteStability,
  readStoredTtsSettings,
  supportsLanguageSelection,
  type ElevenLabsVoice,
  type TtsSettings,
  type VoiceSettings,
} from "@/lib/config/elevenlabs";
import { getVoiceoverSegmentCost } from "@/lib/config/pricing";
import { exportSegmentsAsWav } from "@/lib/client/audio-export";
import { consumeVoiceoverHandoff } from "@/lib/client/voiceover-handoff";
import { pollUntilSettled } from "@/lib/polling";
import { cn, downloadBlob } from "@/lib/utils";
import { isValidName, NAME_MAX } from "@/lib/validation";

type GenerationMode = "line_by_line" | "all_at_once";
type View = "input" | "loading" | "editor";
type EditorTab = "editor" | "audio";

interface SegmentState {
  text: string;
  durationSeconds: number;
}

// Same splitting rule as src/lib/server/voiceover-segmentation.ts, duplicated
// here (rather than imported from lib/server) so this purely cosmetic
// credit-count preview doesn't pull server-only code into the client bundle.
// The server route re-derives the real segments itself -- this is only ever
// used to render the "N credits" badge before Generate is clicked.
const SENTENCE_END = /(?<=[.!?])\s+(?=[A-Z0-9"'])/;
function estimateSegmentTexts(script: string, mode: GenerationMode): string[] {
  const trimmed = script.trim();
  if (!trimmed) return [];
  if (mode === "all_at_once") return [trimmed];
  const lines = trimmed
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => line.split(SENTENCE_END))
    .map((s) => s.trim())
    .filter(Boolean);
  return lines.length > 0 ? lines : [trimmed];
}

const VOICEOVER_LOADING_PHASES = [
  { at: 0, label: "splitting script" },
  { at: 22, label: "finding natural pauses" },
  { at: 48, label: "synthesizing voice" },
  { at: 75, label: "mixing segments" },
  { at: 92, label: "finalizing audio" },
];

const MAX_SCRIPT_CHARS = 5000;

function segmentUrl(generationId: string, index: number): string {
  return `/api/generate-voiceover/${generationId}/segments/${index}`;
}

// The id of the generation this tab is waiting on, so leaving the page (or
// reloading) mid-generation can resume watching it on return. Cleared once
// the generation settles.
const PENDING_GENERATION_KEY = "clypa:voiceover-pending";

function readPendingGeneration(): string | null {
  try {
    return sessionStorage.getItem(PENDING_GENERATION_KEY);
  } catch {
    return null;
  }
}

function writePendingGeneration(id: string | null): void {
  try {
    if (id) sessionStorage.setItem(PENDING_GENERATION_KEY, id);
    else sessionStorage.removeItem(PENDING_GENERATION_KEY);
  } catch {
    // Storage unavailable -- resuming is a nicety, not required.
  }
}

// ── Small presentational pieces ─────────────────────────────────────────

// One filled accent on the page -- the primary action. Everything else is
// neutral ink on the surface, so the eye lands on Generate / Export.
const PRIMARY_BUTTON =
  "inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-lg bg-btn-primary px-4 text-sm font-semibold text-white shadow-[0_1px_2px_rgba(16,24,40,0.15),inset_0_1px_0_rgba(255,255,255,0.18)] transition-colors hover:bg-btn-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-45";
const SECONDARY_BUTTON =
  "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-3 text-xs font-medium text-body ring-1 ring-inset ring-hairline transition-colors hover:bg-(--app-fill) hover:text-heading focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40";
const FIELD =
  "w-full rounded-lg border border-hairline bg-surface px-3 text-sm text-heading outline-none transition-colors hover:bg-(--app-fill) focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/15";
const SECTION_LABEL = "text-[13px] font-medium text-heading";

function PrimaryButton({
  text,
  loadingText,
  loading = false,
  disabled = false,
  onClick,
  icon,
  className,
}: {
  text: string;
  loadingText?: string;
  loading?: boolean;
  disabled?: boolean;
  onClick: () => void;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled || loading} className={cn(PRIMARY_BUTTON, className)}>
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      {loading ? (loadingText ?? text) : text}
    </button>
  );
}

function creditsLabel(credits: number): string {
  return `${credits.toLocaleString()} credit${credits === 1 ? "" : "s"}`;
}

function SegmentedControl<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  const pillId = useId();
  return (
    <div className="relative flex rounded-lg bg-(--app-fill) p-0.5">
      {options.map((option) => (
        <button
          key={String(option.value)}
          type="button"
          onClick={() => onChange(option.value)}
          className="relative flex-1 rounded-md px-3 py-1.5 text-xs font-medium"
        >
          {value === option.value && (
            <motion.span
              layoutId={`${pillId}-active`}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className={SEGMENT_ACTIVE}
            />
          )}
          <span className={cn("relative z-10 transition-colors", value === option.value ? "text-heading" : "text-subtle hover:text-heading")}>
            {option.label}
          </span>
        </button>
      ))}
    </div>
  );
}

// The selected half of every segmented control on the page.
const SEGMENT_ACTIVE = "absolute inset-0 rounded-md bg-surface shadow-[0_1px_2px_rgba(16,24,40,0.08)] ring-1 ring-black/[0.04] dark:bg-white/[0.1] dark:ring-white/[0.06]";

// An [audio tag] in the footer hint, drawn the way the editor highlights it.
function AudioTagSample({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-md bg-primary/[0.06] px-1 py-px font-mono text-[11px] text-primary shadow-[inset_0_0_0_1px_rgba(51,92,255,0.3)] dark:bg-primary/15 dark:text-blue-300">
      {children}
    </span>
  );
}

// The explanation lives in the label's tooltip rather than an info icon
// beside every control.
function SettingLabel({ label, hint, value }: { label: string; hint: string; value?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span title={hint} className="cursor-help text-[13px] font-medium text-heading">
        {label}
      </span>
      {value !== undefined && <span className="text-xs font-medium tabular-nums text-heading">{value}</span>}
    </div>
  );
}

function SettingSlider({
  label,
  hint,
  value,
  min,
  max,
  step,
  onChange,
  format,
  leftLabel,
  rightLabel,
}: {
  label: string;
  hint: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  format: (value: number) => string;
  leftLabel: string;
  rightLabel: string;
}) {
  return (
    <div>
      <SettingLabel label={label} hint={hint} value={format(value)} />
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        aria-label={label}
        className="voiceover-range mt-2"
        style={{ "--fill": `${((value - min) / (max - min)) * 100}%` } as CSSProperties}
      />
      <div className="mt-1 flex justify-between text-[11px] text-subtle">
        <span>{leftLabel}</span>
        <span>{rightLabel}</span>
      </div>
    </div>
  );
}

function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function formatTime(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// Decoded amplitude peaks, keyed by segment audio URL so switching tabs or
// re-rendering the timeline doesn't re-fetch/re-decode audio already seen.
const waveformPeakCache = new Map<string, number[]>();
const WAVEFORM_SAMPLE_COUNT = 300;
const COMBINED_SAMPLE_COUNT = 240;

async function loadPeaks(url: string): Promise<number[]> {
  const cached = waveformPeakCache.get(url);
  if (cached) return cached;
  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();
  const audioContext = new AudioContext();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  const channel = audioBuffer.getChannelData(0);
  const blockSize = Math.max(1, Math.floor(channel.length / WAVEFORM_SAMPLE_COUNT));
  const result: number[] = [];
  for (let i = 0; i < WAVEFORM_SAMPLE_COUNT; i++) {
    const start = i * blockSize;
    let sum = 0;
    for (let j = 0; j < blockSize; j++) sum += Math.abs(channel[start + j] ?? 0);
    result.push(sum / blockSize);
  }
  const max = Math.max(...result, 0.0001);
  const normalized = result.map((v) => Math.min(1, v / max));
  void audioContext.close();
  waveformPeakCache.set(url, normalized);
  return normalized;
}

// Stitches every segment's decoded peaks into one continuous track, each
// sized proportionally to its share of total duration, so the scrubber reads
// as a single waveform rather than per-segment blocks.
function useCombinedWaveformPeaks(generationId: string | null, durations: number[]): number[] | null {
  const [, forceUpdate] = useState(0);
  const durationsKey = durations.join(",");

  useEffect(() => {
    if (!generationId || durations.length === 0) return;
    let cancelled = false;
    const urls = durations.map((_, i) => segmentUrl(generationId, i));
    Promise.all(urls.map((url) => loadPeaks(url).catch(() => null))).then(() => {
      if (!cancelled) forceUpdate((n) => n + 1);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- durationsKey stands in for durations (a fresh array reference every render) so this only re-fetches when segment lengths actually change
  }, [generationId, durationsKey]);

  if (!generationId || durations.length === 0) return null;

  const total = durations.reduce((sum, d) => sum + d, 0) || 1;
  const combined = new Array(COMBINED_SAMPLE_COUNT).fill(0);
  let cursor = 0;
  durations.forEach((duration, i) => {
    const peaks = waveformPeakCache.get(segmentUrl(generationId, i));
    const fraction = duration / total;
    const startIdx = Math.round(cursor * COMBINED_SAMPLE_COUNT);
    const endIdx = Math.round((cursor + fraction) * COMBINED_SAMPLE_COUNT);
    if (peaks) {
      for (let idx = startIdx; idx < endIdx; idx++) {
        const t = endIdx > startIdx ? (idx - startIdx) / (endIdx - startIdx) : 0;
        combined[idx] = peaks[Math.min(peaks.length - 1, Math.floor(t * peaks.length))];
      }
    }
    cursor += fraction;
  });
  return combined;
}

// Renders decoded peaks as a two-tone bar waveform -- bright ahead of the
// unplayed remainder, dimmed in what's already played -- on a canvas sized to
// its container so bars stay crisp at any width.
function ScrubWaveform({ peaks, progress }: { peaks: number[] | null; progress: number }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    function draw() {
      const rect = container!.getBoundingClientRect();
      const width = Math.max(1, rect.width);
      const height = Math.max(1, rect.height);
      const dpr = window.devicePixelRatio || 1;
      canvas!.width = width * dpr;
      canvas!.height = height * dpr;
      canvas!.style.width = `${width}px`;
      canvas!.style.height = `${height}px`;
      const ctx = canvas!.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, width, height);
      if (!peaks || peaks.length === 0) return;
      ctx.scale(dpr, dpr);

      const barWidth = 2.5;
      const gap = 2;
      const barCount = Math.max(1, Math.floor(width / (barWidth + gap)));
      const mid = height / 2;
      const playedBars = progress * barCount;
      // A single brand blue at two alphas (rather than two hand-picked hex
      // colors) so bars read correctly on the neutral well in both themes
      // without a separate light/dark color pair.
      ctx.fillStyle = "#335cff";
      for (let i = 0; i < barCount; i++) {
        const peak = peaks[Math.min(peaks.length - 1, Math.floor((i / barCount) * peaks.length))];
        const barHeight = Math.max(2.5, peak * height * 0.85);
        const x = i * (barWidth + gap);
        const y = mid - barHeight / 2;
        ctx.globalAlpha = i < playedBars ? 1 : 0.32;
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barHeight, barWidth / 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    draw();
    const resizeObserver = new ResizeObserver(draw);
    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, [peaks, progress]);

  return (
    <div ref={containerRef} className="pointer-events-none absolute inset-0">
      <canvas ref={canvasRef} className="block h-full w-full" />
    </div>
  );
}

// The scrub bar users drag to choose playback position: a single dark
// "player chrome" pill (play button + continuous waveform + elapsed time)
// that reads as one deliberate control rather than a row of parts.
function Timeline({
  durations,
  currentTime,
  generationId,
  onSeek,
  isPlaying,
  onTogglePlay,
  disabled,
  onDeleteSegment,
  deletingIndex,
}: {
  durations: number[];
  currentTime: number;
  generationId: string | null;
  onSeek: (time: number) => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  disabled: boolean;
  onDeleteSegment?: (index: number) => void;
  deletingIndex?: number | null;
}) {
  const total = Math.max(0.5, durations.reduce((sum, d) => sum + d, 0));
  const progress = Math.min(1, currentTime / total);
  const combinedPeaks = useCombinedWaveformPeaks(generationId, durations);
  const showSegments = !disabled && durations.length > 1 && !!onDeleteSegment;

  // Boundaries for the per-segment dividers/hover-delete overlay below.
  let boundaryCursor = 0;
  const segmentZones = durations.map((duration, index) => {
    const startPct = (boundaryCursor / total) * 100;
    boundaryCursor += duration;
    return { index, startPct, widthPct: (duration / total) * 100 };
  });

  const trackRef = useRef<HTMLDivElement | null>(null);
  const [isScrubbing, setIsScrubbing] = useState(false);

  function progressFromClientX(clientX: number): number {
    const el = trackRef.current;
    if (!el) return progress;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 ? Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)) : 0;
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (disabled) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsScrubbing(true);
    onSeek(progressFromClientX(event.clientX) * total);
  }
  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!isScrubbing) return;
    onSeek(progressFromClientX(event.clientX) * total);
  }
  function handlePointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    if (!isScrubbing) return;
    setIsScrubbing(false);
    onSeek(progressFromClientX(event.clientX) * total);
  }

  return (
    <div
      className={cn(
        "flex items-center gap-3 transition-opacity",
        disabled && "opacity-50"
      )}
    >
      <button
        type="button"
        onClick={onTogglePlay}
        disabled={disabled}
        aria-label={isPlaying ? "Pause" : "Play"}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-heading text-surface transition-opacity hover:opacity-90 active:scale-95 disabled:cursor-not-allowed"
      >
        {isPlaying ? (
          <Pause className="h-3.5 w-3.5" fill="currentColor" />
        ) : (
          <Play className="h-3.5 w-3.5 translate-x-[1px]" fill="currentColor" />
        )}
      </button>

      {/* A neutral well -- the waveform itself carries the color. */}
      <div
        ref={trackRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className={cn(
          "relative h-10 flex-1 touch-none select-none overflow-hidden rounded-lg bg-(--app-fill)",
          disabled ? "cursor-not-allowed" : "cursor-pointer"
        )}
      >
        <ScrubWaveform peaks={combinedPeaks} progress={progress} />

        {showSegments &&
          segmentZones.map(({ index, startPct, widthPct }) => (
            <div
              key={index}
              className={cn(
                "group absolute inset-y-0 flex items-start justify-end",
                index > 0 && "border-l border-black/10 dark:border-white/10"
              )}
              style={{ left: `${startPct}%`, width: `${widthPct}%` }}
            >
              <div className="pointer-events-none absolute inset-0 bg-primary/0 transition-colors group-hover:bg-primary/10" />
              <button
                type="button"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation();
                  onDeleteSegment?.(index);
                }}
                disabled={deletingIndex === index}
                aria-label={`Delete segment ${index + 1}`}
                className="pointer-events-auto relative z-10 m-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-heading text-surface opacity-0 shadow-sm transition-opacity group-hover:opacity-100 hover:bg-danger disabled:cursor-not-allowed disabled:opacity-100"
              >
                {deletingIndex === index ? (
                  <Loader2 className="h-2.5 w-2.5 animate-spin" />
                ) : (
                  <X className="h-2.5 w-2.5" strokeWidth={3} />
                )}
              </button>
            </div>
          ))}

        {/* bg-heading/text pairing is intentionally inverted per theme
            (near-black in light, near-white in dark) so this cursor stays
            visible against the well above regardless of theme. */}
        <div
          className={cn(
            "pointer-events-none absolute inset-y-1.5 w-0.5 -translate-x-1/2 rounded-full bg-heading transition-transform",
            isScrubbing && "scale-y-125"
          )}
          style={{ left: `${progress * 100}%` }}
        />
      </div>

      <span className="shrink-0 text-xs tabular-nums text-subtle">
        <span className="text-heading">{formatTime(currentTime)}</span> / {formatTime(total)}
      </span>
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────────

export function VoiceoverGenerator() {
  const [title, setTitle] = useState("");
  const [script, setScript] = useState("");
  // `voiceId` is what gets sent: an ElevenLabs id, or `clone:<id>` for a
  // cloned voice. `elevenLabsVoice` holds the display info for the former.
  const [voiceId, setVoiceId] = useState(DEFAULT_VOICE.voiceId);
  const [elevenLabsVoice, setElevenLabsVoice] = useState<ElevenLabsVoice>(DEFAULT_VOICE);
  const [generationMode, setGenerationMode] = useState<GenerationMode>("line_by_line");
  const generationModePillId = useId();

  const [modelId, setModelId] = useState(DEFAULT_MODEL_ID);
  const [isModelListOpen, setIsModelListOpen] = useState(false);
  const [languageCode, setLanguageCode] = useState(DEFAULT_LANGUAGE_CODE);
  const [voiceSettings, setVoiceSettings] = useState<VoiceSettings>(DEFAULT_VOICE_SETTINGS);

  const [sidebarTab, setSidebarTab] = useState<"settings" | "history">("settings");
  const [historyRefreshSignal, setHistoryRefreshSignal] = useState(0);
  const [selectingHistoryId, setSelectingHistoryId] = useState<string | null>(null);


  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [voiceClones, setVoiceClones] = useState<VoiceCloneSummary[]>([]);
  const [isAddVoiceModalOpen, setIsAddVoiceModalOpen] = useState(false);
  const [previewingCloneId, setPreviewingCloneId] = useState<string | null>(null);
  const [playingCloneId, setPlayingCloneId] = useState<string | null>(null);
  const [deletingCloneId, setDeletingCloneId] = useState<string | null>(null);
  const cloneAudioRef = useRef<HTMLAudioElement | null>(null);
  // The picked voice's static sample, played from its card.
  const voicePreviewRef = useRef<HTMLAudioElement | null>(null);
  const [isVoicePreviewPlaying, setIsVoicePreviewPlaying] = useState(false);
  // Generate never greys out: pressed with no script it says so and puts
  // the cursor in the editor (same as the image and video generators).
  const [scriptHint, setScriptHint] = useState(false);
  const scriptRef = useRef<HTMLTextAreaElement | null>(null);

  const [view, setView] = useState<View>("input");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [generationId, setGenerationId] = useState<string | null>(null);
  const [segments, setSegments] = useState<SegmentState[]>([]);
  const [creditsQuoted, setCreditsQuoted] = useState<number | null>(null);
  const pollCancelRef = useRef<(() => void) | null>(null);
  const [loadingProgress, setLoadingProgress] = useState(0);

  const [editorTab, setEditorTab] = useState<EditorTab>("audio");
  const [isAddingSegment, setIsAddingSegment] = useState(false);
  const [newSegmentText, setNewSegmentText] = useState("");
  const [isSubmittingSegment, setIsSubmittingSegment] = useState(false);
  const [deletingIndex, setDeletingIndex] = useState<number | null>(null);
  const [regeneratingIndex, setRegeneratingIndex] = useState<number | null>(null);

  const [playingIndex, setPlayingIndex] = useState<number | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  // Whether the shared <audio> element is currently mid-playback, and
  // whether that playback is the sequential bottom-player (auto-advances on
  // end) vs a single-segment preview (from a row's own Play button). Tracked
  // as state (not read off audioRef.current) so render never touches a ref's
  // .current -- React flags reading a ref during render as unsafe.
  const [isPlaying, setIsPlaying] = useState(false);
  const [isSequenceMode, setIsSequenceMode] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Picks up a script handed off from the Script Writer's "Generate
  // Voiceover" button (see ScriptEditorModal.tsx). Must run post-mount, not
  // as a lazy useState initializer -- this component is server-rendered
  // first (sessionStorage doesn't exist there), and reading browser storage
  // during the initial client render would create a hydration mismatch
  // against that empty server-rendered output.
  useEffect(() => {
    const handoff = consumeVoiceoverHandoff();
    if (!handoff) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydration from sessionStorage, not a derived/external sync
    setScript(handoff.script.slice(0, MAX_SCRIPT_CHARS));
    if (handoff.title.trim()) {
      setTitle(handoff.title.trim());
    }
  }, []);

  const deepLinkId = useSearchParams().get("id");

  useEffect(() => {
    if (!VOICE_CLONING_ENABLED) return;
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/api/voice-clones");
        if (!response.ok) return;
        const data = await response.json();
        if (!cancelled) setVoiceClones(data.voiceClones ?? []);
      } catch {
        // Non-fatal -- the fixed catalog still works without cloned voices.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedClone = voiceId.startsWith("clone:") ? voiceClones.find((clone) => `clone:${clone.id}` === voiceId) : undefined;

  const currentModel = ELEVENLABS_MODELS.find((m) => m.id === modelId) ?? ELEVENLABS_MODELS[0];
  const discreteStability = hasDiscreteStability(currentModel.id);
  const showLanguage = supportsLanguageSelection(currentModel.id);

  // A new voice stops the previous one's sample (its onPause clears the state).
  useEffect(() => {
    voicePreviewRef.current?.pause();
  }, [voiceId]);

  function toggleVoicePreview() {
    const audio = voicePreviewRef.current;
    if (!audio || !elevenLabsVoice.previewUrl) return;
    if (!audio.paused) {
      audio.pause();
      return;
    }
    audio.src = elevenLabsVoice.previewUrl;
    void audio.play().catch(() => setIsVoicePreviewPlaying(false));
  }

  function submitScript() {
    if (!script.trim()) {
      setScriptHint(true);
      scriptRef.current?.focus();
      return;
    }
    void handleGenerate();
  }

  function selectElevenLabsVoice(voice: ElevenLabsVoice) {
    setElevenLabsVoice(voice);
    setVoiceId(voice.voiceId);
  }

  function selectModel(id: string) {
    setModelId(id);
    setIsModelListOpen(false);
    if (hasDiscreteStability(id)) {
      setVoiceSettings((prev) => ({ ...prev, stability: nearestDiscreteStability(prev.stability) }));
    }
  }

  function updateVoiceSetting<K extends keyof VoiceSettings>(key: K, value: VoiceSettings[K]) {
    setVoiceSettings((prev) => ({ ...prev, [key]: value }));
  }

  const estimatedSegments = useMemo(() => estimateSegmentTexts(script, generationMode), [script, generationMode]);
  const estimatedCredits = useMemo(
    () => estimatedSegments.reduce((sum, text) => sum + getVoiceoverSegmentCost(text.length, currentModel.costMultiplier), 0),
    [estimatedSegments, currentModel.costMultiplier]
  );
  const newSegmentCredits = useMemo(
    () => getVoiceoverSegmentCost(newSegmentText.length, currentModel.costMultiplier),
    [newSegmentText, currentModel.costMultiplier]
  );

  const durations = segments.map((s) => s.durationSeconds);

  useEffect(() => {
    return () => pollCancelRef.current?.();
  }, []);

  function resetSettings() {
    setVoiceSettings(DEFAULT_VOICE_SETTINGS);
    setLanguageCode(DEFAULT_LANGUAGE_CODE);
  }

  function buildTtsSettings(): TtsSettings {
    return {
      modelId: currentModel.id,
      languageCode: showLanguage ? languageCode : null,
      voiceSettings,
      voiceName: selectedClone ? selectedClone.name : elevenLabsVoice.name,
    };
  }

  // A clone's preview was rendered once when it was created and stored; the
  // route redirects to a fresh link to that file, so it plays as a plain src.
  async function playClonePreview(clone: VoiceCloneSummary) {
    const audio = cloneAudioRef.current;
    if (!audio) return;
    if (playingCloneId === clone.id) {
      audio.pause();
      setPlayingCloneId(null);
      return;
    }
    setPreviewingCloneId(clone.id);
    setPreviewError(null);
    try {
      audio.src = `/api/voice-clones/${clone.id}/preview`;
      await audio.play();
      setPlayingCloneId(clone.id);
    } catch {
      setPreviewError("Could not play that preview");
    } finally {
      setPreviewingCloneId(null);
    }
  }

  async function deleteClone(clone: VoiceCloneSummary) {
    setDeletingCloneId(clone.id);
    try {
      const response = await fetch(`/api/voice-clones/${clone.id}`, { method: "DELETE" });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error ?? "Could not delete that voice");
      }
      setVoiceClones((prev) => prev.filter((c) => c.id !== clone.id));
      if (voiceId === `clone:${clone.id}`) setVoiceId(elevenLabsVoice.voiceId);
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : "Could not delete that voice");
    } finally {
      setDeletingCloneId(null);
    }
  }

  // Stable so the modal's Escape-key effect doesn't resubscribe every render.
  const closeVoiceModal = useCallback(() => {
    setIsVoiceModalOpen(false);
    cloneAudioRef.current?.pause();
    setPlayingCloneId(null);
  }, []);

  const closeCloneModal = useCallback(() => setIsAddVoiceModalOpen(false), []);

  function handleVoiceCloneCreated(clone: VoiceCloneSummary) {
    setVoiceClones((prev) => [clone, ...prev]);
    setVoiceId(`clone:${clone.id}`);
  }

  // `resumed`: picked back up after leaving the page (see readPendingGeneration),
  // so the form no longer holds this generation's title/script/voice --
  // loadGeneration restores all of that along with the finished audio.
  function pollGeneration(id: string, resumed = false) {
    pollCancelRef.current?.();
    pollCancelRef.current = pollUntilSettled<{
      status: string;
      error_message: string | null;
      segments: { text: string; durationSeconds: number }[];
      credits_quoted?: number;
    } | null>(
      async () => {
        const response = await fetch(`/api/generate-voiceover?id=${id}`);
        if (!response.ok) throw new Error();
        const data = await response.json();
        return data.generations?.[0] ?? null;
      },
      (row) => !row || row.status !== "generating",
      (row) => {
        if (!row) {
          writePendingGeneration(null);
          setView("input");
          setIsGenerating(false);
          return;
        }
        if (row.status !== "generating") writePendingGeneration(null);
        if (row.status === "completed" && resumed) {
          setIsGenerating(false);
          setHistoryRefreshSignal((n) => n + 1);
          void loadGeneration(id);
        } else if (row.status === "completed") {
          setSegments(row.segments.map((s) => ({ text: s.text, durationSeconds: s.durationSeconds })));
          setCreditsQuoted(row.credits_quoted ?? null);
          setView("editor");
          setEditorTab("audio");
          setIsGenerating(false);
          setHistoryRefreshSignal((n) => n + 1);
        } else if (row.status === "failed") {
          setGenerationError(row.error_message ?? "Something went wrong. Try again.");
          setView("input");
          setIsGenerating(false);
        }
      },
      {
        intervalMs: 2500,
        timeoutMs: 5 * 60 * 1000,
        onTimeout: () => {
          writePendingGeneration(null);
          setGenerationError("This is taking longer than expected. Please try again.");
          setView("input");
          setIsGenerating(false);
        },
      }
    );
  }

  // Real completion arrives via `pollGeneration` above, which can take up to
  // a few minutes -- so the bar can't just sweep to 100% on a fixed timer
  // (it would finish and loop several times before the voiceover is
  // actually ready). Instead it creeps toward a near-complete cap and holds
  // there; only the real `setView("editor")` on completion ever unmounts it.
  useEffect(() => {
    if (view !== "loading") {
      setLoadingProgress(0);
      return;
    }
    const cap = 96;
    const easeSeconds = 45;
    const start = performance.now();
    let raf = 0;
    const tick = (ts: number) => {
      const elapsed = (ts - start) / 1000;
      setLoadingProgress(cap * (1 - Math.exp(-elapsed / easeSeconds)));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [view]);

  async function handleGenerate() {
    if (!script.trim() || isGenerating) return;

    if (title.trim() && !isValidName(title)) {
      setGenerationError("Title contains characters that aren't allowed, or is too long.");
      return;
    }

    setIsGenerating(true);
    setGenerationError(null);
    setView("loading");

    try {
      const response = await fetch("/api/generate-voiceover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, script, voiceId, generationMode, tts: buildTtsSettings() }),
      });

      if (response.status === 402) {
        setGenerationError("You don't have enough credits for this generation.");
        setIsGenerating(false);
        setView("input");
        return;
      }

      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error ?? "Failed to generate voiceover.");

      setGenerationId(data.id);
      writePendingGeneration(data.id);
      pollGeneration(data.id);
    } catch (err) {
      setGenerationError(err instanceof Error ? err.message : "Something went wrong. Try again.");
      setIsGenerating(false);
      setView("input");
    }
  }

  async function handleAddSegment() {
    if (!generationId || !newSegmentText.trim() || isSubmittingSegment) return;
    setIsSubmittingSegment(true);
    try {
      const response = await fetch(`/api/generate-voiceover/${generationId}/segments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: newSegmentText }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error ?? "Could not add segment");

      setSegments((prev) => [...prev, { text: data.segment.text, durationSeconds: data.segment.durationSeconds }]);
      setNewSegmentText("");
      setIsAddingSegment(false);
    } catch (err) {
      setGenerationError(err instanceof Error ? err.message : "Could not add segment");
    } finally {
      setIsSubmittingSegment(false);
    }
  }

  async function handleDeleteSegment(index: number) {
    if (!generationId || deletingIndex !== null) return;
    setDeletingIndex(index);
    try {
      const response = await fetch(`/api/generate-voiceover/${generationId}/segments/${index}`, { method: "DELETE" });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error ?? "Could not delete segment");
      }
      setSegments((prev) => prev.filter((_, i) => i !== index));
      if (playingIndex === index) {
        audioRef.current?.pause();
        setPlayingIndex(null);
      }
    } catch (err) {
      setGenerationError(err instanceof Error ? err.message : "Could not delete segment");
    } finally {
      setDeletingIndex(null);
    }
  }

  function playSegment(index: number) {
    if (!generationId || !audioRef.current) return;
    setIsSequenceMode(false);
    audioRef.current.loop = false;
    audioRef.current.src = segmentUrl(generationId, index);
    setPlayingIndex(index);
    void audioRef.current.play();
  }

  // Re-runs TTS for just this segment's (possibly edited) text, keeping the
  // generation's existing voice/style/language, and swaps in the new audio
  // once the server confirms it -- the "Voiceover editor" tab's regenerate
  // button. Stops playback of the segment being replaced so a stale <audio>
  // src never lingers pointed at now-superseded audio.
  async function handleRegenerateSegment(index: number) {
    if (!generationId || regeneratingIndex !== null) return;
    const text = segments[index]?.text.trim();
    if (!text) return;
    setRegeneratingIndex(index);
    try {
      const response = await fetch(`/api/generate-voiceover/${generationId}/segments/${index}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error ?? "Could not regenerate segment");

      setSegments((prev) =>
        prev.map((s, i) => (i === index ? { text: data.segment.text, durationSeconds: data.segment.durationSeconds } : s))
      );
      if (playingIndex === index) {
        audioRef.current?.pause();
        setPlayingIndex(null);
      }
    } catch (err) {
      setGenerationError(err instanceof Error ? err.message : "Could not regenerate segment");
    } finally {
      setRegeneratingIndex(null);
    }
  }

  function playSequenceFrom(index: number) {
    if (!generationId || !audioRef.current || segments.length === 0) return;
    setIsSequenceMode(true);
    audioRef.current.loop = false;
    audioRef.current.src = segmentUrl(generationId, index);
    setPlayingIndex(index);
    void audioRef.current.play();
  }

  function seekToGlobalTime(time: number) {
    if (!generationId || !audioRef.current || durations.length === 0) return;
    const total = durations.reduce((sum, d) => sum + d, 0) || 1;
    const clamped = Math.max(0, Math.min(total - 0.01, time));
    let acc = 0;
    let index = durations.length - 1;
    for (let i = 0; i < durations.length; i++) {
      if (clamped < acc + durations[i]) {
        index = i;
        break;
      }
      acc += durations[i];
    }
    const localTime = Math.max(0, clamped - acc);
    const audio = audioRef.current;
    const wasPlaying = isPlaying;

    setCurrentTime(clamped);
    setIsSequenceMode(true);

    if (playingIndex === index) {
      audio.currentTime = localTime;
      if (wasPlaying) void audio.play();
      return;
    }

    setPlayingIndex(index);
    audio.src = segmentUrl(generationId, index);
    const onReady = () => {
      audio.currentTime = localTime;
      if (wasPlaying) void audio.play();
      audio.removeEventListener("loadedmetadata", onReady);
    };
    audio.addEventListener("loadedmetadata", onReady);
  }

  function handleGenerateAgain() {
    audioRef.current?.pause();
    pollCancelRef.current?.();
    setPlayingIndex(null);
    setIsPlaying(false);
    setIsSequenceMode(false);
    setCurrentTime(0);
    setGenerationId(null);
    setSegments([]);
    setCreditsQuoted(null);
    setGenerationError(null);
    setView("input");
  }

  function togglePlayPause() {
    if (!audioRef.current) return;
    if (isPlaying && isSequenceMode) {
      audioRef.current.pause();
      return;
    }
    if (playingIndex !== null && isSequenceMode) {
      void audioRef.current.play();
      return;
    }
    playSequenceFrom(0);
  }

  function handleAudioEnded() {
    if (!isSequenceMode || playingIndex === null) {
      setPlayingIndex(null);
      return;
    }
    const nextIndex = playingIndex + 1;
    if (nextIndex < segments.length) {
      playSequenceFrom(nextIndex);
    } else {
      setPlayingIndex(null);
    }
  }

  function handleTimeUpdate() {
    if (!audioRef.current) return;
    const priorDuration = durations.slice(0, playingIndex ?? 0).reduce((sum, d) => sum + d, 0);
    setCurrentTime(priorDuration + audioRef.current.currentTime);
  }

  function handleLoadedMetadata(index: number) {
    if (!audioRef.current) return;
    const realDuration = audioRef.current.duration;
    if (!Number.isFinite(realDuration) || realDuration <= 0) return;
    setSegments((prev) => prev.map((s, i) => (i === index ? { ...s, durationSeconds: realDuration } : s)));
  }

  async function handleExport() {
    if (!generationId || segments.length === 0 || isExporting) return;
    setIsExporting(true);
    setExportError(null);
    try {
      const urls = segments.map((_, index) => segmentUrl(generationId, index));
      const blob = await exportSegmentsAsWav(urls);
      downloadBlob(blob, `${(title || "voiceover").trim().replace(/\s+/g, "-").toLowerCase()}.wav`);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Could not export audio");
    } finally {
      setIsExporting(false);
    }
  }

  async function loadGeneration(id: string) {
    if (selectingHistoryId) return;
    setSelectingHistoryId(id);
    setGenerationError(null);
    try {
      const response = await fetch(`/api/generate-voiceover?id=${id}`);
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error ?? "Could not load that generation");
      const row = data?.generations?.[0];
      if (!row) throw new Error("That generation could not be found");

      audioRef.current?.pause();
      setPlayingIndex(null);
      setIsSequenceMode(false);
      setCurrentTime(0);

      setTitle(row.title ?? "");
      setScript(row.script ?? "");
      // Rows from before the ElevenLabs switch have no stored settings (and a
      // Gemini voice id), so they keep whatever voice/settings are current.
      const tts = readStoredTtsSettings(row.style_prompt);
      if (tts) {
        if (String(row.voice_id).startsWith("clone:")) {
          setVoiceId(row.voice_id);
        } else {
          // A Voice Library or pasted-id voice isn't in VOICES -- rebuild what
          // the picker row shows from the name stored with the generation.
          const voice =
            getVoice(row.voice_id) ??
            (isElevenLabsVoiceId(row.voice_id)
              ? { voiceId: row.voice_id, name: tts.voiceName, gender: null, accent: null, age: null, description: "", previewUrl: null }
              : undefined);
          if (voice) {
            setElevenLabsVoice(voice);
            setVoiceId(voice.voiceId);
          }
        }
        setModelId(tts.modelId);
        setLanguageCode(tts.languageCode ?? DEFAULT_LANGUAGE_CODE);
        setVoiceSettings({ ...DEFAULT_VOICE_SETTINGS, ...tts.voiceSettings });
      }
      setGenerationId(row.id);
      setSegments((row.segments ?? []).map((s: { text: string; durationSeconds: number }) => ({ text: s.text, durationSeconds: s.durationSeconds })));
      setCreditsQuoted(row.credits_quoted ?? null);
      setEditorTab("audio");
      setView("editor");
      setSidebarTab("settings");
    } catch (err) {
      setGenerationError(err instanceof Error ? err.message : "Could not load that generation");
    } finally {
      setSelectingHistoryId(null);
    }
  }

  // Deep-link from the Library ("Open" on a voiceover asset) -- preloads
  // that generation straight into the editor instead of landing on the
  // blank input screen.
  useEffect(() => {
    if (deepLinkId) void loadGeneration(deepLinkId);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once for the id present at mount; loadGeneration is stable enough for this one-shot deep link
  }, [deepLinkId]);

  // A generation keeps running server-side (after() in generate-voiceover)
  // when the user leaves the page -- coming back resumes watching it rather
  // than landing on a blank form while it finishes unseen in History.
  useEffect(() => {
    if (deepLinkId) return;
    const pendingId = readPendingGeneration();
    if (!pendingId) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydration from sessionStorage, not a derived/external sync
    setGenerationId(pendingId);
    setIsGenerating(true);
    setView("loading");
    pollGeneration(pendingId, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only resume
  }, []);

  const charCount = script.length;

  return (
    <div className="w-full px-0 pt-8 pb-16 sm:px-6 sm:pt-10">
      <audio ref={cloneAudioRef} className="hidden" onEnded={() => setPlayingCloneId(null)} />
      <audio
        ref={voicePreviewRef}
        className="hidden"
        onPlay={() => setIsVoicePreviewPlaying(true)}
        onPause={() => setIsVoicePreviewPlaying(false)}
        onEnded={() => setIsVoicePreviewPlaying(false)}
      />
      <VoiceLibraryModal
        isOpen={isVoiceModalOpen}
        onClose={closeVoiceModal}
        selectedVoiceId={voiceId}
        onSelectVoice={selectElevenLabsVoice}
        clones={voiceClones}
        onSelectClone={(clone) => setVoiceId(`clone:${clone.id}`)}
        onPlayClone={playClonePreview}
        onDeleteClone={deleteClone}
        onAddVoice={() => setIsAddVoiceModalOpen(true)}
        previewingCloneId={previewingCloneId}
        playingCloneId={playingCloneId}
        deletingCloneId={deletingCloneId}
        cloneError={previewError}
      />
      <CloneVoiceModal isOpen={isAddVoiceModalOpen} onClose={closeCloneModal} onCreated={handleVoiceCloneCreated} />
      <audio
        ref={audioRef}
        className="hidden"
        onEnded={handleAudioEnded}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={() => playingIndex !== null && handleLoadedMetadata(playingIndex)}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
      />

      <div className="mx-auto w-full max-w-7xl">
        <header className="mb-8">
          <h1 className={cn(INK_TITLE, "text-[32px] leading-[1.1] tracking-[-0.03em] sm:text-[40px]")}>
            {view === "editor" ? "Edit voiceover" : "Create voiceover"}
          </h1>
          <p className="mt-2 text-sm text-subtle sm:text-[15px]">Turn a script into natural-sounding narration</p>
        </header>

        {generationError && (
          <p className="mb-4 rounded-xl bg-danger-tint px-4 py-2.5 text-sm font-medium text-danger" role="alert">
            {generationError}
          </p>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_372px]">
          {/* ── Left column: main workspace, in the composer bezel ─────── */}
          <div className={cn(COMPOSER_RIM, "flex")}>
          <div className={cn(COMPOSER_SHEET, "relative flex min-h-[600px] flex-1 flex-col overflow-hidden")}>
            {view !== "editor" && (
              <>
                <div className="flex flex-1 flex-col">
                  <input
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="Untitled script"
                    aria-label="Title"
                    disabled={view === "loading"}
                    maxLength={NAME_MAX}
                    className="w-full bg-transparent px-6 pt-6 text-xl font-semibold tracking-[-0.02em] text-heading outline-none placeholder:text-[#9AA0AB] disabled:opacity-60 dark:placeholder:text-zinc-600"
                  />

                  {view === "loading" ? (
                    <div className="relative flex flex-1 flex-col items-center justify-center gap-3 px-6">
                      <span className="absolute right-6 top-3 text-xs text-subtle">Usually 1–3 minutes</span>
                      <ProgressiveFluxLoader
                        phases={VOICEOVER_LOADING_PHASES}
                        value={loadingProgress}
                      />
                    </div>
                  ) : (
                    <>
                      <ScriptTextarea
                        textareaRef={scriptRef}
                        value={script}
                        onChange={(value) => {
                          setScript(value.slice(0, MAX_SCRIPT_CHARS));
                          setScriptHint(false);
                        }}
                        onSubmit={submitScript}
                        highlightTags
                        placeholder="Type or paste your script"
                        maxLength={MAX_SCRIPT_CHARS}
                        className="mt-2 min-h-[300px] flex-1"
                        paddingClassName="px-6 pb-4"
                      />
                    </>
                  )}
                </div>

                <div className={cn("flex items-center justify-between gap-3 border-t py-3 pl-6 pr-3", SHEET_RULE)}>
                  <span className="min-w-0 truncate text-xs text-subtle">
                    <span className="font-mono tabular-nums">
                      {charCount.toLocaleString()} / {MAX_SCRIPT_CHARS.toLocaleString()}
                    </span>
                    {supportsAudioTags(currentModel.id) && view !== "loading" && (
                      <span className="ml-4 hidden lg:inline">
                        Tags like <AudioTagSample>[excited]</AudioTagSample> or <AudioTagSample>[whispers]</AudioTagSample> work with{" "}
                        {currentModel.name}
                      </span>
                    )}
                  </span>
                  <div className="flex shrink-0 items-center gap-3">
                    <SubmitHint hint={scriptHint && !script.trim() ? "Write a script first" : null} />
                    <PlasticButton
                      text="Generate"
                      loading={view === "loading"}
                      loadingText="Generating…"
                      onClick={submitScript}
                      trailing={script.trim() ? <CreditCost amount={estimatedCredits} className="text-blue-200/80" /> : undefined}
                      className="shrink-0 !px-5 !py-2.5 font-semibold"
                    />
                  </div>
                </div>
              </>
            )}

            {view === "editor" && generationId && (
              <>
                <div className="flex items-start justify-between gap-3 px-6 pt-6">
                  <div className="min-w-0">
                    <h2 className="truncate text-xl font-semibold tracking-[-0.02em] text-heading">{title || "Untitled script"}</h2>
                    <p className="mt-0.5 text-xs text-subtle">
                      {[
                        `${segments.length} segment${segments.length === 1 ? "" : "s"}`,
                        formatTime(durations.reduce((sum, d) => sum + d, 0)),
                        creditsQuoted !== null && creditsLabel(creditsQuoted),
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <button type="button" onClick={handleGenerateAgain} className={SECONDARY_BUTTON}>
                    <RotateCcw className="h-3.5 w-3.5" />
                    Generate again
                  </button>
                </div>

                <div className={cn("mt-4 flex gap-5 border-b px-6", SHEET_RULE)}>
                  {(
                    [
                      { key: "audio", label: "Audio" },
                      { key: "editor", label: "Script" },
                    ] as const
                  ).map(({ key, label }) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setEditorTab(key)}
                      aria-pressed={editorTab === key}
                      className={cn(
                        "-mb-px border-b-2 pb-2.5 text-sm font-medium transition-colors",
                        editorTab === key ? "border-heading text-heading" : "border-transparent text-subtle hover:text-heading"
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {editorTab === "editor" ? (
                  <>
                    <ScriptTextarea
                      value={script}
                      onChange={(value) => setScript(value.slice(0, MAX_SCRIPT_CHARS))}
                      highlightTags
                      placeholder="Type or paste your script…"
                      maxLength={MAX_SCRIPT_CHARS}
                      className="min-h-[300px] flex-1"
                      paddingClassName="px-6 py-4"
                      onSubmit={() => void handleGenerate()}
                    />
                    <div className={cn("flex items-center justify-between gap-3 border-t py-3 pl-6 pr-3", SHEET_RULE)}>
                      <span className="font-mono text-xs tabular-nums text-subtle">
                        {charCount.toLocaleString()} / {MAX_SCRIPT_CHARS.toLocaleString()}
                      </span>
                      <div className="flex shrink-0 items-center gap-3">
                        <PlasticButton
                          text="Regenerate"
                          loading={isGenerating}
                          loadingText="Regenerating…"
                          disabled={!script.trim()}
                          onClick={handleGenerate}
                          trailing={script.trim() ? <CreditCost amount={estimatedCredits} className="text-blue-200/80" /> : undefined}
                          className="shrink-0 !px-5 !py-2.5 font-semibold"
                        />
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-1 flex-col">
                    <div className="flex-1 space-y-0.5 overflow-y-auto px-3 py-3">
                      {segments.map((segment, index) => (
                        <div
                          key={index}
                          className={cn(
                            "group/segment flex items-center gap-2 rounded-lg py-1 pl-2 pr-1 transition-colors",
                            playingIndex === index ? "bg-(--app-fill-strong)" : "hover:bg-(--app-fill)"
                          )}
                        >
                          <span className={cn("w-6 shrink-0 text-right text-xs tabular-nums", playingIndex === index ? "font-semibold text-primary" : "text-subtle")}>
                            {index + 1}
                          </span>
                          <input
                            value={segment.text}
                            onChange={(event) => {
                              const value = event.target.value;
                              setSegments((prev) => prev.map((s, i) => (i === index ? { ...s, text: value } : s)));
                            }}
                            disabled={regeneratingIndex === index}
                            aria-label={`Segment ${index + 1} text`}
                            className="min-w-0 flex-1 rounded-md bg-transparent px-2 py-1.5 text-sm text-heading outline-none transition-colors focus:bg-surface focus:ring-1 focus:ring-hairline disabled:opacity-60"
                          />
                          <div className="flex shrink-0 items-center gap-0.5">
                            <div
                              className={cn(
                                "flex items-center gap-0.5 transition-opacity group-hover/segment:opacity-100 group-focus-within/segment:opacity-100",
                                regeneratingIndex !== index && deletingIndex !== index && "[@media(hover:hover)]:opacity-0"
                              )}
                            >
                            <IconButton
                              title="Regenerate segment"
                              onClick={() => handleRegenerateSegment(index)}
                              disabled={regeneratingIndex !== null || !segment.text.trim()}
                            >
                              {regeneratingIndex === index ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <RotateCcw className="h-3.5 w-3.5" />
                              )}
                            </IconButton>
                            <IconButton
                              title="Delete segment"
                              destructive
                              disabled={deletingIndex === index}
                              onClick={() => handleDeleteSegment(index)}
                            >
                              {deletingIndex === index ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
                            </IconButton>
                            </div>
                            <IconButton title="Play segment" onClick={() => playSegment(index)} active={playingIndex === index && !isSequenceMode}>
                              {playingIndex === index && !isSequenceMode && isPlaying ? (
                                <Pause className="h-3.5 w-3.5" />
                              ) : (
                                <Play className="h-3.5 w-3.5" />
                              )}
                            </IconButton>
                          </div>
                        </div>
                      ))}

                      {isAddingSegment ? (
                        <div className="mx-2 mt-2 rounded-xl border border-hairline bg-surface p-3">
                          <textarea
                            value={newSegmentText}
                            onChange={(event) => setNewSegmentText(event.target.value.slice(0, 1000))}
                            placeholder="Type the new segment's text..."
                            autoFocus
                            className="min-h-[70px] w-full resize-none bg-transparent text-sm text-body outline-none placeholder:text-subtle"
                          />
                          <div className="mt-2 flex items-center justify-between gap-2">
                            {newSegmentText.trim() ? (
                              <span className="text-xs tabular-nums text-subtle">{creditsLabel(newSegmentCredits)}</span>
                            ) : (
                              <span />
                            )}
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setIsAddingSegment(false);
                                  setNewSegmentText("");
                                }}
                                className="h-8 rounded-lg px-3 text-xs font-medium text-subtle hover:bg-(--app-fill) hover:text-heading"
                              >
                                Cancel
                              </button>
                              <PrimaryButton
                                text="Add segment"
                                loading={isSubmittingSegment}
                                disabled={!newSegmentText.trim()}
                                onClick={handleAddSegment}
                                className="h-8 px-3 text-xs"
                              />
                            </div>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setIsAddingSegment(true)}
                          className="mt-1 flex w-full items-center gap-2 rounded-lg py-2 pl-2 text-sm text-subtle transition-colors hover:bg-(--app-fill) hover:text-heading"
                        >
                          <span className="flex w-6 justify-end">
                            <Plus className="h-4 w-4" />
                          </span>
                          Add segment
                        </button>
                      )}
                    </div>

                    <div className={cn("border-t px-6 py-4", SHEET_RULE)}>
                    <Timeline
                      durations={durations.length > 0 ? durations : [1]}
                      currentTime={currentTime}
                      generationId={generationId}
                      onSeek={seekToGlobalTime}
                      isPlaying={isSequenceMode && isPlaying}
                      onTogglePlay={togglePlayPause}
                      disabled={segments.length === 0}
                      onDeleteSegment={handleDeleteSegment}
                      deletingIndex={deletingIndex}
                    />
                    {exportError && <p className="mt-2 text-xs font-medium text-danger">{exportError}</p>}
                    <div className="mt-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-1.5">
                        <IconButton
                          title="Previous segment"
                          onClick={() => playSequenceFrom(Math.max(0, (playingIndex ?? 0) - 1))}
                          disabled={segments.length === 0}
                        >
                          <SkipBack className="h-4 w-4" />
                        </IconButton>
                        <IconButton
                          title="Next segment"
                          onClick={() => playSequenceFrom(Math.min(segments.length - 1, (playingIndex ?? 0) + 1))}
                          disabled={segments.length === 0}
                        >
                          <SkipForward className="h-4 w-4" />
                        </IconButton>
                      </div>
                      <PlasticButton
                        text={
                          <>
                            <Download className="h-4 w-4" />
                            Download
                          </>
                        }
                        loading={isExporting}
                        loadingText="Exporting…"
                        disabled={segments.length === 0}
                        onClick={handleExport}
                        className="shrink-0 !px-5 !py-2.5 font-semibold"
                      />
                    </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
          </div>

          {/* ── Right column: settings / history, in the same bezel. The
              tabs sit on the rim like the generators' settings tray, and
              the active one lifts onto a white chip. ─────────────────── */}
          <div className="relative">
              <div
                className={cn(
                  COMPOSER_RIM,
                  "flex flex-col",
                  // History needs the full column height to size its own scroll
                  // area (see HistoryPanel's h-full max-h-[720px]); Settings has
                  // no such need and should just hug its content instead of
                  // stretching to match the (usually taller) left column.
                  sidebarTab === "history" && "h-full"
                )}
              >
                <div role="tablist" aria-label="Sidebar" className="flex shrink-0 items-center gap-1 px-[11px] pb-1.5">
                  {(
                    [
                      { key: "settings", label: "Settings" },
                      { key: "history", label: "History" },
                    ] as const
                  ).map(({ key, label }) => (
                    <button
                      key={key}
                      type="button"
                      role="tab"
                      onClick={() => setSidebarTab(key)}
                      aria-selected={sidebarTab === key}
                      className={cn(TRAY_CHIP, sidebarTab === key && TRAY_CHIP_OPEN)}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <div className={cn(COMPOSER_SHEET_STATIC, "flex min-h-0 flex-1 flex-col overflow-hidden")}>

                  {sidebarTab === "history" ? (
                    <HistoryPanel onSelect={(item) => void loadGeneration(item.id)} selectingId={selectingHistoryId} refreshSignal={historyRefreshSignal} />
                  ) : (
                    <div>
                    <div className="p-5">
                      <h2 className={SECTION_LABEL}>Voice</h2>
                    <div className="mt-2.5 flex items-center gap-3 rounded-xl border border-hairline py-2.5 pl-2.5 pr-1.5">
                      {selectedClone || !elevenLabsVoice.previewUrl ? (
                        <Avatar name={selectedClone ? selectedClone.name : elevenLabsVoice.name} size="lg" hideInitials />
                      ) : (
                        // The voice's own sample: the one place on the page
                        // you can hear the voice before spending credits.
                        <button
                          type="button"
                          onClick={toggleVoicePreview}
                          aria-label={isVoicePreviewPlaying ? "Stop sample" : `Play ${elevenLabsVoice.name}'s sample`}
                          title={isVoicePreviewPlaying ? "Stop sample" : "Play sample"}
                          className="group/preview relative shrink-0 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                        >
                          <Avatar name={elevenLabsVoice.name} size="lg" hideInitials />
                          <span
                            className={cn(
                              "absolute inset-0 flex items-center justify-center rounded-full bg-black/30 text-white transition-opacity duration-150",
                              isVoicePreviewPlaying ? "opacity-100" : "opacity-0 group-hover/preview:opacity-100 [@media(hover:none)]:opacity-100"
                            )}
                          >
                            {isVoicePreviewPlaying ? (
                              <Pause className="h-4 w-4" fill="currentColor" />
                            ) : (
                              <Play className="h-4 w-4 translate-x-px" fill="currentColor" />
                            )}
                          </span>
                          {isVoicePreviewPlaying && <span aria-hidden="true" className="absolute -inset-[3px] rounded-full ring-2 ring-[#335cff] dark:ring-[#5c7cff]" />}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setIsVoiceModalOpen(true)}
                        className="group/row flex min-w-0 flex-1 items-center gap-3 rounded-lg py-1 pl-0.5 pr-1.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-heading">{selectedClone ? selectedClone.name : elevenLabsVoice.name}</p>
                          <p className="mt-0.5 truncate text-xs text-subtle">
                            {selectedClone ? "Your cloned voice" : voiceMeta(elevenLabsVoice)}
                          </p>
                        </div>
                        <span className="shrink-0 rounded-lg px-2 py-1 text-xs font-medium text-body transition-colors group-hover/row:bg-(--app-fill) group-hover/row:text-heading">
                          Change
                        </span>
                      </button>
                    </div>
                  </div>

                  <div className={cn("border-t p-5", SHEET_RULE)}>
                    <h2 className={SECTION_LABEL}>Model</h2>
                    <button
                    type="button"
                    onClick={() => setIsModelListOpen((open) => !open)}
                    aria-expanded={isModelListOpen}
                    className={cn(FIELD, "mt-2.5 flex h-10 items-center justify-between gap-2 text-left font-medium")}
                    >
                    <span className="truncate">{currentModel.name}</span>
                    <ChevronDown className={cn("h-4 w-4 shrink-0 text-subtle transition-transform", isModelListOpen && "rotate-180")} />
                    </button>
                    {!isModelListOpen && <p className="mt-2 text-xs leading-relaxed text-subtle">{currentModel.description}</p>}
                    {isModelListOpen && (
                    <div className="mt-1.5 max-h-80 overflow-y-auto rounded-lg border border-hairline bg-surface p-1 shadow-[0_8px_24px_rgba(16,24,40,0.08)]">
                      {ELEVENLABS_MODELS.map((model) => {
                        const selected = model.id === currentModel.id;
                        const details = [
                          model.costMultiplier < 1 && `${model.costMultiplier}× cost`,
                          supportsAudioTags(model.id) && "audio tags",
                        ].filter(Boolean);
                        return (
                          <button
                            key={model.id}
                            type="button"
                            onClick={() => selectModel(model.id)}
                            title={model.description}
                            className={cn(
                              "flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-2 text-left transition-colors",
                              selected ? "bg-(--app-fill-strong)" : "hover:bg-(--app-fill)"
                            )}
                          >
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-medium text-heading">{model.name}</span>
                              {details.length > 0 && <span className="mt-0.5 block truncate text-xs text-subtle">{details.join(" · ")}</span>}
                            </span>
                            {selected && <Check className="h-4 w-4 shrink-0 text-[#335cff] dark:text-[#7d97ff]" />}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {showLanguage && (
                    <div className="relative mt-2">
                      <select
                        value={languageCode ?? ""}
                        onChange={(event) => setLanguageCode(event.target.value)}
                        aria-label="Language"
                        className={cn(FIELD, "h-10 cursor-pointer appearance-none pr-9 font-medium")}
                      >
                        {LANGUAGES.map((language) => (
                          <option key={language.code} value={language.code}>
                            {language.name}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
                    </div>
                  )}
                </div>

                <div className={cn("border-t p-5", SHEET_RULE)}>
                  <h2 className={SECTION_LABEL}>Generation mode</h2>

                  <div className="relative mt-2.5 flex shrink-0 rounded-lg bg-(--app-fill) p-0.5">
                    {(
                      [
                        { key: "line_by_line", label: "Line by line" },
                        { key: "all_at_once", label: "All at once" },
                      ] as const
                    ).map(({ key, label }) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setGenerationMode(key)}
                        className="relative flex-1 rounded-md px-3.5 py-1.5 text-xs font-medium"
                      >
                        {generationMode === key && (
                          <motion.span
                            layoutId={`${generationModePillId}-active`}
                            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                            className={SEGMENT_ACTIVE}
                          />
                        )}
                        <span
                          className={cn(
                            "relative z-10 transition-colors",
                            generationMode === key ? "text-heading" : "text-subtle hover:text-heading"
                          )}
                        >
                          {label}
                        </span>
                      </button>
                    ))}
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-subtle">
                    {generationMode === "line_by_line"
                      ? "Each sentence becomes its own clip you can edit and regenerate."
                      : "The whole script is generated as a single take."}
                  </p>
                </div>

                <div className={cn("border-t p-5", SHEET_RULE)}>
                  <div className="flex items-center justify-between">
                    <h2 className={SECTION_LABEL}>Voice settings</h2>
                    <button
                      type="button"
                      onClick={resetSettings}
                      className="-mr-1.5 flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium text-subtle outline-none transition-colors hover:bg-(--app-fill) hover:text-heading"
                    >
                      <RotateCcw className="h-3 w-3" />
                      Reset
                    </button>
                  </div>

                  {selectedClone ? (
                    <p className="mt-3 text-xs text-subtle">Cloned voices use their own engine, so these settings don&apos;t apply.</p>
                  ) : (
                    <div className="mt-4 space-y-5">
                      {discreteStability ? (
                        <div>
                          <SettingLabel
                            label="Stability"
                            hint="Creative is more expressive and emotional but can be less predictable. Robust is very consistent but less responsive to direction."
                          />
                          <div className="mt-2">
                            <SegmentedControl
                              options={DISCRETE_STABILITY_OPTIONS}
                              value={voiceSettings.stability}
                              onChange={(value) => updateVoiceSetting("stability", value)}
                            />
                          </div>
                        </div>
                      ) : (
                        <SettingSlider
                          label="Stability"
                          hint="Lower values make the delivery more expressive and varied; higher values make it more consistent but can sound monotone."
                          value={voiceSettings.stability}
                          min={0}
                          max={1}
                          step={0.01}
                          onChange={(value) => updateVoiceSetting("stability", value)}
                          format={percent}
                          leftLabel="More variable"
                          rightLabel="More stable"
                        />
                      )}

                      {currentModel.similarity && (
                      <SettingSlider
                        label="Similarity"
                        hint="How closely the output should match the original voice. High values can also reproduce artifacts from the source recording."
                        value={voiceSettings.similarityBoost}
                        min={0}
                        max={1}
                        step={0.01}
                        onChange={(value) => updateVoiceSetting("similarityBoost", value)}
                        format={percent}
                        leftLabel="Low"
                        rightLabel="High"
                      />
                      )}

                      {currentModel.style && (
                      <SettingSlider
                        label="Style exaggeration"
                        hint="Amplifies the speaking style of the original voice. Adds latency and can reduce stability -- usually best left at 0."
                        value={voiceSettings.style}
                        min={0}
                        max={1}
                        step={0.01}
                        onChange={(value) => updateVoiceSetting("style", value)}
                        format={percent}
                        leftLabel="None"
                        rightLabel="Exaggerated"
                      />
                      )}

                      {currentModel.speed && (
                      <SettingSlider
                        label="Speed"
                        hint="Speaking rate. 1.0 is the voice's natural pace; extreme values can affect quality."
                        value={voiceSettings.speed}
                        min={SPEED_MIN}
                        max={SPEED_MAX}
                        step={0.01}
                        onChange={(value) => updateVoiceSetting("speed", value)}
                        format={(value) => `${value.toFixed(2)}×`}
                        leftLabel="Slower"
                        rightLabel="Faster"
                      />
                      )}
                    </div>
                  )}
                </div>
                  </div>
                )}
                </div>
              </div>
          </div>
        </div>
      </div>
    </div>
  );
}
