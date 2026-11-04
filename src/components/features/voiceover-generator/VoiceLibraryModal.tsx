"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Heart, Loader2, Pause, Play, Plus, Search, Trash2, X } from "lucide-react";
import { VOICES, isElevenLabsVoiceId, voiceMeta, voiceTitle, type ElevenLabsVoice } from "@/lib/config/elevenlabs";
import { VOICE_CLONING_ENABLED, type VoiceCloneSummary } from "@/lib/config/voices";
import { cn } from "@/lib/utils";

type VoiceTab = "saved" | "elevenlabs" | "cloned";

// ── Pieces ──────────────────────────────────────────────────────────────

function PlayButton({
  label,
  isLoading,
  isPlaying,
  onClick,
}: {
  label: string;
  isLoading: boolean;
  isPlaying: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      aria-label={label}
      className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-full ring-1 ring-inset transition-colors active:scale-[0.94]",
        isPlaying ? "bg-btn-primary text-white ring-transparent" : "bg-surface text-heading ring-hairline hover:bg-(--app-fill)"
      )}
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : isPlaying ? (
        <Pause className="h-3.5 w-3.5" fill="currentColor" />
      ) : (
        <Play className="h-3.5 w-3.5 translate-x-[1px]" fill="currentColor" />
      )}
    </button>
  );
}

function HeartButton({ voiceName, saved, onToggle }: { voiceName: string; saved: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onToggle();
      }}
      aria-label={saved ? `Remove ${voiceName} from saved voices` : `Save ${voiceName}`}
      aria-pressed={saved}
      className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-(--app-fill)",
        saved ? "text-rose-500" : "text-heading"
      )}
    >
      <Heart className="h-[18px] w-[18px]" fill={saved ? "currentColor" : "none"} />
    </button>
  );
}

const CARD = "flex w-full items-center gap-3 rounded-2xl border p-3 text-left outline-none transition-colors";

function cardState(selected: boolean): string {
  return selected
    ? "border-primary/70 bg-accent/60 shadow-[0_0_0_1px_var(--color-primary)] dark:bg-primary/[0.08]"
    : "border-hairline bg-surface hover:border-heading/20 hover:bg-(--app-fill)";
}

function VoiceCard({
  voice,
  selected,
  highlight = false,
  saved,
  onSelect,
  onPlay,
  onToggleSave,
  isPreviewLoading,
  isPreviewPlaying,
}: {
  voice: ElevenLabsVoice;
  selected: boolean;
  /** The voice a pasted id resolved to -- shown lifted, like the selected one. */
  highlight?: boolean;
  saved: boolean;
  onSelect: () => void;
  onPlay: () => void;
  onToggleSave: () => void;
  isPreviewLoading: boolean;
  isPreviewPlaying: boolean;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect();
        }
      }}
      className={cn(CARD, "cursor-pointer focus-visible:ring-2 focus-visible:ring-primary/30", cardState(selected || highlight))}
    >
      {voice.previewUrl ? (
        <PlayButton
          label={isPreviewPlaying ? `Stop ${voice.name} preview` : `Preview ${voice.name}`}
          isLoading={isPreviewLoading}
          isPlaying={isPreviewPlaying}
          onClick={onPlay}
        />
      ) : (
        <span className="h-9 w-9 shrink-0" />
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-semibold text-heading">{voiceTitle(voice)}</p>
        <p className="mt-0.5 truncate text-[13px] text-subtle">{voiceMeta(voice)}</p>
      </div>
      <HeartButton voiceName={voice.name} saved={saved} onToggle={onToggleSave} />
    </div>
  );
}

