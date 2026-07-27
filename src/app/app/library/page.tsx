"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowUpDown,
  BookmarkX,
  Check,
  Download,
  ExternalLink,
  Film,
  Filter,
  ImageIcon,
  MoreHorizontal,
  Sparkles,
  X,
} from "lucide-react";
import { setBendSaved } from "@/lib/api/niche-bend";
import type { LibraryAsset, LibraryAssetType } from "@/lib/types";
import { cn, formatBytes, formatRelativeTime } from "@/lib/utils";

type TabValue = "all" | "image" | "video" | "sop";

const TABS: { value: TabValue; label: string }[] = [
  { value: "all", label: "All" },
  { value: "image", label: "Images" },
  { value: "video", label: "Video" },
  { value: "sop", label: "SOPs" },
];

const TYPE_BADGE: Record<LibraryAssetType, string> = {
  image: "Image",
  video: "Video",
  sop: "SOP",
};

const SORT_OPTIONS: { value: "newest" | "oldest"; label: string }[] = [
  { value: "newest", label: "Last updated" },
  { value: "oldest", label: "Oldest first" },
];

function downloadDataUrl(dataUrl: string, filename: string) {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  link.click();
}

function AssetThumbnail({ asset }: { asset: LibraryAsset }) {
  if (asset.thumbnailUrl) {
    return (
      <>
        {/* eslint-disable-next-line @next/next/no-img-element -- blurred backdrop, same source as the foreground image below */}
        <img
          src={asset.thumbnailUrl}
          alt=""
          className="absolute inset-0 h-full w-full scale-110 object-cover opacity-50 blur-md"
        />
        {/* eslint-disable-next-line @next/next/no-img-element -- foreground thumbnail from a data URL or upstream URL */}
        <img src={asset.thumbnailUrl} alt={asset.title} className="absolute inset-0 h-full w-full object-contain" />
      </>
    );
  }

  const Icon = asset.type === "video" ? Film : asset.type === "sop" ? Sparkles : ImageIcon;
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <Icon className="h-8 w-8 text-slate-300 dark:text-zinc-700" />
    </div>
  );
}

