"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import useSWR, { mutate as globalMutate } from "swr";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowUpDown,
  Check,
  Download,
  ExternalLink,
  FileText,
  Film,
  Filter,
  FolderOpen,
  ImageIcon,
  type LucideIcon,
  Mic2,
  MoreHorizontal,
  Pause,
  Play,
  Trash2,
  X,
} from "lucide-react";
import { setBendSaved } from "@/lib/api/niche-bend";
import type { LibraryAsset, LibraryAssetType } from "@/lib/types";
import { cn, downloadBlob, formatBytes, formatRelativeTime } from "@/lib/utils";
import { exportSegmentsAsWav } from "@/lib/client/audio-export";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

function voiceoverSegmentUrl(generationId: string, index: number): string {
  return `/api/generate-voiceover/${generationId}/segments/${index}`;
}

function formatSeconds(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// Stitched voiceover segments aren't decoded client-side, so there's no real
// amplitude data to draw -- this renders a stable, per-asset "waveform" look
// (seeded off the generation id, so it doesn't reshuffle on re-render) rather
// than a flat progress bar. A light moving-average pass turns raw noise into
// something that reads as a natural envelope instead of static.
function generateWaveform(seed: string, count: number): number[] {
  let state = 0;
  for (let i = 0; i < seed.length; i++) {
    state = (state * 31 + seed.charCodeAt(i)) >>> 0;
  }
  if (state === 0) state = 1;
  function next(): number {
    state ^= state << 13;
    state >>>= 0;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return state / 4294967295;
  }
  const raw = Array.from({ length: count }, () => 0.18 + next() * 0.82);
  return raw.map((value, i) => {
    const neighbors = [raw[i - 1], value, raw[i + 1]].filter((v): v is number => v !== undefined);
    return neighbors.reduce((sum, v) => sum + v, 0) / neighbors.length;
  });
}

async function fetchVoiceoverSegmentDurations(generationId: string): Promise<number[]> {
  const response = await fetch(`/api/generate-voiceover?id=${generationId}`);
  const data = await response.json().catch(() => null);
  const segments: { durationSeconds?: number }[] = data?.generations?.[0]?.segments ?? [];
  return segments.map((segment) => segment.durationSeconds ?? 0);
}

// Every tab x sort combination /api/library?type=...&sort=... gets its own
// cache entry, so a delete has to patch all of them (not just whichever's
// currently visible) or a stale copy of the deleted asset reappears the
// moment the user switches to a tab that still has the old cached array.
function removeAssetFromLibraryCache(assetId: string) {
  globalMutate(
    (key) => typeof key === "string" && key.startsWith("/api/library?"),
    (data: { assets: LibraryAsset[] } | undefined) =>
      data ? { assets: data.assets.filter((asset) => asset.id !== assetId) } : data,
    { revalidate: false }
  );
}

type TabValue = "all" | "image" | "video" | "sop" | "voiceover";

const TABS: { value: TabValue; label: string }[] = [
  { value: "all", label: "All" },
  { value: "image", label: "Images" },
  { value: "video", label: "Video" },
  { value: "voiceover", label: "Voiceovers" },
];

// Type is said once: the tabs filter by it, and on a tile only the non-image
// kinds carry a tag (a picture already reads as a picture).
const TYPE_META: Record<LibraryAssetType, { label: string; icon: LucideIcon }> = {
  image: { label: "Image", icon: ImageIcon },
  video: { label: "Video", icon: Film },
  sop: { label: "SOP", icon: FileText },
  voiceover: { label: "Voiceover", icon: Mic2 },
};

const SORT_OPTIONS: { value: "newest" | "oldest"; label: string }[] = [
  { value: "newest", label: "Last updated" },
  { value: "oldest", label: "Oldest first" },
];

// Pixel widths passed to /api/library/image/.../route.ts?w=, which resizes
// server-side (via sharp) and returns webp. That route requires a Supabase
// session, so it can't be routed through next/image's built-in optimizer --
// the optimizer's internal fetch doesn't forward cookies, which 401s and
// renders as a broken image. Sized generously for high-DPI screens.
const GRID_THUMB_WIDTH = 480;
const PREVIEW_THUMB_WIDTH = 960;

function downloadDataUrl(dataUrl: string, filename: string) {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  link.click();
}

function AssetPlaceholder({ type }: { type: LibraryAssetType }) {
  const Icon = TYPE_META[type].icon;
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <Icon className="h-6 w-6 text-subtle" aria-hidden="true" />
    </div>
  );
}

