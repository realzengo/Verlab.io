import { generateObject, type LanguageModel } from "ai";
import { z } from "zod";
import {
  AlignmentType,
  BorderStyle,
  Document,
  ExternalHyperlink,
  HeadingLevel,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import { OPENROUTER_INSTRUCT_MODEL, OPENROUTER_MAX_OUTPUT_TOKENS, openrouterInstructModel } from "@/lib/server/openrouter-client";
import { CLAUDE_MAX_OUTPUT_TOKENS, anthropicModel } from "@/lib/server/anthropic-client";

export interface CreatorVideoTranscript {
  title: string;
  views: string;
  text: string;
}

const CreatorAnalysisSchema = z.object({
  executiveSummary: z.string().describe("2-3 sentence high-level verdict on what makes this creator's content work."),
  hookFormula: z
    .string()
    .describe(
      "One tight paragraph on how they open/hook viewers in the first line -- quote or closely paraphrase a real line from the transcripts if it illustrates the pattern."
    ),
  pacingAndStructure: z
    .string()
    .describe("One tight paragraph on their pacing, sentence rhythm, and any structural device (reveal, list, direct address, etc.) that repeats."),
  voiceAndTone: z.string().describe("One tight paragraph on their point of view, tone, and delivery style."),
  recurringPatterns: z
    .string()
    .describe(
      "One tight paragraph naming any pattern that repeats across multiple videos. If the videos don't share an obvious pattern, say so honestly rather than inventing one."
    ),
  perVideoInsights: z
    .array(z.object({ title: z.string().describe("Must exactly match one of the given video titles."), insight: z.string().describe("One sentence on what this specific video does that ties back to the patterns above.") }))
    .describe("One entry per video provided, in the same order they were given."),
  actionSteps: z
    .array(z.string())
    .min(4)
    .max(7)
    .describe("Concrete, numbered steps someone could follow to replicate this creator's style in their own videos -- specific, not generic advice."),
});

export type CreatorAnalysis = z.infer<typeof CreatorAnalysisSchema>;

const ANALYSIS_SYSTEM_PROMPT =
  "You are a short-form video analyst. You've been given the real transcripts of a creator's top-performing videos. " +
  "Ground every claim specifically in what's actually said in these transcripts -- not generic advice. If the videos " +
  "don't share an obvious pattern, say so honestly rather than inventing one.";

function buildCreatorAnalysisPrompt(channelName: string, videos: CreatorVideoTranscript[]): string {
  const videoBlocks = videos
    .map(
      (video, index) =>
        `<VIDEO index="${index + 1}" views="${video.views}">
<TITLE>${video.title}</TITLE>
<TRANSCRIPT>${video.text || "(no speech detected)"}</TRANSCRIPT>
</VIDEO>`
    )
    .join("\n\n");

  return `Analyze ${channelName}'s content strategy using the real transcripts below, and structure your findings into the required format.

${videoBlocks}`;
}

// Same fallback shape as script-generation.ts's MODEL_CANDIDATES, but for a
// structured (generateObject) call instead of streamed text -- OpenRouter's
// instruct model first (cheap, reliable JSON mode), Claude as the backstop.
const ANALYSIS_MODEL_CANDIDATES: { model: LanguageModel; maxOutputTokens: number; label: string }[] = [
  { model: openrouterInstructModel, maxOutputTokens: Math.min(4000, OPENROUTER_MAX_OUTPUT_TOKENS), label: OPENROUTER_INSTRUCT_MODEL },
  { model: anthropicModel, maxOutputTokens: Math.min(4000, CLAUDE_MAX_OUTPUT_TOKENS), label: "claude-sonnet-5" },
];

export async function analyzeCreatorTranscripts(channelName: string, videos: CreatorVideoTranscript[]): Promise<CreatorAnalysis> {
  const prompt = buildCreatorAnalysisPrompt(channelName, videos);

  for (const candidate of ANALYSIS_MODEL_CANDIDATES) {
    try {
      const { object } = await generateObject({
        model: candidate.model,
        system: ANALYSIS_SYSTEM_PROMPT,
        messages: [{ role: "user", content: prompt }],
        schema: CreatorAnalysisSchema,
        maxOutputTokens: candidate.maxOutputTokens,
      });
      return object;
    } catch (error) {
      console.error(`analyzeCreatorTranscripts: ${candidate.label} failed`, error);
    }
  }

  throw new Error("All creator-analysis models are currently unavailable.");
}

// Verlab's brand palette (see src/app/globals.css) -- kept in hex-without-#
// since that's the format `docx` colors expect.
const BRAND = {
  primary: "335CFF",
  heading: "111827",
  body: "374151",
  subtle: "525866",
  accentFill: "EFF2FF",
  accentLine: "DBE2FF",
  hairline: "E5E5E5",
};

const PLATFORM_LABEL: Record<string, string> = { tiktok: "TikTok", youtube: "YouTube" };

function bodyParagraph(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, color: BRAND.body })],
    spacing: { after: 200 },
  });
}

function sectionHeading(text: string): Paragraph {
  return new Paragraph({
    text,
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 360, after: 160 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: BRAND.hairline, space: 6 } },
  });
}

