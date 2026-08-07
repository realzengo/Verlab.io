"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  History,
  Languages,
  List,
  ListChecks,
  Loader2,
  Mic2,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Search,
  Settings2,
  SkipBack,
  SkipForward,
  Sparkles,
  Wand2,
  X,
} from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { IconButton } from "@/components/ui/IconButton";
import { PlasticButton } from "@/components/ui/plastic-button";
import { ProgressiveFluxLoader } from "@/components/ui/ProgressiveFluxLoader";
import { HistoryPanel, type VoiceoverHistoryItem } from "@/components/features/voiceover-generator/HistoryPanel";
import { DEFAULT_VOICE_ID, getVoiceOption, VOICE_OPTIONS, type VoiceOption } from "@/lib/config/voices";
import { DEFAULT_LANGUAGE_CODE, LANGUAGE_OPTIONS } from "@/lib/config/languages";
import { getVoiceoverSegmentCost } from "@/lib/config/pricing";
import { exportSegmentsAsWav } from "@/lib/client/audio-export";
import { consumeVoiceoverHandoff } from "@/lib/client/voiceover-handoff";
import { pollUntilSettled } from "@/lib/polling";
import { cn, downloadBlob } from "@/lib/utils";

type GenerationMode = "line_by_line" | "all_at_once";
type View = "input" | "loading" | "editor";
type EditorTab = "editor" | "audio";
type VoiceGenderFilter = "All" | "Male" | "Female";

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
// Matches the Gemini TTS model's own default `prompt` value, and the server
// route's 500-char cap on stylePrompt (see generate-voiceover/route.ts).
const DEFAULT_STYLE_PROMPT = "Say the following.";
const MAX_STYLE_PROMPT_CHARS = 500;

function segmentUrl(generationId: string, index: number): string {
  return `/api/generate-voiceover/${generationId}/segments/${index}`;
}

function formatTime(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// ── Small presentational pieces ─────────────────────────────────────────

// Quick-tap presets for the free-text `prompt` style instruction Gemini TTS
// actually accepts (see src/lib/server/replicate-tts.ts) -- there's no
// numeric speed/stability knob on this model, so these fill the box with a
// ready-made instruction that the user can still edit directly afterward.
const STYLE_PRESETS: { label: string; prompt: string }[] = [
  { label: "Natural", prompt: "Say the following." },
  { label: "Calm & Professional", prompt: "Say this in a calm, professional tone." },
  { label: "Energetic", prompt: "Speak with excitement and energy." },
  { label: "Warm & Friendly", prompt: "Say this in a warm, friendly tone." },
  { label: "Fast-Paced", prompt: "Say the following quickly and energetically." },
  { label: "Slow & Deliberate", prompt: "Say the following slowly and deliberately." },
  { label: "Whispered", prompt: "Say the following in a hushed whisper." },
  { label: "Dramatic", prompt: "Say the following dramatically, like narrating a movie trailer." },
];

function VoiceCard({
  voice,
  selected,
  onSelect,
  onPlay,
  isPreviewLoading,
  isPreviewPlaying,
}: {
  voice: VoiceOption;
  selected: boolean;
  onSelect: () => void;
  onPlay: () => void;
  isPreviewLoading: boolean;
  isPreviewPlaying: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "group relative flex w-full items-center gap-3 rounded-2xl border p-3.5 text-left transition-all duration-200",
        selected
          ? "border-primary/60 bg-gradient-to-b from-accent to-accent/40 shadow-[0_0_0_1px_var(--color-primary),0_10px_28px_-8px_rgba(51,92,255,0.4)] dark:from-primary/[0.12] dark:to-primary/[0.03]"
          : "border-hairline bg-surface shadow-card hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-card-hover"
      )}
    >
      <Avatar
        name={voice.id}
        size="md"
        hideInitials
        className={cn("shadow-sm ring-2", selected ? "ring-primary/25" : "ring-surface dark:ring-white/5")}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-1">
          <p className="truncate text-sm font-semibold text-heading">{voice.id}</p>
          <span className="text-subtle">·</span>
          <span className="truncate text-sm font-medium text-primary">{voice.gender}</span>
        </div>
        <p className="truncate text-xs text-subtle">{voice.description}</p>
      </div>
      {selected && (
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-white shadow-[0_2px_6px_rgba(51,92,255,0.5)]">
          <Check className="h-3 w-3" strokeWidth={3} />
        </span>
      )}
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onPlay();
        }}
        aria-label={isPreviewPlaying ? `Stop ${voice.id} preview` : `Preview ${voice.id}`}
        className={cn(
          "relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full transition-all duration-200 hover:scale-105 active:scale-[0.94]",
          selected || isPreviewPlaying
            ? "text-white"
            : "bg-app text-subtle ring-1 ring-inset ring-black/[0.06] hover:text-primary hover:ring-primary/30 dark:bg-white/5 dark:ring-white/10"
        )}
        style={
          selected || isPreviewPlaying
            ? {
                background: "linear-gradient(to bottom, rgb(59, 130, 246), rgb(37, 99, 235))",
                boxShadow:
                  "0 2px 8px 0 rgba(37, 99, 235, 0.4), 0 1.5px 0 0 rgba(255,255,255,0.25) inset, 0 -2px 6px 0 rgba(37, 99, 235, 0.5) inset",
              }
            : undefined
        }
      >
        {(selected || isPreviewPlaying) && (
          <span
            className="pointer-events-none absolute left-1/2 top-0 h-2/5 w-[70%] -translate-x-1/2 rounded-t-full"
            style={{
              background: "linear-gradient(180deg, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0) 80%)",
              filter: "blur(1px)",
            }}
          />
        )}
        <span className="relative z-10 flex items-center justify-center">
          {isPreviewLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : isPreviewPlaying ? (
            <Pause className="h-3.5 w-3.5" fill="currentColor" />
          ) : (
            <Play className="h-3.5 w-3.5" fill="currentColor" />
          )}
        </span>
      </button>
    </button>
  );
}

