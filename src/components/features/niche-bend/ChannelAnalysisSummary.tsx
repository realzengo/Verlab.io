import type { NicheBendChannelAnalysis } from "@/lib/types";

export function ChannelAnalysisSummary({ analysis }: { analysis: NicheBendChannelAnalysis }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <span className="text-[11px] font-semibold uppercase tracking-wide text-subtle">Channel</span>
          <p className="mt-1 text-sm font-medium text-heading">{analysis.channelName}</p>
        </div>
        <div>
          <span className="text-[11px] font-semibold uppercase tracking-wide text-subtle">Detected niche</span>
          <p className="mt-1 text-sm font-medium text-heading">{analysis.detectedNiche}</p>
        </div>
        <div>
          <span className="text-[11px] font-semibold uppercase tracking-wide text-subtle">Format</span>
          <p className="mt-1 text-sm text-heading">{analysis.format}</p>
        </div>
      </div>

      <div>
        <span className="text-[11px] font-semibold uppercase tracking-wide text-subtle">Top 10 videos</span>
        <ol className="mt-2 flex flex-col gap-1.5">
          {analysis.topVideos.map((video, i) => (
            <li key={i} className="flex items-baseline justify-between gap-3 text-sm text-heading">
              <span className="min-w-0 truncate">
                {i + 1}. {video.title}
              </span>
              <span className="shrink-0 text-body">{video.views}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
