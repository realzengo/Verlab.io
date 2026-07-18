import { jsPDF } from "jspdf";
import type { NicheBendSopResult } from "@/lib/types";
import { getSopBlocks } from "./sop-blocks";

const PAGE_MARGIN = 56;
const PAGE_WIDTH = 612; // US Letter, pt
const PAGE_HEIGHT = 792;
const CONTENT_WIDTH = PAGE_WIDTH - PAGE_MARGIN * 2;

export function buildSopPdfBlob(sop: NicheBendSopResult): Blob {
  const blocks = getSopBlocks(sop);
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  let y = PAGE_MARGIN;

  const ensureSpace = (needed: number) => {
    if (y + needed > PAGE_HEIGHT - PAGE_MARGIN) {
      doc.addPage();
      y = PAGE_MARGIN;
    }
  };

  const writeLines = (text: string, options: { size: number; style: string; lineHeight: number; indent?: number }) => {
    doc.setFont("helvetica", options.style);
    doc.setFontSize(options.size);
    const indent = options.indent ?? 0;
    const lines = doc.splitTextToSize(text, CONTENT_WIDTH - indent);
    for (const line of lines as string[]) {
      ensureSpace(options.lineHeight);
      doc.text(line, PAGE_MARGIN + indent, y);
      y += options.lineHeight;
    }
  };

  for (const block of blocks) {
    switch (block.type) {
      case "title":
        ensureSpace(30);
        writeLines(block.text, { size: 20, style: "bold", lineHeight: 24 });
        y += 4;
        break;
      case "subtitle":
        writeLines(block.text, { size: 11, style: "italic", lineHeight: 15 });
        y += 8;
        break;
      case "callout":
        y += 4;
        writeLines(block.text, { size: 11, style: "bold", lineHeight: 15, indent: 10 });
        y += 10;
        break;
      case "h2":
        y += 10;
        ensureSpace(22);
        writeLines(block.text, { size: 14, style: "bold", lineHeight: 18 });
        y += 2;
        break;
      case "h3":
        y += 6;
        writeLines(block.text, { size: 12, style: "bold", lineHeight: 16 });
        break;
      case "bullet":
        writeLines(`•  ${block.text}`, { size: 10, style: "normal", lineHeight: 14, indent: 10 });
        break;
      case "numbered":
        writeLines(`${block.index}. ${block.text}`, { size: 10, style: "normal", lineHeight: 14, indent: 10 });
        break;
      case "p":
      default:
        writeLines(block.text, { size: 10, style: "normal", lineHeight: 14 });
        break;
    }
  }

  return doc.output("blob");
}
