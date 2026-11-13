import {
  connectApp,
  downloadUrl,
  escapeHtml,
  openLink,
  pad2,
  panel,
  sendChatMessage,
  statusBadge,
  errorBadge,
  DOWNLOAD_ICON,
  PEN_ICON,
  ARROW_RIGHT_ICON,
  pollTool,
  progressBlock,
  renderErrorState,
  stageList,
  startElapsedTicker,
  startedAtFor,
  enterOnce,
  type ToolError,
} from "../../shared/host";

interface AnalyzedVideo {
  title: string;
  views: string;
  url: string;
}
interface PerVideoInsight {
  title: string;
  insight: string;
}
interface CreatorAnalysisDetail {
  executiveSummary: string;
  hookFormula: string;
  pacingAndStructure: string;
  voiceAndTone: string;
  recurringPatterns: string;
  perVideoInsights: PerVideoInsight[];
  actionSteps: string[];
}
interface CreatorProfileData {
  id?: string;
  status?: string;
  channelName?: string | null;
  videos?: AnalyzedVideo[];
  summary?: string | null;
  analysis?: CreatorAnalysisDetail;
  docUrl?: string | null;
  docFilename?: string | null;
}

const root = document.getElementById("root")!;
let videos: AnalyzedVideo[] = [];
let channelName = "Creator";
let current: CreatorProfileData | null = null;
let renderToken = 0;

// Verlab only ever stores view counts as an already-humanized string (e.g.
// "126.9K") -- parsed back to a number purely to size bar-chart widths.
function parseViews(text: string): number {
  const match = text.replace(/,/g, "").match(/^([\d.]+)\s*([KMB])?$/i);
  if (!match) return 0;
  const value = parseFloat(match[1]);
  const multiplier = { K: 1_000, M: 1_000_000, B: 1_000_000_000 }[match[2]?.toUpperCase() as "K" | "M" | "B"] ?? 1;
  return value * multiplier;
}

// A ranked list with thin bars; only the top video carries the accent.
function renderBars(list: AnalyzedVideo[]): string {
  const maxViews = Math.max(1, ...list.map((video) => parseViews(video.views)));
  return list
    .map((video, index) => {
      const pct = Math.max(2, Math.round((parseViews(video.views) / maxViews) * 100));
      return `
        <button type="button" class="cp-row" data-index="${index}">
          <span class="v-index">${pad2(index + 1)}</span>
          <span class="cp-row-title">${escapeHtml(video.title)}</span>
          <span class="cp-track"><span class="cp-fill${index === 0 ? " is-top" : ""}" style="width:${pct}%"></span></span>
          <span class="cp-views">${escapeHtml(video.views)}</span>
        </button>`;
    })
    .join("");
}

function renderSection(title: string, body: string): string {
  return `
    <div class="cp-block">
      <div class="cp-block-title">${escapeHtml(title)}</div>
      <p class="cp-block-body">${escapeHtml(body)}</p>
    </div>`;
}

function renderFullReport(analysis: CreatorAnalysisDetail): string {
  const steps = analysis.actionSteps
    .map((step, index) => `<li class="cp-step"><span class="v-index">${pad2(index + 1)}</span><span>${escapeHtml(step)}</span></li>`)
    .join("");

  return `
    <div class="v-section cp-report">
      ${renderSection("The hook formula", analysis.hookFormula)}
      ${renderSection("Pacing and structure", analysis.pacingAndStructure)}
      ${renderSection("Voice and delivery", analysis.voiceAndTone)}
      ${renderSection("Recurring patterns", analysis.recurringPatterns)}
    </div>
    ${
      steps
        ? `<div class="v-section">
            <div class="cp-block-title">How to replicate this</div>
            <ol class="cp-steps">${steps}</ol>
          </div>`
        : ""
    }`;
}

function renderError(error: ToolError) {
  renderToken++;
  root.innerHTML = panel({ tool: "Creator analysis", aside: errorBadge(error), body: renderErrorState(error) });
}

