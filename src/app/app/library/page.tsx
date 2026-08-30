"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import useSWR, { mutate as globalMutate } from "swr";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowUpDown,
  Check,
  Download,
  ExternalLink,
  Film,
  Filter,
  ImageIcon,
  type LucideIcon,
  Mic2,
  MoreHorizontal,
  Pause,
  Play,
  Sparkles,
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
  { value: "sop", label: "SOPs" },
  { value: "voiceover", label: "Voiceovers" },
];

const TYPE_BADGE: Record<LibraryAssetType, { label: string; icon: LucideIcon; chip: string; text: string }> = {
  image: { label: "Image", icon: ImageIcon, chip: "bg-cat-1-tint", text: "text-cat-1" },
  video: { label: "Video", icon: Film, chip: "bg-cat-6-tint", text: "text-cat-6" },
  sop: { label: "SOP", icon: Sparkles, chip: "bg-cat-7-tint", text: "text-cat-7" },
  voiceover: { label: "Voiceover", icon: Mic2, chip: "bg-cat-2-tint", text: "text-cat-2" },
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
  const badge = TYPE_BADGE[type];
  const Icon = badge.icon;
  return (
    <div className={cn("absolute inset-0 flex items-center justify-center overflow-hidden", badge.chip)}>
      <div
        className="absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage: "radial-gradient(currentColor 1px, transparent 1px)",
          backgroundSize: "16px 16px",
        }}
      />
      <div className={cn("absolute -right-6 -bottom-8 h-28 w-28 rounded-full opacity-[0.08]", badge.text, "bg-current")} />
      <span
        className={cn(
          "relative flex h-11 w-11 items-center justify-center rounded-xl bg-surface shadow-[0_1px_2px_rgba(15,23,42,0.06),0_8px_20px_-8px_rgba(15,23,42,0.15)] ring-1 ring-black/[0.04] dark:ring-white/[0.06]",
          badge.text
        )}
      >
        <Icon className="h-5 w-5" />
      </span>
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
      <>
        {isOwnOrigin && (
          // eslint-disable-next-line @next/next/no-img-element -- pre-resized by our own route; next/image can't reach an authenticated route (its internal fetch drops cookies)
          <img
            src={src}
            alt=""
            loading="lazy"
            decoding="async"
            className="absolute inset-0 h-full w-full scale-110 object-cover opacity-40 blur-lg"
          />
        )}
        {/* eslint-disable-next-line @next/next/no-img-element -- pre-resized by our own route (own-origin) or a small third-party avatar (SOP) */}
        <img
          src={src}
          alt={asset.title}
          loading="lazy"
          decoding="async"
          className={cn(
            "absolute inset-0 h-full w-full transition-transform duration-300 ease-out group-hover:scale-[1.03]",
            isOwnOrigin ? "object-contain" : "object-cover"
          )}
        />
      </>
    );
  }

  return <AssetPlaceholder type={asset.type} />;
}

function PlayIndicator({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm">
        <Icon className="h-4 w-4" />
      </span>
    </div>
  );
}

