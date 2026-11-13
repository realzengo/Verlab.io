import { connectApp, escapeHtml, openLink, panel, PLAY_ICON } from "../../shared/host";

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

function render(data: VideoGridData | null) {
  videos = data?.videos ?? [];

  const cards = videos
    .map(
      (video, index) => `
      <button type="button" class="tg-video" data-index="${index}" aria-label="${escapeHtml(video.title)}">
        <span class="tg-cover">
          ${video.coverUrl ? `<img src="${escapeHtml(video.coverUrl)}" alt="" loading="lazy">` : ""}
          <span class="tg-platform">${video.platform === "tiktok" ? "TikTok" : "YouTube"}</span>
          <span class="tg-views">${PLAY_ICON}${escapeHtml(video.views)}</span>
        </span>
        <span class="tg-title">${escapeHtml(video.title)}</span>
        <span class="tg-author">@${escapeHtml(video.author)}</span>
      </button>`
    )
    .join("");

  root.innerHTML = panel({
    tool: "Trending",
    enter: data ? "v-enter" : "",
    aside: videos.length ? `<span class="v-aside v-aside-mono">${videos.length} videos</span>` : "",
    body: data ? (cards ? `<div class="tg-grid">${cards}</div>` : `<div class="v-empty">No videos found</div>`) : `<div class="v-empty">Loading videos…</div>`,
  });
}

render(null);
const app = connectApp({
  name: "Verlab Trending",
  onResult: (result) => render((result.structuredContent as VideoGridData | undefined) ?? null),
});

root.addEventListener("click", (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>(".tg-video");
  if (!button) return;
  const video = videos[Number(button.dataset.index)];
  openLink(app, video?.videoUrl);
});
