import type { NicheBendSopResult } from "@/lib/types";

export type SopBlock =
  | { type: "title"; text: string }
  | { type: "subtitle"; text: string }
  | { type: "callout"; text: string }
  | { type: "h2"; text: string }
  | { type: "h3"; text: string }
  | { type: "p"; text: string }
  | { type: "bullet"; text: string }
  | { type: "numbered"; text: string; index: number };

function bullets(items: string[]): SopBlock[] {
  return items.map((text) => ({ type: "bullet", text }));
}

export function getSopBlocks(sop: NicheBendSopResult): SopBlock[] {
  const { content, originalChannel } = sop;

  const blocks: SopBlock[] = [
    { type: "title", text: content.title },
    { type: "subtitle", text: content.subtitle },
    { type: "callout", text: content.onelinePromise },

    { type: "h2", text: "1. Channel Overview" },
    { type: "bullet", text: `Channel: ${content.channelOverview.channel}` },
    { type: "bullet", text: `Niche: ${content.channelOverview.niche}` },
    { type: "bullet", text: `Format: ${content.channelOverview.format}` },
    { type: "bullet", text: `Narration POV: ${content.channelOverview.narrationPov}` },
    { type: "bullet", text: `Avg length: ${content.channelOverview.avgLength}` },
    { type: "p", text: "Recurring themes:" },
    ...bullets(content.channelOverview.recurringThemes),
    { type: "p", text: `Your-channel note: ${content.channelOverview.yourChannelNote}` },

    { type: "h2", text: "2. Hook Playbook" },
    ...content.hookPlaybook.flatMap((hook, i): SopBlock[] => [
      { type: "h3", text: `${i + 1}. ${hook.template}` },
      { type: "bullet", text: `Used in: ${hook.usedInVideos.join(", ")}` },
      { type: "bullet", text: `Psychology: ${hook.psychology}` },
      { type: "bullet", text: `When to use: ${hook.whenToUse}` },
      { type: "p", text: "For your channel:" },
      ...bullets(hook.forYourChannelExamples),
    ]),

    { type: "h2", text: "3. Script Structure Blueprint" },
    ...content.scriptStructureBeats.map(
      (beat): SopBlock => ({ type: "bullet", text: `${beat.beat} (${beat.timing}), ${beat.function}` })
    ),

    { type: "h2", text: "4. Storytelling Frameworks" },
    ...content.storytellingFrameworks.flatMap((framework): SopBlock[] => [
      { type: "h3", text: framework.name },
      { type: "p", text: framework.howItWorks },
      { type: "bullet", text: `Used in: ${framework.usedInVideos.join(", ")}` },
      ...framework.steps.map((step, i): SopBlock => ({ type: "numbered", text: step, index: i + 1 })),
      ...(framework.signaturePhrases.length > 0
        ? [{ type: "p" as const, text: `Signature phrases: ${framework.signaturePhrases.join(", ")}` }]
        : []),
      ...(framework.yourChannelMoat
        ? [{ type: "p" as const, text: `Your-channel moat: ${framework.yourChannelMoat}` }]
        : []),
    ]),

    { type: "h2", text: "5. Retention Mechanics" },
    { type: "h3", text: "Rehook Catalog" },
    ...content.retentionMechanics.rehookCatalog.map(
      (r): SopBlock => ({ type: "bullet", text: `"${r.phrase}", ${r.whenToUse}` })
    ),
    { type: "h3", text: "Pattern Interrupts" },
    ...bullets(content.retentionMechanics.patternInterrupts),
    { type: "h3", text: "Open Loops" },
    { type: "p", text: content.retentionMechanics.openLoopsRule },
    { type: "h3", text: "Specificity Spikes" },
    { type: "p", text: content.retentionMechanics.specificitySpikesRule },
    ...bullets(content.retentionMechanics.specificityExamples),

    { type: "h2", text: "6. Opening & Closing Patterns" },
    { type: "h3", text: "First 30 Seconds" },
    ...content.openingClosingPatterns.first30SecondsTemplate.map(
      (line, i): SopBlock => ({ type: "numbered", text: line, index: i + 1 })
    ),
    { type: "h3", text: "Hard Rules" },
    ...bullets(content.openingClosingPatterns.hardRules),
    { type: "h3", text: "How Videos End" },
    { type: "p", text: content.openingClosingPatterns.howVideosEnd },
    { type: "h3", text: "Signature Closing Phrases" },
    ...bullets(content.openingClosingPatterns.signatureClosingPhrases),

    { type: "h2", text: "7. Quick Reference Card" },
    { type: "p", text: "Hook formulas, pick one:" },
    ...bullets(content.quickReferenceCard.hookFormulaPicks),
    { type: "p", text: `Structure: ${content.quickReferenceCard.beatStructureOneLine}` },
    { type: "p", text: "Top rehooks:" },
    ...bullets(content.quickReferenceCard.topRehooks),
    { type: "p", text: "Do:" },
    ...bullets(content.quickReferenceCard.dos),
    { type: "p", text: "Don't:" },
    ...bullets(content.quickReferenceCard.donts),

    { type: "h2", text: "Original Channel Analysis" },
    { type: "bullet", text: `Channel: ${originalChannel.channelName}` },
    { type: "bullet", text: `Detected niche: ${originalChannel.detectedNiche}` },
    { type: "bullet", text: `Format: ${originalChannel.format}` },
    { type: "h3", text: "Top videos" },
    ...originalChannel.topVideos.map(
      (video): SopBlock => ({ type: "bullet", text: `${video.title}, ${video.views} views` })
    ),
  ];

  return blocks;
}

export function slugifySopTitle(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "sop"
  );
}
