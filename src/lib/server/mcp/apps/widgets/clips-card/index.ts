import {
  connectApp,
  copyText,
  escapeHtml,
  flashButton,
  formatDuration,
  openLink,
  panel,
  statusBadge,
  errorBadge,
  CHECK_ICON,
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
  enterOnce,
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
  const meta = [data.channel, data.durationSeconds ? formatDuration(data.durationSeconds) : null]
    .filter(Boolean)
    .map((p) => escapeHtml(String(p)))
    .join(' <span class="v-meta-dot">·</span> ');
  return `
    <div class="v-section cl-source">
      ${data.thumbnailUrl ? `<img class="cl-thumb" src="${escapeHtml(data.thumbnailUrl)}" alt="">` : `<div class="cl-thumb"></div>`}
      <div class="cl-source-text">
        <div class="cl-source-title">${escapeHtml(data.title)}</div>
        ${meta ? `<div class="v-meta">${meta}</div>` : ""}
      </div>
    </div>`;
}

function renderError(error: ToolError) {
  renderToken++;
  root.innerHTML = panel({
    tool: "Clips",
    aside: errorBadge(error),
    flush: true,
    body: `${sourceRow(current)}<div class="v-section">${renderErrorState(error)}</div>`,
  });
}

function scoreBars(scores: ClipRow["scores"]): string {
  const entries: [string, number | undefined][] = [
    ["Hook", scores?.hook],
    ["Flow", scores?.flow],
    ["Value", scores?.value],
    ["Trend", scores?.trend],
  ];
  const rows = entries.filter(([, value]) => typeof value === "number");
  if (!rows.length) return "";
  return `<div class="cl-bars">${rows
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
        <span class="cl-score${index === 0 ? " is-top" : ""}" title="Viral score">${clip.score}</span>
        <div class="cl-clip-text" data-toggle="${escapeHtml(clip.id)}">
          <div class="cl-clip-title">${escapeHtml(clip.title)}</div>
          <div class="v-meta">${formatDuration(clip.start)}–${formatDuration(clip.end)} <span class="v-meta-dot">·</span> ${clip.durationSeconds}s</div>
        </div>
        <button type="button" class="v-btn v-btn-ghost v-btn-sm cl-watch" data-watch="${index}" aria-label="Watch this moment">${PLAY_ICON}<span class="cl-watch-label">Watch</span></button>
        <button type="button" class="v-icon-btn cl-toggle" data-toggle="${escapeHtml(clip.id)}" aria-label="${open ? "Hide" : "Show"} details" aria-expanded="${open}">${CHEVRON_DOWN_ICON}</button>
      </div>
      ${
        open
          ? `<div class="cl-details">
              ${clip.hookTitle ? `<div class="cl-hook">“${escapeHtml(clip.hookTitle)}”</div>` : ""}
              ${clip.reason ? `<p class="cl-reason">${escapeHtml(clip.reason)}</p>` : ""}
              ${scoreBars(clip.scores)}
              ${
                clip.caption
                  ? `<div class="cl-caption">
                      <div class="cl-caption-head"><span>Caption</span><button type="button" class="v-btn v-btn-ghost v-btn-sm" data-copy="${index}">${COPY_ICON}Copy</button></div>
                      <div class="cl-caption-text">${escapeHtml(captionFor(clip))}</div>
                    </div>`
                  : `<div class="cl-copy-row"><button type="button" class="v-btn v-btn-ghost v-btn-sm" data-copy="${index}">${COPY_ICON}Copy caption</button></div>`
              }
            </div>`
          : ""
      }
    </div>`;
}

function render(data: ClipsData | null) {
  const token = ++renderToken;
  current = data;

  if (data?.status === "ready") {
    const clips = data.clips ?? [];
    const avg = clips.length ? Math.round(clips.reduce((sum, c) => sum + c.durationSeconds, 0) / clips.length) : 0;
    root.innerHTML = panel({
      tool: "Clips",
      aside: statusBadge("ready", "Ready"),
      enter: enterOnce(`${data.id}:ready`),
      flush: true,
      body: clips.length
        ? `
        ${sourceRow(data)}
        <div class="cl-stats">
          <div class="cl-stat"><div class="cl-stat-value">${clips.length}</div><div class="cl-stat-label">Clips found</div></div>
          <div class="cl-stat"><div class="cl-stat-value is-accent">${clips[0]?.score ?? 0}</div><div class="cl-stat-label">Top score</div></div>
          <div class="cl-stat"><div class="cl-stat-value">${avg}s</div><div class="cl-stat-label">Average length</div></div>
        </div>
        <div class="cl-list v-scroll">${clips.map(clipRow).join("")}</div>`
        : `${sourceRow(data)}<div class="v-empty">No strong standalone moments were found in this video.</div>`,
      footer:
        clips.length && data.editorUrl
          ? `<span class="v-footer-note">Reframe to 9:16 and add captions in the editor, then export</span>
             <button type="button" class="v-btn v-btn-primary" data-open-url="${escapeHtml(data.editorUrl)}">${SCISSORS_ICON}Open in editor</button>`
          : "",
    });
    return;
  }

  const stageIndex = STAGE_INDEX[data?.status ?? "queued"] ?? 0;
  root.innerHTML = panel({
    tool: "Clips",
    aside: statusBadge("live", "Working"),
    enter: enterOnce(`${data?.id}:working`),
    flush: true,
    body: `
      ${sourceRow(data)}
      <div class="v-section">
        ${progressBlock({ label: data?.stage ?? "Starting", sublabel: "Usually 1–3 minutes. You can keep chatting meanwhile.", startedAt: startedAtFor(data?.id) })}
        ${stageList(STAGES, stageIndex)}
      </div>`,
  });

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

  const watch = target.closest<HTMLElement>("[data-watch]");
  if (watch) {
    openLink(app, clips[Number(watch.dataset.watch)]?.watchUrl);
    return;
  }
  const copy = target.closest<HTMLElement>("[data-copy]");
  if (copy) {
    const clip = clips[Number(copy.dataset.copy)];
    if (clip) void copyText(captionFor(clip)).then((ok) => flashButton(copy, ok ? `${CHECK_ICON}Copied` : "Copy failed"));
    return;
  }
  const toggle = target.closest<HTMLElement>("[data-toggle]");
  if (toggle?.dataset.toggle) {
    const id = toggle.dataset.toggle;
    if (expanded.has(id)) expanded.delete(id);
    else expanded.add(id);
    // Swap just this row so the panel doesn't replay its entrance.
    const index = clips.findIndex((clip) => clip.id === id);
    const rowEl = toggle.closest(".cl-clip");
    if (rowEl && index >= 0) rowEl.outerHTML = clipRow(clips[index], index);
  }
});
