"use client";

import { useState } from "react";
import { Check, Copy, FileDown, Loader2 } from "lucide-react";
import type { NicheBendSopResult } from "@/lib/types";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { formatSopAsMarkdown } from "@/lib/niche-bend/markdown";
import { ChannelAnalysisSummary } from "./ChannelAnalysisSummary";

const SECTIONS: { id: string; label: string }[] = [
  { id: "channel-overview", label: "1. Channel Overview" },
  { id: "hook-playbook", label: "2. Hook Playbook" },
  { id: "script-structure", label: "3. Script Structure Blueprint" },
  { id: "storytelling-frameworks", label: "4. Storytelling Frameworks" },
  { id: "retention-mechanics", label: "5. Retention Mechanics" },
  { id: "opening-closing", label: "6. Opening & Closing Patterns" },
  { id: "quick-reference", label: "7. Quick Reference Card" },
  { id: "original-channel-analysis", label: "Original Channel Analysis" },
];

function SectionHeading({ children }: { children: string }) {
  return <h2 className="text-base font-semibold text-heading">{children}</h2>;
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="mt-2 flex flex-col gap-1.5">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2 text-sm leading-snug text-body">
          <span className="shrink-0 font-semibold text-primary">→</span>
          {item}
        </li>
      ))}
    </ul>
  );
}

