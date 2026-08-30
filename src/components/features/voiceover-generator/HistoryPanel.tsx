"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Calendar,
  Check,
  ChevronDown,
  CircleCheck,
  Download,
  History as HistoryIcon,
  Loader2,
  Mic2,
  Pause,
  Play,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { IconButton } from "@/components/ui/IconButton";
import { VOICE_OPTIONS } from "@/lib/config/voices";
import { exportSegmentsAsWav } from "@/lib/client/audio-export";
import { cn, downloadBlob } from "@/lib/utils";

export interface VoiceoverHistoryItem {
  id: string;
  title: string;
  voiceId: string;
  generationMode: "line_by_line" | "all_at_once";
  languageCode: string;
  status: "generating" | "completed" | "failed";
  errorMessage: string | null;
  creditsQuoted: number;
  createdAt: string;
  scriptPreview: string;
  segmentCount: number;
  durationSeconds: number;
}

type DateFilter = "any" | "today" | "7d" | "30d";
type StatusFilter = "any" | "completed" | "failed" | "generating";

const DATE_FILTER_OPTIONS: { value: DateFilter; label: string }[] = [
  { value: "any", label: "Any time" },
  { value: "today", label: "Today" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
];

const STATUS_FILTER_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "any", label: "Any status" },
  { value: "completed", label: "Completed" },
  { value: "failed", label: "Failed" },
  { value: "generating", label: "Generating" },
];

function dateFromForFilter(filter: DateFilter): string | null {
  const now = new Date();
  switch (filter) {
    case "today":
      return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    case "7d":
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    case "30d":
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    default:
      return null;
  }
}

function dateGroupLabel(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return date.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
}