function tableHeaderCell(text: string, widthPct: number): TableCell {
  return new TableCell({
    width: { size: widthPct, type: WidthType.PERCENTAGE },
    shading: { type: ShadingType.CLEAR, color: "auto", fill: BRAND.accentFill },
    children: [new Paragraph({ children: [new TextRun({ text, bold: true, color: BRAND.heading, size: 18 })] })],
  });
}

function tableBodyCell(children: Paragraph[], widthPct: number): TableCell {
  return new TableCell({ width: { size: widthPct, type: WidthType.PERCENTAGE }, children });
}

/**
 * Builds a fully branded Word (.docx) document for a completed creator
 * analysis -- Verlab colors, professional section structure, a per-video
 * breakdown table, and numbered action steps. Uploading this file to Google
 * Drive as `application/vnd.openxmlformats-officedocument.wordprocessingml.document`
 * auto-converts it into a native Google Doc (see mcp/tools.ts), so this is
 * the single source of truth for both the downloadable file and the doc the
 * user sees in Drive/Claude.
 */
export async function buildCreatorAnalysisDocx(
  channelName: string,
  sourceUrl: string,
  platform: string,
  videos: { title: string; views: string; url: string }[],
  analysis: CreatorAnalysis
): Promise<Buffer> {
  const dateStr = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const platformLabel = PLATFORM_LABEL[platform] ?? platform;

  const insightByTitle = new Map(analysis.perVideoInsights.map((entry) => [entry.title, entry.insight]));

  const tableRows: TableRow[] = [
    new TableRow({
      tableHeader: true,
      children: [tableHeaderCell("#", 6), tableHeaderCell("Video", 40), tableHeaderCell("Views", 14), tableHeaderCell("Insight", 40)],
    }),
    ...videos.map(
      (video, index) =>
        new TableRow({
          children: [
            tableBodyCell([new Paragraph({ children: [new TextRun({ text: String(index + 1), color: BRAND.subtle })] })], 6),
            tableBodyCell(
              [
                new Paragraph({
                  children: [
                    new ExternalHyperlink({
                      link: video.url,
                      children: [new TextRun({ text: video.title, color: BRAND.primary, underline: {} })],
                    }),
                  ],
                }),
              ],
              40
            ),
            tableBodyCell([new Paragraph({ children: [new TextRun({ text: video.views, color: BRAND.subtle })] })], 14),
            tableBodyCell(
              [new Paragraph({ children: [new TextRun({ text: insightByTitle.get(video.title) ?? "—", color: BRAND.body, size: 18 })] })],
              40
            ),
          ],
        })
    ),
  ];

  const doc = new Document({
    numbering: {
      config: [
        { reference: "creator-analysis-steps", levels: [{ level: 0, format: "decimal", text: "%1.", alignment: AlignmentType.START }] },
      ],
    },
    sections: [
      {
        properties: {},
        children: [
          // Brand header band
          new Paragraph({
            children: [new TextRun({ text: "VERLAB", bold: true, color: BRAND.primary, size: 18, characterSpacing: 30 })],
            spacing: { after: 80 },
          }),
          new Paragraph({
            children: [new TextRun({ text: `${channelName} — Content Strategy Analysis`, bold: true, color: BRAND.heading, size: 40 })],
            spacing: { after: 80 },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: `${platformLabel} • ${videos.length} videos analyzed • ${dateStr}`,
                italics: true,
                color: BRAND.subtle,
                size: 18,
              }),
            ],
            spacing: { after: 360 },
            border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: BRAND.hairline, space: 12 } },
          }),

          // Executive summary as a branded callout
          new Paragraph({
            children: [new TextRun({ text: analysis.executiveSummary, bold: true, color: BRAND.heading })],
            border: { left: { style: BorderStyle.SINGLE, size: 24, color: BRAND.primary, space: 12 } },
            indent: { left: 200 },
            spacing: { before: 120, after: 320 },
          }),

          sectionHeading("The Hook Formula"),
          bodyParagraph(analysis.hookFormula),

          sectionHeading("Pacing & Structure"),
          bodyParagraph(analysis.pacingAndStructure),

          sectionHeading("Voice & Delivery"),
          bodyParagraph(analysis.voiceAndTone),

          sectionHeading("Recurring Patterns"),
          bodyParagraph(analysis.recurringPatterns),

          sectionHeading("Video-by-Video Breakdown"),
          new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: tableRows }),
          new Paragraph({ text: "", spacing: { after: 240 } }),

          sectionHeading("How To Replicate This"),
          ...analysis.actionSteps.map(
            (step) =>
              new Paragraph({
                children: [new TextRun({ text: step, color: BRAND.body })],
                numbering: { reference: "creator-analysis-steps", level: 0 },
                spacing: { after: 140 },
              })
          ),

          // Footer
          new Paragraph({
            children: [
              new TextRun({
                text: `Generated by Verlab from ${sourceUrl}`,
                italics: true,
                color: BRAND.subtle,
                size: 16,
              }),
            ],
            border: { top: { style: BorderStyle.SINGLE, size: 6, color: BRAND.hairline, space: 12 } },
            spacing: { before: 400 },
          }),
        ],
      },
    ],
  });

  return Packer.toBuffer(doc);
}
