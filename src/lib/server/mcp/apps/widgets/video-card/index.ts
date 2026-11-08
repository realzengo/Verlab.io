import {
  connectApp,
  copyText,
  downloadUrl,
  escapeHtml,
  flashButton,
  formatDuration,
  openLink,
  sendChatMessage,
  LOGO_MARK,
  DOWNLOAD_ICON,
  COPY_ICON,
  EXTERNAL_ICON,
  SPARK_ICON,
  MIC_ICON,
  pollTool,
  renderErrorState,
  startElapsedTicker,
  startedAtFor,
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
  // Landscape and square fill the card's width; portrait is sized by height.
  return w >= h ? `aspect-ratio:${w}/${h};width:100%;height:auto` : `aspect-ratio:${w}/${h}`;
}

function metaLine(data: VideoData | null): string {
  return [data?.model, data?.durationSeconds ? `${data.durationSeconds}s` : null, data?.aspectRatio, data?.resolution]
    .filter(Boolean)
    .map((part) => escapeHtml(String(part)))
    .join(" · ");
}

function shell(body: string, pill = "") {
  const meta = metaLine(current);
  return `
    <div class="v-card v-enter">
      <div class="v-header">
        ${LOGO_MARK}
        <span class="v-title">Verlab Video</span>
        ${meta ? `<span class="v-sub">${meta}</span>` : ""}
        <span class="v-spacer"></span>
        ${pill}
      </div>
      ${body}
    </div>`;
}

function renderError(error: ToolError) {
  renderToken++;
  root.innerHTML = shell(renderErrorState(error));
}

function promptBlock(prompt: string | null | undefined): string {
  return prompt ? `<p class="vc-prompt">${escapeHtml(prompt)}</p>` : "";
}

function render(data: VideoData | null) {
  const token = ++renderToken;
  current = data;

  if (data?.status === "completed" && data.url) {
    root.innerHTML = shell(
      `
      <div class="vc-stage">
        <div class="v-media vc-frame" style="${frameStyle(data.aspectRatio)}">
          <video src="${escapeHtml(data.url)}" controls playsinline loop preload="metadata"></video>
        </div>
      </div>
      ${promptBlock(data.prompt)}
      <div class="v-btn-row">
        <button type="button" class="v-btn v-btn-primary" id="vc-download">${DOWNLOAD_ICON}Download MP4</button>
        <button type="button" class="v-btn" id="vc-open">${EXTERNAL_ICON}Open</button>
        <button type="button" class="v-btn" id="vc-copy">${COPY_ICON}Copy link</button>
      </div>
      <div class="v-quick-actions">
        <button type="button" class="v-quick-pill" id="vc-variation">${SPARK_ICON}Make a variation</button>
        <button type="button" class="v-quick-pill" id="vc-voice">${MIC_ICON}Write a voiceover for it</button>
      </div>
      <div class="v-quick-status" id="quick-status" hidden></div>`,
      '<span class="v-pill v-pill-success">Ready</span>'
    );
    const video = root.querySelector("video");
    video?.addEventListener("error", () => {
      const frame = root.querySelector(".vc-frame");
      if (frame) frame.innerHTML = `<div class="vc-unavailable">This host blocked inline playback. Use Open or Download.</div>`;
    });
    return;
  }

  const startedAt = startedAtFor(data?.id, data?.createdAt);
  const label = data?.status === "processing" ? "Rendering" : "Queued";
  root.innerHTML = shell(`
    <div class="vc-stage">
      <div class="v-media vc-frame vc-rendering" style="${frameStyle(data?.aspectRatio)}">
        <div class="vc-glow"></div>
        <div class="vc-center">
          <span class="vc-spinner"></span>
          <div class="vc-label">${label}</div>
          <div class="vc-time" data-elapsed-since="${startedAt}">${formatDuration((Date.now() - startedAt) / 1000)}</div>
          <div class="vc-hint">Usually 1-4 minutes</div>
        </div>
      </div>
    </div>
    ${promptBlock(data?.prompt)}`);

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
      timeoutMessage: "The render is taking unusually long. It may still finish -- ask Claude to check the video status in a few minutes.",
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
    void copyText(current.downloadUrl).then((ok) => flashButton(button, ok ? "Copied" : "Copy failed"));
  } else if (target.closest("#vc-variation")) {
    sendChatMessage(app, `Make a variation of that video (${current.model ?? "same model"}, ${current.aspectRatio ?? "9:16"}) with a fresh take on the prompt.`, showQuickStatus);
  } else if (target.closest("#vc-voice")) {
    sendChatMessage(app, "Write a short voiceover script that fits this video and generate it with generate_voiceover.", showQuickStatus);
  }
});