// Voiceover generations have no visual source (no thumbnailUrl, no fileUrl
// to snapshot), so the tile draws a per-asset waveform silhouette instead --
// same seeded generator as VoiceoverPreviewPlayer's, so a given voiceover
// looks the same in the grid as in the preview. Drawn in quiet ink on the
// tile's neutral ground so it sits with the image tiles around it.
function VoiceoverThumbnail({ asset }: { asset: LibraryAsset }) {
  const bars = useMemo(() => generateWaveform(asset.id, 22), [asset.id]);
  return (
    <div className="absolute inset-0 flex items-center justify-center px-[14%]">
      <div className="flex h-[36%] w-full items-center justify-center gap-[3px]">
        {bars.map((value, i) => (
          <span
            key={i}
            className="w-full max-w-[5px] rounded-full bg-heading/25 transition-colors duration-200 group-hover:bg-primary/70"
            style={{ height: `${16 + value * 84}%` }}
          />
        ))}
      </div>
    </div>
  );
}

function VideoThumbnail({ src }: { src: string }) {
  // Every card in the grid used to mount its <video> (and start fetching)
  // the moment it rendered, so a page full of videos fired that many
  // concurrent requests through the proxied /api/library/video/[id] route
  // (auth check + DB read + Supabase signed-URL mint + stream) all at once --
  // that pile-up is what made the grid feel slow to paint. Deferring the
  // `src` until the card is actually near the viewport spreads those
  // requests out instead of firing them all on mount.
  const containerRef = useRef<HTMLDivElement>(null);
  const [shouldLoad, setShouldLoad] = useState(false);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShouldLoad(true);
          observer.disconnect();
        }
      },
      { rootMargin: "400px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="absolute inset-0">
      {shouldLoad ? (
        <video
          src={src}
          muted
          loop
          playsInline
          preload="metadata"
          onMouseEnter={(event) => void event.currentTarget.play().catch(() => {})}
          onMouseLeave={(event) => event.currentTarget.pause()}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <AssetPlaceholder type="video" />
      )}
    </div>
  );
}

function AssetThumbnail({ asset, width }: { asset: LibraryAsset; width: number }) {
  if (asset.type === "video" && asset.fileUrl) {
    return <VideoThumbnail src={asset.fileUrl} />;
  }

  if (asset.type === "voiceover") {
    return <VoiceoverThumbnail asset={asset} />;
  }

  if (asset.thumbnailUrl) {
    // Our own /api/library/image/... route resizes server-side when a `w`
    // param is given, so the grid never pulls the full-resolution original.
    // Third-party avatar URLs (SOPs) aren't ours to resize, so those load
    // as-is -- they're already small.
    const isOwnOrigin = asset.thumbnailUrl.startsWith("/api/");
    const src = isOwnOrigin
      ? `${asset.thumbnailUrl}${asset.thumbnailUrl.includes("?") ? "&" : "?"}w=${width}`
      : asset.thumbnailUrl;

    return (
      // Generated media is shown whole (contain) on the tile's neutral ground
      // rather than cropped or padded out with a blurred copy of itself.
      // eslint-disable-next-line @next/next/no-img-element -- pre-resized by our own route (own-origin) or a small third-party avatar (SOP)
      <img
        src={src}
        alt={asset.title}
        loading="lazy"
        decoding="async"
        className={cn(
          "absolute inset-0 h-full w-full transition-transform duration-300 ease-out group-hover:scale-[1.02]",
          isOwnOrigin ? "object-contain" : "object-cover"
        )}
      />
    );
  }

  return <AssetPlaceholder type={asset.type} />;
}

function PlayIndicator() {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-black/55 text-white opacity-0 backdrop-blur-sm transition-opacity duration-200 group-hover:opacity-100">
        <Play className="h-4 w-4 translate-x-px" fill="currentColor" aria-hidden="true" />
      </span>
    </div>
  );
}

