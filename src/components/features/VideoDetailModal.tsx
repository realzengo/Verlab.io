"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Eye, FileText, Heart, Loader2, Sparkles, X } from "lucide-react";
import {
  PLATFORM_BADGE,
  TrendingVideoCard,
  formatCompactNumber,
  formatTimeAgo,
} from "@/components/features/NicheFinder";
import { Button } from "@/components/ui/Button";
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

function OutlierRow({
  label,
  value,
  barWidth,
  gradient,
  caption,
}: {
  label: string;
  value: string;
  barWidth: number;
  gradient: string;
  caption?: string;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium text-body">{label}</span>
        <span className="text-sm font-bold tabular-nums text-heading">{value}</span>
      </div>
      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-hairline">
        <div className={cn("h-full rounded-full bg-gradient-to-r", gradient)} style={{ width: `${barWidth}%` }} />
      </div>
      {caption && <p className="mt-1 text-[11px] text-subtle">{caption}</p>}
    </div>
  );
}

function SectionLabel({ children }: { children: string }) {
  return <p className="text-[10px] font-bold uppercase tracking-wide text-subtle">{children}</p>;
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
  const [saved, setSaved] = useState(false);
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

  const PlatformIcon = PLATFORM_BADGE[video.platform].icon;
  const platformLabel = PLATFORM_BADGE[video.platform].label;
  const hashtags = parseHashtags(video.title);
  const handle = video.platform === "tiktok" ? parseTikTokHandle(video.videoUrl) : null;
  const profileUrl = handle ? `https://www.tiktok.com/@${handle}` : null;
  const timeAgo = formatTimeAgo(video.postedAt);

  const related = relatedVideos.filter((v) => v.niche === video.niche && v.id !== video.id).slice(0, 8);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[92dvh] w-full max-w-6xl flex-col overflow-y-auto rounded-card-lg border border-hairline bg-surface shadow-card-hover"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="sticky right-4 top-4 z-10 ml-auto flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface text-subtle shadow-card transition-colors hover:bg-app hover:text-heading"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="-mt-8 grid grid-cols-1 gap-6 p-5 sm:p-7 lg:grid-cols-[300px_1fr]">
          {/* Left: creator + performance + outlier score */}
          <div className="flex flex-col gap-4">
            <div>
              <SectionLabel>Platform</SectionLabel>
              <div className="mt-1.5 flex items-center gap-1.5">
                <PlatformIcon className="h-4 w-4" />
                <span className="text-sm font-bold text-heading">{platformLabel}</span>
              </div>
            </div>

            {timeAgo && (
              <div className="border-t border-hairline pt-4">
                <SectionLabel>Posted</SectionLabel>
                <p className="mt-1.5 text-sm font-bold text-heading">{formatFullDate(video.postedAt)}</p>
              </div>
            )}

            <div className="border-t border-hairline pt-4">
              <SectionLabel>Creator</SectionLabel>
              <div className="mt-1.5 flex items-center gap-2">
                {video.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={video.avatarUrl} alt="" referrerPolicy="no-referrer" className="h-8 w-8 shrink-0 rounded-full object-cover" />
                ) : (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
                    {video.author.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <span className="truncate text-sm font-bold text-heading">{video.author}</span>
              </div>
              {profileUrl && (
                <Button href={profileUrl} target="_blank" rel="noopener noreferrer" variant="secondary" size="sm" className="mt-2.5 w-full">
                  View Profile
                </Button>
              )}
            </div>

            <div className="border-t border-hairline pt-4">
              <SectionLabel>Performance</SectionLabel>
              <div className="mt-1.5 grid grid-cols-2 gap-2">
                <div className="rounded-xl bg-app p-2.5">
                  <p className="text-[11px] text-subtle">Views</p>
                  <p className="text-base font-bold tabular-nums text-heading">{video.viewCount.toLocaleString()}</p>
                </div>
                <div className="rounded-xl bg-app p-2.5">
                  <p className="text-[11px] text-subtle">Likes</p>
                  <p className="text-base font-bold tabular-nums text-heading">{video.likeCount.toLocaleString()}</p>
                </div>
              </div>
            </div>

            {hashtags.length > 0 && (
              <div className="border-t border-hairline pt-4">
                <SectionLabel>Hashtags</SectionLabel>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {hashtags.map((tag) => (
                    <span key={tag} className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold text-primary">
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="border-t border-hairline pt-4">
              <SectionLabel>Outlier Score</SectionLabel>
              {insightsError ? (
                <p className="mt-2 text-xs text-subtle">Couldn&apos;t load outlier stats.</p>
              ) : !insights ? (
                <div className="mt-2 flex flex-col gap-4">
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} className="h-8 animate-pulse rounded-lg bg-app" />
                  ))}
                </div>
              ) : (
                <div className="mt-2 flex flex-col gap-3.5">
                  <OutlierRow
                    label="Outlier index"
                    value={`${insights.outlierIndex}%`}
                    barWidth={insights.outlierIndex}
                    gradient="from-violet-500 to-fuchsia-500"
                    caption="Engagement percentile within this niche"
                  />
                  <OutlierRow
                    label="Against creator reach"
                    value={`${insights.creator.viewsVsReach.toFixed(1)}x`}
                    barWidth={xBarWidth(insights.creator.viewsVsReach)}
                    gradient="from-rose-500 to-pink-500"
                    caption={
                      insights.creator.basis === "peer_videos"
                        ? `Vs their other ${insights.creator.sampleSize} cached video${insights.creator.sampleSize === 1 ? "" : "s"}`
                        : "Vs their follower count (no other cached videos)"
                    }
                  />
                  <OutlierRow
                    label="Vs niche average"
                    value={`${insights.niche.viewsVsAvg.toFixed(1)}x`}
                    barWidth={xBarWidth(insights.niche.viewsVsAvg)}
                    gradient="from-teal-500 to-emerald-500"
                    caption={`Niche average: ${formatCompactNumber(insights.niche.avgViews)} views`}
                  />
                  <OutlierRow
                    label="Niche percentile"
                    value={`Top ${insights.niche.percentileTop}%`}
                    barWidth={100 - insights.niche.percentileTop}
                    gradient="from-emerald-500 to-teal-500"
                    caption={`Rank #${insights.niche.rank} of ${insights.niche.totalVideos} cached`}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Right: video + overview + key insights + related */}
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-5 sm:flex-row">
              <div className="relative aspect-[9/16] w-full shrink-0 overflow-hidden rounded-2xl bg-ink sm:w-[220px]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={video.coverUrl} alt="" referrerPolicy="no-referrer" className="absolute inset-0 h-full w-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/5 to-black/40" />
                <span className="absolute right-2.5 top-2.5 flex h-6 w-6 items-center justify-center rounded-full bg-white">
                  <PlatformIcon className="h-3.5 w-3.5" />
                </span>
                {timeAgo && (
                  <span className="absolute bottom-2.5 left-2.5 inline-flex items-center gap-1 rounded-full bg-black/40 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur-sm">
                    {timeAgo}
                    <Eye className="ml-1 h-3 w-3" />
                    {video.views}
                  </span>
                )}
              </div>

              <div className="flex min-w-0 flex-1 flex-col gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-primary">Video Overview</p>
                  <p className="mt-1.5 text-base font-bold leading-snug text-heading">{video.title}</p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" size="sm" onClick={() => setSaved((prev) => !prev)}>
                    <Heart className={cn("h-3.5 w-3.5", saved && "fill-red-500 text-red-500")} />
                    {saved ? "Saved" : "Save video"}
                  </Button>
                  <Button href={video.videoUrl} target="_blank" rel="noopener noreferrer" variant="primary" size="sm">
                    Watch on {platformLabel}
                  </Button>
                </div>

                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-primary">Key Insights</p>
                  <div className="mt-1.5 grid grid-cols-2 gap-2">
                    <div className="rounded-xl bg-app p-2.5">
                      <p className="text-[11px] text-subtle">{video.niche} rank</p>
                      {insights ? (
                        <>
                          <p className="text-base font-bold tabular-nums text-heading">
                            #{insights.niche.rank} <span className="text-xs font-medium text-subtle">of {insights.niche.totalVideos}</span>
                          </p>
                          <p className="text-[11px] text-subtle">{insights.niche.engagementVsAvg.toFixed(2)}x avg engagement</p>
                        </>
                      ) : insightsError ? (
                        <p className="mt-1 text-sm font-medium text-subtle">—</p>
                      ) : (
                        <div className="mt-1 h-6 w-16 animate-pulse rounded bg-hairline" />
                      )}
                    </div>
                    <div className="rounded-xl bg-app p-2.5">
                      <p className="text-[11px] text-subtle">Engagement rate</p>
                      {insights ? (
                        <p className="text-base font-bold tabular-nums text-heading">{(insights.engagementRate * 100).toFixed(1)}%</p>
                      ) : insightsError ? (
                        <p className="mt-1 text-sm font-medium text-subtle">—</p>
                      ) : (
                        <div className="mt-1 h-6 w-16 animate-pulse rounded bg-hairline" />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <p className="rounded-xl bg-success-tint px-3.5 py-2.5 text-xs text-success">
              This video detail links out to the original source. Always review the live video for the latest metrics.
            </p>

            <div className="flex flex-col gap-4 rounded-xl border border-hairline bg-app p-4">
              <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-bold text-heading">Generate ideas with AI</p>
                  <p className="text-xs text-body">
                    Get four fresh concepts tailored to this video&apos;s niche, including hooks, audiences, production notes, and
                    hashtags.
                  </p>
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  icon={ideasLoading ? undefined : Sparkles}
                  className="shrink-0"
                  onClick={handleGenerateIdeas}
                  disabled={ideasLoading}
                >
                  {ideasLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                  {ideasLoading ? "Generating…" : ideasResult ? "Regenerate ideas" : "Generate ideas"}
                </Button>
              </div>

              {ideasError && <p className="text-xs text-danger">{ideasError}</p>}

              {ideasResult && (
                <div className="flex flex-col gap-4 border-t border-hairline pt-4">
                  <div className="rounded-lg border border-hairline bg-surface p-3.5">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-subtle">Source video context</p>
                    <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
                      <div>
                        <p className="text-[11px] text-subtle">Niche</p>
                        <p className="text-sm font-bold text-heading">{ideasResult.sourceContext.niche}</p>
                      </div>
                      <div>
                        <p className="text-[11px] text-subtle">Views</p>
                        <p className="text-sm font-bold tabular-nums text-heading">
                          {ideasResult.sourceContext.viewCount.toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] text-subtle">Velocity</p>
                        <p className="text-sm font-bold tabular-nums text-heading">
                          {ideasResult.sourceContext.velocity.toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] text-subtle">Outlier score</p>
                        <p className="text-sm font-bold tabular-nums text-heading">{ideasResult.sourceContext.outlierIndex}</p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-[11px] text-subtle">Title</p>
                        <p className="truncate text-sm font-bold text-heading" title={ideasResult.sourceContext.title}>
                          {ideasResult.sourceContext.title}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                    {ideasResult.ideas.map((idea, i) => (
                      <div key={i} className="flex flex-col rounded-lg border border-hairline bg-surface p-3.5">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-[10px] font-bold uppercase tracking-wide text-success">Idea {i + 1}</p>
                          <button
                            type="button"
                            onClick={() => handleCopyIdea(idea, i)}
                            aria-label="Copy idea"
                            title="Copy idea"
                            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-subtle transition-colors hover:bg-app hover:text-heading"
                          >
                            {copiedIdeaIndex === i ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
                          </button>
                        </div>
                        <p className="mt-1 text-sm font-bold text-heading">
                          {idea.title} {idea.emoji}
                        </p>
                        <p className="mt-1.5 text-xs text-body">{idea.description}</p>
                        <p className="mt-2 text-xs text-body">
                          <span className="font-bold text-heading">Target audience:</span> {idea.targetAudience}
                        </p>
                        <p className="mt-2.5 text-[10px] font-bold uppercase tracking-wide text-subtle">Production notes</p>
                        <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-body">
                          {idea.productionNotes.map((note, j) => (
                            <li key={j}>{note}</li>
                          ))}
                        </ul>
                        <p className="mt-2.5 text-[10px] font-bold uppercase tracking-wide text-subtle">Suggested hashtags</p>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          {idea.hashtags.map((tag) => (
                            <span key={tag} className="rounded-full bg-success-tint px-2 py-0.5 text-[11px] font-semibold text-success">
                              #{tag}
                            </span>
                          ))}
                        </div>
                        <Button
                          href={`/app/scripts?idea=${encodeURIComponent(formatIdeaAsText(idea))}`}
                          variant="secondary"
                          size="sm"
                          icon={FileText}
                          className="mt-3.5 w-full"
                        >
                          Generate script
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {related.length > 0 && (
              <div>
                <p className="mb-3 text-sm font-bold text-heading">Videos in the same niche</p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {related.map((v) => (
                    <TrendingVideoCard key={v.id} video={v} onOpen={onSelectVideo} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
