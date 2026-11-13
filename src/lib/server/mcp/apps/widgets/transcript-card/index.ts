import {
  connectApp,
  copyText,
  escapeHtml,
  flashButton,
  openLink,
  panel,
  sendChatMessage,
  statusBadge,
  errorBadge,
  CHECK_ICON,
  DOWNLOAD_ICON,
  CHEVRON_DOWN_ICON,
  COPY_ICON,
  EXTERNAL_ICON,
  PEN_ICON,
  pollTool,
  progressBlock,
  renderErrorState,
  startElapsedTicker,
  startedAtFor,
  enterOnce,
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

const EXPORTS: { kind: "srt" | "vtt" | "txt"; label: string }[] = [
  { kind: "srt", label: "Subtitles" },
  { kind: "vtt", label: "Web captions" },
  { kind: "txt", label: "Plain text" },
];

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

function watchButton(): string {
  return watchUrl ? `<button type="button" class="v-btn v-btn-ghost v-btn-sm tr-watch" id="watch-btn">Watch${EXTERNAL_ICON}</button>` : "";
}

function headRow(data: TranscriptData | null, meta: string): string {
  return `
    <div class="v-section tr-head">
      ${data?.coverUrl ? `<img class="tr-cover" src="${escapeHtml(data.coverUrl)}" alt="">` : ""}
      <div class="tr-head-text">
        <div class="v-title-md">${escapeHtml(data?.title ?? "Transcript")}</div>
        ${meta ? `<div class="v-meta">${meta}</div>` : ""}
      </div>
    </div>`;
}

function renderError(error: ToolError) {
  renderToken++;
  root.innerHTML = panel({ tool: "Transcript", aside: errorBadge(error), body: renderErrorState(error) });
}

function render(data: TranscriptData | null) {
  const token = ++renderToken;
  currentId = data?.id ?? null;
  watchUrl = data?.videoUrl ?? data?.embedUrl ?? null;
  currentLines = data?.lines ?? [];
  currentTitle = data?.title ?? "transcript";
  exportOpen = false;

  if (currentLines.length) {
    const words = currentLines.reduce((sum, line) => sum + line.text.split(/\s+/).filter(Boolean).length, 0);
    root.innerHTML = panel({
      tool: "Transcript",
      aside: watchButton(),
      enter: enterOnce(`${data?.id}:ready`),
      flush: true,
      body: `
        ${headRow(data, `${currentLines.length} line${currentLines.length === 1 ? "" : "s"} <span class="v-meta-dot">·</span> ${words.toLocaleString("en-US")} words`)}
        <div class="tr-lines v-scroll">${currentLines
          .map((line) => `<div class="tr-line"><span class="tr-ts">${escapeHtml(line.timestamp)}</span><span class="tr-text">${escapeHtml(line.text)}</span></div>`)
          .join("")}</div>`,
      footer: `
        <button type="button" class="v-btn" id="copy-all">${COPY_ICON}Copy text</button>
        <div class="tr-export">
          <button type="button" class="v-btn" id="export-toggle" aria-haspopup="menu" aria-expanded="false">${DOWNLOAD_ICON}Export<span class="tr-chevron">${CHEVRON_DOWN_ICON}</span></button>
          <div class="tr-menu" id="export-panel" role="menu" hidden>
            ${EXPORTS.map(({ kind, label }) => `<button type="button" role="menuitem" class="tr-menu-item" data-export="${kind}"><span>${label}</span><span class="tr-ext">.${kind}</span></button>`).join("")}
          </div>
        </div>
        <span class="v-spacer"></span>
        <button type="button" class="v-btn v-btn-primary" id="write-script">${PEN_ICON}Write a script like this</button>
        <div class="v-quick-status" id="quick-status" hidden></div>`,
    });
    return;
  }

  if (data?.status === "complete") {
    root.innerHTML = panel({
      tool: "Transcript",
      aside: watchButton(),
      flush: true,
      body: `${headRow(data, "")}<div class="v-empty">No speech was found in this video.</div>`,
    });
    return;
  }

  root.innerHTML = panel({
    tool: "Transcript",
    aside: statusBadge("live", "Extracting"),
    enter: enterOnce(`${data?.id}:working`),
    body: progressBlock({ label: "Extracting transcript", sublabel: "Usually 10–60 seconds", startedAt: startedAtFor(data?.id) }),
  });
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

startElapsedTicker();
render(null);
const app = connectApp({
  name: "Verlab Transcript",
  onResult: (result) => render((result.structuredContent as TranscriptData | undefined) ?? null),
  onError: renderError,
});

function showQuickStatus(message: string, ms = 3500) {
  const el = document.getElementById("quick-status");
  if (!el) return;
  el.hidden = false;
  el.textContent = message;
  setTimeout(() => (el.hidden = true), ms);
}

function setExportOpen(open: boolean) {
  exportOpen = open;
  const panelEl = document.getElementById("export-panel") as HTMLElement | null;
  const toggle = document.getElementById("export-toggle") as HTMLElement | null;
  if (panelEl) panelEl.hidden = !open;
  toggle?.classList.toggle("is-open", open);
  toggle?.setAttribute("aria-expanded", String(open));
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
    showQuickStatus(`Downloaded ${filename}`, 2500);
  } catch {
    // Host doesn't support (or denied) a mediated download -- clipboard is
    // the next best thing so the export button never dead-ends silently.
    try {
      await navigator.clipboard.writeText(content);
      showQuickStatus(`This host can't download files here, so the ${kind.toUpperCase()} was copied to your clipboard instead.`);
    } catch {
      showQuickStatus(`Couldn't export ${kind.toUpperCase()}. This host doesn't support downloads or clipboard access.`);
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
    void copyText(buildTxt(currentLines)).then((ok) => flashButton(copyAll, ok ? `${CHECK_ICON}Copied` : "Copy failed"));
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
    setExportOpen(!exportOpen);
    return;
  }

  const exportBtn = target.closest<HTMLButtonElement>("[data-export]");
  if (exportBtn) {
    setExportOpen(false);
    void exportTranscript(exportBtn.dataset.export as "srt" | "vtt" | "txt");
    return;
  }

  // Clicking anywhere else in the panel (or the document, below) dismisses
  // an open export menu -- otherwise it stays stuck open until the user
  // happens to hit the toggle again.
  if (exportOpen && !target.closest("#export-panel")) setExportOpen(false);
});

document.addEventListener("click", (event) => {
  if (exportOpen && !root.contains(event.target as Node)) setExportOpen(false);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && exportOpen) setExportOpen(false);
});