// Voiceover generations don't store one stitched audio file (segments are
// stitched client-side, see exportSegmentsAsWav) -- so previewing one plays
// its segments back to back through a single hidden <audio> element,
// advancing on `ended`, same sequencing approach as VoiceoverGenerator's
// playSequenceFrom/handleAudioEnded.
function VoiceoverPreviewPlayer({ asset }: { asset: LibraryAsset }) {
  const generationId = useMemo(() => asset.id.replace(/^voiceover-/, ""), [asset.id]);
  const [durations, setDurations] = useState<number[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [playingIndex, setPlayingIndex] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

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

  return (
    <div className="flex w-full max-w-xs flex-col items-center gap-6 py-4">
      <audio ref={audioRef} onEnded={handleEnded} onTimeUpdate={handleTimeUpdate} className="hidden" />

      <button
        type="button"
        onClick={togglePlayPause}
        disabled={!durations}
        aria-label={isPlaying ? "Pause" : "Play"}
        className="group relative flex h-28 w-28 shrink-0 items-center justify-center rounded-full bg-cat-2-tint text-cat-2 shadow-[0_1px_2px_rgba(15,23,42,0.06),0_8px_20px_-8px_rgba(15,23,42,0.15)] ring-1 ring-black/[0.04] transition-transform active:scale-[0.97] disabled:opacity-40 dark:ring-white/[0.06]"
      >
        <Mic2 className="h-11 w-11 transition-opacity group-hover:opacity-0" />
        <span className="absolute inset-0 flex items-center justify-center rounded-full bg-cat-2/90 text-white opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100">
          {isPlaying ? <Pause className="h-8 w-8" /> : <Play className="h-8 w-8 translate-x-0.5" />}
        </span>
      </button>

      <div className="flex w-full flex-col gap-2">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-white/10">
          <div className="h-full rounded-full bg-cat-2 transition-[width] duration-150" style={{ width: `${progress * 100}%` }} />
        </div>
        <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-zinc-500">
          <span>{formatSeconds(currentTime)}</span>
          <span>{durations ? formatSeconds(totalDuration) : "—:—"}</span>
        </div>
      </div>

      {loadError && <p className="text-xs font-medium text-red-500">Could not load this voiceover&rsquo;s audio.</p>}
    </div>
  );
}

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

  const { data: libraryData, error: libraryError } = useSWR<{ assets: LibraryAsset[] }>(
    `/api/library?type=${activeTab}&sort=${sort}`
  );
  const assets = libraryData?.assets ?? null;
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const error = deleteError ?? (libraryError ? "Couldn't load your library." : null);

  useEffect(() => {
    setCategory("all");
  }, [activeTab]);

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
    <div className="flex flex-col gap-2 pt-2">
      <div>
        <h1 className="bg-gradient-to-br from-heading via-heading to-primary bg-clip-text text-3xl font-extrabold tracking-tight text-transparent sm:text-4xl">
          Library
        </h1>
        <p className="mt-2 text-xs font-medium tracking-wide text-body/60 sm:text-sm">
          Every image, video, and SOP you&rsquo;ve generated, in one place.
        </p>
      </div>

      <div className="mt-4 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div className="flex w-full gap-6 border-b border-hairline md:w-auto">
          {TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setActiveTab(tab.value)}
              className={cn(
                "cursor-pointer pb-2 text-sm font-medium transition-colors",
                activeTab === tab.value ? "border-b-2 border-primary text-heading" : "text-body/70 hover:text-heading"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <div ref={categoryMenuRef} className="relative">
            <button
              type="button"
              onClick={() => setCategoryMenuOpen((prev) => !prev)}
              className="flex items-center gap-2 rounded-full border border-hairline bg-surface px-3 py-1.5 text-sm font-medium text-body shadow-card transition-colors hover:text-heading"
            >
              <Filter className="h-3.5 w-3.5" />
              {category === "all" ? "All categories" : category}
            </button>
            {categoryMenuOpen && (
              <div className="absolute top-full right-0 z-20 mt-2 max-h-64 w-48 overflow-y-auto rounded-2xl border border-hairline bg-surface p-1.5 shadow-card-hover">
                <button
                  type="button"
                  onClick={() => {
                    setCategory("all");
                    setCategoryMenuOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm",
                    category === "all" ? "bg-accent font-medium text-heading" : "text-body hover:bg-accent/60"
                  )}
                >
                  All categories
                  {category === "all" && <Check className="h-3.5 w-3.5 text-primary" />}
                </button>
                {categories.map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => {
                      setCategory(value);
                      setCategoryMenuOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm",
                      category === value ? "bg-accent font-medium text-heading" : "text-body hover:bg-accent/60"
                    )}
                  >
                    <span className="truncate">{value}</span>
                    {category === value && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div ref={sortMenuRef} className="relative">
            <button
              type="button"
              onClick={() => setSortMenuOpen((prev) => !prev)}
              className="flex items-center gap-2 rounded-full border border-hairline bg-surface px-3 py-1.5 text-sm font-medium text-body shadow-card transition-colors hover:text-heading"
            >
              <ArrowUpDown className="h-3.5 w-3.5" />
              {SORT_OPTIONS.find((option) => option.value === sort)?.label}
            </button>
            {sortMenuOpen && (
              <div className="absolute top-full right-0 z-20 mt-2 w-40 rounded-2xl border border-hairline bg-surface p-1.5 shadow-card-hover">
                {SORT_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      setSort(option.value);
                      setSortMenuOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm",
                      sort === option.value ? "bg-accent font-medium text-heading" : "text-body hover:bg-accent/60"
                    )}
                  >
                    {option.label}
                    {sort === option.value && <Check className="h-3.5 w-3.5 text-primary" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {error && <p className="mt-4 text-sm font-medium text-red-500">{error}</p>}

      {visibleAssets === null ? (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="overflow-hidden rounded-lg border border-hairline bg-surface p-2.5 shadow-card">
              <div className="aspect-[4/3] animate-pulse rounded-md bg-accent" />
              <div className="flex flex-col gap-2 px-1 pt-3 pb-1">
                <div className="h-3.5 w-3/4 animate-pulse rounded-full bg-accent" />
                <div className="h-3 w-1/2 animate-pulse rounded-full bg-accent" />
              </div>
            </div>
          ))}
        </div>
      ) : visibleAssets.length === 0 ? (
        <div className="mt-6 flex h-64 flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-hairline text-body/60">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent text-primary">
            <Sparkles className="h-5 w-5" />
          </span>
          <p className="text-sm font-medium text-heading">Nothing here yet</p>
          <p className="text-xs text-body/70">Generate an image, video, or SOP to see it show up here.</p>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {visibleAssets.map((asset) => {
            const badge = TYPE_BADGE[asset.type];
            const BadgeIcon = badge.icon;
            return (
              <div
                key={asset.id}
                className={cn(
                  "group relative flex flex-col rounded-lg border border-hairline bg-surface p-2.5 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card-hover",
                  openMenuId === asset.id && "z-30"
                )}
              >
                {asset.type === "sop" ? (
                  <Link
                    href={asset.fileUrl ?? "#"}
                    className="relative block aspect-[4/3] w-full shrink-0 overflow-hidden rounded-md border border-hairline/60 bg-accent"
                  >
                    <AssetThumbnail asset={asset} width={GRID_THUMB_WIDTH} />
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={() => setPreviewAsset(asset)}
                    className="relative block aspect-[4/3] w-full shrink-0 overflow-hidden rounded-md border border-hairline/60 bg-accent"
                  >
                    <AssetThumbnail asset={asset} width={GRID_THUMB_WIDTH} />
                    {asset.type === "video" && <PlayIndicator icon={Film} />}
                    {asset.type === "voiceover" && <PlayIndicator icon={Play} />}
                  </button>
                )}

                <div className="flex flex-col gap-1.5 px-1 pt-3 pb-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="max-w-[62%] truncate text-sm font-semibold text-heading">{asset.title}</p>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <span
                        className={cn(
                          "flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold tracking-wide uppercase",
                          badge.chip,
                          badge.text
                        )}
                      >
                        <BadgeIcon className="h-2.5 w-2.5" />
                        {badge.label}
                      </span>
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setOpenMenuId((prev) => (prev === asset.id ? null : asset.id))}
                          aria-label="Asset actions"
                          className="flex h-6 w-6 items-center justify-center rounded-full text-body/60 hover:bg-accent hover:text-primary"
                        >
                          <MoreHorizontal className="h-3.5 w-3.5" />
                        </button>
                        {openMenuId === asset.id && (
                          <div
                            ref={actionMenuRef}
                            className="absolute top-full right-0 z-20 mt-1 w-44 rounded-2xl border border-hairline bg-surface p-1.5 shadow-card-hover"
                          >
                            {asset.type === "sop" ? (
                              <Link
                                href={asset.fileUrl ?? "#"}
                                onClick={() => setOpenMenuId(null)}
                                className="flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-body hover:bg-accent/60"
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                                Open
                              </Link>
                            ) : asset.type === "voiceover" ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenMenuId(null);
                                    setPreviewAsset(asset);
                                  }}
                                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-body hover:bg-accent/60"
                                >
                                  <Play className="h-3.5 w-3.5" />
                                  Play
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDownload(asset)}
                                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-body hover:bg-accent/60"
                                >
                                  <Download className="h-3.5 w-3.5" />
                                  Download
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleDownload(asset)}
                                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-body hover:bg-accent/60"
                              >
                                <Download className="h-3.5 w-3.5" />
                                Download
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                setOpenMenuId(null);
                                setPendingDeleteId(asset.id);
                              }}
                              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-body/70">
                    Created {formatRelativeTime(asset.createdAt)}
                    {asset.sizeBytes != null && ` • ${formatBytes(asset.sizeBytes)}`}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <AnimatePresence>
        {previewAsset && (
          <motion.div
            key="preview-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-md dark:bg-black/80"
            onClick={() => {
              setPreviewAsset(null);
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 4 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              onClick={(event) => event.stopPropagation()}
              className="relative flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_40px_120px_-24px_rgba(15,23,42,0.25),0_0_0_1px_rgba(15,23,42,0.03)] dark:border-white/10 dark:bg-[#0b0b0e] dark:shadow-[0_40px_120px_-24px_rgba(0,0,0,0.85),0_0_0_1px_rgba(255,255,255,0.05)]"
            >
              <button
                type="button"
                onClick={() => {
                  setPreviewAsset(null);
                }}
                aria-label="Close"
                className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white/90 text-slate-600 shadow-sm backdrop-blur-md transition-colors hover:bg-white hover:text-slate-900 active:scale-[0.96] dark:border-white/10 dark:bg-black/50 dark:text-white/70 dark:hover:bg-black/70 dark:hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>

              <div className="flex min-h-[30vh] flex-1 items-center justify-center bg-slate-100 p-6 dark:bg-black">
                {previewAsset.type === "voiceover" ? (
                  <VoiceoverPreviewPlayer key={previewAsset.id} asset={previewAsset} />
                ) : (
                  <div className="relative aspect-[4/3] max-h-full w-full overflow-hidden rounded-xl">
                    {previewAsset.type === "video" && previewAsset.fileUrl ? (
                      <video
                        key={previewAsset.id}
                        src={previewAsset.fileUrl}
                        controls
                        autoPlay
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <AssetThumbnail asset={previewAsset} width={PREVIEW_THUMB_WIDTH} />
                    )}
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-4 border-t border-slate-200 p-5 dark:border-white/[0.08]">
                <div>
                  <p className="line-clamp-2 text-sm font-semibold text-slate-900 dark:text-white/90">
                    {previewAsset.title}
                  </p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-zinc-500">
                    {previewAsset.category} · Created {formatRelativeTime(previewAsset.createdAt)}
                  </p>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPendingDeleteId(previewAsset.id)}
                    aria-label="Delete"
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-slate-200 text-red-500 transition-colors hover:border-red-200 hover:bg-red-50 active:scale-[0.98] dark:border-white/15 dark:hover:border-red-500/30 dark:hover:bg-red-500/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownload(previewAsset)}
                    className="flex flex-1 items-center justify-center gap-2 rounded-full bg-blue-500 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_1px_0_rgba(255,255,255,0.25)_inset,0_8px_20px_-8px_rgba(59,130,246,0.6)] transition-colors hover:bg-blue-400 active:scale-[0.98]"
                  >
                    <Download className="h-4 w-4" />
                    Download
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const url = previewAsset.fileUrl ?? previewAsset.thumbnailUrl;
                      if (url) window.open(url, "_blank");
                    }}
                    className="flex flex-1 items-center justify-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-100 active:scale-[0.98] dark:border-white/15 dark:bg-white/[0.04] dark:text-white/90 dark:hover:border-white/25 dark:hover:bg-white/[0.08]"
                  >
                    <ExternalLink className="h-4 w-4" />
                    View
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
