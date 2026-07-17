import type { NicheBendChannelAnalysis } from "@/lib/types";
import { ChannelAvatar } from "./ChannelAvatar";

export function ChannelAnalysisSummary({ analysis }: { analysis: NicheBendChannelAnalysis }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-hairline bg-app px-4 py-3">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-subtle">Channel</span>
          <div className="mt-2 flex items-center gap-3">
            <ChannelAvatar name={analysis.channelName} avatarUrl={analysis.avatarUrl} platform={analysis.platform} />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-heading">{analysis.channelName}</p>
              <p className="text-xs text-subtle">{analysis.platform === "youtube" ? "YouTube" : "TikTok"}</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-hairline bg-app px-4 py-3">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-subtle">Detected niche</span>
          <p className="mt-1 text-sm font-medium text-heading">{analysis.detectedNiche}</p>
        </div>
      </div>

      <div>
        <span className="text-[11px] font-semibold uppercase tracking-wide text-subtle">Format</span>
        <p className="mt-2 text-sm leading-relaxed text-body">{analysis.format}</p>
      </div>

      <div className="border-t border-hairline pt-5">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-subtle">Top 10 videos</span>
        <ol className="mt-3 flex flex-col divide-y divide-hairline">
          {analysis.topVideos.map((video, i) => (
            <li key={i} className="flex items-center gap-3 py-2.5">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-primary">
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
