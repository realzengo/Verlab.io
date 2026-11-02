"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Download,
  History,
  Info,
  List,
  ListChecks,
  Loader2,
  Mic2,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Settings2,
  SkipBack,
  SkipForward,
  SlidersHorizontal,
  Sparkles,
  X,
} from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { IconButton } from "@/components/ui/IconButton";
import { PlasticButton } from "@/components/ui/plastic-button";
import { ProgressiveFluxLoader } from "@/components/ui/ProgressiveFluxLoader";
import { HistoryPanel } from "@/components/features/voiceover-generator/HistoryPanel";
import { AddVoiceModal, type VoiceCloneSummary } from "@/components/features/voiceover-generator/AddVoiceModal";
import { VoiceLibraryModal, voiceMeta } from "@/components/features/voiceover-generator/VoiceLibraryModal";
import { ScriptTextarea } from "@/components/features/voiceover-generator/ScriptTextarea";
import { VOICE_CLONING_ENABLED } from "@/lib/config/voices";
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

// ── Small presentational pieces ─────────────────────────────────────────

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
    <div className="relative flex rounded-lg bg-app p-1 ring-1 ring-inset ring-black/[0.06] dark:bg-white/5 dark:ring-white/10">
      {options.map((option) => (
        <button
          key={String(option.value)}
          type="button"
          onClick={() => onChange(option.value)}
          className="relative flex-1 rounded-md px-3 py-1.5 text-xs font-semibold"
        >
          {value === option.value && (
            <motion.span
              layoutId={`${pillId}-active`}
              transition={{ type: "spring", stiffness: 500, damping: 34 }}
              className="absolute inset-0 rounded-md bg-surface shadow-card dark:bg-[#0D0D10]"
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

function SettingLabel({ label, hint, value }: { label: string; hint: string; value?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-1.5 text-xs font-semibold text-heading">
        {label}
        <span title={hint}>
          <Info className="h-3.5 w-3.5 text-subtle/60" />
        </span>
      </span>
      {value !== undefined && <span className="font-mono text-[11px] font-medium tabular-nums text-subtle">{value}</span>}
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
        className="mt-2 w-full cursor-pointer accent-primary"
      />
      <div className="flex justify-between text-[10px] font-medium text-subtle/70">
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
      // colors) so bars read correctly on both the light indigo-tint well
      // and the dark well without a separate light/dark color pair.
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
        "flex items-center gap-3 rounded-2xl border border-hairline bg-surface p-2 shadow-card transition-opacity",
        "dark:border-transparent dark:bg-gradient-to-b dark:from-[#181a24] dark:to-[#0a0a0f]",
        "dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.07),0_10px_28px_-12px_rgba(0,0,0,0.6)]",
        disabled && "opacity-50"
      )}
    >
      <button
        type="button"
        onClick={onTogglePlay}
        disabled={disabled}
        aria-label={isPlaying ? "Pause" : "Play"}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white transition-transform active:scale-95 disabled:cursor-not-allowed"
        style={{
          background: "linear-gradient(to bottom, rgb(84, 132, 255), rgb(51, 92, 255))",
          boxShadow: "0 1.5px 0 0 rgba(255,255,255,0.3) inset, 0 -2px 6px 0 rgba(37,63,199,0.6) inset",
        }}
      >
        {isPlaying ? (
          <Pause className="h-3.5 w-3.5" fill="currentColor" />
        ) : (
          <Play className="h-3.5 w-3.5 translate-x-[1px]" fill="currentColor" />
        )}
      </button>

      {/* Branded-tint well in light mode, recessed near-black well in dark --
          either way the bars/playhead below are colored to hold contrast
          against both. */}
      <div
        ref={trackRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className={cn(
          "relative h-9 flex-1 touch-none select-none overflow-hidden rounded-lg bg-accent ring-1 ring-inset ring-accent-line",
          "dark:bg-[#0c0d13] dark:ring-white/[0.05]",
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
            "pointer-events-none absolute top-1/2 h-4 w-[3px] -translate-x-1/2 -translate-y-1/2 rounded-sm bg-heading shadow-[0_0_6px_rgba(51,92,255,0.55)] transition-transform",
            isScrubbing && "scale-y-125"
          )}
          style={{ left: `${progress * 100}%` }}
        />
      </div>

      <span className="shrink-0 font-mono text-[11px] font-medium tabular-nums text-subtle dark:text-white/45">
        {formatTime(currentTime)} <span className="text-subtle/60 dark:text-white/25">/ {formatTime(total)}</span>
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
  const sidebarTabPillId = useId();
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

  const [view, setView] = useState<View>("input");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [generationId, setGenerationId] = useState<string | null>(null);
  const [segments, setSegments] = useState<SegmentState[]>([]);
  const [creditsQuoted, setCreditsQuoted] = useState<number | null>(null);
  const pollCancelRef = useRef<(() => void) | null>(null);
  const [loadingProgress, setLoadingProgress] = useState(0);

  const [editorTab, setEditorTab] = useState<EditorTab>("audio");
  const editorTabPillId = useId();
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

  // Cloned voices have no shared cached clip (see /api/voice-clones/[id]/preview's
  // own comment) -- the endpoint streams fresh audio bytes back directly
  // rather than a Storage URL, so this decodes a blob instead of setting
  // `.src` to a JSON-returned link like playVoicePreview does.
  async function playClonePreview(clone: VoiceCloneSummary) {
    if (playingCloneId === clone.id) {
      cloneAudioRef.current?.pause();
      setPlayingCloneId(null);
      return;
    }
    setPreviewingCloneId(clone.id);
    setPreviewError(null);
    try {
      const response = await fetch(`/api/voice-clones/${clone.id}/preview`, { signal: AbortSignal.timeout(60_000) });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error ?? `Could not load preview (${response.status})`);
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      if (cloneAudioRef.current) {
        cloneAudioRef.current.src = url;
        await cloneAudioRef.current.play();
        setPlayingCloneId(clone.id);
      }
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : "Could not load preview");
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

  function handleVoiceCloneCreated(clone: VoiceCloneSummary) {
    setVoiceClones((prev) => [clone, ...prev]);
    setVoiceId(`clone:${clone.id}`);
  }

  function pollGeneration(id: string) {
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
        if (!row) return;
        if (row.status === "completed") {
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
          const voice = getVoice(row.voice_id);
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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydration from the URL's ?id=, not a derived/external sync
    if (deepLinkId) void loadGeneration(deepLinkId);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once for the id present at mount; loadGeneration is stable enough for this one-shot deep link
  }, [deepLinkId]);

  const charCount = script.length;

  return (
    <div className="w-full px-0 pt-8 pb-16 sm:px-6 sm:pt-10">
      <audio ref={cloneAudioRef} className="hidden" onEnded={() => setPlayingCloneId(null)} />
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
      <AddVoiceModal isOpen={isAddVoiceModalOpen} onClose={() => setIsAddVoiceModalOpen(false)} onCreated={handleVoiceCloneCreated} />
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
        <div className="mb-6">
          <h1 className="bg-gradient-to-br from-slate-900 via-slate-900 to-blue-600 bg-clip-text text-3xl font-extrabold tracking-tight text-transparent dark:from-white dark:via-white dark:to-blue-400 sm:text-4xl">
            {view === "editor" ? "Generate Voiceover" : "Create Voiceover"}
          </h1>
          <p className="mt-2 text-xs font-medium tracking-wide text-subtle sm:text-sm">
            Turn a script into natural-sounding narration.
          </p>
        </div>

        {generationError && (
          <p className="mb-4 rounded-xl bg-danger-tint px-4 py-2.5 text-sm font-medium text-danger" role="alert">
            {generationError}
          </p>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          {/* ── Left column: main workspace ───────────────────────────── */}
          <div className="relative flex min-h-[600px] flex-col rounded-2xl border border-hairline bg-app p-3 shadow-card dark:bg-surface">
            {view !== "editor" && (
              <>
                <div className="flex flex-1 flex-col overflow-hidden rounded-xl border border-hairline bg-surface dark:bg-[#0D0D10]">
                  <input
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="Untitled Script"
                    disabled={view === "loading"}
                    maxLength={NAME_MAX}
                    className="w-full bg-transparent px-4 pt-4 text-lg font-semibold text-heading outline-none placeholder:text-subtle disabled:opacity-60"
                  />

                  {view === "loading" ? (
                    <div className="relative m-3 mt-2 flex flex-1 flex-col items-center justify-center gap-3 rounded-lg bg-surface px-6">
                      <span className="absolute right-4 top-4 rounded-full bg-surface px-3 py-1 text-xs font-medium text-subtle shadow-card">
                        Wait 1-3 minutes...
                      </span>
                      <ProgressiveFluxLoader
                        phases={VOICEOVER_LOADING_PHASES}
                        value={loadingProgress}
                      />
                    </div>
                  ) : (
                    <>
                      <ScriptTextarea
                        value={script}
                        onChange={(value) => setScript(value.slice(0, MAX_SCRIPT_CHARS))}
                        highlightTags
                        placeholder="Type your script here..."
                        maxLength={MAX_SCRIPT_CHARS}
                        className="mt-2 min-h-[300px] flex-1"
                        paddingClassName="px-4 pb-3"
                      />
                      <div className="flex items-center justify-between gap-3 border-t border-hairline px-4 py-3">
                        <span className="min-w-0 text-xs font-medium text-subtle">
                          {charCount.toLocaleString()}/{MAX_SCRIPT_CHARS.toLocaleString()}
                          {supportsAudioTags(currentModel.id) && (
                            <span className="ml-2 hidden text-subtle/70 sm:inline">
                              Tip: add audio tags like [excited], [whispers] or [laughs]
                            </span>
                          )}
                        </span>
                        <Badge>
                          {estimatedCredits} credit{estimatedCredits === 1 ? "" : "s"}
                        </Badge>
                      </div>
                    </>
                  )}
                </div>

                <PlasticButton
                  text="Generate"
                  loading={view === "loading"}
                  loadingText="Generating…"
                  disabled={!script.trim()}
                  onClick={handleGenerate}
                  className="mt-3 w-full py-3"
                  trailing={<Sparkles className="h-4 w-4" />}
                />
              </>
            )}

            {view === "editor" && generationId && (
              <>
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <h2 className="truncate text-base font-semibold text-heading">{title || "Untitled Script"}</h2>
                    {creditsQuoted !== null && (
                      <Badge>
                        {creditsQuoted} credit{creditsQuoted === 1 ? "" : "s"}
                      </Badge>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={handleGenerateAgain}
                      className="flex items-center gap-1.5 rounded-full border border-hairline bg-surface px-3 py-1.5 text-xs font-semibold text-subtle shadow-card transition-colors hover:border-primary/40 hover:text-primary"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Generate again
                    </button>
                    <div className="flex shrink-0 rounded-full bg-app p-1 dark:bg-white/5">
                      {(["editor", "audio"] as const).map((tab) => (
                        <button
                          key={tab}
                          type="button"
                          onClick={() => setEditorTab(tab)}
                          className="relative flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold"
                        >
                          {editorTab === tab && (
                            <motion.span
                              layoutId={`${editorTabPillId}-active`}
                              transition={{ type: "spring", stiffness: 500, damping: 34 }}
                              className="absolute inset-0 rounded-full bg-surface shadow-card"
                            />
                          )}
                          <span
                            className={cn(
                              "relative z-10 flex items-center gap-1.5 transition-colors",
                              editorTab === tab ? "text-heading" : "text-subtle hover:text-heading"
                            )}
                          >
                            {tab === "editor" ? <List className="h-3.5 w-3.5" /> : <ListChecks className="h-3.5 w-3.5" />}
                            {tab === "editor" ? "Voiceover editor" : "Generated audio"}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {editorTab === "editor" ? (
                  <>
                    <div className="flex flex-1 flex-col overflow-hidden rounded-xl border border-hairline bg-surface dark:bg-[#0D0D10]">
                      <ScriptTextarea
                        value={script}
                        onChange={(value) => setScript(value.slice(0, MAX_SCRIPT_CHARS))}
                        highlightTags
                        placeholder="Type your script here..."
                        maxLength={MAX_SCRIPT_CHARS}
                        className="min-h-[300px] flex-1"
                        paddingClassName="p-4"
                      />
                      <div className="flex items-center justify-between border-t border-hairline px-4 py-3">
                        <span className="text-xs font-medium text-subtle">
                          {charCount.toLocaleString()}/{MAX_SCRIPT_CHARS.toLocaleString()}
                        </span>
                        <Badge>
                          {estimatedCredits} credit{estimatedCredits === 1 ? "" : "s"}
                        </Badge>
                      </div>
                    </div>
                    <PlasticButton
                      text="Regenerate"
                      loading={isGenerating}
                      loadingText="Regenerating…"
                      disabled={!script.trim()}
                      onClick={handleGenerate}
                      className="mt-3 w-full py-3"
                      trailing={<Sparkles className="h-4 w-4" />}
                    />
                  </>
                ) : (
                  <div className="mt-4 flex flex-1 flex-col border-t border-hairline pt-4">
                    <div className="mb-4 flex-1 space-y-2 overflow-y-auto pr-1">
                      {segments.map((segment, index) => (
                        <div key={index} className="flex items-center gap-2.5">
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
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
                            className={cn(
                              "min-w-0 flex-1 rounded-xl border px-4 py-2.5 text-sm text-body shadow-card outline-none transition-colors disabled:opacity-60",
                              playingIndex === index ? "border-primary/40 bg-accent/60" : "border-hairline bg-surface",
                              "focus:border-primary/50 focus:ring-2 focus:ring-primary/15"
                            )}
                          />
                          <div className="flex shrink-0 items-center gap-1">
                            <IconButton title="Play segment" onClick={() => playSegment(index)} active={playingIndex === index && !isSequenceMode}>
                              {playingIndex === index && !isSequenceMode && isPlaying ? (
                                <Pause className="h-3.5 w-3.5" />
                              ) : (
                                <Play className="h-3.5 w-3.5" />
                              )}
                            </IconButton>
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
                        </div>
                      ))}

                      {isAddingSegment ? (
                        <div className="rounded-xl border border-hairline p-3">
                          <textarea
                            value={newSegmentText}
                            onChange={(event) => setNewSegmentText(event.target.value.slice(0, 1000))}
                            placeholder="Type the new segment's text..."
                            autoFocus
                            className="min-h-[70px] w-full resize-none bg-transparent text-sm text-body outline-none placeholder:text-subtle"
                          />
                          <div className="mt-2 flex items-center justify-between gap-2">
                            {newSegmentText.trim() ? (
                              <Badge>
                                {newSegmentCredits} credit{newSegmentCredits === 1 ? "" : "s"}
                              </Badge>
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
                                className="rounded-lg px-3 py-1.5 text-xs font-medium text-subtle hover:bg-accent hover:text-heading"
                              >
                                Cancel
                              </button>
                              <PlasticButton
                                text="Add"
                                loading={isSubmittingSegment}
                                disabled={!newSegmentText.trim()}
                                onClick={handleAddSegment}
                                className="!px-4 !py-1.5 text-xs"
                              />
                            </div>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setIsAddingSegment(true)}
                          className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-hairline bg-surface py-3 text-sm font-medium text-subtle shadow-card transition-colors hover:border-primary/40 hover:text-primary"
                        >
                          <Plus className="h-4 w-4" /> Add Segment
                        </button>
                      )}
                    </div>

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
                    <div className="mt-3 flex items-center justify-between">
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
                        text="Export"
                        loading={isExporting}
                        loadingText="Exporting…"
                        disabled={segments.length === 0}
                        onClick={handleExport}
                        trailing={<Download className="h-3.5 w-3.5" />}
                      />
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* ── Right column: settings / history sidebar ──────────────── */}
          <div className="relative">
              <div
                className={cn(
                  "flex flex-col gap-3 rounded-3xl bg-app p-3 ring-1 ring-inset ring-black/[0.06] dark:bg-white/5 dark:ring-white/10",
                  // History needs the full column height to size its own scroll
                  // area (see HistoryPanel's h-full max-h-[720px]); Settings has
                  // no such need and should just hug its content instead of
                  // stretching to match the (usually taller) left column.
                  sidebarTab === "history" && "h-full"
                )}
              >
                <div className="flex shrink-0 rounded-xl bg-app p-1 ring-1 ring-inset ring-black/[0.06] dark:bg-white/5 dark:ring-white/10">
                  {(
                    [
                      { key: "settings", label: "Settings", icon: Settings2 },
                      { key: "history", label: "History", icon: History },
                    ] as const
                  ).map(({ key, label, icon: TabIcon }) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setSidebarTab(key)}
                      className="relative flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold"
                    >
                      {sidebarTab === key && (
                        <motion.span
                          layoutId={`${sidebarTabPillId}-active`}
                          transition={{ type: "spring", stiffness: 500, damping: 34 }}
                          className="absolute inset-0 rounded-lg bg-surface shadow-card dark:bg-[#0D0D10]"
                        />
                      )}
                      <span
                        className={cn(
                          "relative z-10 flex items-center gap-1.5 transition-colors",
                          sidebarTab === key ? "text-heading" : "text-subtle hover:text-heading"
                        )}
                      >
                        <TabIcon className="h-3.5 w-3.5" />
                        {label}
                      </span>
                    </button>
                  ))}
                </div>

                  {sidebarTab === "history" ? (
                    <HistoryPanel onSelect={(item) => void loadGeneration(item.id)} selectingId={selectingHistoryId} refreshSignal={historyRefreshSignal} />
                  ) : (
                    <div className="rounded-2xl border border-hairline bg-surface shadow-card dark:bg-[#0D0D10]">
                    <div className="group p-5">
                      <div className="flex items-center gap-2">
                        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-accent to-primary/15 text-primary">
                          <Mic2 className="h-3.5 w-3.5" />
                        </span>
                        <h2 className="text-xs font-semibold uppercase tracking-wide text-subtle">Voice Style</h2>
                      </div>
                    <button
                    type="button"
                    onClick={() => setIsVoiceModalOpen(true)}
                    className="group/row mt-3 flex w-full items-center gap-3 rounded-xl border border-hairline bg-app/60 p-3 text-left transition-all duration-200 hover:border-primary/40 hover:bg-accent/50 dark:bg-white/[0.02]"
                    >
                    <Avatar name={selectedClone ? selectedClone.name : elevenLabsVoice.name} size="md" hideInitials className="ring-2 ring-surface shadow-sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-heading">{selectedClone ? selectedClone.name : elevenLabsVoice.name}</p>
                      {!selectedClone && voiceMeta(elevenLabsVoice) && (
                        <p className="truncate text-xs font-medium text-primary">{voiceMeta(elevenLabsVoice)}</p>
                      )}
                      <p className="truncate text-xs text-subtle">
                        {selectedClone ? "Your cloned voice" : elevenLabsVoice.description}
                      </p>
                    </div>
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-primary transition-transform duration-200 group-hover/row:translate-x-0.5">
                      <ChevronRight className="h-3.5 w-3.5" />
                    </span>
                    </button>
                  </div>

                  <div className="border-t border-hairline p-5">
                    <h2 className="text-xs font-semibold uppercase tracking-wide text-subtle">Model</h2>
                    <button
                    type="button"
                    onClick={() => setIsModelListOpen((open) => !open)}
                    aria-expanded={isModelListOpen}
                    title={currentModel.description}
                    className="mt-3 flex w-full items-center justify-between gap-2 rounded-lg border border-hairline bg-app/60 px-3 py-2.5 text-left text-sm font-semibold text-heading transition-colors hover:border-primary/40 dark:bg-white/[0.02]"
                    >
                    <span className="truncate">{currentModel.name}</span>
                    <ChevronDown className={cn("h-4 w-4 shrink-0 text-subtle transition-transform", isModelListOpen && "rotate-180")} />
                    </button>
                    {isModelListOpen && (
                    <div className="mt-1.5 max-h-72 overflow-y-auto rounded-lg border border-hairline bg-surface p-1 shadow-card">
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
                              selected ? "bg-primary/10" : "hover:bg-accent/60 dark:hover:bg-white/[0.05]"
                            )}
                          >
                            <span className="min-w-0">
                              <span className={cn("block truncate text-sm font-medium", selected ? "text-primary" : "text-heading")}>{model.name}</span>
                              {details.length > 0 && <span className="block truncate text-[11px] text-subtle">{details.join(" · ")}</span>}
                            </span>
                            {selected && <Check className="h-3.5 w-3.5 shrink-0 text-primary" strokeWidth={3} />}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {showLanguage && (
                    <select
                      value={languageCode ?? ""}
                      onChange={(event) => setLanguageCode(event.target.value)}
                      aria-label="Language"
                      className="mt-2 w-full cursor-pointer rounded-lg border border-hairline bg-app/60 px-3 py-2.5 text-sm text-heading outline-none transition-colors focus:border-primary/50 focus:ring-2 focus:ring-primary/15 dark:bg-white/[0.02]"
                    >
                      {LANGUAGES.map((language) => (
                        <option key={language.code} value={language.code}>
                          {language.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="border-t border-hairline p-5">
                  <div className="flex items-center gap-1.5">
                    <h2 className="text-xs font-semibold uppercase tracking-wide text-subtle">Generation Mode</h2>
                    <span title="Line by line generates each sentence as its own clip you can edit and regenerate individually. All at once sends the full script as a single take.">
                      <Info className="h-3.5 w-3.5 text-subtle/60" />
                    </span>
                  </div>

                  <div className="relative mt-3 flex shrink-0 rounded-lg bg-app p-1 ring-1 ring-inset ring-black/[0.06] dark:bg-white/5 dark:ring-white/10">
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
                        className="relative flex-1 rounded-md px-3.5 py-2 text-xs font-semibold"
                      >
                        {generationMode === key && (
                          <motion.span
                            layoutId={`${generationModePillId}-active`}
                            transition={{ type: "spring", stiffness: 500, damping: 34 }}
                            className="absolute inset-0 rounded-md bg-surface shadow-card dark:bg-[#0D0D10]"
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
                </div>

                <div className="border-t border-hairline p-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-primary/15 to-primary/5 text-primary ring-1 ring-primary/10">
                        <SlidersHorizontal className="h-3.5 w-3.5" />
                      </span>
                      <h2 className="text-xs font-semibold uppercase tracking-wide text-subtle">Voice Settings</h2>
                    </div>
                    <button
                      type="button"
                      onClick={resetSettings}
                      className="flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold text-primary outline-none transition-colors hover:bg-primary/10"
                    >
                      <RotateCcw className="h-3 w-3" />
                      Reset
                    </button>
                  </div>

                  {selectedClone ? (
                    <p className="mt-4 text-xs text-subtle">Cloned voices use their own engine, so these settings don&apos;t apply.</p>
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

                      <SettingSlider
                        label="Style Exaggeration"
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
  );
}
