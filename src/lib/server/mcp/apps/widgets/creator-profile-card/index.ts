import { connectApp, escapeHtml, openLink } from "../../shared/host";

interface AnalyzedVideo {
  title: string;
  views: string;
  url: string;
}
interface CreatorProfileData {
  status?: string;
  channelName?: string | null;
  videos?: AnalyzedVideo[];
  summary?: string | null;
  note?: string;
  error_message?: string | null;
}

const root = document.getElementById("root")!;
let videos: AnalyzedVideo[] = [];

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

function render(data: CreatorProfileData | null) {
  videos = data?.videos ?? [];
  const channelName = data?.channelName ?? "Creator";

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
    `;
  } else {
    body = `<div class="v-empty">${escapeHtml(data?.note ?? `Analyzing ${channelName}'s top videos…`)}</div>`;
  }

  root.innerHTML = `
    <div class="v-card">
      <div class="v-header">
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
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>(".v-bench-row-link");
  if (!button) return;
  const video = videos[Number(button.dataset.index)];
  openLink(app, video?.url);
});