export default function LibraryPage() {
  const [activeTab, setActiveTab] = useState<TabValue>("all");
  const [sort, setSort] = useState<"newest" | "oldest">("newest");
  const [category, setCategory] = useState("all");
  const [assets, setAssets] = useState<LibraryAsset[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [previewAsset, setPreviewAsset] = useState<LibraryAsset | null>(null);

  const [categoryMenuOpen, setCategoryMenuOpen] = useState(false);
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const categoryMenuRef = useRef<HTMLDivElement>(null);
  const sortMenuRef = useRef<HTMLDivElement>(null);
  const actionMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    setAssets(null);
    setError(null);
    fetch(`/api/library?type=${activeTab}&sort=${sort}`)
      .then((response) => {
        if (!response.ok) throw new Error();
        return response.json();
      })
      .then((data) => {
        if (!cancelled) setAssets(data.assets ?? []);
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't load your library.");
      });
    return () => {
      cancelled = true;
    };
  }, [activeTab, sort]);

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

  async function handleRemoveSop(asset: LibraryAsset) {
    const jobId = asset.id.replace(/^sop-/, "");
    setBusyId(asset.id);
    try {
      await setBendSaved(jobId, false);
      setAssets((prev) => (prev ? prev.filter((item) => item.id !== asset.id) : prev));
    } finally {
      setBusyId(null);
      setOpenMenuId(null);
    }
  }

  function handleDownload(asset: LibraryAsset) {
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
    } else if (asset.type === "image") {
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
        <div className="flex w-full gap-6 border-b border-slate-200 md:w-auto dark:border-zinc-800">
          {TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setActiveTab(tab.value)}
              className={
                activeTab === tab.value
                  ? "border-b-2 border-blue-600 pb-2 font-medium text-slate-900 dark:text-white"
                  : "cursor-pointer pb-2 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              }
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
              className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-slate-300"
            >
              <Filter className="h-3.5 w-3.5" />
              {category === "all" ? "All categories" : category}
            </button>
            {categoryMenuOpen && (
              <div className="absolute top-full right-0 z-20 mt-2 max-h-64 w-48 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg dark:border-zinc-800 dark:bg-zinc-900">
                <button
                  type="button"
                  onClick={() => {
                    setCategory("all");
                    setCategoryMenuOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm",
                    category === "all"
                      ? "bg-slate-100 font-medium text-slate-900 dark:bg-zinc-800 dark:text-white"
                      : "text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-zinc-800/60"
                  )}
                >
                  All categories
                  {category === "all" && <Check className="h-3.5 w-3.5" />}
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
                      category === value
                        ? "bg-slate-100 font-medium text-slate-900 dark:bg-zinc-800 dark:text-white"
                        : "text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-zinc-800/60"
                    )}
                  >
                    <span className="truncate">{value}</span>
                    {category === value && <Check className="h-3.5 w-3.5 shrink-0" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div ref={sortMenuRef} className="relative">
            <button
              type="button"
              onClick={() => setSortMenuOpen((prev) => !prev)}
              className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-slate-300"
            >
              <ArrowUpDown className="h-3.5 w-3.5" />
              {SORT_OPTIONS.find((option) => option.value === sort)?.label}
            </button>
            {sortMenuOpen && (
              <div className="absolute top-full right-0 z-20 mt-2 w-40 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg dark:border-zinc-800 dark:bg-zinc-900">
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
                      sort === option.value
                        ? "bg-slate-100 font-medium text-slate-900 dark:bg-zinc-800 dark:text-white"
                        : "text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-zinc-800/60"
                    )}
                  >
                    {option.label}
                    {sort === option.value && <Check className="h-3.5 w-3.5" />}
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
            <div
              key={i}
              className="aspect-[4/3] animate-pulse rounded-xl border border-slate-200 bg-slate-100 dark:border-zinc-800 dark:bg-zinc-900"
            />
          ))}
        </div>
      ) : visibleAssets.length === 0 ? (
        <div className="mt-6 flex h-56 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-200 text-slate-400 dark:border-zinc-800">
          <Sparkles className="h-6 w-6" />
          <p className="text-sm font-medium">Nothing here yet</p>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {visibleAssets.map((asset) => (
            <div
              key={asset.id}
              className="flex flex-col rounded-xl border border-slate-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
            >
              {asset.type === "sop" ? (
                <Link
                  href={asset.fileUrl ?? "#"}
                  className="relative aspect-[4/3] overflow-hidden rounded-t-xl bg-zinc-100 dark:bg-zinc-900"
                >
                  <AssetThumbnail asset={asset} />
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => setPreviewAsset(asset)}
                  className="relative aspect-[4/3] overflow-hidden rounded-t-xl bg-zinc-100 dark:bg-zinc-900"
                >
                  <AssetThumbnail asset={asset} />
                </button>
              )}

              <div className="flex flex-col gap-1 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="max-w-[60%] truncate text-sm font-medium text-slate-900 dark:text-white">{asset.title}</p>
                  <div className="flex items-center gap-1.5">
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-500 uppercase dark:bg-zinc-800">
                      {TYPE_BADGE[asset.type]}
                    </span>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setOpenMenuId((prev) => (prev === asset.id ? null : asset.id))}
                        aria-label="Asset actions"
                        className="flex h-6 w-6 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-zinc-800 dark:hover:text-slate-200"
                      >
                        <MoreHorizontal className="h-3.5 w-3.5" />
                      </button>
                      {openMenuId === asset.id && (
                        <div
                          ref={actionMenuRef}
                          className="absolute top-full right-0 z-20 mt-1 w-40 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg dark:border-zinc-800 dark:bg-zinc-900"
                        >
                          {asset.type === "sop" ? (
                            <>
                              <Link
                                href={asset.fileUrl ?? "#"}
                                onClick={() => setOpenMenuId(null)}
                                className="flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-zinc-800/60"
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                                Open
                              </Link>
                              <button
                                type="button"
                                disabled={busyId === asset.id}
                                onClick={() => handleRemoveSop(asset)}
                                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-red-500 hover:bg-red-50 disabled:opacity-50 dark:hover:bg-red-500/10"
                              >
                                <BookmarkX className="h-3.5 w-3.5" />
                                Remove
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleDownload(asset)}
                              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-zinc-800/60"
                            >
                              <Download className="h-3.5 w-3.5" />
                              Download
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <p className="text-xs text-slate-500 dark:text-zinc-500">
                  Created {formatRelativeTime(asset.createdAt)}
                  {asset.sizeBytes != null && ` • ${formatBytes(asset.sizeBytes)}`}
                </p>
              </div>
            </div>
          ))}
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
            onClick={() => setPreviewAsset(null)}
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
                onClick={() => setPreviewAsset(null)}
                aria-label="Close"
                className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white/90 text-slate-600 shadow-sm backdrop-blur-md transition-colors hover:bg-white hover:text-slate-900 active:scale-[0.96] dark:border-white/10 dark:bg-black/50 dark:text-white/70 dark:hover:bg-black/70 dark:hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>

              <div className="flex min-h-[30vh] flex-1 items-center justify-center bg-slate-100 p-6 dark:bg-black">
                <div className="relative aspect-[4/3] max-h-full w-full overflow-hidden rounded-xl">
                  <AssetThumbnail asset={previewAsset} />
                </div>
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
                    onClick={() => handleDownload(previewAsset)}
                    className="flex flex-1 items-center justify-center gap-2 rounded-full bg-blue-500 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_1px_0_rgba(255,255,255,0.25)_inset,0_8px_20px_-8px_rgba(59,130,246,0.6)] transition-colors hover:bg-blue-400 active:scale-[0.98]"
                  >
                    <Download className="h-4 w-4" />
                    Download
                  </button>
                  <button
                    type="button"
                    onClick={() => previewAsset.thumbnailUrl && window.open(previewAsset.thumbnailUrl, "_blank")}
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
    </div>
  );
}