function TypeTag({ type }: { type: LibraryAssetType }) {
  const { label, icon: Icon } = TYPE_META[type];
  return (
    <span className="pointer-events-none absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-md bg-black/60 px-1.5 py-0.5 text-[11px] font-medium text-white backdrop-blur-sm">
      <Icon className="h-3 w-3" aria-hidden="true" />
      {label}
    </span>
  );
}

// Voiceover generations don't store one stitched audio file (segments are
// stitched client-side, see exportSegmentsAsWav) -- so previewing one plays
// its segments back to back through a single hidden <audio> element,
// advancing on `ended`, same sequencing approach as VoiceoverGenerator's
// playSequenceFrom/handleAudioEnded.
const WAVEFORM_BAR_COUNT = 48;

function VoiceoverPreviewPlayer({ asset }: { asset: LibraryAsset }) {
  const generationId = useMemo(() => asset.id.replace(/^voiceover-/, ""), [asset.id]);
  const waveform = useMemo(() => generateWaveform(generationId, WAVEFORM_BAR_COUNT), [generationId]);
  const [durations, setDurations] = useState<number[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [playingIndex, setPlayingIndex] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);
  const waveformRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // The library page keys this component on previewAsset.id (see the
    // preview modal below), so switching voiceovers remounts it fresh --
    // no manual state reset needed here, just the fetch.
    let cancelled = false;
    fetchVoiceoverSegmentDurations(generationId)
      .then((values) => {
        if (cancelled) return;
        if (values.length === 0) {
          setLoadError(true);
          return;
        }
        setDurations(values);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [generationId]);

  const totalDuration = durations?.reduce((sum, value) => sum + value, 0) ?? 0;
  const progress = totalDuration > 0 ? Math.min(1, currentTime / totalDuration) : 0;

  function playFrom(index: number) {
    if (!audioRef.current || !durations || index >= durations.length) return;
    audioRef.current.src = voiceoverSegmentUrl(generationId, index);
    setPlayingIndex(index);
    setIsPlaying(true);
    void audioRef.current.play();
  }

  function togglePlayPause() {
    if (!audioRef.current || !durations) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      return;
    }
    if (playingIndex !== null) {
      setIsPlaying(true);
      void audioRef.current.play();
      return;
    }
    playFrom(0);
  }

  function handleEnded() {
    if (playingIndex === null || !durations) return;
    const nextIndex = playingIndex + 1;
    if (nextIndex < durations.length) {
      playFrom(nextIndex);
    } else {
      setIsPlaying(false);
      setPlayingIndex(null);
      setCurrentTime(0);
    }
  }

  function handleTimeUpdate() {
    if (!audioRef.current || !durations || playingIndex === null) return;
    const priorDuration = durations.slice(0, playingIndex).reduce((sum, value) => sum + value, 0);
    setCurrentTime(priorDuration + audioRef.current.currentTime);
  }

  // Segments are separate files, so seeking has to land on the right one --
  // walk the cumulative durations to find which segment `target` falls in,
  // switch to it if needed, then wait for its metadata to load before
  // jumping to the in-segment offset (setting currentTime before a new src
  // has loaded is a no-op in most browsers).
  function seekToFraction(fraction: number) {
    if (!durations || !audioRef.current || totalDuration <= 0) return;
    const target = Math.min(totalDuration - 0.05, Math.max(0, fraction * totalDuration));
    const audio = audioRef.current;
    let elapsed = 0;
    for (let index = 0; index < durations.length; index++) {
      const segmentEnd = elapsed + durations[index];
      if (target < segmentEnd || index === durations.length - 1) {
        const offset = Math.max(0, target - elapsed);
        setCurrentTime(target);
        if (playingIndex !== index) {
          setPlayingIndex(index);
          audio.src = voiceoverSegmentUrl(generationId, index);
          const onLoaded = () => {
            audio.currentTime = offset;
            audio.removeEventListener("loadedmetadata", onLoaded);
          };
          audio.addEventListener("loadedmetadata", onLoaded);
        } else {
          audio.currentTime = offset;
        }
        if (isPlaying) void audio.play();
        return;
      }
      elapsed = segmentEnd;
    }
  }

  function handleWaveformClick(event: React.MouseEvent<HTMLDivElement>) {
    if (!durations || !waveformRef.current) return;
    const rect = waveformRef.current.getBoundingClientRect();
    seekToFraction((event.clientX - rect.left) / rect.width);
  }

  function handleWaveformKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (!durations || totalDuration <= 0) return;
    if (event.key === "ArrowRight") {
      event.preventDefault();
      seekToFraction((currentTime + 5) / totalDuration);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      seekToFraction((currentTime - 5) / totalDuration);
    }
  }

  return (
    <div className="flex w-full max-w-xs flex-col items-center gap-6 py-4">
      <audio ref={audioRef} onEnded={handleEnded} onTimeUpdate={handleTimeUpdate} className="hidden" />

      <button
        type="button"
        onClick={togglePlayPause}
        disabled={!durations}
        aria-label={isPlaying ? "Pause" : "Play"}
        className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-btn-primary text-white shadow-[0_1px_2px_rgba(16,24,40,0.15),inset_0_1px_0_rgba(255,255,255,0.18)] transition-colors hover:bg-btn-primary-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 active:scale-[0.97] disabled:opacity-40"
      >
        {isPlaying ? (
          <Pause className="h-5 w-5" fill="currentColor" aria-hidden="true" />
        ) : (
          <Play className="h-5 w-5 translate-x-0.5" fill="currentColor" aria-hidden="true" />
        )}
      </button>

      <div className="flex w-full flex-col gap-2">
        <div
          ref={waveformRef}
          onClick={handleWaveformClick}
          onKeyDown={handleWaveformKeyDown}
          role="slider"
          aria-label="Seek"
          aria-valuemin={0}
          aria-valuemax={Math.round(totalDuration)}
          aria-valuenow={Math.round(currentTime)}
          tabIndex={durations ? 0 : -1}
          className={cn(
            "flex h-14 w-full items-center gap-[3px] rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
            durations ? "cursor-pointer" : "cursor-default"
          )}
        >
          {waveform.map((height, index) => {
            const filled = durations !== null && index / (waveform.length - 1) <= progress;
            return (
              <span
                key={index}
                className={cn(
                  "min-w-[2px] flex-1 rounded-full transition-colors duration-150",
                  filled ? "bg-primary" : "bg-heading/15"
                )}
                style={{ height: `${12 + height * 88}%` }}
              />
            );
          })}
        </div>
        <div className="flex items-center justify-between text-xs font-medium tabular-nums text-subtle">
          <span>{formatSeconds(currentTime)}</span>
          <span>{durations ? formatSeconds(totalDuration) : "--:--"}</span>
        </div>
      </div>

      {loadError && <p className="text-xs font-medium text-danger">Could not load this voiceover&rsquo;s audio.</p>}
    </div>
  );
}