// A pasted id that's still being checked, or that fal can't speak with.
function VoiceIdCard({ voiceId, status, onRetry }: { voiceId: string; status: "checking" | "unavailable" | "error"; onRetry: () => void }) {
  return (
    <div className={cn(CARD, "border-hairline bg-surface")}>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center">
        {status === "checking" && <Loader2 className="h-4 w-4 animate-spin text-subtle" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className={cn("truncate text-[15px] font-semibold", status === "checking" ? "text-heading" : "text-subtle")}>{voiceId}</p>
        <p className="mt-0.5 truncate text-[13px] text-subtle">ElevenLabs voice</p>
      </div>
      {status === "unavailable" && <span className="shrink-0 pr-2 text-sm font-semibold text-danger">Unavailable</span>}
      {status === "error" && (
        <button type="button" onClick={onRetry} className="shrink-0 rounded-md px-2 py-1 text-sm font-semibold text-danger hover:bg-danger-tint">
          Try again
        </button>
      )}
    </div>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="mx-auto max-w-sm py-14 text-center">
      <p className="text-sm font-semibold text-heading">{title}</p>
      <p className="mt-1.5 text-sm text-subtle">{body}</p>
    </div>
  );
}

// ── Data ────────────────────────────────────────────────────────────────

type LookupResult = { status: "ok"; voice: ElevenLabsVoice } | { status: "unavailable" } | { status: "error" };

interface LibraryResult {
  /** The search this result answers, so a stale one is never shown. */
  query: string;
  configured: boolean;
  voices: ElevenLabsVoice[];
  hasMore: boolean;
  page: number;
}

const SEARCH_DEBOUNCE_MS = 350;

async function fetchLibraryPage(search: string, page: number, signal?: AbortSignal) {
  const params = new URLSearchParams({ search, page: String(page) });
  const response = await fetch(`/api/voices/library?${params}`, { signal });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error ?? `Could not load the voice library (${response.status})`);
  return data as { configured: boolean; voices: ElevenLabsVoice[]; hasMore: boolean };
}

function matchesSearch(voice: ElevenLabsVoice, query: string): boolean {
  if (!query) return true;
  return [voice.name, voice.description, voice.accent ?? "", voice.gender ?? "", voice.age ?? ""].some((field) => field.toLowerCase().includes(query));
}

// ── Modal ───────────────────────────────────────────────────────────────

interface VoiceLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedVoiceId: string;
  onSelectVoice: (voice: ElevenLabsVoice) => void;
  clones: VoiceCloneSummary[];
  onSelectClone: (clone: VoiceCloneSummary) => void;
  onPlayClone: (clone: VoiceCloneSummary) => void;
  onDeleteClone: (clone: VoiceCloneSummary) => void;
  onAddVoice: () => void;
  previewingCloneId: string | null;
  playingCloneId: string | null;
  deletingCloneId: string | null;
  cloneError: string | null;
}

