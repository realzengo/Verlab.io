import type { NicheBendChannelAnalysis } from "@/lib/types";
import { ChannelAvatar } from "./ChannelAvatar";

export function ChannelAnalysisSummary({ analysis }: { analysis: NicheBendChannelAnalysis }) {
  return (
    <div className="flex flex-col">
      <div className="grid grid-cols-1 gap-1 py-3 first:pt-0 sm:grid-cols-[168px_1fr] sm:gap-6">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-subtle">Channel</span>
        <div className="flex items-center gap-3">
          <ChannelAvatar name={analysis.channelName} avatarUrl={analysis.avatarUrl} platform={analysis.platform} size={36} />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-heading">{analysis.channelName}</p>
            <p className="text-xs text-subtle">{analysis.platform === "youtube" ? "YouTube" : "TikTok"}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-1 border-t border-hairline py-3 sm:grid-cols-[168px_1fr] sm:gap-6">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-subtle">Detected niche</span>
        <p className="text-sm leading-relaxed text-heading">{analysis.detectedNiche}</p>
      </div>

      <div className="grid grid-cols-1 gap-1 border-t border-hairline py-3 sm:grid-cols-[168px_1fr] sm:gap-6">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-subtle">Format</span>
        <p className="text-sm leading-relaxed text-body">{analysis.format}</p>
      </div>

      <div className="border-t border-hairline pt-4">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-subtle">Top 10 videos</span>
        <ol className="mt-3 flex flex-col divide-y divide-hairline">
          {analysis.topVideos.map((video, i) => (
            <li key={i} className="flex items-center gap-3 py-2.5">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-hairline text-[11px] font-semibold text-subtle">
                {i + 1}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm text-heading">{video.title}</span>
              <span className="shrink-0 text-xs font-medium tabular-nums text-subtle">{video.views} views</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
