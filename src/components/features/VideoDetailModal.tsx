"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { ArrowUpRight, Check, Copy, Eye, FileText, Heart, Lightbulb, Loader2, Play, X } from "lucide-react";
import {
  PLATFORM_BADGE,
  TrendingVideoCard,
  formatCompactNumber,
  formatTimeAgo,
  gradientForId,
} from "@/components/features/NicheFinder";
import { useSavedVideos } from "@/components/features/SavedVideosContext";
import { useVideoCover } from "@/components/features/useVideoCover";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/utils";
import type { TrendingVideo } from "@/lib/types";

interface VideoIdea {
  title: string;
  emoji: string;
  description: string;
  targetAudience: string;
  productionNotes: string[];
  hashtags: string[];
}

interface VideoIdeasResponse {
  ideas: VideoIdea[];
  sourceContext: {
    niche: string;
    title: string;
    viewCount: number;
    velocity: number;
    outlierIndex: number;
  };
}

interface VideoInsights {
  outlierIndex: number;
  engagementRate: number;
  niche: {
    totalVideos: number;
    avgViews: number;
    rank: number;
    percentileTop: number;
    viewsVsAvg: number;
    engagementVsAvg: number;
  };
  creator: {
    basis: "peer_videos" | "follower_count";
    sampleSize: number;
    viewsVsReach: number;
  };
}

