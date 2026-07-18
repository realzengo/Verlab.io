import { AlignmentType, Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";
import type { NicheBendSopResult } from "@/lib/types";
import { getSopBlocks } from "./sop-blocks";

export async function buildSopDocxBlob(sop: NicheBendSopResult): Promise<Blob> {
  const blocks = getSopBlocks(sop);

  const paragraphs: Paragraph[] = blocks.map((block) => {
    switch (block.type) {
      case "title":
        return new Paragraph({
          text: block.text,
          heading: HeadingLevel.TITLE,
          spacing: { after: 120 },
        });
      case "subtitle":
        return new Paragraph({
          children: [new TextRun({ text: block.text, italics: true, color: "555555" })],
          spacing: { after: 240 },
        });
      case "callout":
        return new Paragraph({
          children: [new TextRun({ text: block.text, bold: true })],
          alignment: AlignmentType.LEFT,
          spacing: { after: 240 },
          border: {
            left: { color: "4C4CFF", space: 8, style: "single", size: 18 },
          },
          indent: { left: 200 },
        });
      case "h2":
        return new Paragraph({
          text: block.text,
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 320, after: 140 },
        });
      case "h3":
        return new Paragraph({
          text: block.text,
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 200, after: 100 },
        });
      case "bullet":
        return new Paragraph({
          text: block.text,
          bullet: { level: 0 },
          spacing: { after: 60 },
        });
      case "numbered":
        return new Paragraph({
          text: block.text,
          numbering: { reference: "sop-numbering", level: 0 },
          spacing: { after: 60 },
        });
      case "p":
      default:
        return new Paragraph({
          text: block.text,
          spacing: { after: 120 },
        });
    }
  });

  const doc = new Document({
    numbering: {
      config: [
        {
          reference: "sop-numbering",
          levels: [
            {
              level: 0,
              format: "decimal",
              text: "%1.",
              alignment: AlignmentType.START,
            },
          ],
        },
      ],
    },
    sections: [
      {
        properties: {},
        children: paragraphs,
      },
    ],
  });

  return Packer.toBlob(doc);
}
