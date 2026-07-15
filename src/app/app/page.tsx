import { ArrowRight, Captions, Compass, Download, Link as LinkIcon, Plug, Star, TrendingUp, Wand2 } from "lucide-react";
import { DASHBOARD_TOOLS } from "@/lib/mock-data";
import { ActionCard } from "@/components/dashboard/ActionCard";
import { PromoCard } from "@/components/dashboard/PromoCard";
import { ToolTile } from "@/components/dashboard/ToolTile";

function BendPreview() {
  return (
    <div className="flex items-center gap-3">
      <div className="rounded-card-sm border border-hairline bg-surface px-3 py-2.5 text-left shadow-card">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-body">Source</span>
        <p className="text-xs font-semibold text-heading">Medical Malpractice</p>
      </div>
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-white">
        <Wand2 className="h-3.5 w-3.5" />
      </div>
      <div className="rounded-card-sm border border-primary bg-accent px-3 py-2.5 text-left shadow-card">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-primary">Your niche</span>
        <p className="text-xs font-semibold text-heading">Corporate Fraud</p>
      </div>
    </div>
  );
}

function NicheFinderPreview() {
  const rows = [
    { name: "Medical Malpractice", category: "True crime", score: 94 },
    { name: "Corporate Espionage", category: "Business", score: 88 },
  ];
  return (
    <div className="flex w-full max-w-[240px] flex-col gap-2">
      {rows.map((row) => (
        <div
          key={row.name}
          className="flex items-center justify-between rounded-card-sm border border-hairline bg-surface px-3 py-2 text-left shadow-card"
        >
          <div>
            <p className="text-xs font-semibold text-heading">{row.name}</p>
            <p className="text-[10px] text-body">{row.category}</p>
          </div>
          <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-success">
            <TrendingUp className="h-3 w-3" />
            {row.score}
          </span>
        </div>
      ))}
    </div>
  );
}

function TranscriptPreview() {
  return (
    <div className="flex w-full max-w-[220px] flex-col gap-1.5 text-left">
      <div className="flex gap-2 text-[11px] text-body">
        <span className="font-mono">0:04</span>
        <span className="line-clamp-1">The $2.3M mistake surgeons hope you never learn about...</span>
      </div>
      <div className="flex gap-2 text-[11px] text-body">
        <span className="font-mono">0:09</span>
        <span className="line-clamp-1">Here&rsquo;s what actually happened...</span>
      </div>
    </div>
  );
}

function DownloaderPreview() {
  return (
    <div className="flex w-full max-w-[220px] flex-col gap-2.5 rounded-card-sm border border-hairline bg-surface px-3 py-2.5 text-left shadow-card">
      <div className="flex items-center gap-2 text-[11px] text-body">
        <LinkIcon className="h-3 w-3 shrink-0" />
        <span className="truncate font-mono">tiktok.com/@user/video/72&hellip;</span>
      </div>
      <div className="flex gap-1.5">
        <span className="rounded-full border border-primary bg-accent px-2 py-0.5 text-[10px] font-semibold text-primary">MP4</span>
        <span className="rounded-full border border-hairline px-2 py-0.5 text-[10px] font-semibold text-body">MP3</span>
      </div>
    </div>
  );
}

function McpPreview() {
  return (
    <div className="flex w-full max-w-[220px] flex-col gap-2 rounded-card-sm border border-hairline bg-surface px-3 py-2.5 text-left shadow-card">
      <div className="flex items-center gap-2">
        <Plug className="h-3.5 w-3.5 text-primary" />
        <span className="text-[10px] font-semibold uppercase tracking-wide text-body">Connected</span>
      </div>
      <p className="truncate font-mono text-[11px] text-heading">api.clypa.io/mcp/v1/sse</p>
      <div className="flex flex-wrap gap-1.5">
        <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-medium text-primary">Claude</span>
        <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-medium text-primary">ChatGPT</span>
      </div>
    </div>
  );
}

export default function AppHome() {
  return (
    <div className="flex flex-col gap-10 pt-2">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ActionCard
          variant="dark"
          title="Bend a Niche"
          subtitle="Turn a viral niche into your own"
          href="/app/bend"
          icon={Wand2}
        />
        <ActionCard
          variant="primary"
          title="Find Viral Niches"
          subtitle="Discover trending faceless niches"
          href="/app/niches"
          icon={ArrowRight}
        />
      </div>

      <ActionCard
        variant="light"
        title="Try our FREE tools"
        subtitle="Transcript extractor, hook generator, and more"
        href="/app/transcripts"
        icon={Star}
        wide
      />

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-body">Featured</h2>
        <div className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2">
          <PromoCard
            title="Niche Bending"
            description="Transfer a viral niche's winning structure into your own."
            previewSlot={<BendPreview />}
            href="/app/bend"
            icon={Wand2}
            tone="violet"
            size="wide"
          />
          <PromoCard
            title="Niche Finder"
            description="Discover trending faceless niches, ranked by momentum."
            previewSlot={<NicheFinderPreview />}
            href="/app/niches"
            icon={Compass}
            tone="blue"
          />
          <PromoCard
            title="Transcripts"
            description="Pull clean, timestamped transcripts from any TikTok, Reels, or Shorts video."
            previewSlot={<TranscriptPreview />}
            href="/app/transcripts"
            icon={Captions}
            tone="amber"
          />
          <PromoCard
            title="Downloader"
            description="Download high-quality video or MP3 audio from TikTok, YouTube, and Instagram."
            previewSlot={<DownloaderPreview />}
            href="/app/downloader"
            icon={Download}
            tone="green"
          />
          <PromoCard
            title="MCP"
            description="Connect Clypa to Claude or ChatGPT to bend niches and pull transcripts from chat."
            previewSlot={<McpPreview />}
            href="/app/mcp"
            icon={Plug}
            tone="rose"
          />
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-body">Clypa tools</h2>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-9">
          {DASHBOARD_TOOLS.map((tool) => (
            <ToolTile key={tool.label} tool={tool} />
          ))}
        </div>
      </section>
    </div>
  );
}