function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months === 1 ? "" : "s"} ago`;
  const years = Math.floor(months / 12);
  return `${years} year${years === 1 ? "" : "s"} ago`;
}

function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function segmentUrl(id: string, index: number): string {
  return `/api/generate-voiceover/${id}/segments/${index}`;
}

// Compact, equal-width filter pill -- built for this row specifically rather
// than reusing PillDropdown, whose padding/label-prefix are sized for wider
// contexts and don't fit three across the 360px sidebar column without
// wrapping. `options[0]` is treated as the "unset" state: the chip shows the
// bare category label (muted) until a real value is picked, then swaps to
// showing that value (tinted), so it reads like the competitor's "+ Voice"
// idle chips without needing a separate placeholder string per filter.
function FilterChip({
  icon: Icon,
  label,
  value,
  options,
  onChange,
  align = "left",
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const isActive = value !== options[0]?.value;

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative min-w-0 flex-1">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          "flex w-full items-center gap-1 rounded-full border px-2.5 py-1.5 text-[11px] font-medium shadow-card outline-none transition-colors",
          isActive
            ? "border-primary/30 bg-accent/70 text-primary"
            : "border-hairline bg-surface text-subtle hover:border-primary/25 hover:text-heading",
          open && "border-primary/50 ring-2 ring-primary/15"
        )}
      >
        <Icon className="h-3 w-3 shrink-0" />
        <span className="min-w-0 flex-1 truncate text-left">{isActive ? options.find((o) => o.value === value)?.label : label}</span>
        <ChevronDown className={cn("h-3 w-3 shrink-0 transition-transform duration-150", open && "rotate-180")} />
      </button>

      {open && (
        <div
          role="listbox"
          className={cn(
            "absolute top-full z-50 mt-1.5 max-h-64 w-44 overflow-y-auto rounded-xl border border-hairline bg-surface p-1 shadow-[0_20px_45px_-12px_rgba(15,23,42,0.18)] dark:shadow-[0_24px_60px_-12px_rgba(0,0,0,0.65)]",
            align === "right" ? "right-0" : "left-0"
          )}
        >
          {options.map((option) => {
            const selected = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors",
                  selected ? "bg-accent font-semibold text-primary" : "text-body hover:bg-app"
                )}
              >
                <span className="min-w-0 flex-1 truncate">{option.label}</span>
                {selected && <Check className="h-3 w-3 shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function HistoryPanel({
  onSelect,
  selectingId,
  refreshSignal,
}: {
  onSelect: (item: VoiceoverHistoryItem) => void;
  selectingId?: string | null;
  refreshSignal?: number;
}) {
  const [items, setItems] = useState<VoiceoverHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchInput, setSearchInput] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [voiceFilter, setVoiceFilter] = useState("any");
  const [dateFilter, setDateFilter] = useState<DateFilter>("any");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("any");

  const [playingId, setPlayingId] = useState<string | null>(null);
  const [playingIndex, setPlayingIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedQuery(searchInput), 350);
    return () => clearTimeout(handle);
  }, [searchInput]);

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    setError(null);
    (async () => {
      try {
        const params = new URLSearchParams();
        if (debouncedQuery.trim()) params.set("q", debouncedQuery.trim());
        if (voiceFilter !== "any") params.set("voiceId", voiceFilter);
        if (statusFilter !== "any") params.set("status", statusFilter);
        const from = dateFromForFilter(dateFilter);
        if (from) params.set("from", from);

        const response = await fetch(`/api/generate-voiceover?${params.toString()}`, { signal: controller.signal });
        const data = await response.json().catch(() => null);
        if (!response.ok) throw new Error(data?.error ?? "Could not load history");
        setItems(data.generations ?? []);
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : "Could not load history");
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    })();
    return () => controller.abort();
  }, [debouncedQuery, voiceFilter, dateFilter, statusFilter, refreshSignal]);

  const voiceFilterOptions = useMemo(
    () => [{ value: "any", label: "Any voice" }, ...VOICE_OPTIONS.map((voice) => ({ value: voice.id, label: voice.id }))],
    []
  );

  const groups = useMemo(() => {
    const map = new Map<string, VoiceoverHistoryItem[]>();
    for (const item of items) {
      const label = dateGroupLabel(item.createdAt);
      if (!map.has(label)) map.set(label, []);
      map.get(label)!.push(item);
    }
    return Array.from(map.entries());
  }, [items]);

  const hasActiveFilters = searchInput.trim() !== "" || voiceFilter !== "any" || dateFilter !== "any" || statusFilter !== "any";

  function clearFilters() {
    setSearchInput("");
    setVoiceFilter("any");
    setDateFilter("any");
    setStatusFilter("any");
  }

  function togglePlay(item: VoiceoverHistoryItem) {
    if (item.segmentCount === 0 || !audioRef.current) return;
    if (playingId === item.id) {
      if (isPlaying) audioRef.current.pause();
      else void audioRef.current.play();
      return;
    }
    setPlayingId(item.id);
    setPlayingIndex(0);
    audioRef.current.src = segmentUrl(item.id, 0);
    void audioRef.current.play();
  }

  function handleEnded() {
    const item = items.find((i) => i.id === playingId);
    if (!item || !audioRef.current) {
      setPlayingId(null);
      return;
    }
    const nextIndex = playingIndex + 1;
    if (nextIndex < item.segmentCount) {
      setPlayingIndex(nextIndex);
      audioRef.current.src = segmentUrl(item.id, nextIndex);
      void audioRef.current.play();
    } else {
      setPlayingId(null);
      setPlayingIndex(0);
    }
  }

  async function handleDownload(item: VoiceoverHistoryItem) {
    if (item.segmentCount === 0 || downloadingId) return;
    setDownloadingId(item.id);
    setError(null);
    try {
      const urls = Array.from({ length: item.segmentCount }, (_, i) => segmentUrl(item.id, i));
      const blob = await exportSegmentsAsWav(urls);
      downloadBlob(blob, `${(item.title || "voiceover").trim().replace(/\s+/g, "-").toLowerCase()}.wav`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not export audio");
    } finally {
      setDownloadingId(null);
    }
  }

  async function handleDelete(item: VoiceoverHistoryItem) {
    if (deletingId) return;
    setDeletingId(item.id);
    try {
      const response = await fetch(`/api/generate-voiceover?id=${item.id}`, { method: "DELETE" });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error ?? "Could not delete generation");
      }
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      if (playingId === item.id) {
        audioRef.current?.pause();
        setPlayingId(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete generation");
    } finally {
      setDeletingId(null);
      setConfirmingDeleteId(null);
    }
  }

  return (
    <div className="flex h-full max-h-[720px] flex-col rounded-2xl border border-hairline bg-white shadow-card dark:bg-white/[0.015]">
      <audio
        ref={audioRef}
        className="hidden"
        onEnded={handleEnded}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
      />

      <div className="space-y-3 border-b border-hairline p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-subtle" />
          <input
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search history..."
            className="w-full rounded-xl border border-hairline bg-surface py-2.5 pl-9 pr-3 text-sm text-heading shadow-card outline-none placeholder:text-subtle transition-colors focus:border-primary/50 focus:ring-2 focus:ring-primary/15"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <FilterChip icon={Mic2} label="Voice" value={voiceFilter} options={voiceFilterOptions} onChange={setVoiceFilter} />
          <FilterChip
            icon={Calendar}
            label="Date"
            value={dateFilter}
            options={DATE_FILTER_OPTIONS}
            onChange={(value) => setDateFilter(value as DateFilter)}
          />
          <FilterChip
            icon={CircleCheck}
            label="Status"
            value={statusFilter}
            options={STATUS_FILTER_OPTIONS}
            onChange={(value) => setStatusFilter(value as StatusFilter)}
            align="right"
          />
        </div>
        {hasActiveFilters && (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={clearFilters}
              className="flex items-center gap-1 text-[11px] font-semibold text-subtle transition-colors hover:text-danger"
            >
              <X className="h-3 w-3" /> Clear filters
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {error && (
          <p className="mb-2 rounded-xl bg-danger-tint px-3 py-2 text-xs font-medium text-danger" role="alert">
            {error}
          </p>
        )}

        {isLoading && items.length === 0 ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-subtle" />
          </div>
        ) : groups.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
            <HistoryIcon className="h-6 w-6 text-subtle" />
            <p className="text-sm font-semibold text-heading">{hasActiveFilters ? "No matches" : "No voiceovers yet"}</p>
            <p className="text-xs text-subtle">
              {hasActiveFilters ? "Try a different search or filter." : "Generations you create will show up here."}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {groups.map(([label, groupItems]) => (
              <div key={label}>
                <p className="mb-1 px-1 text-[11px] font-semibold uppercase tracking-wide text-subtle">{label}</p>
                <div className="space-y-0.5">
                  {groupItems.map((item) => {
                    const isSelecting = selectingId === item.id;
                    return (
                      <div
                        key={item.id}
                        className={cn(
                          "group flex w-full items-start gap-2.5 rounded-xl border border-transparent px-2.5 py-2.5 transition-colors",
                          playingId === item.id ? "border-primary/30 bg-accent/50" : "hover:border-hairline hover:bg-surface"
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => item.status === "completed" && !isSelecting && onSelect(item)}
                          disabled={item.status !== "completed"}
                          className="flex min-w-0 flex-1 items-start gap-2.5 text-left disabled:cursor-default"
                        >
                          <Avatar name={item.voiceId} size="sm" hideInitials className="mt-0.5 shrink-0 ring-2 ring-surface shadow-sm" />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <p className="truncate text-xs font-semibold text-heading">{item.title || item.voiceId}</p>
                              {item.status === "failed" && <Badge variant="danger">Failed</Badge>}
                              {item.status === "generating" && <Badge variant="warning">Generating</Badge>}
                            </div>
                            <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-body">
                              {item.scriptPreview || "(empty script)"}
                            </p>
                            <div className="mt-1 flex items-center gap-1.5 text-[10px] font-medium text-subtle">
                              <span>{formatRelativeTime(item.createdAt)}</span>
                              {item.status === "completed" && (
                                <>
                                  <span>·</span>
                                  <span>
                                    {item.segmentCount} segment{item.segmentCount === 1 ? "" : "s"}
                                  </span>
                                  <span>·</span>
                                  <span>{formatDuration(item.durationSeconds)}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </button>

                        <div className="flex shrink-0 items-center gap-0.5">
                          {isSelecting ? (
                            <Loader2 className="mt-1 h-3.5 w-3.5 animate-spin text-primary" />
                          ) : (
                            <>
                              {item.status === "completed" && (
                                <>
                                  <IconButton
                                    title={playingId === item.id && isPlaying ? "Pause" : "Play"}
                                    onClick={() => togglePlay(item)}
                                    active={playingId === item.id}
                                  >
                                    {playingId === item.id && isPlaying ? (
                                      <Pause className="h-3.5 w-3.5" />
                                    ) : (
                                      <Play className="h-3.5 w-3.5" />
                                    )}
                                  </IconButton>
                                  <IconButton
                                    title="Download"
                                    onClick={() => handleDownload(item)}
                                    disabled={downloadingId === item.id}
                                  >
                                    {downloadingId === item.id ? (
                                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                      <Download className="h-3.5 w-3.5" />
                                    )}
                                  </IconButton>
                                </>
                              )}
                              {confirmingDeleteId === item.id ? (
                                <>
                                  <IconButton
                                    title="Confirm delete"
                                    destructive
                                    disabled={deletingId === item.id}
                                    onClick={() => handleDelete(item)}
                                  >
                                    {deletingId === item.id ? (
                                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                      <Check className="h-3.5 w-3.5" />
                                    )}
                                  </IconButton>
                                  <IconButton title="Cancel" onClick={() => setConfirmingDeleteId(null)}>
                                    <X className="h-3.5 w-3.5" />
                                  </IconButton>
                                </>
                              ) : (
                                <IconButton title="Delete" destructive onClick={() => setConfirmingDeleteId(item.id)}>
                                  <Trash2 className="h-3.5 w-3.5" />
                                </IconButton>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
