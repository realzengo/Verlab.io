"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
  Pause,
  Play,
  Plus,
  Repeat,
  Search,
  SkipBack,
  SkipForward,
  Sparkles,
  Trash2,
} from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { PlasticButton } from "@/components/ui/plastic-button";
import { DEFAULT_VOICE_ID, getVoiceOption, VOICE_OPTIONS, type VoiceOption } from "@/lib/config/voices";
import { getVoiceoverSegmentCost } from "@/lib/config/pricing";
import { exportSegmentsAsWav } from "@/lib/client/audio-export";
import { consumeVoiceoverHandoff } from "@/lib/client/voiceover-handoff";
import { pollUntilSettled } from "@/lib/polling";
import { cn, downloadBlob } from "@/lib/utils";

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

const MAX_SCRIPT_CHARS = 5000;
const DEFAULT_SPEED = 1.08;
const DEFAULT_STABILITY = 80;

function segmentUrl(generationId: string, index: number): string {
  return `/api/generate-voiceover/${generationId}/segments/${index}`;
}

// ── Small presentational pieces ─────────────────────────────────────────

function SliderRow({
  label,
  value,
  min,
  max,
  step,
  onChange,
  format,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  format: (value: number) => string;
}) {
  return (
    <div className="mt-4 first:mt-3">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{label}</span>
        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{format(value)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-blue-500 dark:bg-zinc-700"
      />
    </div>
  );
}

function IconButton({
  onClick,
  active,
  destructive,
  disabled,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  destructive?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      className={cn(
        "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors disabled:cursor-not-allowed disabled:opacity-40",
        destructive
          ? "text-slate-400 hover:bg-red-50 hover:text-red-500 dark:text-slate-500 dark:hover:bg-red-500/10 dark:hover:text-red-400"
          : active
            ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
            : "text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-zinc-800 dark:hover:text-slate-200"
      )}
    >
      {children}
    </button>
  );
}

function VoiceCard({
  voice,
  selected,
  onSelect,
  onPlay,
  isPreviewLoading,
}: {
  voice: VoiceOption;
  selected: boolean;
  onSelect: () => void;
  onPlay: () => void;
  isPreviewLoading: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors",
        selected
          ? "border-blue-500 bg-blue-50/60 ring-2 ring-blue-500 dark:bg-blue-500/10"
          : "border-slate-200 hover:border-slate-300 dark:border-zinc-800 dark:hover:border-zinc-700"
      )}
    >
      <Avatar name={voice.id} size="md" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{voice.id}</p>
          <Badge>{voice.style}</Badge>
        </div>
      </div>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onPlay();
        }}
        aria-label={`Preview ${voice.id}`}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-zinc-800"
      >
        {isPreviewLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
      </button>
    </button>
  );
}