export function VoiceLibraryModal({
  isOpen,
  onClose,
  selectedVoiceId,
  onSelectVoice,
  clones,
  onSelectClone,
  onPlayClone,
  onDeleteClone,
  onAddVoice,
  previewingCloneId,
  playingCloneId,
  deletingCloneId,
  cloneError,
}: VoiceLibraryModalProps) {
  const [tab, setTab] = useState<VoiceTab>("elevenlabs");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [savedVoices, setSavedVoices] = useState<ElevenLabsVoice[] | null>(null);
  const [lookups, setLookups] = useState<Record<string, LookupResult>>({});
  const [libraryResult, setLibraryResult] = useState<LibraryResult | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Deleting a paid clone takes a second click.
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);

  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Escape closes; the page behind doesn't scroll while the modal is open.
  useEffect(() => {
    if (!isOpen) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen, onClose]);

  // Stop any preview when the modal closes.
  useEffect(() => {
    if (isOpen) return;
    audioRef.current?.pause();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- resets preview state when the modal closes
    setPlayingId(null);
  }, [isOpen]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [search]);

  // Saved voices load once, the first time the picker opens.
  useEffect(() => {
    if (!isOpen || savedVoices !== null) return;
    const controller = new AbortController();
    fetch("/api/voices/saved", { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : { voices: [] }))
      .then((data) => setSavedVoices(Array.isArray(data?.voices) ? data.voices : []))
      .catch(() => {
        if (!controller.signal.aborted) setSavedVoices([]);
      });
    return () => controller.abort();
  }, [isOpen, savedVoices]);

  const savedIds = useMemo(() => new Set((savedVoices ?? []).map((v) => v.voiceId)), [savedVoices]);

  async function toggleSaved(voice: ElevenLabsVoice) {
    const wasSaved = savedIds.has(voice.voiceId);
    const previous = savedVoices ?? [];
    setSavedVoices(wasSaved ? previous.filter((v) => v.voiceId !== voice.voiceId) : [voice, ...previous]);
    setError(null);
    try {
      const response = wasSaved
        ? await fetch(`/api/voices/saved?voiceId=${encodeURIComponent(voice.voiceId)}`, { method: "DELETE" })
        : await fetch("/api/voices/saved", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ voice }) });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error ?? "Could not update your saved voices");
      if (Array.isArray(data?.voices)) setSavedVoices(data.voices);
    } catch (err) {
      setSavedVoices(previous);
      setError(err instanceof Error ? err.message : "Could not update your saved voices");
    }
  }

  // Any ElevenLabs voice can be used by pasting its id into the search box.
  // It's checked as soon as it's complete: the lookup confirms fal can speak
  // with it and finds a sample clip (see /api/voices/lookup). "Checking" is
  // derived from there being no result yet, not set here.
  const typedVoiceId = isElevenLabsVoiceId(search.trim()) ? search.trim() : null;
  const typedLookup = typedVoiceId ? lookups[typedVoiceId] : undefined;
  useEffect(() => {
    if (!isOpen || !typedVoiceId || lookups[typedVoiceId]) return;
    const voiceId = typedVoiceId;
    const controller = new AbortController();
    fetch(`/api/voices/lookup?voiceId=${encodeURIComponent(voiceId)}`, { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(130_000)]) })
      .then(async (response) => {
        const data = await response.json().catch(() => null);
        const result: LookupResult =
          response.ok && data?.voice ? { status: "ok", voice: data.voice } : response.status === 404 || response.status === 400 ? { status: "unavailable" } : { status: "error" };
        setLookups((prev) => ({ ...prev, [voiceId]: result }));
      })
      .catch(() => {
        if (!controller.signal.aborted) setLookups((prev) => ({ ...prev, [voiceId]: { status: "error" } }));
      });
    return () => controller.abort();
  }, [isOpen, typedVoiceId, lookups]);

  function retryLookup(voiceId: string) {
    setLookups((prev) => {
      const next = { ...prev };
      delete next[voiceId];
      return next;
    });
  }

  // Searching the ElevenLabs tab also searches the public Voice Library when
  // the server has an ElevenLabs key; without one the first answer says so
  // and nothing is asked again.
  const libraryUnavailable = libraryResult?.configured === false;
  const wantsLibrary = isOpen && tab === "elevenlabs" && debouncedSearch !== "" && !typedVoiceId && !libraryUnavailable;
  const isLibraryLoading = wantsLibrary && libraryResult?.query !== debouncedSearch;
  useEffect(() => {
    if (!wantsLibrary || libraryResult?.query === debouncedSearch) return;
    const query = debouncedSearch;
    const controller = new AbortController();
    fetchLibraryPage(query, 0, controller.signal)
      .then((data) => setLibraryResult({ query, ...data, page: 0 }))
      .catch(() => {
        if (!controller.signal.aborted) setLibraryResult({ query, configured: true, voices: [], hasMore: false, page: 0 });
      });
    return () => controller.abort();
  }, [wantsLibrary, debouncedSearch, libraryResult?.query]);

  async function loadMoreLibrary() {
    if (!libraryResult || isLoadingMore) return;
    const { query, page } = libraryResult;
    setIsLoadingMore(true);
    try {
      const data = await fetchLibraryPage(query, page + 1);
      setLibraryResult((prev) => (prev && prev.query === query ? { ...prev, voices: [...prev.voices, ...data.voices], hasMore: data.hasMore, page: page + 1 } : prev));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load more voices");
    } finally {
      setIsLoadingMore(false);
    }
  }

  // A pasted id is answered by its own card above the tabs, so it doesn't
  // filter the lists below.
  const query = typedVoiceId ? "" : search.trim().toLowerCase();
  const visibleSaved = useMemo(() => (savedVoices ?? []).filter((voice) => matchesSearch(voice, query)), [savedVoices, query]);
  const visibleDefaults = useMemo(() => VOICES.filter((voice) => matchesSearch(voice, query)), [query]);
  const libraryMatches = useMemo(() => {
    if (!wantsLibrary || isLibraryLoading || !libraryResult) return [];
    const shown = new Set(visibleDefaults.map((v) => v.voiceId));
    return libraryResult.voices.filter((v) => !shown.has(v.voiceId));
  }, [wantsLibrary, isLibraryLoading, libraryResult, visibleDefaults]);
  const visibleClones = useMemo(
    () => (query ? clones.filter((clone) => [clone.name, clone.language, clone.gender].some((field) => field.toLowerCase().includes(query))) : clones),
    [clones, query]
  );

  // Samples are static clips -- bundled in public/voice-previews/ for the
  // defaults, ElevenLabs' CDN for library voices -- so nothing is generated.
  async function playPreview(voice: ElevenLabsVoice) {
    const audio = audioRef.current;
    if (!audio || !voice.previewUrl) return;
    if (playingId === voice.voiceId) {
      audio.pause();
      setPlayingId(null);
      return;
    }
    setPreviewingId(voice.voiceId);
    setError(null);
    try {
      audio.src = voice.previewUrl;
      await audio.play();
      setPlayingId(voice.voiceId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not play that preview");
    } finally {
      setPreviewingId(null);
    }
  }

  function select(voice: ElevenLabsVoice) {
    onSelectVoice(voice);
    onClose();
  }

  if (!isOpen) return null;

  const tabs: { key: VoiceTab; label: string; count: number }[] = [
    { key: "saved", label: "Saved", count: savedVoices?.length ?? 0 },
    { key: "elevenlabs", label: "ElevenLabs", count: VOICES.length },
    { key: "cloned", label: "Cloned", count: clones.length },
  ];

  function renderCard(voice: ElevenLabsVoice, highlight = false) {
    return (
      <VoiceCard
        key={voice.voiceId}
        voice={voice}
        selected={voice.voiceId === selectedVoiceId}
        highlight={highlight}
        saved={savedIds.has(voice.voiceId)}
        onSelect={() => select(voice)}
        onPlay={() => void playPreview(voice)}
        onToggleSave={() => void toggleSaved(voice)}
        isPreviewLoading={previewingId === voice.voiceId}
        isPreviewPlaying={playingId === voice.voiceId}
      />
    );
  }

  // The pasted id, as a full-width card of its own between the search box
  // and the tabs.
  const voiceIdCard =
    typedVoiceId
      ? typedLookup?.status === "ok"
        ? renderCard(typedLookup.voice, true)
        : (
            <VoiceIdCard
              key={`id-${typedVoiceId}`}
              voiceId={typedVoiceId}
              status={typedLookup?.status === "unavailable" ? "unavailable" : typedLookup?.status === "error" ? "error" : "checking"}
              onRetry={() => retryLookup(typedVoiceId)}
            />
          )
      : null;

  const visibleError = error ?? cloneError;
  const grid = "grid grid-cols-1 gap-2.5 sm:grid-cols-2";

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onClick={onClose}>
      <audio ref={audioRef} className="hidden" onEnded={() => setPlayingId(null)} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="voice-library-title"
        className="flex h-[min(88vh,840px)] w-full max-w-4xl flex-col overflow-hidden rounded-3xl bg-surface shadow-[0_24px_64px_-16px_rgba(16,24,40,0.3)] dark:ring-1 dark:ring-white/[0.08]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 px-5 pt-5 sm:px-6 sm:pt-6">
          <div>
            <h2 id="voice-library-title" className="text-lg font-semibold text-heading">
              Select a voice
            </h2>
            <p className="mt-1 text-sm text-subtle">Choose a saved, ElevenLabs, or cloned voice.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-hairline text-heading transition-colors hover:bg-(--app-fill)"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 pt-4 sm:px-6">
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search your voices by name, or paste an ElevenLabs voice ID"
              aria-label="Search voices"
              autoFocus
              className="h-11 w-full rounded-xl border border-hairline bg-surface pl-11 pr-10 text-sm text-heading outline-none placeholder:text-subtle transition-colors focus:border-primary/50 focus:ring-2 focus:ring-primary/15"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                aria-label="Clear search"
                className="absolute right-3 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-subtle hover:bg-(--app-fill) hover:text-heading"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          {voiceIdCard && <div className="mt-3">{voiceIdCard}</div>}
        </div>

        <div className="mt-5 flex shrink-0 gap-5 overflow-x-auto sm:gap-7 border-b border-hairline px-5 sm:px-6">
          {tabs.map(({ key, label, count }) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              aria-pressed={tab === key}
              className={cn(
                "-mb-px flex shrink-0 items-center gap-2 border-b-2 pb-3.5 text-[15px] font-semibold transition-colors",
                tab === key ? "border-primary text-heading" : "border-transparent text-subtle hover:text-heading"
              )}
            >
              {label}
              <span
                className={cn(
                  "min-w-6 rounded-full px-2 py-0.5 text-center text-xs font-semibold tabular-nums",
                  tab === key ? "bg-primary/10 text-primary" : "bg-(--app-fill-strong) text-subtle"
                )}
              >
                {count}
              </span>
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          {visibleError && (
            <p className="mb-4 rounded-xl bg-danger-tint px-4 py-2.5 text-sm font-medium text-danger" role="alert">
              {visibleError}
            </p>
          )}

          {tab === "saved" &&
            (savedVoices === null ? (
              <div className="flex justify-center py-14">
                <Loader2 className="h-5 w-5 animate-spin text-subtle" />
              </div>
            ) : visibleSaved.length > 0 ? (
              <div className={grid}>{visibleSaved.map((voice) => renderCard(voice))}</div>
            ) : savedVoices.length === 0 ? (
              <EmptyState title="No saved voices yet" body="Tap the heart on any voice to keep it here." />
            ) : (
              <EmptyState title="No matches" body="None of your saved voices match that search." />
            ))}

          {tab === "elevenlabs" && (
            <>
              {visibleDefaults.length > 0 || libraryMatches.length > 0 ? (
                <div className={grid}>
                  {visibleDefaults.map((voice) => renderCard(voice))}
                  {libraryMatches.map((voice) => renderCard(voice))}
                </div>
              ) : (
                !isLibraryLoading && <EmptyState title="No matches" body="Try another name, or paste an ElevenLabs voice ID." />
              )}
              {isLibraryLoading && (
                <div className="flex justify-center py-6">
                  <Loader2 className="h-5 w-5 animate-spin text-subtle" />
                </div>
              )}
              {wantsLibrary && !isLibraryLoading && libraryResult?.hasMore && (
                <div className="mt-4 flex justify-center">
                  <button
                    type="button"
                    onClick={() => void loadMoreLibrary()}
                    disabled={isLoadingMore}
                    className="flex items-center gap-2 rounded-full border border-hairline px-4 py-2 text-sm font-semibold text-heading transition-colors hover:bg-(--app-fill) disabled:opacity-60"
                  >
                    {isLoadingMore && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    Load more voices
                  </button>
                </div>
              )}
            </>
          )}

          {tab === "cloned" &&
            (!VOICE_CLONING_ENABLED ? (
              <EmptyState title="No cloned voices" body="Voice cloning is coming soon. Your cloned voices will show up here." />
            ) : (
              <>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <p className="text-[15px] text-body">Voices you cloned from your own audio samples.</p>
                <button
                  type="button"
                  onClick={onAddVoice}
                  className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-btn-primary px-4 text-sm font-semibold text-white shadow-[0_1px_2px_rgba(16,24,40,0.15),inset_0_1px_0_rgba(255,255,255,0.18)] transition-colors hover:bg-btn-primary-hover"
                >
                  <Plus className="h-4 w-4" /> Clone a voice
                </button>
              </div>
              {clones.length === 0 ? (
                <p className="text-[15px] text-subtle">No cloned voices yet.</p>
              ) : visibleClones.length === 0 ? (
                <p className="text-[15px] text-subtle">None of your cloned voices match that search.</p>
              ) : (
              <div className={grid}>
                {visibleClones.map((clone) => {
                  const selected = `clone:${clone.id}` === selectedVoiceId;
                  return (
                    <div
                      key={clone.id}
                      role="button"
                      tabIndex={0}
                      aria-pressed={selected}
                      onClick={() => {
                        onSelectClone(clone);
                        onClose();
                      }}
                      onKeyDown={(event) => {
                        if (event.target !== event.currentTarget) return;
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          onSelectClone(clone);
                          onClose();
                        }
                      }}
                      className={cn(CARD, "cursor-pointer focus-visible:ring-2 focus-visible:ring-primary/30", cardState(selected))}
                    >
                      {clone.hasPreview ? (
                        <PlayButton
                          label={playingCloneId === clone.id ? `Stop ${clone.name} preview` : `Preview ${clone.name}`}
                          isLoading={previewingCloneId === clone.id}
                          isPlaying={playingCloneId === clone.id}
                          onClick={() => onPlayClone(clone)}
                        />
                      ) : (
                        <span className="h-9 w-9 shrink-0" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[15px] font-semibold text-heading">{clone.name}</p>
                        <p className="mt-0.5 truncate text-[13px] text-subtle">
                          {[clone.gender, clone.language === "Automatic" ? "multilingual" : clone.language.toLowerCase(), "cloned"].join(" · ")}
                        </p>
                      </div>
                      {confirmingDeleteId === clone.id ? (
                        <div className="flex shrink-0 items-center gap-1" onClick={(event) => event.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => {
                              setConfirmingDeleteId(null);
                              onDeleteClone(clone);
                            }}
                            className="rounded-lg px-2.5 py-1.5 text-sm font-semibold text-danger transition-colors hover:bg-danger-tint"
                          >
                            Delete
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmingDeleteId(null)}
                            className="rounded-lg px-2.5 py-1.5 text-sm font-medium text-subtle transition-colors hover:bg-(--app-fill) hover:text-heading"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            setConfirmingDeleteId(clone.id);
                          }}
                          disabled={deletingCloneId === clone.id}
                          aria-label={`Delete ${clone.name}`}
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-subtle transition-colors hover:bg-danger-tint hover:text-danger disabled:opacity-50"
                        >
                          {deletingCloneId === clone.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
              )}
              </>
            ))}
        </div>
      </div>
    </div>,
    document.body
  );
}
