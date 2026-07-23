import type { TranscriptRow } from "@/lib/types";

export type ExportFormat = "CSV" | "JSON" | "XML" | "TXT";

export const EXPORT_FORMATS: { id: ExportFormat; title: string; description: string }[] = [
  { id: "CSV", title: "CSV", description: "Comma-separated values (Excel compatible)" },
  { id: "JSON", title: "JSON", description: "Structured data format (developer-friendly)" },
  { id: "XML", title: "XML", description: "Structured markup format (legacy system compatible)" },
  { id: "TXT", title: "TXT", description: "Plain text format (universal compatibility)" },
];

const MIME: Record<ExportFormat, string> = {
  CSV: "text/csv;charset=utf-8",
  JSON: "application/json;charset=utf-8",
  XML: "application/xml;charset=utf-8",
  TXT: "text/plain;charset=utf-8",
};

const EXTENSION: Record<ExportFormat, string> = { CSV: "csv", JSON: "json", XML: "xml", TXT: "txt" };

function escapeCsvCell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function transcriptText(row: TranscriptRow): string {
  return (row.lines ?? []).map((line) => `[${line.timestamp}] ${line.text}`).join("\n");
}

function buildCsv(rows: TranscriptRow[]): string {
  const header = ["id", "title", "platform", "status", "source_url", "created_at", "duration_seconds", "transcript"];
  const lines = rows.map((row) =>
    [row.id, row.title ?? "", row.platform, row.status, row.source_url, row.created_at, row.duration_seconds ?? "", transcriptText(row)]
      .map((cell) => escapeCsvCell(String(cell)))
      .join(",")
  );
  return [header.join(","), ...lines].join("\n");
}

function buildJson(rows: TranscriptRow[]): string {
  return JSON.stringify(rows, null, 2);
}

function buildXml(rows: TranscriptRow[]): string {
  const items = rows
    .map(
      (row) => `  <transcript>
    <id>${escapeXml(row.id)}</id>
    <title>${escapeXml(row.title ?? "")}</title>
    <platform>${escapeXml(row.platform)}</platform>
    <status>${escapeXml(row.status)}</status>
    <sourceUrl>${escapeXml(row.source_url)}</sourceUrl>
    <createdAt>${escapeXml(row.created_at)}</createdAt>
    <durationSeconds>${row.duration_seconds ?? ""}</durationSeconds>
    <lines>
${(row.lines ?? [])
  .map((line) => `      <line timestamp="${escapeXml(line.timestamp)}">${escapeXml(line.text)}</line>`)
  .join("\n")}
    </lines>
  </transcript>`
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<transcripts>\n${items}\n</transcripts>`;
}

function buildTxt(rows: TranscriptRow[]): string {
  return rows
    .map((row) => `${row.title ?? row.source_url}\n${"=".repeat(40)}\n${transcriptText(row) || "(no transcript)"}`)
    .join("\n\n");
}

function buildContent(rows: TranscriptRow[], format: ExportFormat): string {
  switch (format) {
    case "CSV":
      return buildCsv(rows);
    case "JSON":
      return buildJson(rows);
    case "XML":
      return buildXml(rows);
    case "TXT":
      return buildTxt(rows);
  }
}

export function exportTranscripts(rows: TranscriptRow[], format: ExportFormat): void {
  const content = buildContent(rows, format);
  const blob = new Blob([content], { type: MIME[format] });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `transcripts-export.${EXTENSION[format]}`;
  link.click();
  URL.revokeObjectURL(url);
}