function Timeline({
  durations,
  currentTime,
  activeIndex,
}: {
  durations: number[];
  currentTime: number;
  activeIndex: number | null;
}) {
  const total = Math.max(0.5, durations.reduce((sum, d) => sum + d, 0));
  const step = total <= 10 ? 0.5 : total <= 30 ? 1 : total <= 120 ? 5 : 10;
  const ticks: number[] = [];
  for (let t = 0; t <= total; t += step) ticks.push(t);

  return (
    <div>
      <div className="relative h-4 text-[10px] font-medium text-slate-400">
        {ticks.map((t) => (
          <span key={t} className="absolute -translate-x-1/2" style={{ left: `${(t / total) * 100}%` }}>
            {t % 1 === 0 ? t : t.toFixed(1)}s
          </span>
        ))}
      </div>
      <div className="relative mt-1 flex h-9 w-full overflow-hidden rounded-lg bg-slate-100 dark:bg-zinc-900">
        {durations.map((duration, index) => (
          <div
            key={index}
            className={cn(
              "h-full border-r border-white/70 dark:border-black/40",
              index === activeIndex ? "bg-blue-400 dark:bg-blue-500/70" : "bg-blue-200 dark:bg-blue-500/25"
            )}
            style={{ width: `${(duration / total) * 100}%` }}
          />
        ))}
        <div
          className="absolute inset-y-0 w-0.5 bg-blue-600"
          style={{ left: `${Math.min(100, (currentTime / total) * 100)}%` }}
        />
      </div>
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────────

export function VoiceoverGenerator() {
  const [title, setTitle] = useState("");
  const [script, setScript] = useState("");
  const [voiceId, setVoiceId] = useState(DEFAULT_VOICE_ID);
  const [generationMode, setGenerationMode] = useState<GenerationMode>("line_by_line");
  const [speed, setSpeed] = useState(DEFAULT_SPEED);
  const [stability, setStability] = useState(DEFAULT_STABILITY);

  const [isVoiceDrawerOpen, setIsVoiceDrawerOpen] = useState(false);
  const [voiceSearch, setVoiceSearch] = useState("");
  const [previewingVoiceId, setPreviewingVoiceId] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  const [view, setView] = useState<View>("input");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [generationId, setGenerationId] = useState<string | null>(null);
  const [segments, setSegments] = useState<SegmentState[]>([]);
  const pollCancelRef = useRef<(() => void) | null>(null);

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
      if (!voiceSearch.trim()) return true;
      const query = voiceSearch.trim().toLowerCase();
      return voice.id.toLowerCase().includes(query) || voice.style.toLowerCase().includes(query);
    });
  }, [voiceSearch]);

  const estimatedSegments = useMemo(() => estimateSegmentTexts(script, generationMode), [script, generationMode]);
  const estimatedCredits = useMemo(
    () => estimatedSegments.reduce((sum, text) => sum + getVoiceoverSegmentCost(text.length), 0),
    [estimatedSegments]
  );

  const durations = segments.map((s) => s.durationSeconds);

  useEffect(() => {
    return () => pollCancelRef.current?.();
  }, []);

  function resetSliders() {
    setSpeed(DEFAULT_SPEED);
    setStability(DEFAULT_STABILITY);
  }

  async function playVoicePreview(voice: VoiceOption) {
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

  async function handleGenerate() {
    if (!script.trim() || isGenerating) return;
    setIsGenerating(true);
    setGenerationError(null);
    setView("loading");

    try {
      const response = await fetch("/api/generate-voiceover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, script, voiceId, speed, stability, generationMode }),
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

  const charCount = script.length;

  return (
    <div className="w-full px-0 pt-8 pb-16 sm:px-6 sm:pt-10">
      <audio ref={previewAudioRef} className="hidden" />
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
          <p className="mt-2 text-xs font-medium tracking-wide text-slate-500 dark:text-slate-400 sm:text-sm">
            Turn a script into natural-sounding narration.
          </p>
        </div>

        {generationError && (
          <p className="mb-4 rounded-xl bg-red-50 px-4 py-2.5 text-sm font-medium text-red-600 dark:bg-red-500/10 dark:text-red-400" role="alert">
            {generationError}
          </p>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          {/* ── Left column: main workspace ───────────────────────────── */}
          <div className="relative flex min-h-[600px] flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            {view !== "editor" && (
              <>
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Untitled Script"
                  disabled={view === "loading"}
                  className="w-full bg-transparent text-lg font-semibold text-slate-900 outline-none placeholder:text-slate-400 disabled:opacity-60 dark:text-white dark:placeholder:text-zinc-600"
                />

                {view === "loading" ? (
                  <div className="relative mt-3 flex flex-1 flex-col items-center justify-center gap-3 rounded-xl bg-slate-50 dark:bg-zinc-900/50">
                    <span className="absolute right-4 top-4 rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-500 shadow-sm dark:bg-zinc-800 dark:text-slate-400">
                      Wait 1-3 minutes...
                    </span>
                    <div className="relative flex h-14 w-14 items-center justify-center">
                      <span className="absolute h-14 w-14 animate-ping rounded-full bg-blue-400/30" />
                      <Sparkles className="relative h-7 w-7 animate-pulse text-blue-500" />
                    </div>
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Splitting Script</p>
                    <p className="max-w-xs text-center text-xs text-slate-400">
                      Finding pauses that sound natural when spoken...
                    </p>
                  </div>
                ) : (
                  <>
                    <textarea
                      value={script}
                      onChange={(event) => setScript(event.target.value.slice(0, MAX_SCRIPT_CHARS))}
                      placeholder="Type your script here..."
                      maxLength={MAX_SCRIPT_CHARS}
                      className="mt-3 min-h-[320px] flex-1 resize-none bg-transparent text-sm leading-relaxed text-slate-800 outline-none placeholder:text-slate-400 dark:text-slate-100 dark:placeholder:text-zinc-600"
                    />
                    <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 dark:border-zinc-800">
                      <span className="text-xs font-medium text-slate-400">
                        {charCount.toLocaleString()}/{MAX_SCRIPT_CHARS.toLocaleString()}
                      </span>
                      <Badge>
                        {estimatedCredits} credit{estimatedCredits === 1 ? "" : "s"}
                      </Badge>
                    </div>
                  </>
                )}

                <PlasticButton
                  text="Generate"
                  loading={view === "loading"}
                  loadingText="Generating…"
                  disabled={!script.trim()}
                  onClick={handleGenerate}
                  className="mt-4 w-full py-3"
                  trailing={<Sparkles className="h-4 w-4" />}
                />
              </>
            )}

            {view === "editor" && generationId && (
              <>
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="truncate text-base font-semibold text-slate-900 dark:text-white">{title || "Untitled Script"}</h2>
                  <div className="flex shrink-0 rounded-full bg-slate-100 p-1 dark:bg-zinc-900">
                    {(["editor", "audio"] as const).map((tab) => (
                      <button
                        key={tab}
                        type="button"
                        onClick={() => setEditorTab(tab)}
                        className={cn(
                          "rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors",
                          editorTab === tab
                            ? "bg-white text-slate-900 shadow-sm dark:bg-zinc-800 dark:text-white"
                            : "text-slate-500 dark:text-slate-400"
                        )}
                      >
                        {tab === "editor" ? "Voiceover editor" : "Generated audio"}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex-1 space-y-2 overflow-y-auto pr-1">
                  {editorTab === "editor" ? (
                    <>
                      {segments.map((segment, index) => (
                        <div
                          key={index}
                          className={cn(
                            "flex items-center gap-3 rounded-xl border p-3 transition-colors",
                            playingIndex === index
                              ? "border-blue-300 bg-blue-50/50 dark:border-blue-500/40 dark:bg-blue-500/5"
                              : "border-slate-200 bg-slate-50/60 dark:border-zinc-800 dark:bg-zinc-900/40"
                          )}
                        >
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-xs font-semibold text-slate-500 shadow-sm dark:bg-zinc-800 dark:text-slate-400">
                            {index + 1}
                          </span>
                          <p className="min-w-0 flex-1 truncate text-sm text-slate-700 dark:text-slate-200">{segment.text}</p>
                          <div className="flex shrink-0 items-center gap-1">
                            <IconButton title="Play segment" onClick={() => playSegment(index)} active={playingIndex === index && !isSequenceMode}>
                              {playingIndex === index && !isSequenceMode && isPlaying ? (
                                <Pause className="h-3.5 w-3.5" />
                              ) : (
                                <Play className="h-3.5 w-3.5" />
                              )}
                            </IconButton>
                            <IconButton title="Loop segment" onClick={() => toggleLoopForSegment(index)} active={loopIndex === index}>
                              <Repeat className="h-3.5 w-3.5" />
                            </IconButton>
                            <IconButton
                              title="Delete segment"
                              destructive
                              disabled={deletingIndex === index}
                              onClick={() => handleDeleteSegment(index)}
                            >
                              {deletingIndex === index ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                            </IconButton>
                          </div>
                        </div>
                      ))}

                      {isAddingSegment ? (
                        <div className="rounded-xl border border-slate-200 p-3 dark:border-zinc-800">
                          <textarea
                            value={newSegmentText}
                            onChange={(event) => setNewSegmentText(event.target.value.slice(0, 1000))}
                            placeholder="Type the new segment's text..."
                            autoFocus
                            className="min-h-[70px] w-full resize-none bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400 dark:text-slate-100"
                          />
                          <div className="mt-2 flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setIsAddingSegment(false);
                                setNewSegmentText("");
                              }}
                              className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-800"
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
                          className="flex w-full items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-slate-300 py-3 text-sm font-medium text-slate-500 transition-colors hover:border-slate-400 hover:text-slate-700 dark:border-zinc-700 dark:text-slate-400 dark:hover:border-zinc-600 dark:hover:text-slate-200"
                        >
                          <Plus className="h-4 w-4" /> Add Segment
                        </button>
                      )}
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-2 rounded-xl bg-slate-50 py-16 text-center dark:bg-zinc-900/50">
                      <Sparkles className="h-6 w-6 text-blue-400" />
                      <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{segments.length} segments generated</p>
                      <p className="text-xs text-slate-400">Use the player below to listen to the full voiceover.</p>
                    </div>
                  )}
                </div>

                {exportError && <p className="mt-2 text-xs font-medium text-red-500">{exportError}</p>}

                {/* ── Bottom audio player ─────────────────────────────── */}
                <div className="mt-4 border-t border-slate-100 pt-4 dark:border-zinc-800">
                  <Timeline durations={durations.length > 0 ? durations : [1]} currentTime={currentTime} activeIndex={playingIndex} />
                  <div className="mt-3 flex items-center justify-between">
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
                        className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-white transition-transform active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white dark:text-slate-900"
                      >
                        {isSequenceMode && isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 translate-x-0.5" />}
                      </button>
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
              </>
            )}
          </div>

          {/* ── Right column: sidebar / voice drawer ──────────────────── */}
          <div className="relative">
            {isVoiceDrawerOpen ? (
              <div className="flex h-full max-h-[720px] flex-col rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                <div className="flex items-center gap-2 border-b border-slate-100 p-4 dark:border-zinc-800">
                  <button
                    type="button"
                    onClick={() => setIsVoiceDrawerOpen(false)}
                    aria-label="Back"
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-zinc-800"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Select a Voice</h2>
                </div>

                <div className="px-4 pt-3">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                    <input
                      value={voiceSearch}
                      onChange={(event) => setVoiceSearch(event.target.value)}
                      placeholder="Search voices"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-8 pr-3 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-blue-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-slate-100 dark:focus:border-blue-500"
                    />
                  </div>
                </div>

                {previewError && (
                  <p className="mx-4 mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-600 dark:bg-red-500/10 dark:text-red-400" role="alert">
                    {previewError}
                  </p>
                )}

                <button
                  type="button"
                  disabled
                  title="Coming soon"
                  className="mx-4 mt-3 flex cursor-not-allowed items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 py-3 text-sm font-medium text-slate-400 opacity-70 dark:border-zinc-700 dark:text-slate-500"
                >
                  <Plus className="h-4 w-4" /> Add Your Voice
                  <Badge>Coming soon</Badge>
                </button>

                <div className="mt-3 flex-1 space-y-2 overflow-y-auto px-4 pb-4">
                  {filteredVoices.map((voice) => (
                    <VoiceCard
                      key={voice.id}
                      voice={voice}
                      selected={voice.id === voiceId}
                      onSelect={() => {
                        setVoiceId(voice.id);
                        setIsVoiceDrawerOpen(false);
                      }}
                      onPlay={() => playVoicePreview(voice)}
                      isPreviewLoading={previewingVoiceId === voice.id}
                    />
                  ))}
                  {filteredVoices.length === 0 && (
                    <p className="py-8 text-center text-sm text-slate-400">No voices match your search.</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                  <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Voice Style</h2>
                  <button
                    type="button"
                    onClick={() => setIsVoiceDrawerOpen(true)}
                    className="mt-2.5 flex w-full items-center gap-3 rounded-xl border border-slate-200 p-3 text-left transition-colors hover:border-slate-300 dark:border-zinc-800 dark:hover:border-zinc-700"
                  >
                    <Avatar name={selectedVoice.id} size="md" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{selectedVoice.id}</p>
                      <p className="truncate text-xs text-slate-400">{selectedVoice.style}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
                  </button>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                  <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Generation Mode</h2>
                  <div className="mt-2.5 flex rounded-full bg-slate-100 p-1 dark:bg-zinc-900">
                    {([
                      { value: "line_by_line", label: "Line by Line" },
                      { value: "all_at_once", label: "All at Once" },
                    ] as const).map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setGenerationMode(option.value)}
                        className={cn(
                          "flex-1 rounded-full py-1.5 text-xs font-semibold transition-colors",
                          generationMode === option.value
                            ? "bg-white text-slate-900 shadow-sm dark:bg-zinc-800 dark:text-white"
                            : "text-slate-500 dark:text-slate-400"
                        )}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Voice Adjustment</h2>
                    <button type="button" onClick={resetSliders} className="text-xs font-semibold text-blue-500 hover:text-blue-600 dark:text-blue-400">
                      Reset
                    </button>
                  </div>
                  <SliderRow label="Speed" value={speed} min={0.5} max={2} step={0.01} onChange={setSpeed} format={(v) => v.toFixed(2)} />
                  <SliderRow label="Stability" value={stability} min={0} max={100} step={1} onChange={setStability} format={(v) => `${v}%`} />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
