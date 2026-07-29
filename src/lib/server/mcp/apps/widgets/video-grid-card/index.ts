import { connectApp, escapeHtml, openLink } from "../../shared/host";

interface VideoRow {
  title: string;
  views: string;
  coverUrl: string | null;
  videoUrl: string;
  author: string;
  platform: "tiktok" | "youtube";
}
interface VideoGridData {
  videos: VideoRow[];
}

const root = document.getElementById("root")!;
let videos: VideoRow[] = [];

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

function render(data: VideoGridData | null) {
  videos = data?.videos ?? [];

  const cards = videos
    .map(
      (video, index) => `
      <button class="v-video" data-index="${index}">
        ${video.coverUrl ? `<img src="${video.coverUrl}" alt="">` : `<div class="v-video-thumb-empty"></div>`}
        <span class="v-video-badge">${video.platform === "tiktok" ? "TikTok" : "YouTube"}</span>
        <div class="v-video-info">
          <div class="v-video-title">${escapeHtml(truncate(video.title, 60))}</div>
          <div class="v-video-sub">${escapeHtml(video.views)} views · @${escapeHtml(video.author)}</div>
        </div>
      </button>
    `
    )
    .join("");

  root.innerHTML = `
    <div class="v-card">
      <div class="v-header">
        <img src="https://verlab.io/logo-icon.png" alt="">
        <span class="v-title">Verlab Trending</span>
      </div>
      <div class="v-grid">${cards || `<div class="v-empty">No videos found.</div>`}</div>
    </div>
  `;
}

render(null);
const app = connectApp({
  name: "Verlab Trending",
  onResult: (result) => render((result.structuredContent as VideoGridData | undefined) ?? null),
});

root.addEventListener("click", (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>(".v-video");
  if (!button) return;
  const video = videos[Number(button.dataset.index)];
  openLink(app, video?.videoUrl);
});