export function StepSop({
  sop,
  onReset,
  saved,
  savingToggle,
  onToggleSaved,
}: {
  sop: NicheBendSopResult;
  onReset: () => void;
  saved: boolean;
  savingToggle: boolean;
  onToggleSaved: () => void;
}) {
  const { content } = sop;
  const [copied, setCopied] = useState(false);
  const [comingSoon, setComingSoon] = useState<"docx" | "pdf" | null>(null);

  const handleCopyMarkdown = async () => {
    await navigator.clipboard.writeText(formatSopAsMarkdown(sop));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleDownload = (format: "docx" | "pdf") => {
    setComingSoon(format);
    setTimeout(() => setComingSoon(null), 1500);
  };

  return (
    <div className="animate-bend-in flex flex-col gap-8 pb-16">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-heading sm:text-3xl">{content.title}</h1>
          <p className="mt-1 text-sm text-body">{content.subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Button variant="secondary" size="sm" icon={FileDown} onClick={() => handleDownload("docx")}>
              Download DOCX
            </Button>
            {comingSoon === "docx" && (
              <span className="absolute left-1/2 top-full z-10 mt-2 w-max -translate-x-1/2 rounded-chip bg-ink px-2.5 py-1 text-xs font-semibold text-white">
                Coming soon
              </span>
            )}
          </div>
          <div className="relative">
            <Button variant="secondary" size="sm" icon={FileDown} onClick={() => handleDownload("pdf")}>
              Download PDF
            </Button>
            {comingSoon === "pdf" && (
              <span className="absolute left-1/2 top-full z-10 mt-2 w-max -translate-x-1/2 rounded-chip bg-ink px-2.5 py-1 text-xs font-semibold text-white">
                Coming soon
              </span>
            )}
          </div>
          <Button size="sm" icon={copied ? Check : Copy} onClick={handleCopyMarkdown}>
            {copied ? "Copied" : "Copy Markdown"}
          </Button>
        </div>
      </div>

      <p className="rounded-card border border-accent-line bg-accent px-5 py-4 text-sm font-medium leading-relaxed text-primary">
        {content.onelinePromise}
      </p>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[220px_1fr]">
        <nav className="lg:sticky lg:top-20 lg:self-start">
          <ul className="flex flex-col gap-1 text-sm">
            {SECTIONS.map((section) => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  className="block rounded-lg px-2.5 py-1.5 text-body hover:bg-accent hover:text-primary"
                >
                  {section.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex flex-col gap-6">
          <Card id="channel-overview" className="scroll-mt-24">
            <SectionHeading>1. Channel Overview</SectionHeading>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wide text-subtle">Channel</span>
                <p className="mt-1 text-sm text-heading">{content.channelOverview.channel}</p>
              </div>
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wide text-subtle">Niche</span>
                <p className="mt-1 text-sm text-heading">{content.channelOverview.niche}</p>
              </div>
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wide text-subtle">
                  Narration POV
                </span>
                <p className="mt-1 text-sm text-heading">{content.channelOverview.narrationPov}</p>
              </div>
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wide text-subtle">Avg length</span>
                <p className="mt-1 text-sm text-heading">{content.channelOverview.avgLength}</p>
              </div>
            </div>
            <div className="mt-3">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-subtle">Format</span>
              <p className="mt-1 text-sm leading-relaxed text-body">{content.channelOverview.format}</p>
            </div>
            <div className="mt-3">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-subtle">
                Recurring themes
              </span>
              <BulletList items={content.channelOverview.recurringThemes} />
            </div>
            <div className="mt-4 rounded-card-sm border border-accent-line bg-accent px-4 py-3 text-sm text-primary">
              <span className="font-semibold">Your-channel moat: </span>
              {content.channelOverview.yourChannelNote}
            </div>
          </Card>

          <Card id="hook-playbook" className="scroll-mt-24 flex flex-col gap-5">
            <SectionHeading>2. Hook Playbook</SectionHeading>
            {content.hookPlaybook.map((hook, i) => (
              <div key={i} className="rounded-card-sm border border-hairline p-4">
                <p className="text-sm font-semibold text-primary">&ldquo;{hook.template}&rdquo;</p>
                <p className="mt-2 text-xs text-subtle">
                  <span className="font-semibold uppercase tracking-wide">Used in: </span>
                  {hook.usedInVideos.join(", ")}
                </p>
                <p className="mt-2 text-sm text-body">
                  <span className="font-semibold text-heading">Psychology: </span>
                  {hook.psychology}
                </p>
                <p className="mt-1 text-sm text-body">
                  <span className="font-semibold text-heading">When to use: </span>
                  {hook.whenToUse}
                </p>
                <div className="mt-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-subtle">
                    For your channel
                  </span>
                  <BulletList items={hook.forYourChannelExamples} />
                </div>
              </div>
            ))}
          </Card>

          <Card id="script-structure" className="scroll-mt-24">
            <SectionHeading>3. Script Structure Blueprint</SectionHeading>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[480px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-hairline text-left text-[11px] font-semibold uppercase tracking-wide text-subtle">
                    <th className="py-2 pr-4">Beat</th>
                    <th className="py-2 pr-4">Timing</th>
                    <th className="py-2">Function</th>
                  </tr>
                </thead>
                <tbody>
                  {content.scriptStructureBeats.map((beat, i) => (
                    <tr key={i} className="border-b border-hairline last:border-0">
                      <td className="py-2 pr-4 font-semibold text-heading">{beat.beat}</td>
                      <td className="py-2 pr-4 text-body">{beat.timing}</td>
                      <td className="py-2 text-body">{beat.function}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card id="storytelling-frameworks" className="scroll-mt-24 flex flex-col gap-5">
            <SectionHeading>4. Storytelling Frameworks</SectionHeading>
            {content.storytellingFrameworks.map((framework, i) => (
              <div key={i} className="rounded-card-sm border border-hairline p-4">
                <h3 className="text-sm font-bold text-heading">{framework.name}</h3>
                <p className="mt-1 text-sm text-body">{framework.howItWorks}</p>
                <p className="mt-2 text-xs text-subtle">
                  <span className="font-semibold uppercase tracking-wide">Used in: </span>
                  {framework.usedInVideos.join(", ")}
                </p>
                <ol className="mt-2 flex flex-col gap-1.5">
                  {framework.steps.map((step, j) => (
                    <li key={j} className="flex gap-2 text-sm leading-snug text-heading">
                      <span className="shrink-0 text-body">{j + 1}.</span>
                      {step}
                    </li>
                  ))}
                </ol>
                {framework.signaturePhrases.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {framework.signaturePhrases.map((phrase, j) => (
                      <Badge key={j}>{phrase}</Badge>
                    ))}
                  </div>
                )}
                {framework.yourChannelMoat && (
                  <p className="mt-2 text-sm text-primary">
                    <span className="font-semibold">Your-channel moat: </span>
                    {framework.yourChannelMoat}
                  </p>
                )}
              </div>
            ))}
          </Card>

          <Card id="retention-mechanics" className="scroll-mt-24 flex flex-col gap-5">
            <SectionHeading>5. Retention Mechanics</SectionHeading>
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wide text-subtle">
                Rehook catalog
              </span>
              <ul className="mt-2 flex flex-col gap-2">
                {content.retentionMechanics.rehookCatalog.map((rehook, i) => (
                  <li key={i} className="text-sm text-body">
                    <span className="font-semibold text-heading">&ldquo;{rehook.phrase}&rdquo;</span> —{" "}
                    {rehook.whenToUse}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wide text-subtle">
                Pattern interrupts
              </span>
              <BulletList items={content.retentionMechanics.patternInterrupts} />
            </div>
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wide text-subtle">Open loops</span>
              <p className="mt-1 text-sm text-body">{content.retentionMechanics.openLoopsRule}</p>
            </div>
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wide text-subtle">
                Specificity spikes
              </span>
              <p className="mt-1 text-sm text-body">{content.retentionMechanics.specificitySpikesRule}</p>
              <BulletList items={content.retentionMechanics.specificityExamples} />
            </div>
          </Card>

          <Card id="opening-closing" className="scroll-mt-24 flex flex-col gap-5">
            <SectionHeading>6. Opening &amp; Closing Patterns</SectionHeading>
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wide text-subtle">
                First 30 seconds
              </span>
              <ol className="mt-2 flex flex-col gap-1.5">
                {content.openingClosingPatterns.first30SecondsTemplate.map((line, i) => (
                  <li key={i} className="flex gap-2 text-sm leading-snug text-heading">
                    <span className="shrink-0 text-body">S{i + 1}.</span>
                    {line}
                  </li>
                ))}
              </ol>
            </div>
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wide text-subtle">Hard rules</span>
              <BulletList items={content.openingClosingPatterns.hardRules} />
            </div>
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wide text-subtle">
                How videos end
              </span>
              <p className="mt-1 text-sm text-body">{content.openingClosingPatterns.howVideosEnd}</p>
            </div>
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wide text-subtle">
                Signature closing phrases
              </span>
              <BulletList items={content.openingClosingPatterns.signatureClosingPhrases} />
            </div>
          </Card>

          <Card id="quick-reference" className="scroll-mt-24 flex flex-col gap-5 border-primary/30 bg-accent">
            <SectionHeading>7. Quick Reference Card</SectionHeading>
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wide text-subtle">
                Hook formulas — pick one
              </span>
              <BulletList items={content.quickReferenceCard.hookFormulaPicks} />
            </div>
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wide text-subtle">Structure</span>
              <p className="mt-1 text-sm font-medium text-heading">
                {content.quickReferenceCard.beatStructureOneLine}
              </p>
            </div>
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wide text-subtle">Top rehooks</span>
              <BulletList items={content.quickReferenceCard.topRehooks} />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wide text-success">Do</span>
                <ul className="mt-1.5 flex flex-col gap-1.5">
                  {content.quickReferenceCard.dos.map((item, i) => (
                    <li key={i} className="flex gap-2 text-sm leading-snug text-heading">
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wide text-danger">Don&rsquo;t</span>
                <ul className="mt-1.5 flex flex-col gap-1.5">
                  {content.quickReferenceCard.donts.map((item, i) => (
                    <li key={i} className="flex gap-2 text-sm leading-snug text-heading">
                      <span className="mt-0.5 shrink-0 text-danger">✕</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Card>

          <Card id="original-channel-analysis" className="scroll-mt-24">
            <h2 className="mb-2 text-base font-semibold text-heading">Original Channel Analysis</h2>
            <ChannelAnalysisSummary analysis={sop.originalChannel} />
          </Card>
        </div>
      </div>

      <p className="text-center text-xs text-subtle">Part of your Zenstars protocols.</p>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button variant="secondary" onClick={onReset}>
          Bend another channel
        </Button>
        <Button variant={saved ? "secondary" : "primary"} onClick={onToggleSaved} disabled={savingToggle}>
          {savingToggle ? (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
          ) : saved ? (
            <Check className="h-4 w-4 shrink-0" />
          ) : null}
          {saved ? "Saved to library" : "Save to my library"}
        </Button>
      </div>
    </div>
  );
}