function parseHashtags(title: string): string[] {
  const matches = [...title.matchAll(/#(\w+)/g)].map((m) => m[1]);
  return [...new Set(matches)].slice(0, 8);
}

// videoUrl is always "https://www.tiktok.com/@<handle>/video/<id>" for TikTok
// rows (see mapAwemeItems in sociavault-client.ts) -- no equivalent exists
// for YouTube, which has no per-video channel URL stored.
function parseTikTokHandle(videoUrl: string): string | null {
  return /tiktok\.com\/@([^/]+)\/video\//.exec(videoUrl)?.[1] ?? null;
}

function formatFullDate(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// Scales an "Nx" multiplier onto a 0-100 bar width -- capAt is the multiplier
// that fills the bar completely, past which it just stays full rather than
// growing unboundedly (a 40x outlier shouldn't need a 4x wider bar than a 10x one).
function xBarWidth(x: number, capAt = 10): number {
  return Math.max(0, Math.min(100, (x / capAt) * 100));
}

// The caption with its hashtags taken out -- they're listed once, under it,
// instead of twice. Falls back to the raw title for a caption that was
// nothing but hashtags.
function captionWithoutHashtags(title: string): string {
  return title.replace(/#\w+/g, "").replace(/\s+/g, " ").trim() || title;
}

// Same quiet chrome as the Niche Finder toolbar. One filled button per
// section: Watch up top, Generate ideas below.
const PRIMARY_BUTTON =
  "inline-flex h-9 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-btn-primary px-3.5 text-[13px] font-medium text-white transition-colors hover:bg-btn-primary-hover disabled:pointer-events-none disabled:opacity-60";
const SECONDARY_BUTTON =
  "inline-flex h-9 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-hairline bg-surface px-3.5 text-[13px] font-medium text-heading transition-colors hover:bg-(--app-fill) dark:bg-white/[0.03]";

/** A separator in the header's meta line -- its own flex item, so the row's
 * gap spaces it evenly on both sides. */
function MetaDot({ className }: { className?: string }) {
  return <span aria-hidden="true" className={cn("h-[3px] w-[3px] shrink-0 rounded-full bg-subtle/50", className)} />;
}

/** One derived metric: label and its basis on the left, a bar in the one
 * accent, the value pinned right. Every row shares one grid so the bars and
 * values line up down the panel. */
function InsightRow({ label, detail, value, barWidth }: { label: string; detail: string; value: string; barWidth: number }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_4.5rem] items-center gap-x-4 py-2.5 @md:grid-cols-[minmax(0,1fr)_9rem_4.5rem]">
      <div className="min-w-0">
        <p className="text-[13px] text-heading">{label}</p>
        <p className="mt-0.5 truncate text-xs text-subtle">{detail}</p>
      </div>
      <div className="hidden h-1.5 overflow-hidden rounded-full bg-(--app-fill-strong) @md:block">
        <div className="h-full rounded-full bg-primary" style={{ width: `${barWidth}%` }} />
      </div>
      <p className="text-right text-[13px] font-semibold tabular-nums text-heading">{value}</p>
    </div>
  );
}

function formatIdeaAsText(idea: VideoIdea): string {
  return [
    `${idea.title} ${idea.emoji}`,
    "",
    idea.description,
    "",
    `Target audience: ${idea.targetAudience}`,
    "",
    "Production notes:",
    ...idea.productionNotes.map((note) => `- ${note}`),
    "",
    `Hashtags: ${idea.hashtags.map((tag) => `#${tag}`).join(" ")}`,
  ].join("\n");
}

export function VideoDetailModal({
  video,
  relatedVideos,
  onClose,
  onSelectVideo,
}: {
  video: TrendingVideo;
  relatedVideos: TrendingVideo[];
  onClose: () => void;
  onSelectVideo: (video: TrendingVideo) => void;
}) {
  const { isSaved, toggleSave } = useSavedVideos();
  const saved = isSaved(video.id);
  const cover = useVideoCover(video);

  // Creator avatars are signed CDN links too, with no proxy to retry
  // through -- a broken one falls back to the platform mark.
  const [avatarFailed, setAvatarFailed] = useState(false);

  const [insights, setInsights] = useState<VideoInsights | null>(null);
  const [insightsError, setInsightsError] = useState(false);
  const [ideasResult, setIdeasResult] = useState<VideoIdeasResponse | null>(null);
  const [ideasLoading, setIdeasLoading] = useState(false);
  const [ideasError, setIdeasError] = useState<string | null>(null);
  const [copiedIdeaIndex, setCopiedIdeaIndex] = useState<number | null>(null);

  function handleCopyIdea(idea: VideoIdea, index: number) {
    navigator.clipboard.writeText(formatIdeaAsText(idea)).then(() => {
      setCopiedIdeaIndex(index);
      setTimeout(() => setCopiedIdeaIndex((current) => (current === index ? null : current)), 1800);
    });
  }

  async function handleGenerateIdeas() {
    setIdeasLoading(true);
    setIdeasError(null);
    try {
      const res = await fetch(`/api/niches/videos/${encodeURIComponent(video.id)}/ideas`, { method: "POST" });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data) {
        throw new Error(
          res.status === 402
            ? "Not enough credits to generate ideas."
            : (data && typeof data.error === "string" && data.error) || "Couldn't generate ideas. Try again."
        );
      }
      setIdeasResult(data);
    } catch (err) {
      setIdeasError(err instanceof Error ? err.message : "Couldn't generate ideas. Try again.");
    } finally {
      setIdeasLoading(false);
    }
  }

  useEffect(() => {
    const controller = new AbortController();

    fetch(`/api/niches/videos/${encodeURIComponent(video.id)}/insights`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("failed"))))
      .then((data: VideoInsights) => setInsights(data))
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setInsightsError(true);
      });

    return () => controller.abort();
  }, [video.id]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  // The caller only ever hands us whatever page of (often niche-mixed)
  // results it already had loaded in the background grid, so filtering that
  // down to this video's niche client-side regularly turns up just one or
  // two matches. Fetch this niche's own top videos directly instead, so the
  // "same niche" rail is actually populated regardless of what the parent
  // grid happened to have on hand.
  const [fetchedRelated, setFetchedRelated] = useState<TrendingVideo[] | null>(null);
  useEffect(() => {
    const controller = new AbortController();

    fetch(`/api/niches/${encodeURIComponent(video.niche)}/videos?limit=24&sort=views`, {
      signal: controller.signal,
    })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("failed"))))
      .then((data: { videos: TrendingVideo[] }) => setFetchedRelated(data.videos))
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setFetchedRelated([]);
      });

    return () => controller.abort();
  }, [video.niche]);

  const PlatformIcon = PLATFORM_BADGE[video.platform].icon;
  const platformLabel = PLATFORM_BADGE[video.platform].label;
  const hashtags = parseHashtags(video.title);
  const handle = video.platform === "tiktok" ? parseTikTokHandle(video.videoUrl) : null;
  const profileUrl = handle ? `https://www.tiktok.com/@${handle}` : null;
  const timeAgo = formatTimeAgo(video.postedAt);

  // Fall back to the client-side filter while the fetch above is in flight
  // (or if it failed) so the rail isn't just empty in the meantime.
  const relatedPool = fetchedRelated ?? relatedVideos;
  const related = relatedPool.filter((v) => v.niche === video.niche && v.id !== video.id).slice(0, 12);

  const caption = captionWithoutHashtags(video.title);
  const postedOn = formatFullDate(video.postedAt);
  const stats = [
    { label: "Views", value: video.viewCount },
    { label: "Likes", value: video.likeCount },
    { label: "Comments", value: video.commentCount },
    { label: "Shares", value: video.shareCount },
  ];

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/50 p-3 backdrop-blur-sm sm:p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Video by @${video.author}`}
        className="relative flex max-h-[92dvh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-hairline bg-surface shadow-card-hover"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Who and where, said once: a fixed bar above the scroll content,
            so the close action is always in reach. */}
        <div className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-hairline pl-5 pr-3 sm:pl-8">
          <div className="flex min-w-0 items-center gap-2 text-[13px]">
            {video.avatarUrl && !avatarFailed ? (
              <span className="relative mr-0.5 shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={video.avatarUrl}
                  alt=""
                  referrerPolicy="no-referrer"
                  onError={() => setAvatarFailed(true)}
                  className="h-7 w-7 rounded-full bg-(--app-fill-strong) object-cover"
                />
                <span className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-white shadow-[0_0_0_1.5px_var(--color-surface)]">
                  <PlatformIcon className="h-2 w-2" aria-label={platformLabel} />
                </span>
              </span>
            ) : (
              <PlatformIcon className="h-4 w-4 shrink-0" aria-label={platformLabel} />
            )}
            <span className="truncate font-semibold text-heading">@{video.author}</span>
            {video.followerCount > 0 && (
              <>
                <MetaDot />
                <span className="shrink-0 tabular-nums text-subtle">
                  {formatCompactNumber(video.followerCount)} {video.platform === "youtube" ? "subscribers" : "followers"}
                </span>
              </>
            )}
            <MetaDot className="hidden sm:block" />
            <span className="hidden shrink-0 text-subtle sm:inline">{video.niche}</span>
            {postedOn && (
              <>
                <MetaDot className="hidden md:block" />
                <span className="hidden shrink-0 text-subtle md:inline" title={timeAgo ?? undefined}>
                  {postedOn}
                </span>
              </>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-subtle transition-colors hover:bg-(--app-fill) hover:text-heading"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="@container overflow-y-auto">
          <div className="grid grid-cols-1 gap-6 p-5 sm:grid-cols-[200px_minmax(0,1fr)] sm:p-8 lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-8">
            {/* The cover is the way to the real video: the whole tile links
                out, with the play mark saying so. */}
            <a
              href={video.videoUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Watch on ${platformLabel}`}
              className="group/cover relative mx-auto aspect-[9/16] w-full max-w-[240px] self-start overflow-hidden rounded-xl bg-ink after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:ring-1 after:ring-black/[0.06] after:ring-inset sm:max-w-none lg:sticky lg:top-0 dark:after:ring-white/[0.08]"
            >
              <div className={cn("absolute inset-0 bg-gradient-to-br", gradientForId(video.id))} />
              {cover.src && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={cover.src}
                  alt=""
                  referrerPolicy="no-referrer"
                  onError={cover.onError}
                  decoding="async"
                  className="absolute inset-0 h-full w-full object-cover"
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/0 via-35% to-black/20" />
              <span className="absolute left-2.5 top-2.5 flex h-6 w-6 items-center justify-center rounded-full bg-white shadow-[0_1px_2px_rgb(0_0_0/0.2)]">
                <PlatformIcon className="h-3 w-3" />
              </span>
              <span className="absolute left-1/2 top-1/2 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 shadow-card transition-transform duration-200 group-hover/cover:scale-105">
                <Play className="ml-0.5 h-5 w-5 fill-ink text-ink" />
              </span>
              <span className="absolute bottom-2.5 left-3 flex items-center gap-1 text-xs font-semibold tabular-nums text-white [text-shadow:0_1px_2px_rgb(0_0_0/0.35)]">
                <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                {video.views}
                <span className="sr-only"> views</span>
              </span>
            </a>

            <div className="flex min-w-0 flex-col gap-6">
              <div className="flex flex-col gap-2.5">
                <p className="text-lg font-semibold leading-snug text-pretty text-heading">{caption}</p>
                {hashtags.length > 0 && caption !== video.title && (
                  <p className="flex flex-wrap gap-x-2 gap-y-0.5 text-[13px] text-primary">
                    {hashtags.map((tag) => (
                      <span key={tag}>#{tag}</span>
                    ))}
                  </p>
                )}
                <div className="mt-1.5 flex flex-wrap gap-2">
                  <a href={video.videoUrl} target="_blank" rel="noopener noreferrer" className={PRIMARY_BUTTON}>
                    Watch on {platformLabel}
                    <ArrowUpRight className="h-4 w-4" />
                  </a>
                  <button type="button" onClick={() => toggleSave(video)} aria-pressed={saved} className={SECONDARY_BUTTON}>
                    <Heart className={cn("h-4 w-4", saved ? "fill-red-500 text-red-500" : "text-subtle")} />
                    {saved ? "Saved" : "Save"}
                  </button>
                  {profileUrl && (
                    <a href={profileUrl} target="_blank" rel="noopener noreferrer" className={SECONDARY_BUTTON}>
                      View profile
                    </a>
                  )}
                </div>
              </div>

              {/* Raw counts in one strip (gap-px over a hairline ground draws
                  the dividers, however the cells wrap). Full figures on hover. */}
              <div>
                <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-hairline bg-hairline @2xl:grid-cols-4">
                  {stats.map((stat) => (
                    <div key={stat.label} className="bg-surface px-4 py-3">
                      <dt className="text-xs text-subtle">{stat.label}</dt>
                      <dd className="mt-1 text-lg font-semibold tabular-nums text-heading" title={stat.value.toLocaleString()}>
                        {formatCompactNumber(stat.value)}
                      </dd>
                    </div>
                  ))}
                </dl>
                <p className="mt-2 text-xs text-subtle">From our latest scrape. The live video has the current numbers.</p>
              </div>

              {/* Derived metrics. One number leads -- how far this video beat
                  its own creator's usual -- and the rest are rows. */}
              <section aria-label="Outlier score" className="rounded-xl border border-hairline">
                <p className="border-b border-hairline px-4 py-3 text-[13px] font-semibold text-heading">Outlier score</p>
                {insightsError ? (
                  <p className="px-4 py-6 text-[13px] text-subtle">Couldn&apos;t load outlier stats.</p>
                ) : (
                  <div className="grid @2xl:grid-cols-[13rem_minmax(0,1fr)]">
                    <div className="border-b border-hairline px-4 py-4 @2xl:border-b-0 @2xl:border-r">
                      {insights ? (
                        <>
                          <p className="text-[32px] font-semibold leading-none tracking-tight tabular-nums text-heading">
                            {insights.creator.viewsVsReach.toFixed(1)}×
                          </p>
                          <p className="mt-2.5 text-[13px] text-heading">
                            {insights.creator.basis === "peer_videos" ? "Views vs their usual" : "Views vs followers"}
                          </p>
                          <p className="mt-0.5 text-xs text-subtle">
                            {insights.creator.basis === "peer_videos"
                              ? `Vs their other ${insights.creator.sampleSize} cached video${insights.creator.sampleSize === 1 ? "" : "s"}`
                              : "No other cached videos to compare"}
                          </p>
                        </>
                      ) : (
                        <>
                          <Skeleton className="h-8 w-20 rounded-md" />
                          <Skeleton className="mt-3 h-3 w-28 rounded-full" />
                          <Skeleton className="mt-2 h-2.5 w-36 rounded-full" />
                        </>
                      )}
                    </div>
                    <div className="px-4 py-1.5">
                      {insights ? (
                        <>
                          <InsightRow
                            label="Outlier index"
                            detail={`Engagement percentile in ${video.niche}`}
                            value={`${insights.outlierIndex}%`}
                            barWidth={insights.outlierIndex}
                          />
                          <InsightRow
                            label="Vs niche average"
                            detail={`${video.niche} average ${formatCompactNumber(insights.niche.avgViews)} views`}
                            value={`${insights.niche.viewsVsAvg.toFixed(1)}×`}
                            barWidth={xBarWidth(insights.niche.viewsVsAvg)}
                          />
                          <InsightRow
                            label="Niche percentile"
                            detail={`#${insights.niche.rank} of ${insights.niche.totalVideos} cached`}
                            value={`Top ${insights.niche.percentileTop}%`}
                            barWidth={100 - insights.niche.percentileTop}
                          />
                          <InsightRow
                            label="Engagement rate"
                            detail={`${insights.niche.engagementVsAvg.toFixed(2)}× the ${video.niche} average`}
                            value={`${(insights.engagementRate * 100).toFixed(1)}%`}
                            barWidth={xBarWidth(insights.niche.engagementVsAvg, 3)}
                          />
                        </>
                      ) : (
                        [0, 1, 2, 3].map((i) => (
                          <div key={i} className="flex h-[55px] items-center gap-4">
                            <Skeleton className="h-3 w-32 rounded-full" />
                            <Skeleton className="hidden h-1.5 flex-1 rounded-full @md:block" />
                            <Skeleton className="ml-auto h-3 w-10 rounded-full" />
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </section>
            </div>
          </div>

          <section className="border-t border-hairline px-5 py-6 sm:px-8">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-heading">Video ideas</p>
                <p className="mt-0.5 text-[13px] text-subtle">
                  Four new concepts for this niche, each with a hook, audience, production notes and hashtags.
                </p>
              </div>
              <button type="button" onClick={handleGenerateIdeas} disabled={ideasLoading} className={PRIMARY_BUTTON}>
                {ideasLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lightbulb className="h-4 w-4" />}
                {ideasLoading ? "Generating…" : ideasResult ? "Regenerate ideas" : "Generate ideas"}
              </button>
            </div>

            {ideasError && <p className="mt-3 text-[13px] text-danger">{ideasError}</p>}

            {ideasResult && (
              <div className="mt-5 grid grid-cols-1 gap-3 @3xl:grid-cols-2">
                {ideasResult.ideas.map((idea, i) => (
                  <article key={i} className="flex flex-col rounded-xl border border-hairline p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs text-subtle">Idea {i + 1}</p>
                        <p className="mt-0.5 text-sm font-semibold text-heading">
                          {idea.title} {idea.emoji}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopyIdea(idea, i)}
                        aria-label="Copy idea"
                        title="Copy idea"
                        className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-subtle transition-colors hover:bg-(--app-fill) hover:text-heading"
                      >
                        {copiedIdeaIndex === i ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                    <p className="mt-2 text-[13px] leading-relaxed text-body">{idea.description}</p>
                    <dl className="mt-3 flex flex-col gap-3 text-[13px]">
                      <div>
                        <dt className="text-xs font-medium text-heading">Target audience</dt>
                        <dd className="mt-0.5 text-body">{idea.targetAudience}</dd>
                      </div>
                      <div>
                        <dt className="text-xs font-medium text-heading">Production notes</dt>
                        <dd>
                          <ul className="mt-1 list-disc space-y-0.5 pl-4 text-body marker:text-subtle">
                            {idea.productionNotes.map((note, j) => (
                              <li key={j}>{note}</li>
                            ))}
                          </ul>
                        </dd>
                      </div>
                    </dl>
                    <p className="mt-3 flex flex-wrap gap-x-2 gap-y-0.5 text-xs text-primary">
                      {idea.hashtags.map((tag) => (
                        <span key={tag}>#{tag}</span>
                      ))}
                    </p>
                    <Link
                      href={`/scripts?idea=${encodeURIComponent(formatIdeaAsText(idea))}`}
                      className={cn(SECONDARY_BUTTON, "mt-4 w-full")}
                    >
                      <FileText className="h-4 w-4 text-subtle" />
                      Generate script
                    </Link>
                  </article>
                ))}
              </div>
            )}
          </section>

          {related.length > 0 && (
            <section className="border-t border-hairline px-5 py-6 sm:px-8">
              <p className="mb-4 text-sm font-semibold text-heading">More in {video.niche}</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-6 @xl:grid-cols-3 @3xl:grid-cols-4 @5xl:grid-cols-6">
                {related.map((v) => (
                  <TrendingVideoCard key={v.id} video={v} onOpen={onSelectVideo} />
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
