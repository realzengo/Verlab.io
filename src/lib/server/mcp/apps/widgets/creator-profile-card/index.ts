import { connectApp, escapeHtml, openLink, sendChatMessage, LOGO_MARK } from "../../shared/host";

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
  status?: string;
  channelName?: string | null;
  videos?: AnalyzedVideo[];
  summary?: string | null;
  analysis?: CreatorAnalysisDetail;
  docBase64?: string;
  docFilename?: string;
  note?: string;
  error_message?: string | null;
}

const root = document.getElementById("root")!;
let videos: AnalyzedVideo[] = [];
let channelName = "Creator";

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

function renderFullReport(analysis: CreatorAnalysisDetail, hasDoc: boolean): string {
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
    ${
      hasDoc
        ? `<div class="v-doc-hint">${LOGO_MARK}<span>Full branded report ready — ask Claude to save this as a Google Doc.</span></div>`
        : ""
    }
  `;
}

function render(data: CreatorProfileData | null) {
  videos = data?.videos ?? [];
  channelName = data?.channelName ?? "Creator";

  let body: string;
  if (data?.error_message) {
    body = `<div class="v-error">${escapeHtml(data.error_message)}</div>`;
  } else if (videos.length) {
    const peakViews = videos[0]?.views ?? "—";
    body = `
      <div class="v-stat-row">
        <div class="v-stat-tile"><div class="v-stat-tile-value">${videos.length}</div><div class="v-stat-tile-label">videos analyzed</div></div>
        <div class="v-stat-tile"><div class="v-stat-tile-value">${escapeHtml(peakViews)}</div><div class="v-stat-tile-label">peak views</div></div>
      </div>
      <div class="v-bench">${renderBars(videos)}</div>
      ${data?.summary ? `<p class="v-summary">${escapeHtml(data.summary)}</p>` : ""}
      ${data?.analysis ? renderFullReport(data.analysis, Boolean(data.docBase64)) : ""}
      <div class="v-quick-actions">
        <button type="button" class="v-quick-pill" id="action-hooks">Extract top hooks</button>
        <button type="button" class="v-quick-pill" id="action-script">Write a script in this style</button>
      </div>
    `;
  } else {
    body = `<div class="v-empty">${escapeHtml(data?.note ?? `Analyzing ${channelName}'s top videos…`)}</div>`;
  }

  root.innerHTML = `
    <div class="v-card">
      <div class="v-header">
        ${LOGO_MARK}
        <span class="v-title">${escapeHtml(channelName)}</span>
        <span class="v-spacer"></span>
        ${data?.status ? `<span class="v-pill">${escapeHtml(data.status)}</span>` : ""}
      </div>
      ${body}
    </div>
  `;
}

render(null);
const app = connectApp({
  name: "Verlab Creator Analysis",
  onResult: (result) => render((result.structuredContent as CreatorProfileData | undefined) ?? null),
});

root.addEventListener("click", (event) => {
  const target = event.target as HTMLElement;

  const bench = target.closest<HTMLButtonElement>(".v-bench-row-link");
  if (bench) {
    const video = videos[Number(bench.dataset.index)];
    openLink(app, video?.url);
    return;
  }

  if (target.closest("#action-hooks")) {
    sendChatMessage(app, `Extract the top hooks from ${channelName}'s videos you just analyzed.`);
    return;
  }
  if (target.closest("#action-script")) {
    sendChatMessage(app, `Write me a script in ${channelName}'s style.`);
  }
});
