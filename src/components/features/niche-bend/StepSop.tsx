"use client";

import { useEffect, useState } from "react";
import { Check, Copy, FileDown, Loader2 } from "lucide-react";
import type { NicheBendSopResult } from "@/lib/types";
import { BezelPanel, INK_BUTTON, INK_TITLE } from "@/components/brand/BrandKit";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { buildSopDocxBlob } from "@/lib/niche-bend/export-docx";
import { buildSopPdfBlob } from "@/lib/niche-bend/export-pdf";
import { formatSopAsMarkdown } from "@/lib/niche-bend/markdown";
import { slugifySopTitle } from "@/lib/niche-bend/sop-blocks";
import { cn, downloadBlob } from "@/lib/utils";
import { ChannelAnalysisSummary } from "./ChannelAnalysisSummary";
import { ChannelAvatar } from "./ChannelAvatar";

const SECTIONS: { id: string; label: string }[] = [
  { id: "channel-overview", label: "Channel overview" },
  { id: "hook-playbook", label: "Hook playbook" },
  { id: "script-structure", label: "Script structure" },
  { id: "storytelling-frameworks", label: "Storytelling frameworks" },
  { id: "retention-mechanics", label: "Retention mechanics" },
  { id: "opening-closing", label: "Opening and closing" },
  { id: "quick-reference", label: "Quick reference" },
  { id: "original-channel-analysis", label: "Original channel analysis" },
];

const LABEL = "text-xs font-medium text-subtle";

function SectionHeading({ id }: { id: string }) {
  const index = SECTIONS.findIndex((section) => section.id === id);
  const { label } = SECTIONS[index];
  return (
    <div className="flex items-center gap-3 border-b border-hairline pb-4">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-semibold tabular-nums text-primary dark:bg-primary/20 dark:text-[#8aa4ff]">
        {index + 1}
      </span>
      <h2 className="text-lg font-semibold tracking-[-0.01em] text-heading">{label}</h2>
    </div>
  );
}

const secondaryButton =
  "inline-flex h-9 items-center gap-1.5 rounded-full border border-hairline bg-white px-3.5 text-[13px] font-medium text-heading shadow-[0_1px_2px_rgba(15,23,42,0.06)] transition-colors duration-150 hover:bg-[#F7F8FA] disabled:pointer-events-none disabled:opacity-50 dark:bg-[#1C1C1F] dark:hover:bg-[#232326]";
const primaryButton = `${INK_BUTTON} h-9 px-4 text-[13px]`;

function DefRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-1 border-t border-hairline py-3 first:border-t-0 first:pt-0 sm:grid-cols-[168px_1fr] sm:gap-6">
      <dt className={LABEL}>{label}</dt>
      <dd className="text-sm leading-relaxed text-heading">{children}</dd>
    </div>
  );
}

function MoatNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-4 border-l-2 border-primary py-0.5 pl-4">
      <p className="text-xs font-medium text-primary">Your channel&apos;s moat</p>
      <p className="mt-1 text-sm leading-relaxed text-body">{children}</p>
    </div>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="mt-2 flex flex-col gap-1.5">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2 text-sm leading-snug text-body">
          <span aria-hidden className="mt-2 h-1 w-1 shrink-0 rounded-full bg-subtle/60" />
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
      <BezelPanel innerClassName="p-6 sm:p-10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <ChannelAvatar
              name={sop.originalChannel.channelName}
              avatarUrl={sop.originalChannel.avatarUrl}
              platform={sop.originalChannel.platform}
              size={36}
            />
            <p className="min-w-0 truncate text-sm text-subtle">
              Scripting SOP bent from <span className="font-medium text-heading">{sop.originalChannel.channelName}</span>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {(["docx", "pdf"] as const).map((format) => (
              <div key={format} className="relative">
                <button
                  type="button"
                  disabled={downloading !== null}
                  onClick={() => handleDownload(format)}
                  className={secondaryButton}
                >
                  {downloading === format ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <FileDown className="h-4 w-4 text-subtle" strokeWidth={1.75} />
                  )}
                  {format.toUpperCase()}
                </button>
                {downloadError === format && (
                  <span className="absolute left-1/2 top-full z-10 mt-2 w-max -translate-x-1/2 rounded-lg bg-danger px-2.5 py-1 text-xs font-medium text-white">
                    Download failed
                  </span>
                )}
              </div>
            ))}
            <button type="button" onClick={handleCopyMarkdown} className={primaryButton}>
              {copied ? <Check className="h-4 w-4" strokeWidth={2} /> : <Copy className="h-4 w-4" strokeWidth={1.75} />}
              {copied ? "Copied" : "Copy Markdown"}
            </button>
          </div>
        </div>

        <h1 className={cn(INK_TITLE, "mt-10 text-balance text-[36px] leading-[1.05] tracking-[-0.04em] sm:text-[52px]")}>
          {content.title}
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-subtle sm:text-[17px]">{content.subtitle}</p>

        <blockquote className="mt-8 border-l-2 border-primary pl-5 text-[15px] leading-relaxed text-heading">
          {content.onelinePromise}
        </blockquote>
      </BezelPanel>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[240px_1fr]">
        <nav aria-label="SOP sections" className="lg:sticky lg:top-20 lg:self-start">
          <p className="px-3 pb-2 text-xs font-medium text-subtle">On this page</p>
          <ul className="flex flex-col gap-0.5 text-sm">
            {SECTIONS.map((section, index) => {
              const active = activeSection === section.id;
              return (
                <li key={section.id}>
                  <a
                    href={`#${section.id}`}
                    aria-current={active ? "location" : undefined}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-1.5 leading-5 transition-colors duration-150",
                      active ? "bg-btn-secondary font-medium text-heading" : "text-subtle hover:text-heading"
                    )}
                  >
                    <span className={cn("w-4 shrink-0 text-xs tabular-nums", active ? "text-primary" : "text-subtle/70")}>
                      {index + 1}
                    </span>
                    <span>{section.label}</span>
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="flex flex-col gap-6">
          <Card id="channel-overview" shadow={false} className="scroll-mt-24">
            <SectionHeading id="channel-overview" />
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
            <SectionHeading id="hook-playbook" />
            <div className="flex flex-col divide-y divide-hairline">
              {content.hookPlaybook.map((hook, i) => (
                <div key={i} className="py-5 first:pt-4 last:pb-0">
                  <p className="text-sm font-semibold text-heading">&ldquo;{hook.template}&rdquo;</p>
                  <p className="mt-1.5 text-xs text-subtle">
                    <span className="font-medium">Used in </span>
                    {hook.usedInVideos.join(", ")}
                  </p>
                  <p className="mt-2 text-sm text-body">
                    <span className="font-semibold text-heading">Psychology, </span>
                    {hook.psychology}
                  </p>
                  <p className="mt-1 text-sm text-body">
                    <span className="font-semibold text-heading">When to use, </span>
                    {hook.whenToUse}
                  </p>
                  <div className="mt-2">
                    <span className={LABEL}>
                      For your channel
                    </span>
                    <BulletList items={hook.forYourChannelExamples} />
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card id="script-structure" shadow={false} className="scroll-mt-24">
            <SectionHeading id="script-structure" />
            <div className="mt-4 overflow-x-auto rounded-xl border border-hairline">
              <table className="w-full min-w-[480px] border-collapse text-sm">
                <thead>
                  <tr className="bg-app text-left text-xs font-medium text-subtle">
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
            <SectionHeading id="storytelling-frameworks" />
            <div className="flex flex-col divide-y divide-hairline">
              {content.storytellingFrameworks.map((framework, i) => (
                <div key={i} className="py-5 first:pt-4 last:pb-0">
                  <h3 className="text-sm font-bold text-heading">{framework.name}</h3>
                  <p className="mt-1 text-sm text-body">{framework.howItWorks}</p>
                  <p className="mt-2 text-xs text-subtle">
                    <span className="font-medium">Used in </span>
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
                      <p className="text-xs font-medium text-primary">Your channel&apos;s moat</p>
                      <p className="mt-1 text-sm leading-relaxed text-body">{framework.yourChannelMoat}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>

          <Card id="retention-mechanics" shadow={false} className="scroll-mt-24 flex flex-col gap-5">
            <SectionHeading id="retention-mechanics" />
            <div>
              <span className={LABEL}>
                Rehook catalog
              </span>
              <ul className="mt-2 flex flex-col gap-2">
                {content.retentionMechanics.rehookCatalog.map((rehook, i) => (
                  <li key={i} className="text-sm text-body">
                    <span className="font-semibold text-heading">&ldquo;{rehook.phrase}&rdquo;</span>,{" "}
                    {rehook.whenToUse}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <span className={LABEL}>
                Pattern interrupts
              </span>
              <BulletList items={content.retentionMechanics.patternInterrupts} />
            </div>
            <div>
              <span className={LABEL}>Open loops</span>
              <p className="mt-1 text-sm text-body">{content.retentionMechanics.openLoopsRule}</p>
            </div>
            <div>
              <span className={LABEL}>
                Specificity spikes
              </span>
              <p className="mt-1 text-sm text-body">{content.retentionMechanics.specificitySpikesRule}</p>
              <BulletList items={content.retentionMechanics.specificityExamples} />
            </div>
          </Card>

          <Card id="opening-closing" shadow={false} className="scroll-mt-24 flex flex-col gap-5">
            <SectionHeading id="opening-closing" />
            <div>
              <span className={LABEL}>
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
              <span className={LABEL}>Hard rules</span>
              <BulletList items={content.openingClosingPatterns.hardRules} />
            </div>
            <div>
              <span className={LABEL}>
                How videos end
              </span>
              <p className="mt-1 text-sm text-body">{content.openingClosingPatterns.howVideosEnd}</p>
            </div>
            <div>
              <span className={LABEL}>
                Signature closing phrases
              </span>
              <BulletList items={content.openingClosingPatterns.signatureClosingPhrases} />
            </div>
          </Card>

          <Card id="quick-reference" shadow={false} className="scroll-mt-24 flex flex-col gap-5">
            <SectionHeading id="quick-reference" />
            <div>
              <span className={LABEL}>
                Hook formulas, pick one
              </span>
              <BulletList items={content.quickReferenceCard.hookFormulaPicks} />
            </div>
            <div>
              <span className={LABEL}>Structure</span>
              <p className="mt-1 text-sm font-medium text-heading">
                {content.quickReferenceCard.beatStructureOneLine}
              </p>
            </div>
            <div>
              <span className={LABEL}>Top rehooks</span>
              <BulletList items={content.quickReferenceCard.topRehooks} />
            </div>
            <div className="grid grid-cols-1 gap-6 border-t border-hairline pt-4 sm:grid-cols-2 sm:divide-x sm:divide-hairline">
              <div>
                <span className="text-xs font-medium text-success">Do</span>
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
                <span className="text-xs font-medium text-danger">Don&rsquo;t</span>
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
            <SectionHeading id="original-channel-analysis" />
            <div className="mt-4">
              <ChannelAnalysisSummary analysis={sop.originalChannel} />
            </div>
          </Card>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3 border-t border-hairline pt-8">
        <button type="button" onClick={onReset} className={secondaryButton}>
          Bend another channel
        </button>
        <button
          type="button"
          onClick={onToggleSaved}
          disabled={savingToggle}
          className={saved ? secondaryButton : primaryButton}
        >
          {savingToggle ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : saved ? (
            <Check className="h-4 w-4" strokeWidth={2} />
          ) : null}
          {saved ? "Saved to library" : "Save to my library"}
        </button>
      </div>
    </div>
  );
}
