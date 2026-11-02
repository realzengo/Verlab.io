"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { Check, Loader2, Pause, Play, Plus, Search, Trash2, X } from "lucide-react";
import { VOICES, type ElevenLabsVoice } from "@/lib/config/elevenlabs";
import { VOICE_CLONING_ENABLED } from "@/lib/config/voices";
import { cn } from "@/lib/utils";
import type { VoiceCloneSummary } from "./AddVoiceModal";

type VoiceTab = "voices" | "cloned";
type GenderFilter = "All" | "Male" | "Female";

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

// "Male · British" from the labels we have for the voice.
export function voiceMeta(voice: ElevenLabsVoice): string {
  return [voice.gender && capitalize(voice.gender), voice.accent].filter(Boolean).join(" · ");
}

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
        "flex h-11 w-11 shrink-0 items-center justify-center rounded-full ring-1 ring-inset transition-all duration-200 hover:scale-105 active:scale-[0.94]",
        isPlaying
          ? "bg-primary text-white ring-primary shadow-[0_2px_8px_rgba(51,92,255,0.45)]"
          : "bg-surface text-heading ring-hairline hover:text-primary hover:ring-primary/40"
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

function VoiceTile({
  voice,
  selected,
  onSelect,
  onPlay,
  isPreviewLoading,
  isPreviewPlaying,
}: {
  voice: ElevenLabsVoice;
  selected: boolean;
  onSelect: () => void;
  onPlay: () => void;
  isPreviewLoading: boolean;
  isPreviewPlaying: boolean;
}) {
  const meta = voiceMeta(voice);
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect();
        }
      }}
      className={cn(
        "flex w-full cursor-pointer items-center gap-3.5 rounded-2xl border p-3.5 text-left outline-none transition-all duration-200 focus-visible:ring-2 focus-visible:ring-primary/30",
        selected
          ? "border-primary/60 bg-accent/70 shadow-[0_0_0_1px_var(--color-primary)] dark:bg-primary/[0.1]"
          : "border-hairline bg-surface hover:border-primary/30"
      )}
    >
      <PlayButton
        label={isPreviewPlaying ? `Stop ${voice.name} preview` : `Preview ${voice.name}`}
        isLoading={isPreviewLoading}
        isPlaying={isPreviewPlaying}
        onClick={onPlay}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-heading">{voice.name}</p>
        <p className="truncate text-xs text-subtle">{[meta, voice.description].filter(Boolean).join(" · ")}</p>
      </div>
      {selected && <Check className="h-4 w-4 shrink-0 text-primary" strokeWidth={3} />}
    </div>
  );
}

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
  const [tab, setTab] = useState<VoiceTab>("voices");
  const [search, setSearch] = useState("");
  const [gender, setGender] = useState<GenderFilter>("All");
  const genderPillId = useId();

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

  const visibleVoices = useMemo(() => {
    const query = search.trim().toLowerCase();
    return VOICES.filter((voice) => {
      if (gender !== "All" && voice.gender !== gender.toLowerCase()) return false;
      if (!query) return true;
      return [voice.name, voice.accent ?? "", voice.description, voice.gender ?? ""].some((field) => field.toLowerCase().includes(query));
    });
  }, [search, gender]);

  const visibleClones = useMemo(() => {
    const query = search.trim().toLowerCase();
    return query ? clones.filter((clone) => clone.name.toLowerCase().includes(query)) : clones;
  }, [clones, search]);

  // Each voice's sample is rendered once through Replicate and cached (see
  // /api/voices/preview), so only the very first play of a voice is slow.
  async function playPreview(voice: ElevenLabsVoice) {
    const audio = audioRef.current;
    if (!audio) return;
    if (playingId === voice.voiceId) {
      audio.pause();
      setPlayingId(null);
      return;
    }
    setPreviewingId(voice.voiceId);
    setError(null);
    try {
      const response = await fetch(`/api/voices/preview?voiceId=${encodeURIComponent(voice.voiceId)}`, { signal: AbortSignal.timeout(130_000) });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error ?? `Could not load preview (${response.status})`);
      audio.src = data.url;
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
    { key: "voices", label: "ElevenLabs", count: VOICES.length },
    ...(VOICE_CLONING_ENABLED ? [{ key: "cloned" as const, label: "Cloned", count: clones.length }] : []),
  ];

  function renderTile(voice: ElevenLabsVoice) {
    return (
      <VoiceTile
        key={voice.voiceId}
        voice={voice}
        selected={voice.voiceId === selectedVoiceId}
        onSelect={() => select(voice)}
        onPlay={() => playPreview(voice)}
        isPreviewLoading={previewingId === voice.voiceId}
        isPreviewPlaying={playingId === voice.voiceId}
      />
    );
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onClick={onClose}>
      <audio ref={audioRef} className="hidden" onEnded={() => setPlayingId(null)} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="voice-library-title"
        className="flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl bg-surface shadow-card-hover"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 px-5 pt-5 sm:px-7 sm:pt-6">
          <div>
            <h2 id="voice-library-title" className="text-lg font-semibold text-heading">
              Select a voice
            </h2>
            <p className="mt-1 text-sm text-subtle">Choose an ElevenLabs voice{VOICE_CLONING_ENABLED ? " or one of your cloned voices" : ""}.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-hairline text-subtle transition-colors hover:text-heading"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 pt-4 sm:px-7">
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search voices by name, accent or style"
              autoFocus
              className="w-full rounded-2xl border border-hairline bg-surface py-3 pl-11 pr-10 text-sm text-heading outline-none placeholder:text-subtle transition-colors focus:border-primary/60 focus:ring-2 focus:ring-primary/15"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                aria-label="Clear search"
                className="absolute right-3 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-subtle hover:bg-accent hover:text-heading"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-end justify-between gap-x-4 gap-y-2 border-b border-hairline px-5 sm:px-7">
          <div className="flex gap-5">
            {tabs.map(({ key, label, count }) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={cn(
                  "flex items-center gap-2 border-b-2 pb-3 pt-1 text-sm font-semibold transition-colors",
                  tab === key ? "border-primary text-heading" : "border-transparent text-subtle hover:text-heading"
                )}
              >
                {label}
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums",
                    tab === key ? "bg-primary/10 text-primary" : "bg-app text-subtle dark:bg-white/5"
                  )}
                >
                  {count}
                </span>
              </button>
            ))}
          </div>
          {tab === "voices" && (
            <div className="mb-2 flex rounded-full bg-app p-1 dark:bg-white/5">
              {(["All", "Male", "Female"] as const).map((option) => (
                <button key={option} type="button" onClick={() => setGender(option)} className="relative rounded-full px-3 py-1 text-xs font-semibold">
                  {gender === option && (
                    <motion.span
                      layoutId={`${genderPillId}-active`}
                      transition={{ type: "spring", stiffness: 500, damping: 34 }}
                      className="absolute inset-0 rounded-full bg-surface shadow-card"
                    />
                  )}
                  <span className={cn("relative z-10 transition-colors", gender === option ? "text-heading" : "text-subtle hover:text-heading")}>{option}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-7">
          {(error || cloneError) && (
            <p className="mb-4 rounded-xl bg-danger-tint px-4 py-2.5 text-sm font-medium text-danger" role="alert">
              {error ?? cloneError}
            </p>
          )}

          {tab === "voices" &&
            (visibleVoices.length > 0 ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{visibleVoices.map(renderTile)}</div>
            ) : (
              <p className="py-16 text-center text-sm text-subtle">No voices match your search.</p>
            ))}

          {tab === "cloned" && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={onAddVoice}
                className="flex min-h-[74px] items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-hairline text-sm font-medium text-body transition-colors hover:border-primary/40 hover:bg-accent/40 hover:text-primary"
              >
                <Plus className="h-4 w-4" /> Add Your Voice
              </button>
              {visibleClones.map((clone) => {
                const selected = `clone:${clone.id}` === selectedVoiceId;
                return (
                  <div
                    key={clone.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      onSelectClone(clone);
                      onClose();
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onSelectClone(clone);
                        onClose();
                      }
                    }}
                    className={cn(
                      "flex cursor-pointer items-center gap-3.5 rounded-2xl border p-3.5 outline-none transition-all duration-200 focus-visible:ring-2 focus-visible:ring-primary/30",
                      selected
                        ? "border-primary/60 bg-accent/70 shadow-[0_0_0_1px_var(--color-primary)] dark:bg-primary/[0.1]"
                        : "border-hairline bg-surface hover:border-primary/30"
                    )}
                  >
                    <PlayButton
                      label={playingCloneId === clone.id ? `Stop ${clone.name} preview` : `Preview ${clone.name}`}
                      isLoading={previewingCloneId === clone.id}
                      isPlaying={playingCloneId === clone.id}
                      onClick={() => onPlayClone(clone)}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-heading">{clone.name}</p>
                      <p className="truncate text-xs text-subtle">Cloned from your audio</p>
                    </div>
                    {selected && <Check className="h-4 w-4 shrink-0 text-primary" strokeWidth={3} />}
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onDeleteClone(clone);
                      }}
                      disabled={deletingCloneId === clone.id}
                      aria-label={`Delete ${clone.name}`}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-subtle transition-colors hover:text-danger disabled:opacity-50"
                    >
                      {deletingCloneId === clone.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