// Decoded per-segment amplitude peaks, keyed by audio URL so switching tabs
// or re-rendering the timeline doesn't re-fetch/re-decode audio already seen.
const waveformPeakCache = new Map<string, number[]>();
const WAVEFORM_SAMPLE_COUNT = 300;

function useWaveformPeaks(url: string | null): number[] | null {
  // Cache hits resolve synchronously during render; the effect below only
  // ever fires for genuine cache misses, and only calls setState from inside
  // the async fetch/decode callback (an external-system response), never
  // directly in the effect body.
  const cached = url ? (waveformPeakCache.get(url) ?? null) : null;
  const [fetched, setFetched] = useState<{ url: string; peaks: number[] } | null>(null);

  useEffect(() => {
    if (!url || waveformPeakCache.has(url)) return;
    let cancelled = false;
    (async () => {
      try {
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
        if (!cancelled) setFetched({ url, peaks: normalized });
      } catch {
        // Leave peaks empty on failure; the bar simply renders without a waveform.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [url]);

  return cached ?? (fetched && fetched.url === url ? fetched.peaks : null);
}

// Renders decoded peaks as a bar waveform on a canvas sized to its container,
// so bars stay crisp at any segment width instead of stretching a fixed set.
function Waveform({ url, color }: { url: string | null; color: string }) {
  const peaks = useWaveformPeaks(url);
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
      if (!ctx || !peaks || peaks.length === 0) return;
      ctx.scale(dpr, dpr);

      const barWidth = 2;
      const gap = 2;
      const barCount = Math.max(1, Math.floor(width / (barWidth + gap)));
      const mid = height / 2;
      ctx.fillStyle = color;
      for (let i = 0; i < barCount; i++) {
        const peak = peaks[Math.min(peaks.length - 1, Math.floor((i / barCount) * peaks.length))];
        const barHeight = Math.max(2, peak * height * 0.82);
        const x = i * (barWidth + gap);
        const y = mid - barHeight / 2;
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barHeight, barWidth / 2);
        ctx.fill();
      }
    }

    draw();
    const resizeObserver = new ResizeObserver(draw);
    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, [peaks, color]);

  return (
    <div ref={containerRef} className="pointer-events-none absolute inset-0">
      <canvas ref={canvasRef} className="block h-full w-full" />
    </div>
  );
}

function Timeline({
  durations,
  currentTime,
  activeIndex,
  generationId,
}: {
  durations: number[];
  currentTime: number;
  activeIndex: number | null;
  generationId: string | null;
}) {
  const total = Math.max(0.5, durations.reduce((sum, d) => sum + d, 0));
  const step = total <= 10 ? 0.5 : total <= 30 ? 1 : total <= 120 ? 5 : 10;
  const ticks: number[] = [];
  for (let t = 0; t <= total; t += step) ticks.push(t);
  const playheadPct = Math.min(100, (currentTime / total) * 100);

  return (
    <div className="relative">
      <div className="relative h-4 text-[10px] font-medium text-subtle">
        {ticks.map((t, i) => (
          <span key={t} className="absolute -translate-x-1/2" style={{ left: `${(t / total) * 100}%` }}>
            {i % 2 === 0 ? `${t % 1 === 0 ? t : t.toFixed(1)}s` : "•"}
          </span>
        ))}
      </div>
      <div className="mt-1 flex h-9 w-full items-stretch gap-1">
        {durations.map((duration, index) => (
          <div
            key={index}
            className={cn(
              "relative flex items-center justify-center overflow-hidden rounded-full border text-[11px] font-bold transition-colors",
              index === activeIndex ? "border-primary bg-primary text-white" : "border-primary/30 bg-accent text-primary"
            )}
            style={{ width: `${(duration / total) * 100}%`, minWidth: 26 }}
          >
            <Waveform
              url={generationId ? segmentUrl(generationId, index) : null}
              color={index === activeIndex ? "rgba(255,255,255,0.55)" : "rgba(51,92,255,0.35)"}
            />
            <span className="relative z-10 drop-shadow-sm">{index + 1}</span>
          </div>
        ))}
      </div>
      <div className="pointer-events-none absolute inset-y-0 w-px bg-primary" style={{ left: `${playheadPct}%` }}>
        <span className="absolute -left-[5px] -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-primary bg-surface" />
      </div>
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────────

export function VoiceoverGenerator() {
  const [title, setTitle] = useState("");
  const [script, setScript] = useState("");
  const [voiceId, setVoiceId] = useState(DEFAULT_VOICE_ID);
  const generationMode: GenerationMode = "all_at_once";
  const [stylePrompt, setStylePrompt] = useState(DEFAULT_STYLE_PROMPT);
  const [languageCode, setLanguageCode] = useState(DEFAULT_LANGUAGE_CODE);

  const [sidebarTab, setSidebarTab] = useState<"settings" | "history">("settings");
  const [historyRefreshSignal, setHistoryRefreshSignal] = useState(0);
  const [selectingHistoryId, setSelectingHistoryId] = useState<string | null>(null);

  const [isVoiceDrawerOpen, setIsVoiceDrawerOpen] = useState(false);
  const [voiceSearch, setVoiceSearch] = useState("");
  const [voiceGenderFilter, setVoiceGenderFilter] = useState<VoiceGenderFilter>("All");
  const [previewingVoiceId, setPreviewingVoiceId] = useState<string | null>(null);
  const [playingPreviewId, setPlayingPreviewId] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  const [view, setView] = useState<View>("input");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [generationId, setGenerationId] = useState<string | null>(null);
  const [segments, setSegments] = useState<SegmentState[]>([]);
  const pollCancelRef = useRef<(() => void) | null>(null);
  const [loadingProgress, setLoadingProgress] = useState(0);

  const [editorTab, setEditorTab] = useState<EditorTab>("editor");
  const [isAddingSegment, setIsAddingSegment] = useState(false);
  const [newSegmentText, setNewSegmentText] = useState("");
  const [isSubmittingSegment, setIsSubmittingSegment] = useState(false);
  const [deletingIndex, setDeletingIndex] = useState<number | null>(null);

  const [playingIndex, setPlayingIndex] = useState<number | null>(null);
  const [loopIndex, setLoopIndex] = useState<number | null>(null);
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

  const selectedVoice = getVoiceOption(voiceId) ?? VOICE_OPTIONS[0];

  const filteredVoices = useMemo(() => {
    return VOICE_OPTIONS.filter((voice) => {
      if (voiceGenderFilter !== "All" && voice.gender !== voiceGenderFilter) return false;
      if (!voiceSearch.trim()) return true;
      const query = voiceSearch.trim().toLowerCase();
      return (
        voice.id.toLowerCase().includes(query) ||
        voice.style.toLowerCase().includes(query) ||
        voice.gender.toLowerCase().includes(query) ||
        voice.description.toLowerCase().includes(query)
      );
    });
  }, [voiceSearch, voiceGenderFilter]);

  const estimatedSegments = useMemo(() => estimateSegmentTexts(script, generationMode), [script, generationMode]);
  const estimatedCredits = useMemo(
    () => estimatedSegments.reduce((sum, text) => sum + getVoiceoverSegmentCost(text.length), 0),
    [estimatedSegments]
  );

  const durations = segments.map((s) => s.durationSeconds);

  useEffect(() => {
    return () => pollCancelRef.current?.();
  }, []);

  function resetStyle() {
    setStylePrompt(DEFAULT_STYLE_PROMPT);
    setLanguageCode(DEFAULT_LANGUAGE_CODE);
  }

  async function playVoicePreview(voice: VoiceOption) {
    if (playingPreviewId === voice.id) {
      previewAudioRef.current?.pause();
      setPlayingPreviewId(null);
      return;
    }
    setPreviewingVoiceId(voice.id);
    setPreviewError(null);
    try {
      const response = await fetch(`/api/voices/preview?voiceId=${encodeURIComponent(voice.id)}`, {
        signal: AbortSignal.timeout(130_000),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error ?? `Could not load preview (${response.status})`);
      if (previewAudioRef.current) {
        previewAudioRef.current.src = data.url;
        await previewAudioRef.current.play();
        setPlayingPreviewId(voice.id);
      }
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : "Could not load preview");
    } finally {
      setPreviewingVoiceId(null);
    }
  }

  function pollGeneration(id: string) {
    pollCancelRef.current?.();
    pollCancelRef.current = pollUntilSettled<{
      status: string;
      error_message: string | null;
      segments: { text: string; durationSeconds: number }[];
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
          setView("editor");
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
    setIsGenerating(true);
    setGenerationError(null);
    setView("loading");

    try {
      const response = await fetch("/api/generate-voiceover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, script, voiceId, stylePrompt, languageCode, generationMode }),
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
    audioRef.current.src = segmentUrl(generationId, index);
    audioRef.current.loop = loopIndex === index;
    setPlayingIndex(index);
    void audioRef.current.play();
  }

  function toggleLoopForSegment(index: number) {
    setLoopIndex((prev) => {
      const next = prev === index ? null : index;
      if (audioRef.current && playingIndex === index) audioRef.current.loop = next === index;
      return next;
    });
  }

  function playSequenceFrom(index: number) {
    if (!generationId || !audioRef.current || segments.length === 0) return;
    setIsSequenceMode(true);
    audioRef.current.loop = false;
    audioRef.current.src = segmentUrl(generationId, index);
    setPlayingIndex(index);
    void audioRef.current.play();
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

  async function handleSelectHistoryItem(item: VoiceoverHistoryItem) {
    if (selectingHistoryId) return;
    setSelectingHistoryId(item.id);
    setGenerationError(null);
    try {
      const response = await fetch(`/api/generate-voiceover?id=${item.id}`);
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
      setVoiceId(row.voice_id);
      setStylePrompt(row.style_prompt);
      setLanguageCode(row.language_code);
      setGenerationId(row.id);
      setSegments((row.segments ?? []).map((s: { text: string; durationSeconds: number }) => ({ text: s.text, durationSeconds: s.durationSeconds })));
      setEditorTab("editor");
      setView("editor");
      setSidebarTab("settings");
    } catch (err) {
      setGenerationError(err instanceof Error ? err.message : "Could not load that generation");
    } finally {
      setSelectingHistoryId(null);
    }
  }

  const charCount = script.length;

  return (
    <div className="w-full px-0 pt-8 pb-16 sm:px-6 sm:pt-10">
      <audio ref={previewAudioRef} className="hidden" onEnded={() => setPlayingPreviewId(null)} />
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
                      <textarea
                        value={script}
                        onChange={(event) => setScript(event.target.value.slice(0, MAX_SCRIPT_CHARS))}
                        placeholder="Type your script here..."
                        maxLength={MAX_SCRIPT_CHARS}
                        className="mt-2 min-h-[300px] flex-1 resize-none bg-transparent px-4 pb-3 text-sm leading-relaxed text-body outline-none placeholder:text-subtle"
                      />
                      <div className="flex items-center justify-between border-t border-hairline px-4 py-3">
                        <span className="text-xs font-medium text-subtle">
                          {charCount.toLocaleString()}/{MAX_SCRIPT_CHARS.toLocaleString()}
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
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="truncate text-base font-semibold text-heading">{title || "Untitled Script"}</h2>
                  <div className="flex shrink-0 rounded-full bg-app p-1 dark:bg-white/5">
                    {(["editor", "audio"] as const).map((tab) => (
                      <button
                        key={tab}
                        type="button"
                        onClick={() => setEditorTab(tab)}
                        className={cn(
                          "flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors",
                          editorTab === tab ? "bg-surface text-heading shadow-card" : "text-subtle hover:text-heading"
                        )}
                      >
                        {tab === "editor" ? <List className="h-3.5 w-3.5" /> : <ListChecks className="h-3.5 w-3.5" />}
                        {tab === "editor" ? "Voiceover editor" : "Generated audio"}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex-1 space-y-2 overflow-y-auto pr-1">
                  {editorTab === "editor" ? (
                    <>
                      {segments.map((segment, index) => (
                        <div key={index} className="flex items-center gap-2.5">
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
                            {index + 1}
                          </span>
                          <div
                            className={cn(
                              "min-w-0 flex-1 rounded-xl border px-4 py-2.5 shadow-card transition-colors",
                              playingIndex === index ? "border-primary/40 bg-accent/60" : "border-hairline bg-surface"
                            )}
                          >
                            <p className="truncate text-sm text-body">{segment.text}</p>
                          </div>
                          <div className="flex shrink-0 items-center gap-1">
                            <IconButton title="Play segment" onClick={() => playSegment(index)} active={playingIndex === index && !isSequenceMode}>
                              {playingIndex === index && !isSequenceMode && isPlaying ? (
                                <Pause className="h-3.5 w-3.5" />
                              ) : (
                                <Play className="h-3.5 w-3.5" />
                              )}
                            </IconButton>
                            <IconButton title="Loop segment" onClick={() => toggleLoopForSegment(index)} active={loopIndex === index}>
                              <RotateCcw className="h-3.5 w-3.5" />
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
                          <div className="mt-2 flex items-center justify-end gap-2">
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
                      ) : (
                        <button
                          type="button"
                          onClick={() => setIsAddingSegment(true)}
                          className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-hairline bg-surface py-3 text-sm font-medium text-subtle shadow-card transition-colors hover:border-primary/40 hover:text-primary"
                        >
                          <Plus className="h-4 w-4" /> Add Segment
                        </button>
                      )}
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-2 rounded-xl bg-app/60 py-16 text-center">
                      <Sparkles className="h-6 w-6 text-primary" />
                      <p className="text-sm font-semibold text-heading">{segments.length} segments generated</p>
                      <p className="text-xs text-subtle">Use the player below to listen to the full voiceover.</p>
                    </div>
                  )}
                </div>

                {exportError && <p className="mt-2 text-xs font-medium text-danger">{exportError}</p>}

                {/* ── Bottom audio player ─────────────────────────────── */}
                <div className="mt-4 border-t border-hairline pt-4">
                  <Timeline
                    durations={durations.length > 0 ? durations : [1]}
                    currentTime={currentTime}
                    activeIndex={playingIndex}
                    generationId={generationId}
                  />
                  <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                    <span className="text-xs font-medium tabular-nums text-subtle">
                      {formatTime(currentTime)} / {formatTime(durations.reduce((sum, d) => sum + d, 0))}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <IconButton
                        title="Previous segment"
                        onClick={() => playSequenceFrom(Math.max(0, (playingIndex ?? 0) - 1))}
                        disabled={segments.length === 0}
                      >
                        <SkipBack className="h-4 w-4" />
                      </IconButton>
                      <button
                        type="button"
                        onClick={togglePlayPause}
                        disabled={segments.length === 0}
                        aria-label={isSequenceMode && isPlaying ? "Pause" : "Play"}
                        className="flex h-9 w-9 items-center justify-center rounded-full text-white transition-transform active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
                        style={{
                          background: "linear-gradient(to bottom, rgb(59, 130, 246), rgb(37, 99, 235))",
                          boxShadow:
                            "0 2px 8px 0 rgba(37, 99, 235, 0.4), 0 1.5px 0 0 rgba(255,255,255,0.25) inset, 0 -2px 6px 0 rgba(37, 99, 235, 0.5) inset",
                        }}
                      >
                        {isSequenceMode && isPlaying ? (
                          <Pause className="h-4 w-4" fill="currentColor" />
                        ) : (
                          <Play className="h-4 w-4" fill="currentColor" />
                        )}
                      </button>
                      <IconButton
                        title="Next segment"
                        onClick={() => playSequenceFrom(Math.min(segments.length - 1, (playingIndex ?? 0) + 1))}
                        disabled={segments.length === 0}
                      >
                        <SkipForward className="h-4 w-4" />
                      </IconButton>
                    </div>
                    <div className="flex justify-end">
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
                </div>
              </>
            )}
          </div>

          {/* ── Right column: sidebar / voice drawer ──────────────────── */}
          <div className="relative">
            {isVoiceDrawerOpen ? (
              <div className="flex h-full max-h-[720px] flex-col rounded-2xl border border-hairline bg-app/60 shadow-card dark:bg-white/[0.015]">
                <div className="flex items-center justify-between gap-2 border-b border-hairline px-4 py-4">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsVoiceDrawerOpen(false)}
                      aria-label="Back"
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-subtle transition-colors hover:bg-accent hover:text-primary"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <h2 className="text-sm font-semibold text-heading">Select a Voice</h2>
                  </div>
                  <div className="flex shrink-0 rounded-full bg-app p-1 dark:bg-white/5">
                    {(["All", "Male", "Female"] as const).map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => setVoiceGenderFilter(option)}
                        className={cn(
                          "rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
                          voiceGenderFilter === option ? "bg-surface text-heading shadow-card" : "text-subtle hover:text-heading"
                        )}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="px-4 pt-3.5">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-subtle" />
                    <input
                      value={voiceSearch}
                      onChange={(event) => setVoiceSearch(event.target.value)}
                      placeholder="Search voices"
                      className="w-full rounded-xl border border-hairline bg-surface py-2.5 pl-9 pr-3 text-sm text-heading shadow-card outline-none placeholder:text-subtle transition-colors focus:border-primary/50 focus:ring-2 focus:ring-primary/15"
                    />
                  </div>
                </div>

                {previewError && (
                  <p className="mx-4 mt-2 rounded-lg bg-danger-tint px-3 py-2 text-xs font-medium text-danger" role="alert">
                    {previewError}
                  </p>
                )}

                <button
                  type="button"
                  disabled
                  title="Coming soon"
                  className="mx-4 mt-3.5 flex cursor-not-allowed items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-hairline py-3.5 text-sm font-medium text-subtle opacity-70"
                >
                  <Plus className="h-4 w-4" /> Add Your Voice
                  <Badge>Coming soon</Badge>
                </button>

                <div className="mt-3.5 flex-1 space-y-2.5 overflow-y-auto px-4 pb-4 pt-1">
                  {filteredVoices.map((voice) => (
                    <VoiceCard
                      key={voice.id}
                      voice={voice}
                      selected={voice.id === voiceId}
                      onSelect={() => {
                        setVoiceId(voice.id);
                        setIsVoiceDrawerOpen(false);
                        previewAudioRef.current?.pause();
                        setPlayingPreviewId(null);
                      }}
                      onPlay={() => playVoicePreview(voice)}
                      isPreviewLoading={previewingVoiceId === voice.id}
                      isPreviewPlaying={playingPreviewId === voice.id}
                    />
                  ))}
                  {filteredVoices.length === 0 && (
                    <p className="py-8 text-center text-sm text-subtle">No voices match your search.</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex h-full flex-col gap-3 rounded-3xl bg-app p-3 ring-1 ring-inset ring-black/[0.06] dark:bg-white/5 dark:ring-white/10">
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
                      className={cn(
                        "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors",
                        sidebarTab === key ? "bg-surface text-heading shadow-card" : "text-subtle hover:text-heading"
                      )}
                    >
                      <TabIcon className="h-3.5 w-3.5" />
                      {label}
                    </button>
                  ))}
                </div>

                {sidebarTab === "history" ? (
                  <HistoryPanel onSelect={handleSelectHistoryItem} selectingId={selectingHistoryId} refreshSignal={historyRefreshSignal} />
                ) : (
                  <div className="rounded-2xl border border-hairline bg-surface shadow-card dark:bg-white/[0.02]">
                    <div className="group p-5">
                      <div className="flex items-center gap-2">
                        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-accent to-primary/15 text-primary">
                          <Mic2 className="h-3.5 w-3.5" />
                        </span>
                        <h2 className="text-xs font-semibold uppercase tracking-wide text-subtle">Voice Style</h2>
                      </div>
                  <button
                    type="button"
                    onClick={() => setIsVoiceDrawerOpen(true)}
                    className="group/row mt-3 flex w-full items-center gap-3 rounded-xl border border-hairline bg-app/60 p-3 text-left transition-all duration-200 hover:border-primary/40 hover:bg-accent/50 dark:bg-white/[0.02]"
                  >
                    <Avatar name={selectedVoice.id} size="md" hideInitials className="ring-2 ring-surface shadow-sm" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-1">
                        <p className="truncate text-sm font-semibold text-heading">{selectedVoice.id}</p>
                        <span className="text-subtle">·</span>
                        <span className="truncate text-sm font-medium text-primary">{selectedVoice.gender}</span>
                      </div>
                      <p className="truncate text-xs text-subtle">{selectedVoice.description}</p>
                    </div>
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-primary transition-transform duration-200 group-hover/row:translate-x-0.5">
                      <ChevronRight className="h-3.5 w-3.5" />
                    </span>
                  </button>
                </div>

                <div className="border-t border-hairline p-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-primary/15 to-primary/5 text-primary ring-1 ring-primary/10">
                        <Wand2 className="h-3.5 w-3.5" />
                      </span>
                      <h2 className="text-xs font-semibold uppercase tracking-wide text-subtle">Speaking Style</h2>
                    </div>
                    <button
                      type="button"
                      onClick={resetStyle}
                      className="flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold text-primary outline-none transition-colors hover:bg-primary/10"
                    >
                      <RotateCcw className="h-3 w-3" />
                      Reset
                    </button>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {STYLE_PRESETS.map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => setStylePrompt(preset.prompt)}
                        className={cn(
                          "rounded-full px-3 py-1.5 text-xs font-semibold transition-all duration-200 ease-[cubic-bezier(0.19,1,0.22,1)]",
                          stylePrompt === preset.prompt
                            ? "bg-gradient-to-b from-primary to-primary-hover text-white shadow-[0_1px_1px_rgba(255,255,255,0.25)_inset,0_4px_12px_-2px_rgba(51,92,255,0.5),0_0_0_5px_rgba(51,92,255,0.14)]"
                            : "bg-app text-subtle shadow-[0_1px_2px_rgba(16,24,40,0.04)] ring-1 ring-inset ring-hairline hover:-translate-y-px hover:text-heading hover:shadow-[0_2px_6px_rgba(16,24,40,0.06)] hover:ring-primary/25 dark:bg-white/[0.03]"
                        )}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>

                  <div className="relative mt-3">
                    <textarea
                      value={stylePrompt}
                      onChange={(event) => setStylePrompt(event.target.value.slice(0, MAX_STYLE_PROMPT_CHARS))}
                      placeholder="Describe how it should sound, e.g. &quot;Speak with excitement and energy.&quot;"
                      rows={2}
                      className="w-full resize-none rounded-xl border border-hairline bg-app/60 p-3 pb-5 text-sm text-heading outline-none placeholder:text-subtle transition-colors focus:border-primary/50 focus:ring-2 focus:ring-primary/15 dark:bg-white/[0.02]"
                    />
                    <span className="pointer-events-none absolute bottom-2 right-3 text-[10px] font-medium tabular-nums text-subtle/60">
                      {stylePrompt.length}/{MAX_STYLE_PROMPT_CHARS}
                    </span>
                  </div>

                  <div className="mt-4 border-t border-hairline pt-4">
                    <label className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-subtle">
                      <Languages className="h-3 w-3" />
                      Language
                    </label>
                    <div className="relative">
                      <select
                        value={languageCode}
                        onChange={(event) => setLanguageCode(event.target.value)}
                        className="w-full appearance-none rounded-lg border border-hairline bg-app/60 px-3 py-2 pr-8 text-sm text-heading outline-none transition-colors focus:border-primary/50 focus:ring-2 focus:ring-primary/15 dark:bg-white/[0.02]"
                      >
                        {LANGUAGE_OPTIONS.map((language) => (
                          <option key={language.code} value={language.code}>
                            {language.label}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-subtle" />
                    </div>
                  </div>
                </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
