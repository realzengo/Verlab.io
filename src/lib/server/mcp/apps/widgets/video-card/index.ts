import {
  connectApp,
  copyText,
  downloadUrl,
  escapeHtml,
  flashButton,
  formatDuration,
  openLink,
  panel,
  sendChatMessage,
  statusBadge,
  errorBadge,
  CHECK_ICON,
  DOWNLOAD_ICON,
  COPY_ICON,
  EXTERNAL_ICON,
  REFRESH_ICON,
  MIC_ICON,
  pollTool,
  renderErrorState,
  startElapsedTicker,
  startedAtFor,
  enterOnce,
  type ToolError,
} from "../../shared/host";

interface VideoData {
  id?: string;
  status?: string;
  model?: string | null;
  prompt?: string | null;
  durationSeconds?: number | null;
  aspectRatio?: string | null;
  resolution?: string | null;
  createdAt?: string | null;
  url?: string | null;
  downloadUrl?: string | null;
  appUrl?: string | null;
}

const root = document.getElementById("root")!;
let current: VideoData | null = null;
let renderToken = 0;

function frameStyle(aspectRatio: string | null | undefined): string {
  const [w, h] = (aspectRatio ?? "9:16").split(":").map(Number);
  if (!(w > 0 && h > 0)) return "aspect-ratio:9/16";
  // Landscape and square fill the canvas's width; portrait is sized by height.
  return w >= h ? `aspect-ratio:${w}/${h};width:100%;height:auto` : `aspect-ratio:${w}/${h}`;
}

function metaLine(data: VideoData | null): string {
  return [data?.model, data?.durationSeconds ? `${data.durationSeconds}s` : null, data?.aspectRatio, data?.resolution]
    .filter(Boolean)
    .map((part) => escapeHtml(String(part)))
    .join(' <span class="v-meta-dot">·</span> ');
}

function details(data: VideoData | null, extra = ""): string {
  const meta = metaLine(data);
  if (!data?.prompt && !meta && !extra) return "";
  return `
    <div class="v-section">
      ${data?.prompt ? `<p class="vc-prompt">${escapeHtml(data.prompt)}</p>` : ""}
      ${meta ? `<div class="v-meta">${meta}</div>` : ""}
      ${extra}
    </div>`;
}

function renderError(error: ToolError) {
  renderToken++;
  root.innerHTML = panel({ tool: "Video", aside: errorBadge(error), body: renderErrorState(error) });
}

function render(data: VideoData | null) {
  const token = ++renderToken;
  current = data;

  if (data?.status === "completed" && data.url) {
    root.innerHTML = panel({
      tool: "Video",
      aside: statusBadge("ready", "Ready"),
      enter: enterOnce(`${data.id}:ready`),
      flush: true,
      body: `
        <div class="v-canvas">
          <div class="v-media vc-frame" style="${frameStyle(data.aspectRatio)}">
            <video src="${escapeHtml(data.url)}" controls playsinline loop preload="metadata"></video>
          </div>
        </div>
        ${details(
          data,
          `<div class="v-next">
            <button type="button" class="v-chip" id="vc-variation">${REFRESH_ICON}Make a variation</button>
            <button type="button" class="v-chip" id="vc-voice">${MIC_ICON}Write a voiceover for it</button>
          </div>
          <div class="v-quick-status" id="quick-status" hidden></div>`
        )}`,
      footer: `
        <button type="button" class="v-btn v-btn-primary" id="vc-download">${DOWNLOAD_ICON}Download MP4</button>
        <button type="button" class="v-btn" id="vc-copy">${COPY_ICON}Copy link</button>
        <span class="v-spacer"></span>
        <button type="button" class="v-btn v-btn-ghost v-trail" id="vc-open">Open${EXTERNAL_ICON}</button>`,
    });
    const video = root.querySelector("video");
    video?.addEventListener("error", () => {
      const frame = root.querySelector(".vc-frame");
      if (frame) frame.innerHTML = `<div class="vc-unavailable">This host blocked inline playback. Use Open or Download.</div>`;
    });
    return;
  }

  const startedAt = startedAtFor(data?.id, data?.createdAt);
  const label = data?.status === "processing" ? "Rendering" : "Queued";
  root.innerHTML = panel({
    tool: "Video",
    aside: statusBadge("live", label),
    enter: enterOnce(`${data?.id}:working`),
    flush: true,
    body: `
      <div class="v-canvas">
        <div class="vc-frame vc-placeholder" style="${frameStyle(data?.aspectRatio)}" role="status" aria-live="polite">
          <span class="vc-spinner"></span>
          <div class="vc-label">${label}</div>
          <div class="vc-time" data-elapsed-since="${startedAt}">${formatDuration((Date.now() - startedAt) / 1000)}</div>
          <div class="vc-hint">Usually 1–4 minutes</div>
        </div>
      </div>
      ${details(data)}`,
  });

  if (data?.id && (data.status === "queued" || data.status === "processing")) {
    void pollTool<VideoData>(app, {
      tool: "check_video_status",
      args: { id: data.id },
      isCurrent: () => token === renderToken,
      isDone: (next) => next.status === "completed",
      onUpdate: (next) => {
        if (next.status !== current?.status) render(next);
      },
      onError: renderError,
      intervalMs: 5000,
      maxMs: 25 * 60_000,
      timeoutMessage: "The render is taking unusually long. It may still finish, so ask Claude to check the video status in a few minutes.",
    });
  }
}

function showQuickStatus(message: string) {
  const el = document.getElementById("quick-status");
  if (!el) return;
  el.hidden = false;
  el.textContent = message;
  setTimeout(() => (el.hidden = true), 3500);
}

startElapsedTicker();
render(null);
const app = connectApp({
  name: "Verlab Video",
  onResult: (result) => render((result.structuredContent as VideoData | undefined) ?? null),
  onError: renderError,
});

root.addEventListener("click", (event) => {
  const target = event.target as HTMLElement;
  if (!current) return;
  if (target.closest("#vc-download") && current.downloadUrl) {
    void downloadUrl(app, current.downloadUrl, `verlab-video-${(current.id ?? "").slice(0, 8)}.mp4`, "video/mp4");
  } else if (target.closest("#vc-open")) {
    openLink(app, current.url);
  } else if (target.closest("#vc-copy") && current.downloadUrl) {
    const button = target.closest<HTMLElement>("#vc-copy")!;
    void copyText(current.downloadUrl).then((ok) => flashButton(button, ok ? `${CHECK_ICON}Copied` : "Copy failed"));
  } else if (target.closest("#vc-variation")) {
    sendChatMessage(app, `Make a variation of that video (${current.model ?? "same model"}, ${current.aspectRatio ?? "9:16"}) with a fresh take on the prompt.`, showQuickStatus);
  } else if (target.closest("#vc-voice")) {
    sendChatMessage(app, "Write a short voiceover script that fits this video and generate it with generate_voiceover.", showQuickStatus);
  }
});
