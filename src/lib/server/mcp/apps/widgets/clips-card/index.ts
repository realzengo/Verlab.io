import {
  connectApp,
  copyText,
  escapeHtml,
  flashButton,
  formatDuration,
  openLink,
  LOGO_MARK,
  COPY_ICON,
  PLAY_ICON,
  SCISSORS_ICON,
  CHEVRON_DOWN_ICON,
  pollTool,
  progressBlock,
  renderErrorState,
  stageList,
  startElapsedTicker,
  startedAtFor,
  type ToolError,
} from "../../shared/host";

interface ClipRow {
  id: string;
  start: number;
  end: number;
  durationSeconds: number;
  title: string;
  hookTitle?: string;
  reason?: string;
  score: number;
  scores?: { hook?: number; flow?: number; value?: number; trend?: number };
  caption?: string;
  hashtags?: string[];
  watchUrl: string;
}

interface ClipsData {
  id?: string;
  status?: string;
  stage?: string | null;
  title?: string | null;
  channel?: string | null;
  thumbnailUrl?: string | null;
  durationSeconds?: number | null;
  clips?: ClipRow[];
  editorUrl?: string | null;
}

const STAGES = ["Fetching the audio", "Transcribing every word", "Finding the viral moments"];
const STAGE_INDEX: Record<string, number> = { queued: 0, transcribing: 1, finding: 2, ready: 3 };

const root = document.getElementById("root")!;
let current: ClipsData | null = null;
let renderToken = 0;
const expanded = new Set<string>();

function captionFor(clip: ClipRow): string {
  const tags = (clip.hashtags ?? []).map((tag) => `#${tag.replace(/^#/, "")}`).join(" ");
  return [clip.caption ?? clip.title, tags].filter(Boolean).join("\n\n");
}

function sourceRow(data: ClipsData | null): string {
  if (!data?.title) return "";
  const meta = [data.channel, data.durationSeconds ? formatDuration(data.durationSeconds) : null].filter(Boolean).map((p) => escapeHtml(String(p))).join(" · ");
  return `
    <div class="cl-source">
      ${data.thumbnailUrl ? `<img class="cl-thumb" src="${escapeHtml(data.thumbnailUrl)}" alt="">` : `<div class="cl-thumb"></div>`}
      <div class="cl-source-text">
        <div class="cl-source-title">${escapeHtml(data.title)}</div>
        ${meta ? `<div class="v-meta">${meta}</div>` : ""}
      </div>
    </div>`;
}

function shell(body: string, pill = "") {
  return `
    <div class="v-card v-enter">
      <div class="v-header">
        ${LOGO_MARK}
        <span class="v-title">Verlab Clips</span>
        <span class="v-spacer"></span>
        ${pill}
      </div>
      ${sourceRow(current)}
      ${body}
    </div>`;
}

function renderError(error: ToolError) {
  renderToken++;
  root.innerHTML = shell(renderErrorState(error));
}

function scoreBars(scores: ClipRow["scores"]): string {
  const entries: [string, number | undefined][] = [
    ["Hook", scores?.hook],
    ["Flow", scores?.flow],
    ["Value", scores?.value],
    ["Trend", scores?.trend],
  ];
  return `<div class="cl-bars">${entries
    .filter(([, value]) => typeof value === "number")
    .map(
      ([label, value]) =>
        `<div class="cl-bar"><span>${label}</span><div class="cl-bar-track"><div class="cl-bar-fill" style="width:${Math.max(4, Math.min(100, value!))}%"></div></div><b>${value}</b></div>`
    )
    .join("")}</div>`;
}

function clipRow(clip: ClipRow, index: number): string {
  const open = expanded.has(clip.id);
  return `
    <div class="cl-clip${open ? " is-open" : ""}">
      <div class="cl-clip-main">
        <span class="v-score${index === 0 ? " is-top" : ""}">${clip.score}</span>
        <div class="cl-clip-text">
          <div class="cl-clip-title">${escapeHtml(clip.title)}</div>
          <div class="v-meta">${formatDuration(clip.start)} – ${formatDuration(clip.end)} <span class="v-meta-dot">·</span> ${clip.durationSeconds}s</div>
        </div>
        <button type="button" class="v-icon-btn cl-toggle" data-toggle="${escapeHtml(clip.id)}" aria-label="Details" aria-expanded="${open}">${CHEVRON_DOWN_ICON}</button>
      </div>
      ${
        open
          ? `<div class="cl-details">
              ${clip.hookTitle ? `<div class="cl-hook">“${escapeHtml(clip.hookTitle)}”</div>` : ""}
              ${clip.reason ? `<p class="cl-reason">${escapeHtml(clip.reason)}</p>` : ""}
              ${scoreBars(clip.scores)}
              ${clip.caption ? `<div class="cl-caption">${escapeHtml(captionFor(clip))}</div>` : ""}
            </div>`
          : ""
      }
      <div class="cl-clip-actions">
        <button type="button" class="v-link-btn" data-watch="${index}">${PLAY_ICON}Watch moment</button>
        <button type="button" class="v-link-btn" data-copy="${index}">${COPY_ICON}Copy caption</button>
      </div>
    </div>`;
}