function render(data: CreatorProfileData | null) {
  const token = ++renderToken;
  current = data;
  videos = data?.videos ?? [];
  channelName = data?.channelName ?? "Creator";

  if (data?.status === "complete" && videos.length) {
    const peakViews = videos[0]?.views;
    root.innerHTML = panel({
      tool: "Creator analysis",
      aside: statusBadge("ready", "Complete"),
      enter: enterOnce(`${data.id}:complete`),
      flush: true,
      body: `
        <div class="v-section cp-head">
          <h1 class="v-title-lg">${escapeHtml(channelName)}</h1>
          <div class="v-meta">${videos.length} videos analyzed${peakViews ? ` <span class="v-meta-dot">·</span> peak ${escapeHtml(peakViews)} views` : ""}</div>
          ${data.summary ? `<p class="cp-summary">${escapeHtml(data.summary)}</p>` : ""}
        </div>
        <div class="v-section">
          <div class="v-section-label">Top videos by views</div>
          <div class="cp-bench">${renderBars(videos)}</div>
        </div>
        ${data.analysis ? renderFullReport(data.analysis) : ""}
        <div class="v-section cp-next">
          <div class="v-next">
            <button type="button" class="v-chip" id="action-hooks">${ARROW_RIGHT_ICON}Extract top hooks</button>
            <button type="button" class="v-chip" id="action-script">${PEN_ICON}Write a script in this style</button>
          </div>
          <div class="v-quick-status" id="quick-status" hidden></div>
        </div>`,
      footer: data.docUrl
        ? `<span class="v-footer-note">The full breakdown as a Word document</span>
           <button type="button" class="v-btn v-btn-primary" id="doc-download">${DOWNLOAD_ICON}Download report</button>`
        : "",
    });
    return;
  }

  root.innerHTML = panel({
    tool: "Creator analysis",
    aside: statusBadge("live", "Analyzing"),
    enter: enterOnce(`${data?.id}:working`),
    body: `
      ${data?.channelName ? `<h1 class="v-title-lg cp-working-title">${escapeHtml(data.channelName)}</h1>` : ""}
      ${progressBlock({ label: "Analyzing the creator", sublabel: "Reading their top videos and real transcripts, about 1–3 minutes", startedAt: startedAtFor(data?.id) })}
      ${stageList(["Finding their most-viewed videos", "Extracting transcripts", "Breaking down hooks, pacing and delivery"], 1)}`,
  });
  if (data?.id && data.status === "processing") {
    void pollTool<CreatorProfileData>(app, {
      tool: "check_creator_analysis_status",
      args: { id: data.id },
      isCurrent: () => token === renderToken,
      isDone: (next) => next.status === "complete",
      onUpdate: (next) => {
        if (next.status === "complete") render(next);
      },
      onError: renderError,
      intervalMs: 4000,
      maxMs: 10 * 60_000,
    });
  }
}

function showQuickStatus(message: string) {
  const el = document.getElementById("quick-status") as HTMLElement | null;
  if (!el) return;
  el.hidden = false;
  el.textContent = message;
  setTimeout(() => {
    el.hidden = true;
  }, 3000);
}

startElapsedTicker();
render(null);
const app = connectApp({
  name: "Verlab Creator Analysis",
  onResult: (result) => render((result.structuredContent as CreatorProfileData | undefined) ?? null),
  onError: renderError,
});

root.addEventListener("click", (event) => {
  const target = event.target as HTMLElement;

  const bench = target.closest<HTMLButtonElement>(".cp-row");
  if (bench) {
    const video = videos[Number(bench.dataset.index)];
    openLink(app, video?.url);
    return;
  }

  if (target.closest("#doc-download") && current?.docUrl) {
    void downloadUrl(app, current.docUrl, current.docFilename ?? "Creator Analysis.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    return;
  }

  if (target.closest("#action-hooks")) {
    sendChatMessage(app, `Extract the top hooks from ${channelName}'s videos you just analyzed.`, showQuickStatus);
    return;
  }
  if (target.closest("#action-script")) {
    sendChatMessage(app, `Write me a script in ${channelName}'s style.`, showQuickStatus);
  }
});
