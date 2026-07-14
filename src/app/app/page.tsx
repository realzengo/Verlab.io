import { ArrowRight, Sparkles, Star, Wand2 } from "lucide-react";
import { MOCK_USER, DASHBOARD_TOOLS } from "@/lib/mock-data";
import { ActionCard } from "@/components/dashboard/ActionCard";
import { PromoCard } from "@/components/dashboard/PromoCard";
import { ToolTile } from "@/components/dashboard/ToolTile";
import { StreakBanner } from "@/components/dashboard/StreakBanner";

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

function SopPreview() {
  return (
    <div className="w-full max-w-[220px] rounded-card-sm border border-hairline bg-surface p-3 text-left shadow-card">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-body">Hook formula</span>
      <p className="mt-1 text-xs text-heading">&ldquo;The $[X] mistake [industry] hoped you&rsquo;d never find&rdquo;</p>
      <div className="mt-2 flex flex-col gap-1">
        <span className="h-1.5 w-full rounded-full bg-app" />
        <span className="h-1.5 w-4/5 rounded-full bg-app" />
        <span className="h-1.5 w-3/5 rounded-full bg-app" />
      </div>
    </div>
  );
}

function ScriptPreview() {
  return (
    <div className="w-full max-w-[220px] rounded-card-sm bg-accent p-3 text-left">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-primary">Hook</span>
      <p className="mt-1 text-xs font-medium text-heading">The $340M expense line that took down a CFO.</p>
    </div>
  );
}

function TranscriptPreview() {
  return (
    <div className="flex w-full max-w-[220px] flex-col gap-1.5 text-left">
      <div className="flex gap-2 text-[11px] text-body">
        <span className="font-mono">0:04</span>
        <span className="line-clamp-1">This surgery took eleven minutes longer...</span>
      </div>
      <div className="flex gap-2 text-[11px] text-body">
        <span className="font-mono">0:09</span>
        <span className="line-clamp-1">Here&rsquo;s what actually happened...</span>
      </div>
    </div>
  );
}

function AgentsPreview() {
  return (
    <div className="flex items-center gap-2">
      <div className="flex h-9 w-9 items-center justify-center rounded-chip bg-accent">
        <Sparkles className="h-4 w-4 text-primary" />
      </div>
      <div className="flex h-9 w-9 items-center justify-center rounded-chip bg-accent">
        <Wand2 className="h-4 w-4 text-primary" />
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
          />
          <PromoCard
            title="SOP Builder"
            description="Reverse-engineer any niche's script structure into a repeatable SOP."
            previewSlot={<SopPreview />}
            href="/app/sops"
          />
        </div>

        <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <PromoCard
            title="Script Maker"
            description="Generate ready-to-film scripts from a bent SOP."
            previewSlot={<ScriptPreview />}
            href="/app/scripts"
          />
          <PromoCard
            title="Transcript Extractor"
            description="Pull clean, timestamped transcripts from any short."
            previewSlot={<TranscriptPreview />}
            href="/app/transcripts"
          />
          <PromoCard
            title="Viral AI Agents"
            description="Hooks, rewrites, and virality breakdowns."
            previewSlot={<AgentsPreview />}
            href="/app/agents"
          />
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-body">Clypa tools</h2>
          <a href="/app/library" className="text-sm font-semibold text-primary hover:underline underline-offset-4">
            View all tools →
          </a>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-9">
          {DASHBOARD_TOOLS.map((tool) => (
            <ToolTile key={tool.label} tool={tool} />
          ))}
        </div>
      </section>

      <StreakBanner streak={MOCK_USER.streak} />
    </div>
  );
}
