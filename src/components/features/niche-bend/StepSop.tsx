"use client";

import { useEffect, useState } from "react";
import {
  BookOpen,
  Check,
  ClipboardCheck,
  Compass,
  Copy,
  FileDown,
  Flag,
  ListOrdered,
  Loader2,
  Magnet,
  Microscope,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { NicheBendSopResult } from "@/lib/types";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { buildSopDocxBlob } from "@/lib/niche-bend/export-docx";
import { buildSopPdfBlob } from "@/lib/niche-bend/export-pdf";
import { formatSopAsMarkdown } from "@/lib/niche-bend/markdown";
import { slugifySopTitle } from "@/lib/niche-bend/sop-blocks";
import { cn, downloadBlob } from "@/lib/utils";
import { ChannelAnalysisSummary } from "./ChannelAnalysisSummary";
import { ChannelAvatar } from "./ChannelAvatar";

const SECTIONS: { id: string; label: string; icon: LucideIcon }[] = [
  { id: "channel-overview", label: "1. Channel Overview", icon: Compass },
  { id: "hook-playbook", label: "2. Hook Playbook", icon: Zap },
  { id: "script-structure", label: "3. Script Structure Blueprint", icon: ListOrdered },
  { id: "storytelling-frameworks", label: "4. Storytelling Frameworks", icon: BookOpen },
  { id: "retention-mechanics", label: "5. Retention Mechanics", icon: Magnet },
  { id: "opening-closing", label: "6. Opening & Closing Patterns", icon: Flag },
  { id: "quick-reference", label: "7. Quick Reference Card", icon: ClipboardCheck },
  { id: "original-channel-analysis", label: "Original Channel Analysis", icon: Microscope },
];

function SectionHeading({ icon: Icon, children }: { icon: LucideIcon; children: string }) {
  return (
    <div className="flex items-center gap-2 border-b border-hairline pb-3">
      <Icon className="h-4 w-4 shrink-0 text-subtle" />
      <h2 className="text-base font-semibold tracking-tight text-heading">{children}</h2>
    </div>
  );
}

function DefRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-1 border-t border-hairline py-3 first:border-t-0 first:pt-0 sm:grid-cols-[168px_1fr] sm:gap-6">
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-subtle">{label}</dt>
      <dd className="text-sm leading-relaxed text-heading">{children}</dd>
    </div>
  );
}

function MoatNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-4 border-l-2 border-primary py-0.5 pl-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">Your-channel moat</p>
      <p className="mt-1 text-sm leading-relaxed text-body">{children}</p>
    </div>
  );
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
  const [downloading, setDownloading] = useState<"docx" | "pdf" | null>(null);
  const [downloadError, setDownloadError] = useState<"docx" | "pdf" | null>(null);
  const [activeSection, setActiveSection] = useState<string>(SECTIONS[0].id);

  useEffect(() => {
    const elements = SECTIONS.map((s) => document.getElementById(s.id)).filter(
      (el): el is HTMLElement => el !== null
    );
    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting);
        if (visible.length > 0) {
          setActiveSection(visible[0].target.id);
        }
      },
      { rootMargin: "-100px 0px -70% 0px", threshold: 0 }
    );
    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const handleCopyMarkdown = async () => {
    await navigator.clipboard.writeText(formatSopAsMarkdown(sop));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleDownload = async (format: "docx" | "pdf") => {
    setDownloading(format);
    setDownloadError(null);
    const filename = `${slugifySopTitle(content.title)}.${format}`;
    try {
      const blob = format === "docx" ? await buildSopDocxBlob(sop) : buildSopPdfBlob(sop);
      downloadBlob(blob, filename);
    } catch {
      setDownloadError(format);
      setTimeout(() => setDownloadError(null), 2000);
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="animate-bend-in flex flex-col gap-8 pb-16">
      <div className="rounded-card-lg border border-hairline bg-surface">
        <div className="flex flex-col gap-6 p-6 sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="shrink-0 overflow-hidden rounded-full ring-1 ring-hairline">
                <ChannelAvatar
                  name={sop.originalChannel.channelName}
                  avatarUrl={sop.originalChannel.avatarUrl}
                  platform={sop.originalChannel.platform}
                  size={52}
                />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-subtle">
                  Scripting SOP · {sop.originalChannel.platform === "youtube" ? "YouTube" : "TikTok"}
                </p>
                <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-heading sm:text-3xl">
                  {content.title}
                </h1>
                <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-body">{content.subtitle}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Button
                  variant="secondary"
                  size="sm"
                  bevel={false}
                  icon={downloading === "docx" ? undefined : FileDown}
                  disabled={downloading !== null}
                  onClick={() => handleDownload("docx")}
                >
                  {downloading === "docx" && <Loader2 className="h-4 w-4 shrink-0 animate-spin" />}
                  Download DOCX
                </Button>
                {downloadError === "docx" && (
                  <span className="absolute left-1/2 top-full z-10 mt-2 w-max -translate-x-1/2 rounded-chip bg-danger px-2.5 py-1 text-xs font-semibold text-white">
                    Download failed
                  </span>
                )}
              </div>
              <div className="relative">
                <Button
                  variant="secondary"
                  size="sm"
                  bevel={false}
                  icon={downloading === "pdf" ? undefined : FileDown}
                  disabled={downloading !== null}
                  onClick={() => handleDownload("pdf")}
                >
                  {downloading === "pdf" && <Loader2 className="h-4 w-4 shrink-0 animate-spin" />}
                  Download PDF
                </Button>
                {downloadError === "pdf" && (
                  <span className="absolute left-1/2 top-full z-10 mt-2 w-max -translate-x-1/2 rounded-chip bg-danger px-2.5 py-1 text-xs font-semibold text-white">
                    Download failed
                  </span>
                )}
              </div>
              <Button size="sm" bevel={false} icon={copied ? Check : Copy} onClick={handleCopyMarkdown}>
                {copied ? "Copied" : "Copy Markdown"}
              </Button>
            </div>
          </div>

          <div className="border-l-2 border-primary py-1 pl-4">
            <p className="text-sm leading-relaxed text-body">{content.onelinePromise}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[268px_1fr]">
        <nav className="rounded-card border border-hairline bg-surface p-3 lg:sticky lg:top-24 lg:self-start">
          <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wide text-subtle">On this page</p>
          <ul className="flex flex-col gap-0.5 text-sm">
            {SECTIONS.map((section) => {
              const Icon = section.icon;
              const active = activeSection === section.id;
              return (
                <li key={section.id}>
                  <a
                    href={`#${section.id}`}
                    className={cn(
                      "flex items-start gap-2 border-l-2 py-1.5 pl-3 pr-2 leading-snug transition-colors",
                      active
                        ? "border-primary font-semibold text-primary"
                        : "border-transparent text-body hover:border-hairline hover:text-heading"
                    )}
                  >
                    <Icon className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", active ? "text-primary" : "text-subtle")} />
                    <span>{section.label}</span>
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="flex flex-col gap-6">
          <Card id="channel-overview" shadow={false} className="scroll-mt-24">
            <SectionHeading icon={Compass}>1. Channel Overview</SectionHeading>
            <dl className="mt-1">
              <DefRow label="Channel">{content.channelOverview.channel}</DefRow>
              <DefRow label="Niche">{content.channelOverview.niche}</DefRow>
              <DefRow label="Narration POV">{content.channelOverview.narrationPov}</DefRow>
              <DefRow label="Avg length">{content.channelOverview.avgLength}</DefRow>
              <DefRow label="Format">{content.channelOverview.format}</DefRow>
              <DefRow label="Recurring themes">
                <BulletList items={content.channelOverview.recurringThemes} />
              </DefRow>
            </dl>
            <MoatNote>{content.channelOverview.yourChannelNote}</MoatNote>
          </Card>

          <Card id="hook-playbook" shadow={false} className="scroll-mt-24">
            <SectionHeading icon={Zap}>2. Hook Playbook</SectionHeading>
            <div className="flex flex-col divide-y divide-hairline">
              {content.hookPlaybook.map((hook, i) => (
                <div key={i} className="py-5 first:pt-4 last:pb-0">
                  <p className="text-sm font-semibold text-heading">&ldquo;{hook.template}&rdquo;</p>
                  <p className="mt-1.5 text-xs text-subtle">
                    <span className="font-semibold uppercase tracking-wide">Used in </span>
                    {hook.usedInVideos.join(", ")}
                  </p>
                  <p className="mt-2 text-sm text-body">
                    <span className="font-semibold text-heading">Psychology — </span>
                    {hook.psychology}
                  </p>
                  <p className="mt-1 text-sm text-body">
                    <span className="font-semibold text-heading">When to use — </span>
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
            </div>
          </Card>

          <Card id="script-structure" shadow={false} className="scroll-mt-24">
            <SectionHeading icon={ListOrdered}>3. Script Structure Blueprint</SectionHeading>
            <div className="mt-4 overflow-x-auto rounded-xl border border-hairline">
              <table className="w-full min-w-[480px] border-collapse text-sm">
                <thead>
                  <tr className="bg-app text-left text-[11px] font-semibold uppercase tracking-wide text-subtle">
                    <th className="px-4 py-2.5">Beat</th>
                    <th className="px-4 py-2.5">Timing</th>
                    <th className="px-4 py-2.5">Function</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline">
                  {content.scriptStructureBeats.map((beat, i) => (
                    <tr key={i}>
                      <td className="px-4 py-2.5 font-semibold text-heading">{beat.beat}</td>
                      <td className="px-4 py-2.5 text-body">{beat.timing}</td>
                      <td className="px-4 py-2.5 text-body">{beat.function}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card id="storytelling-frameworks" shadow={false} className="scroll-mt-24">
            <SectionHeading icon={BookOpen}>4. Storytelling Frameworks</SectionHeading>
            <div className="flex flex-col divide-y divide-hairline">
              {content.storytellingFrameworks.map((framework, i) => (
                <div key={i} className="py-5 first:pt-4 last:pb-0">
                  <h3 className="text-sm font-bold text-heading">{framework.name}</h3>
                  <p className="mt-1 text-sm text-body">{framework.howItWorks}</p>
                  <p className="mt-2 text-xs text-subtle">
                    <span className="font-semibold uppercase tracking-wide">Used in </span>
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
                    <div className="mt-3 border-l-2 border-primary py-0.5 pl-4">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">
                        Your-channel moat
                      </p>
                      <p className="mt-1 text-sm leading-relaxed text-body">{framework.yourChannelMoat}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>

          <Card id="retention-mechanics" shadow={false} className="scroll-mt-24 flex flex-col gap-5">
            <SectionHeading icon={Magnet}>5. Retention Mechanics</SectionHeading>
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

          <Card id="opening-closing" shadow={false} className="scroll-mt-24 flex flex-col gap-5">
            <SectionHeading icon={Flag}>6. Opening &amp; Closing Patterns</SectionHeading>
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

          <Card id="quick-reference" shadow={false} className="scroll-mt-24 flex flex-col gap-5 border-t-2 border-t-primary">
            <SectionHeading icon={ClipboardCheck}>7. Quick Reference Card</SectionHeading>
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
            <div className="grid grid-cols-1 gap-6 border-t border-hairline pt-4 sm:grid-cols-2 sm:divide-x sm:divide-hairline">
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
              <div className="sm:pl-6">
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

          <Card id="original-channel-analysis" shadow={false} className="scroll-mt-24">
            <SectionHeading icon={Microscope}>Original Channel Analysis</SectionHeading>
            <div className="mt-4">
              <ChannelAnalysisSummary analysis={sop.originalChannel} />
            </div>
          </Card>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3 border-t border-hairline pt-8">
        <Button variant="secondary" bevel={false} onClick={onReset}>
          Bend another channel
        </Button>
        <Button
          variant={saved ? "secondary" : "primary"}
          bevel={false}
          onClick={onToggleSaved}
          disabled={savingToggle}
        >
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
