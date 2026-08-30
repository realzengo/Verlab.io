import { connectApp, escapeHtml, LOGO_MARK } from "../../shared/host";

interface ScriptRow {
  prompt: string;
  created_at: string;
}
interface ImageRow {
  prompt: string;
  outputs: string[];
  created_at: string;
}
interface TopVideo {
  title: string;
  views: string;
}
interface SopRow {
  created_at: string;
  channelName: string | null;
  detectedNiche: string | null;
  topVideos: TopVideo[];
}
interface ListData {
  scripts?: ScriptRow[];
  images?: ImageRow[];
  sops?: SopRow[];
}

const root = document.getElementById("root")!;

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

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

function renderCreatorProfile(sop: SopRow): string {
  const videos = sop.topVideos.slice(0, 8);
  const maxViews = Math.max(1, ...videos.map((video) => parseViews(video.views)));
  const peakViews = videos[0]?.views ?? "—";

  const bars = videos
    .map((video, index) => {
      const pct = Math.max(4, Math.round((parseViews(video.views) / maxViews) * 100));
      return `
        <div class="v-bench-row">
          <div class="v-bench-label">${escapeHtml(truncate(video.title, 40))}</div>
          <div class="v-bench-track"><div class="v-bench-fill${index < 3 ? " top" : ""}" style="width:${pct}%"></div></div>
          <div class="v-bench-value">${escapeHtml(video.views)}</div>
        </div>
      `;
    })
    .join("");

  return `
    <div class="v-profile">
      <div class="v-profile-header">
        <div class="v-profile-name">${escapeHtml(sop.channelName ?? "Saved channel")}</div>
        ${sop.detectedNiche ? `<span class="v-pill">${escapeHtml(sop.detectedNiche)}</span>` : ""}
      </div>
      <div class="v-stat-row">
        <div class="v-stat-tile"><div class="v-stat-tile-value">${videos.length}</div><div class="v-stat-tile-label">videos analyzed</div></div>
        <div class="v-stat-tile"><div class="v-stat-tile-value">${escapeHtml(peakViews)}</div><div class="v-stat-tile-label">peak views</div></div>
      </div>
      ${videos.length ? `<div class="v-bench">${bars}</div>` : ""}
      <div class="v-row-sub">Saved ${formatDate(sop.created_at)}</div>
    </div>
  `;
}

function renderRows(data: ListData): string {
  const rows: string[] = [];

  for (const script of data.scripts ?? []) {
    rows.push(`
      <div class="v-row">
        <div class="v-row-main">
          <div class="v-row-title">${escapeHtml(truncate(script.prompt, 70))}</div>
          <div class="v-row-sub">Script · ${formatDate(script.created_at)}</div>
        </div>
      </div>
    `);
  }

  for (const image of data.images ?? []) {
    const thumb = image.outputs?.[0];
    rows.push(`
      <div class="v-row">
        ${thumb ? `<img class="v-row-thumb" src="${escapeHtml(thumb)}" alt="">` : ""}
        <div class="v-row-main">
          <div class="v-row-title">${escapeHtml(truncate(image.prompt, 60))}</div>
          <div class="v-row-sub">Image · ${formatDate(image.created_at)}</div>
        </div>
      </div>
    `);
  }

  for (const sop of data.sops ?? []) {
    rows.push(renderCreatorProfile(sop));
  }

  return rows.join("") || `<div class="v-empty">Nothing here yet.</div>`;
}

function render(data: ListData | null) {
  root.innerHTML = `
    <div class="v-card">
      <div class="v-header">
        ${LOGO_MARK}
        <span class="v-title">Verlab Library</span>
      </div>
      <div class="v-list">${renderRows(data ?? {})}</div>
    </div>
  `;
}

render(null);
connectApp({
  name: "Verlab Library",
  onResult: (result) => render((result.structuredContent as ListData | undefined) ?? null),
});
