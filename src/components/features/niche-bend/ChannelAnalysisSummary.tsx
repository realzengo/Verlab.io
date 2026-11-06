import type { NicheBendChannelAnalysis } from "@/lib/types";
import { ChannelAvatar } from "./ChannelAvatar";

const LABEL = "text-xs font-medium text-subtle";
const ROW = "grid grid-cols-1 gap-1 border-t border-hairline py-3 first:border-t-0 first:pt-0 sm:grid-cols-[148px_1fr] sm:gap-6";

export function ChannelAnalysisSummary({
  analysis,
  hideChannel = false,
}: {
  analysis: NicheBendChannelAnalysis;
  /** Skip the channel row when the surrounding UI already shows it. */
  hideChannel?: boolean;
}) {
  return (
    <div className="flex flex-col">
      {!hideChannel && (
        <div className={ROW}>
          <span className={LABEL}>Channel</span>
          <div className="flex items-center gap-3">
            <ChannelAvatar name={analysis.channelName} avatarUrl={analysis.avatarUrl} platform={analysis.platform} size={36} />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-heading">{analysis.channelName}</p>
              <p className="text-xs text-subtle">{analysis.platform === "youtube" ? "YouTube" : "TikTok"}</p>
            </div>
          </div>
        </div>
      )}

      <div className={ROW}>
        <span className={LABEL}>Detected niche</span>
        <p className="text-sm leading-relaxed text-heading">{analysis.detectedNiche}</p>
      </div>

      <div className={ROW}>
        <span className={LABEL}>Format</span>
        <p className="text-sm leading-relaxed text-body">{analysis.format}</p>
      </div>

      <div className="border-t border-hairline pt-4">
        <span className={LABEL}>Top {analysis.topVideos.length} videos</span>
        <ol className="mt-2 flex flex-col divide-y divide-hairline">
          {analysis.topVideos.map((video, i) => (
            <li key={i} className="flex items-center gap-3 py-2.5">
              <span className="w-5 shrink-0 text-right text-xs tabular-nums text-subtle">{i + 1}</span>
              <span className="min-w-0 flex-1 truncate text-sm text-heading">{video.title}</span>
              <span className="shrink-0 text-xs tabular-nums text-subtle">{video.views} views</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
