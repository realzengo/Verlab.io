import { connectApp, escapeHtml, openLink, LOGO_MARK, DOWNLOAD_ICON, CHEVRON_DOWN_ICON } from "../../shared/host";

interface Line {
  timestamp: string;
  text: string;
}
interface TranscriptData {
  title?: string | null;
  coverUrl?: string | null;
  videoUrl?: string | null;
  embedUrl?: string | null;
  lines?: Line[];
  note?: string;
  error_message?: string | null;
}

const root = document.getElementById("root")!;
let watchUrl: string | null = null;
let currentLines: Line[] = [];
let currentTitle = "transcript";
let exportOpen = false;

// Lines only carry a start timestamp ("M:SS" or "H:MM:SS", see
// formatTimestamp in lib/server/video-provider.ts) -- there's no per-line
// end time in the data, so SRT/VTT cues borrow the next line's start as
// their end (or pad the final line by a few seconds).
function parseTimestamp(raw: string): number {
  const parts = raw.trim().split(":").map(Number);
  if (parts.some((n) => Number.isNaN(n))) return 0;
  return parts.reduceRight((total, part, i) => total + part * Math.pow(60, parts.length - 1 - i), 0);
}

function pad(n: number, width = 2): string {
  return String(Math.max(0, Math.floor(n))).padStart(width, "0");
}

function formatClockTime(totalSeconds: number, msSep: "," | "."): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  const ms = Math.round((totalSeconds - Math.floor(totalSeconds)) * 1000);
  return `${pad(h)}:${pad(m)}:${pad(s)}${msSep}${pad(ms, 3)}`;
}

const TAIL_PAD_SECONDS = 3;

function cueBounds(lines: Line[]): { start: number; end: number }[] {
  const starts = lines.map((line) => parseTimestamp(line.timestamp));
  return starts.map((start, i) => ({ start, end: i < starts.length - 1 ? starts[i + 1] : start + TAIL_PAD_SECONDS }));
}

function buildSrt(lines: Line[]): string {
  const bounds = cueBounds(lines);
  return lines
    .map((line, i) => `${i + 1}\n${formatClockTime(bounds[i].start, ",")} --> ${formatClockTime(bounds[i].end, ",")}\n${line.text}\n`)
    .join("\n");
}

function buildVtt(lines: Line[]): string {
  const bounds = cueBounds(lines);
  const cues = lines
    .map((line, i) => `${formatClockTime(bounds[i].start, ".")} --> ${formatClockTime(bounds[i].end, ".")}\n${line.text}`)
    .join("\n\n");
  return `WEBVTT\n\n${cues}\n`;
}

function buildTxt(lines: Line[]): string {
  return lines.map((line) => line.text).join("\n");
}

function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "transcript"
  );
}

function render(data: TranscriptData | null) {
  watchUrl = data?.videoUrl ?? data?.embedUrl ?? null;
  currentLines = data?.lines ?? [];
  currentTitle = data?.title ?? "transcript";
  exportOpen = false;

  let body: string;
  if (data?.error_message) {
    body = `<div class="v-error">${escapeHtml(data.error_message)}</div>`;
  } else if (currentLines.length) {
    body = `
      <div class="v-meta">
        <span>${currentLines.length} line${currentLines.length === 1 ? "" : "s"}</span>
      </div>
      <div class="v-transcript">${currentLines
        .map(
          (line) =>
            `<div class="v-line"><span class="v-line-ts">${escapeHtml(line.timestamp)}</span><span class="v-line-text">${escapeHtml(line.text)}</span></div>`
        )
        .join("")}</div>
      <div class="v-export">
        <button type="button" class="v-export-toggle" id="export-toggle">
          ${DOWNLOAD_ICON}<span>Export</span><span class="v-export-chevron">${CHEVRON_DOWN_ICON}</span>
        </button>
        <div class="v-export-panel" id="export-panel" hidden>
          <button type="button" class="v-quick-pill" data-export="srt">.SRT</button>
          <button type="button" class="v-quick-pill" data-export="vtt">.VTT</button>
          <button type="button" class="v-quick-pill" data-export="txt">.TXT</button>
        </div>
        <div class="v-export-status" id="export-status" hidden></div>
      </div>
    `;
  } else {
    body = `<div class="v-empty">${escapeHtml(data?.note ?? "Extracting transcript…")}</div>`;
  }

  root.innerHTML = `
    <div class="v-card">
      <div class="v-header">
        ${LOGO_MARK}
        ${data?.coverUrl ? `<img src="${data.coverUrl}" alt="">` : ""}
        <span class="v-title">${escapeHtml(data?.title ?? "Verlab Transcript")}</span>
        <span class="v-spacer"></span>
        ${watchUrl ? `<button class="v-btn" id="watch-btn">Watch</button>` : ""}
      </div>
      ${body}
    </div>
  `;
}

render(null);
const app = connectApp({
  name: "Verlab Transcript",
  onResult: (result) => render((result.structuredContent as TranscriptData | undefined) ?? null),
});

function showExportStatus(message: string) {
  const el = document.getElementById("export-status") as HTMLElement | null;
  if (!el) return;
  el.hidden = false;
  el.textContent = message;
  setTimeout(() => {
    el.hidden = true;
  }, 2500);
}

async function exportTranscript(kind: "srt" | "vtt" | "txt") {
  const builders = { srt: buildSrt, vtt: buildVtt, txt: buildTxt } as const;
  const mimeTypes = { srt: "application/x-subrip", vtt: "text/vtt", txt: "text/plain" } as const;
  const content = builders[kind](currentLines);
  const filename = `${slugify(currentTitle)}.${kind}`;

  try {
    const result = await app.downloadFile({
      contents: [{ type: "resource", resource: { uri: `file:///${filename}`, mimeType: mimeTypes[kind], text: content } }],
    });
    if (result.isError) throw new Error("denied");
    showExportStatus(`Downloaded ${filename}`);
  } catch {
    // Host doesn't support (or denied) a mediated download -- clipboard is
    // the next best thing so the export button never dead-ends silently.
    await navigator.clipboard.writeText(content);
    showExportStatus(`Host can't download files here — copied ${kind.toUpperCase()} to clipboard instead.`);
  }
}

root.addEventListener("click", (event) => {
  const target = event.target as HTMLElement;

  if (target.closest("#watch-btn")) {
    openLink(app, watchUrl);
    return;
  }

  if (target.closest("#export-toggle")) {
    exportOpen = !exportOpen;
    const panel = document.getElementById("export-panel") as HTMLElement | null;
    const toggle = document.getElementById("export-toggle") as HTMLElement | null;
    if (panel) panel.hidden = !exportOpen;
    toggle?.classList.toggle("is-open", exportOpen);
    return;
  }

  const exportBtn = target.closest<HTMLButtonElement>("[data-export]");
  if (exportBtn) {
    void exportTranscript(exportBtn.dataset.export as "srt" | "vtt" | "txt");
  }
});
