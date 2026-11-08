import {
  connectApp,
  copyText,
  escapeHtml,
  flashButton,
  openLink,
  sendChatMessage,
  LOGO_MARK,
  DOWNLOAD_ICON,
  CHEVRON_DOWN_ICON,
  COPY_ICON,
  SPARK_ICON,
  pollTool,
  progressBlock,
  renderErrorState,
  startElapsedTicker,
  startedAtFor,
  type ToolError,
} from "../../shared/host";

interface Line {
  timestamp: string;
  text: string;
}
interface TranscriptData {
  id?: string;
  status?: string;
  title?: string | null;
  coverUrl?: string | null;
  videoUrl?: string | null;
  embedUrl?: string | null;
  lines?: Line[];
}

const root = document.getElementById("root")!;
let watchUrl: string | null = null;
let currentLines: Line[] = [];
let currentTitle = "transcript";
let exportOpen = false;
let currentId: string | null = null;
let renderToken = 0;

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

function renderError(error: ToolError) {
  renderToken++;
  root.innerHTML = `
    <div class="v-card v-enter">
      <div class="v-header">${LOGO_MARK}<span class="v-title">Verlab Transcript</span></div>
      ${renderErrorState(error)}
    </div>`;
}

function render(data: TranscriptData | null) {
  const token = ++renderToken;
  currentId = data?.id ?? null;
  watchUrl = data?.videoUrl ?? data?.embedUrl ?? null;
  currentLines = data?.lines ?? [];
  currentTitle = data?.title ?? "transcript";
  exportOpen = false;

  let body: string;
  if (currentLines.length) {
    const words = currentLines.reduce((sum, line) => sum + line.text.split(/\s+/).filter(Boolean).length, 0);
    body = `
      <div class="v-meta">
        <span>${currentLines.length} line${currentLines.length === 1 ? "" : "s"}</span><span class="v-meta-dot">&middot;</span><span>${words.toLocaleString()} words</span>
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
          <button type="button" class="v-quick-pill" data-export="srt">.srt</button>
          <button type="button" class="v-quick-pill" data-export="vtt">.vtt</button>
          <button type="button" class="v-quick-pill" data-export="txt">.txt</button>
        </div>
        <div class="v-export-status" id="export-status" hidden></div>
      </div>
      <div class="v-quick-actions">
        <button type="button" class="v-quick-pill" id="copy-all">${COPY_ICON}Copy text</button>
        <button type="button" class="v-quick-pill" id="write-script">${SPARK_ICON}Write a script in this style</button>
      </div>
      <div class="v-quick-status" id="quick-status" hidden></div>
    `;
  } else if (data?.status === "complete") {
    body = `<div class="v-empty">No speech was found in this video.</div>`;
  } else {
    body = progressBlock({ label: "Extracting transcript", sublabel: "Usually 10-60 seconds", startedAt: startedAtFor(data?.id) });
    if (data?.id && data.status === "processing") {
      void pollTool<TranscriptData>(app, {
        tool: "check_transcript_status",
        args: { id: data.id },
        isCurrent: () => token === renderToken,
        isDone: (next) => next.status === "complete",
        onUpdate: (next) => {
          if (next.status === "complete") render(next);
        },
        onError: renderError,
        maxMs: 9 * 60_000,
      });
    }
  }

  root.innerHTML = `
    <div class="v-card v-enter">
      <div class="v-header">
        ${LOGO_MARK}
        ${data?.coverUrl ? `<img src="${escapeHtml(data.coverUrl)}" alt="">` : ""}
        <span class="v-title">${escapeHtml(data?.title ?? "Verlab Transcript")}</span>
        <span class="v-spacer"></span>
        ${watchUrl ? `<button class="v-btn v-btn-primary" id="watch-btn">Watch</button>` : ""}
      </div>
      ${body}
    </div>
  `;
}

startElapsedTicker();
render(null);
const app = connectApp({
  name: "Verlab Transcript",
  onResult: (result) => render((result.structuredContent as TranscriptData | undefined) ?? null),
  onError: renderError,
});

function showQuickStatus(message: string) {
  const el = document.getElementById("quick-status");
  if (!el) return;
  el.hidden = false;
  el.textContent = message;
  setTimeout(() => (el.hidden = true), 3500);
}

function closeExportPanel() {
  if (!exportOpen) return;
  exportOpen = false;
  const panel = document.getElementById("export-panel") as HTMLElement | null;
  const toggle = document.getElementById("export-toggle") as HTMLElement | null;
  if (panel) panel.hidden = true;
  toggle?.classList.remove("is-open");
}

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
    const result = await app.downloadFile(
      { contents: [{ type: "resource", resource: { uri: `file:///${filename}`, mimeType: mimeTypes[kind], text: content } }] },
      { timeout: 8000 }
    );
    if (result.isError) throw new Error("denied");
    showExportStatus(`Downloaded ${filename}`);
  } catch {
    // Host doesn't support (or denied) a mediated download -- clipboard is
    // the next best thing so the export button never dead-ends silently.
    try {
      await navigator.clipboard.writeText(content);
      showExportStatus(`Host can't download files here. Copied ${kind.toUpperCase()} to clipboard instead.`);
    } catch {
      showExportStatus(`Couldn't export ${kind.toUpperCase()}. This host doesn't support downloads or clipboard access.`);
    }
  }
}

root.addEventListener("click", (event) => {
  const target = event.target as HTMLElement;

  if (target.closest("#watch-btn")) {
    openLink(app, watchUrl);
    return;
  }

  const copyAll = target.closest<HTMLElement>("#copy-all");
  if (copyAll) {
    void copyText(buildTxt(currentLines)).then((ok) => flashButton(copyAll, ok ? `${COPY_ICON}Copied` : "Copy failed"));
    return;
  }

  if (target.closest("#write-script")) {
    sendChatMessage(
      app,
      currentId
        ? `Write a new script in the style of this video, using generate_script with transcriptIds ["${currentId}"]. Ask me for the topic if you need it.`
        : "Write a new script in the style of this transcript.",
      showQuickStatus
    );
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
    closeExportPanel();
    void exportTranscript(exportBtn.dataset.export as "srt" | "vtt" | "txt");
    return;
  }

  // Clicking anywhere else in the card (or the document, below) dismisses
  // an open export panel -- otherwise it stays stuck open until the user
  // happens to hit the toggle again.
  if (exportOpen && !target.closest("#export-panel")) closeExportPanel();
});

document.addEventListener("click", (event) => {
  if (exportOpen && !root.contains(event.target as Node)) closeExportPanel();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && exportOpen) closeExportPanel();
});