const GRID = "grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6";

// The media sits straight on a neutral square -- no card around it. The
// inset ring is drawn on ::after so it stays crisp over the image itself.
const TILE =
  "relative block aspect-square w-full cursor-pointer overflow-hidden rounded-xl bg-(--app-fill-strong) after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:ring-1 after:ring-black/[0.06] after:ring-inset focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 dark:after:ring-white/[0.06]";

const TOOLBAR_BUTTON =
  "flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-hairline bg-surface px-2.5 text-[13px] font-medium text-body transition-colors hover:text-heading dark:bg-white/[0.03]";

const MENU_PANEL = "absolute top-full right-0 z-20 mt-1.5 rounded-xl border border-hairline bg-surface p-1 shadow-card-hover";

const MENU_ROW =
  "flex w-full cursor-pointer items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[13px] transition-colors";

const EMPTY_TITLE: Record<TabValue, string> = {
  all: "Nothing here yet",
  image: "No images yet",
  video: "No videos yet",
  sop: "No SOPs yet",
  voiceover: "No voiceovers yet",
};

export default function LibraryPage() {
  const [activeTab, setActiveTab] = useState<TabValue>("all");
  const [sort, setSort] = useState<"newest" | "oldest">("newest");
  const [category, setCategory] = useState("all");
  const [previewAsset, setPreviewAsset] = useState<LibraryAsset | null>(null);

  const [categoryMenuOpen, setCategoryMenuOpen] = useState(false);
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const categoryMenuRef = useRef<HTMLDivElement>(null);
  const sortMenuRef = useRef<HTMLDivElement>(null);
  const actionMenuRef = useRef<HTMLDivElement>(null);

  // document.body isn't available during SSR -- only portal the preview
  // modal once mounted (same guard as UpgradeModal.tsx).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const { data: libraryData, error: libraryError } = useSWR<{ assets: LibraryAsset[] }>(
    `/api/library?type=${activeTab}&sort=${sort}`
  );
  const assets = libraryData?.assets ?? null;
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const error = deleteError ?? (libraryError ? "Couldn't load your library." : null);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (categoryMenuOpen && categoryMenuRef.current && !categoryMenuRef.current.contains(event.target as Node)) {
        setCategoryMenuOpen(false);
      }
      if (sortMenuOpen && sortMenuRef.current && !sortMenuRef.current.contains(event.target as Node)) {
        setSortMenuOpen(false);
      }
      if (openMenuId && actionMenuRef.current && !actionMenuRef.current.contains(event.target as Node)) {
        setOpenMenuId(null);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [categoryMenuOpen, sortMenuOpen, openMenuId]);

  const categories = useMemo(() => {
    if (!assets) return [];
    return Array.from(new Set(assets.map((asset) => asset.category).filter(Boolean))).sort();
  }, [assets]);

  const visibleAssets = useMemo(() => {
    if (!assets) return null;
    return category === "all" ? assets : assets.filter((asset) => asset.category === category);
  }, [assets, category]);

  async function handleDeleteAsset(asset: LibraryAsset) {
    setDeleteError(null);
    setOpenMenuId(null);
    // Optimistic: remove from every cached tab immediately, then roll back
    // (by revalidating) if the delete turns out not to have happened.
    removeAssetFromLibraryCache(asset.id);
    setPreviewAsset((prev) => (prev?.id === asset.id ? null : prev));
    try {
      if (asset.type === "sop") {
        const jobId = asset.id.replace(/^sop-/, "");
        await setBendSaved(jobId, false);
      } else if (asset.type === "voiceover") {
        const generationId = asset.id.replace(/^voiceover-/, "");
        const response = await fetch(`/api/generate-voiceover?id=${generationId}`, { method: "DELETE" });
        if (!response.ok) throw new Error();
      } else {
        // id is `image-${dbId}-${index}` -- dbId itself may contain dashes
        // (it's a uuid), so only the trailing `-<digits>` is the index.
        const match = asset.id.match(/^image-(.+)-(\d+)$/);
        if (!match) throw new Error();
        const [, dbId, index] = match;
        const response = await fetch(`/api/library/image/${dbId}/${index}`, { method: "DELETE" });
        if (!response.ok) throw new Error();
      }
    } catch {
      setDeleteError("Could not delete. Try again.");
      globalMutate((key) => typeof key === "string" && key.startsWith("/api/library?"));
    }
  }

  async function handleDownloadVoiceover(asset: LibraryAsset) {
    const generationId = asset.id.replace(/^voiceover-/, "");
    try {
      const durations = await fetchVoiceoverSegmentDurations(generationId);
      if (durations.length === 0) throw new Error();
      const urls = durations.map((_, index) => voiceoverSegmentUrl(generationId, index));
      const blob = await exportSegmentsAsWav(urls);
      const slug = asset.title.trim().slice(0, 40).replace(/\s+/g, "-").toLowerCase() || "voiceover";
      downloadBlob(blob, `${slug}.wav`);
    } catch {
      setDeleteError("Could not download audio. Try again.");
    }
    setOpenMenuId(null);
  }

  function handleDownload(asset: LibraryAsset) {
    if (asset.type === "voiceover") {
      void handleDownloadVoiceover(asset);
      return;
    }
    // Images only ever populate thumbnailUrl (see /api/library) -- fall
    // back to it here. It's a same-origin /api/library/image/... URL that
    // serves the actual bytes with a Content-Disposition filename, not a
    // data URL, so a plain anchor click is enough to trigger the download.
    const url = asset.fileUrl ?? (asset.type === "image" ? asset.thumbnailUrl : null);
    if (!url) return;
    if (url.startsWith("data:")) {
      const extension = url.slice(5, url.indexOf(";")).split("/")[1] ?? "jpg";
      const slug = asset.title.trim().slice(0, 40).replace(/\s+/g, "-") || "image";
      downloadDataUrl(url, `${slug}.${extension}`);
    } else if (asset.type === "image" || asset.type === "video") {
      // Both routes support ?download=1 to set a Content-Disposition
      // filename, same as the image route's own download handling above.
      const link = document.createElement("a");
      link.href = `${url}${url.includes("?") ? "&" : "?"}download=1`;
      link.click();
    } else {
      window.open(url, "_blank");
    }
    setOpenMenuId(null);
  }

  return (
    <div className="flex flex-col gap-6 pt-2 sm:pt-4">
      <header>
        <h1 className="text-2xl font-semibold tracking-[-0.02em] text-heading sm:text-[28px]">Library</h1>
        <p className="mt-1.5 text-sm text-subtle">Every image, video and voiceover you&rsquo;ve generated, in one place.</p>
      </header>

      <div className="flex flex-col-reverse gap-3 border-b border-hairline md:flex-row md:items-end md:justify-between">
        <div className="-mb-px flex gap-5 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => {
                setActiveTab(tab.value);
                // Categories come from the tab's own assets, so a pick from
                // the previous tab may not exist in this one.
                setCategory("all");
              }}
              aria-pressed={activeTab === tab.value}
              className={cn(
                "cursor-pointer border-b-2 pb-2.5 text-sm font-medium whitespace-nowrap transition-colors",
                activeTab === tab.value
                  ? "border-heading text-heading"
                  : "border-transparent text-subtle hover:text-heading"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 md:pb-2">
          {visibleAssets && visibleAssets.length > 0 && (
            <span className="mr-auto text-[13px] tabular-nums text-subtle md:mr-1">
              {visibleAssets.length} {visibleAssets.length === 1 ? "item" : "items"}
            </span>
          )}

          <div ref={categoryMenuRef} className="relative">
            <button
              type="button"
              onClick={() => setCategoryMenuOpen((prev) => !prev)}
              aria-haspopup="menu"
              aria-expanded={categoryMenuOpen}
              className={TOOLBAR_BUTTON}
            >
              <Filter className="h-3.5 w-3.5 text-subtle" aria-hidden="true" />
              <span className="max-w-[140px] truncate">{category === "all" ? "All categories" : category}</span>
            </button>
            {categoryMenuOpen && (
              <div className={cn(MENU_PANEL, "max-h-64 w-52 overflow-y-auto")}>
                {[{ value: "all", label: "All categories" }, ...categories.map((value) => ({ value, label: value }))].map(
                  (option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        setCategory(option.value);
                        setCategoryMenuOpen(false);
                      }}
                      className={cn(
                        MENU_ROW,
                        "justify-between hover:bg-(--app-fill)",
                        category === option.value ? "font-medium text-heading" : "text-body hover:text-heading"
                      )}
                    >
                      <span className="truncate">{option.label}</span>
                      {category === option.value && <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
                    </button>
                  )
                )}
              </div>
            )}
          </div>

          <div ref={sortMenuRef} className="relative">
            <button
              type="button"
              onClick={() => setSortMenuOpen((prev) => !prev)}
              aria-haspopup="menu"
              aria-expanded={sortMenuOpen}
              className={TOOLBAR_BUTTON}
            >
              <ArrowUpDown className="h-3.5 w-3.5 text-subtle" aria-hidden="true" />
              {SORT_OPTIONS.find((option) => option.value === sort)?.label}
            </button>
            {sortMenuOpen && (
              <div className={cn(MENU_PANEL, "w-44")}>
                {SORT_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      setSort(option.value);
                      setSortMenuOpen(false);
                    }}
                    className={cn(
                      MENU_ROW,
                      "justify-between hover:bg-(--app-fill)",
                      sort === option.value ? "font-medium text-heading" : "text-body hover:text-heading"
                    )}
                  >
                    {option.label}
                    {sort === option.value && <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      {visibleAssets === null ? (
        <div className={GRID} aria-hidden="true">
          {Array.from({ length: 10 }, (_, i) => (
            <div key={i} className="flex flex-col gap-2.5">
              <div className="aspect-square animate-pulse rounded-xl bg-(--app-fill-strong)" />
              <div className="flex flex-col gap-1.5">
                <div className="h-3 w-3/4 animate-pulse rounded-full bg-(--app-fill-strong)" />
                <div className="h-2.5 w-1/3 animate-pulse rounded-full bg-(--app-fill)" />
              </div>
            </div>
          ))}
        </div>
      ) : visibleAssets.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-center">
          <FolderOpen className="h-6 w-6 text-subtle" aria-hidden="true" />
          <p className="mt-3 text-sm font-medium text-heading">{EMPTY_TITLE[activeTab]}</p>
          <p className="mt-1 text-[13px] text-subtle">What you generate with the tools shows up here.</p>
          <Link href="/tools" className={cn(TOOLBAR_BUTTON, "mt-5 px-3")}>
            Browse tools
          </Link>
        </div>
      ) : (
        <div className={GRID}>
          {visibleAssets.map((asset) => {
            const media = (
              <>
                <AssetThumbnail asset={asset} width={GRID_THUMB_WIDTH} />
                {asset.type === "voiceover" && <PlayIndicator />}
                {asset.type !== "image" && <TypeTag type={asset.type} />}
              </>
            );
            return (
              <div
                key={asset.id}
                className={cn("group relative flex min-w-0 flex-col gap-2.5", openMenuId === asset.id && "z-30")}
              >
                {asset.type === "sop" ? (
                  <Link href={asset.fileUrl ?? "#"} aria-label={`Open ${asset.title}`} className={TILE}>
                    {media}
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={() => setPreviewAsset(asset)}
                    aria-label={`Preview ${asset.title}`}
                    className={TILE}
                  >
                    {media}
                  </button>
                )}

                <div className="flex items-start gap-1">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-heading" title={asset.title}>
                      {asset.title}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-subtle">
                      {formatRelativeTime(asset.createdAt)}
                      {asset.sizeBytes != null && ` · ${formatBytes(asset.sizeBytes)}`}
                    </p>
                  </div>

                  <div className="relative -mt-0.5 -mr-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => setOpenMenuId((prev) => (prev === asset.id ? null : asset.id))}
                      aria-label="Asset actions"
                      aria-haspopup="menu"
                      aria-expanded={openMenuId === asset.id}
                      className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-subtle transition-colors hover:bg-(--app-fill) hover:text-heading"
                    >
                      <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                    </button>
                    {openMenuId === asset.id && (
                      <div ref={actionMenuRef} className={cn(MENU_PANEL, "w-40")}>
                        {asset.type === "sop" ? (
                          <Link
                            href={asset.fileUrl ?? "#"}
                            onClick={() => setOpenMenuId(null)}
                            className={cn(MENU_ROW, "text-body hover:bg-(--app-fill) hover:text-heading")}
                          >
                            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                            Open
                          </Link>
                        ) : (
                          <>
                            {asset.type === "voiceover" && (
                              <button
                                type="button"
                                onClick={() => {
                                  setOpenMenuId(null);
                                  setPreviewAsset(asset);
                                }}
                                className={cn(MENU_ROW, "text-body hover:bg-(--app-fill) hover:text-heading")}
                              >
                                <Play className="h-3.5 w-3.5" aria-hidden="true" />
                                Play
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleDownload(asset)}
                              className={cn(MENU_ROW, "text-body hover:bg-(--app-fill) hover:text-heading")}
                            >
                              <Download className="h-3.5 w-3.5" aria-hidden="true" />
                              Download
                            </button>
                          </>
                        )}
                        <div className="mx-1 my-1 h-px bg-hairline" />
                        <button
                          type="button"
                          onClick={() => {
                            setOpenMenuId(null);
                            setPendingDeleteId(asset.id);
                          }}
                          className={cn(MENU_ROW, "text-danger hover:bg-danger-tint")}
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Portaled to <body> so the fixed overlay always covers the full
          viewport (including the sidebar) -- AppShell's AuroraBackground
          wraps dashboard content in a positioned, z-indexed container that
          would otherwise create a stacking context and trap this modal
          below the sidebar (same fix as UpgradeModal.tsx). */}
      {mounted && createPortal(
      <AnimatePresence>
        {previewAsset && (
          <motion.div
            key="preview-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm dark:bg-black/70"
            onClick={() => {
              setPreviewAsset(null);
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.97, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: 4 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              onClick={(event) => event.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-label={previewAsset.title}
              className="relative flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-hairline bg-surface shadow-[0_24px_64px_-16px_rgba(16,24,40,0.28)] dark:shadow-[0_24px_64px_-16px_rgba(0,0,0,0.8)]"
            >
              <button
                type="button"
                onClick={() => {
                  setPreviewAsset(null);
                }}
                aria-label="Close"
                className="absolute top-3 right-3 z-10 flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg bg-black/50 text-white backdrop-blur-sm transition-colors hover:bg-black/70"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>

              <div className="flex min-h-[30vh] items-center justify-center bg-zinc-100 dark:bg-black">
                {previewAsset.type === "voiceover" ? (
                  <div className="flex w-full justify-center px-6 py-10">
                    <VoiceoverPreviewPlayer key={previewAsset.id} asset={previewAsset} />
                  </div>
                ) : (
                  <div className="relative aspect-[4/3] max-h-[62vh] w-full">
                    {previewAsset.type === "video" && previewAsset.fileUrl ? (
                      <video
                        key={previewAsset.id}
                        src={previewAsset.fileUrl}
                        controls
                        autoPlay
                        className="absolute inset-0 h-full w-full object-contain"
                      />
                    ) : (
                      <AssetThumbnail asset={previewAsset} width={PREVIEW_THUMB_WIDTH} />
                    )}
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-4 border-t border-hairline p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                <div className="min-w-0">
                  <p className="line-clamp-2 text-sm font-medium text-heading">{previewAsset.title}</p>
                  <p className="mt-1 text-xs text-subtle">
                    {[TYPE_META[previewAsset.type].label, previewAsset.category, formatRelativeTime(previewAsset.createdAt)]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>

                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => setPendingDeleteId(previewAsset.id)}
                    aria-label="Delete"
                    title="Delete"
                    className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-hairline text-subtle transition-colors hover:bg-danger-tint hover:text-danger"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                  {(previewAsset.fileUrl ?? previewAsset.thumbnailUrl) && (
                    <button
                      type="button"
                      onClick={() => {
                        const url = previewAsset.fileUrl ?? previewAsset.thumbnailUrl;
                        if (url) window.open(url, "_blank");
                      }}
                      className={cn(TOOLBAR_BUTTON, "h-9 flex-1 justify-center px-3.5 sm:flex-none")}
                    >
                      <ExternalLink className="h-3.5 w-3.5 text-subtle" aria-hidden="true" />
                      View
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleDownload(previewAsset)}
                    className="flex h-9 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-btn-primary px-3.5 text-[13px] font-medium text-white transition-colors hover:bg-btn-primary-hover active:scale-[0.98] sm:flex-none"
                  >
                    <Download className="h-3.5 w-3.5" aria-hidden="true" />
                    Download
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>,
      document.body
      )}

      <ConfirmDialog
        isOpen={pendingDeleteId !== null}
        onClose={() => setPendingDeleteId(null)}
        onConfirm={() => {
          const target = assets?.find((asset) => asset.id === pendingDeleteId) ?? previewAsset;
          if (target) void handleDeleteAsset(target);
        }}
        title={`Delete "${(assets?.find((asset) => asset.id === pendingDeleteId) ?? previewAsset)?.title ?? "this asset"}"?`}
        description="This permanently deletes the asset and can't be undone."
        confirmLabel="Delete"
        danger
      />
    </div>
  );
}