function render(data: ClipsData | null) {
  const token = ++renderToken;
  current = data;

  if (data?.status === "ready") {
    const clips = data.clips ?? [];
    const avg = clips.length ? Math.round(clips.reduce((sum, c) => sum + c.durationSeconds, 0) / clips.length) : 0;
    root.innerHTML = shell(
      clips.length
        ? `
      <div class="cl-stats">
        <div class="v-stat-tile"><div class="v-stat-tile-value">${clips.length}</div><div class="v-stat-tile-label">clips found</div></div>
        <div class="v-stat-tile"><div class="v-stat-tile-value">${clips[0]?.score ?? 0}</div><div class="v-stat-tile-label">top score</div></div>
        <div class="v-stat-tile"><div class="v-stat-tile-value">${avg}s</div><div class="v-stat-tile-label">avg length</div></div>
      </div>
      <div class="cl-list">${clips.map(clipRow).join("")}</div>
      ${data.editorUrl ? `<button type="button" class="v-btn v-btn-primary cl-editor" data-open-url="${escapeHtml(data.editorUrl)}">${SCISSORS_ICON}Open in editor to export 9:16</button><div class="cl-editor-note">AI reframe, animated captions and hook titles, then download.</div>` : ""}`
        : `<div class="v-empty">No strong standalone moments were found in this video.</div>`,
      `<span class="v-pill v-pill-success">Ready</span>`
    );
    return;
  }

  const stageIndex = STAGE_INDEX[data?.status ?? "queued"] ?? 0;
  root.innerHTML = shell(`
    ${progressBlock({ label: data?.stage ?? "Starting", sublabel: "Usually 1-3 minutes. You can keep chatting meanwhile.", startedAt: startedAtFor(data?.id) })}
    ${stageList(STAGES, stageIndex)}`);

  if (data?.id && data.status !== "failed") {
    void pollTool<ClipsData>(app, {
      tool: "check_clips_status",
      args: { id: data.id },
      isCurrent: () => token === renderToken,
      isDone: (next) => next.status === "ready",
      onUpdate: (next) => {
        if (next.status !== current?.status) render(next);
      },
      onError: renderError,
      intervalMs: 4000,
      maxMs: 50 * 60_000,
    });
  }
}

startElapsedTicker();
render(null);
const app = connectApp({
  name: "Verlab Clips",
  onResult: (result) => render((result.structuredContent as ClipsData | undefined) ?? null),
  onError: renderError,
});

root.addEventListener("click", (event) => {
  const target = event.target as HTMLElement;
  const clips = current?.clips ?? [];

  const toggle = target.closest<HTMLElement>("[data-toggle]");
  if (toggle?.dataset.toggle) {
    const id = toggle.dataset.toggle;
    if (expanded.has(id)) expanded.delete(id);
    else expanded.add(id);
    // Swap just this row so the card doesn't replay its entrance.
    const index = clips.findIndex((clip) => clip.id === id);
    const rowEl = toggle.closest(".cl-clip");
    if (rowEl && index >= 0) rowEl.outerHTML = clipRow(clips[index], index);
    return;
  }
  const watch = target.closest<HTMLElement>("[data-watch]");
  if (watch) {
    openLink(app, clips[Number(watch.dataset.watch)]?.watchUrl);
    return;
  }
  const copy = target.closest<HTMLElement>("[data-copy]");
  if (copy) {
    const clip = clips[Number(copy.dataset.copy)];
    if (clip) void copyText(captionFor(clip)).then((ok) => flashButton(copy, ok ? `${COPY_ICON}Copied` : "Copy failed"));
  }
});
