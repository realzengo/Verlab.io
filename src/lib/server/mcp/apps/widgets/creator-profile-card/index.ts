import {
  connectApp,
  downloadUrl,
  escapeHtml,
  openLink,
  sendChatMessage,
  LOGO_MARK,
  DOWNLOAD_ICON,
  pollTool,
  progressBlock,
  renderErrorState,
  stageList,
  startElapsedTicker,
  startedAtFor,
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

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

// Verlab only ever stores view counts as an already-humanized string (e.g.
// "126.9K") -- parsed back to a number purely to size bar-chart widths.
function parseViews(text: string): number {
  const match = text.replace(/,/g, "").match(/^([\d.]+)\s*([KMB])?$/i);
  if (!match) return 0;
  const value = parseFloat(match[1]);
  const multiplier = { K: 1_000, M: 1_000_000, B: 1_000_000_000 }[match[2]?.toUpperCase() as "K" | "M" | "B"] ?? 1;
  return value * multiplier;
}

function renderBars(list: AnalyzedVideo[]): string {
  const maxViews = Math.max(1, ...list.map((video) => parseViews(video.views)));
  return list
    .map((video, index) => {
      const pct = Math.max(4, Math.round((parseViews(video.views) / maxViews) * 100));
      return `
        <button class="v-bench-row v-bench-row-link" data-index="${index}">
          <div class="v-bench-label">${escapeHtml(truncate(video.title, 40))}</div>
          <div class="v-bench-track"><div class="v-bench-fill${index < 3 ? " top" : ""}" style="width:${pct}%"></div></div>
          <div class="v-bench-value">${escapeHtml(video.views)}</div>
        </button>
      `;
    })
    .join("");
}

function renderSection(title: string, body: string): string {
  return `
    <div class="v-report-section">
      <div class="v-report-heading">${escapeHtml(title)}</div>
      <p class="v-report-body">${escapeHtml(body)}</p>
    </div>
  `;
}

function renderFullReport(analysis: CreatorAnalysisDetail, docUrl: string | null | undefined): string {
  const steps = analysis.actionSteps
    .map((step, index) => `<li class="v-step"><span class="v-step-num">${index + 1}</span><span>${escapeHtml(step)}</span></li>`)
    .join("");

  return `
    ${renderSection("The hook formula", analysis.hookFormula)}
    ${renderSection("Pacing and structure", analysis.pacingAndStructure)}
    ${renderSection("Voice and delivery", analysis.voiceAndTone)}
    ${renderSection("Recurring patterns", analysis.recurringPatterns)}
    <div class="v-report-section">
      <div class="v-report-heading">How to replicate this</div>
      <ol class="v-steps">${steps}</ol>
    </div>
    ${docUrl ? `<button type="button" class="v-btn v-btn-primary v-doc-btn" id="doc-download">${DOWNLOAD_ICON}Download the branded report (.docx)</button>` : ""}
  `;
}

function renderError(error: ToolError) {
  renderToken++;
  root.innerHTML = `
    <div class="v-card v-enter">
      <div class="v-header">${LOGO_MARK}<span class="v-title">${escapeHtml(channelName)}</span></div>
      ${renderErrorState(error)}
    </div>`;
}

function render(data: CreatorProfileData | null) {
  const token = ++renderToken;
  current = data;
  videos = data?.videos ?? [];
  channelName = data?.channelName ?? "Creator";

  let body: string;
  if (data?.status === "complete" && videos.length) {
    const peakViews = videos[0]?.views ?? "N/A";
    body = `
      <div class="v-stat-row">
        <div class="v-stat-tile"><div class="v-stat-tile-value">${videos.length}</div><div class="v-stat-tile-label">videos analyzed</div></div>
        <div class="v-stat-tile"><div class="v-stat-tile-value">${escapeHtml(peakViews)}</div><div class="v-stat-tile-label">peak views</div></div>
      </div>
      <div class="v-bench">${renderBars(videos)}</div>
      ${data?.summary ? `<p class="v-summary">${escapeHtml(data.summary)}</p>` : ""}
      ${data?.analysis ? renderFullReport(data.analysis, data.docUrl) : ""}
      <div class="v-quick-actions">
        <button type="button" class="v-quick-pill" id="action-hooks">Extract top hooks</button>
        <button type="button" class="v-quick-pill" id="action-script">Write a script in this style</button>
      </div>
      <div class="v-quick-status" id="quick-status" hidden></div>
    `;
  } else {
    body = `
      ${progressBlock({ label: "Analyzing the creator", sublabel: "Scraping top videos and reading real transcripts -- about 1-3 minutes", startedAt: startedAtFor(data?.id) })}
      ${stageList(["Finding their most-viewed videos", "Extracting transcripts", "Breaking down hooks, pacing and delivery"], 1)}`;
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

  root.innerHTML = `
    <div class="v-card v-enter">
      <div class="v-header">
        ${LOGO_MARK}
        <span class="v-title">${escapeHtml(channelName)}</span>
        <span class="v-spacer"></span>
        ${data?.status === "complete" ? `<span class="v-pill v-pill-success">Complete</span>` : ""}
      </div>
      ${body}
    </div>
  `;
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

  const bench = target.closest<HTMLButtonElement>(".v-bench-row-link");
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
