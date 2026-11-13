import {
  connectApp,
  downloadUrl,
  escapeHtml,
  openLink,
  panel,
  sendChatMessage,
  statusBadge,
  errorBadge,
  DOWNLOAD_ICON,
  EXTERNAL_ICON,
  FILM_ICON,
  pollTool,
  progressBlock,
  renderErrorState,
  startElapsedTicker,
  startedAtFor,
  enterOnce,
  type ToolError,
} from "../../shared/host";

interface ImageData {
  id?: string;
  status?: string;
  images?: string[];
  downloads?: string[];
  refs?: string[];
  outputs?: number | null;
  model?: string | null;
  aspectRatio?: string | null;
  prompt?: string | null;
}

const root = document.getElementById("root")!;
let current: ImageData | null = null;
let renderToken = 0;

function ratioStyle(aspectRatio: string | null | undefined): string {
  const [w, h] = (aspectRatio ?? "1:1").split(":").map(Number);
  return w > 0 && h > 0 ? `aspect-ratio:${w}/${h}` : "aspect-ratio:1/1";
}

function details(data: ImageData | null, count: number, extra = ""): string {
  const meta = [data?.model, data?.aspectRatio, `${count} image${count === 1 ? "" : "s"}`]
    .filter(Boolean)
    .map((part) => escapeHtml(String(part)))
    .join(' <span class="v-meta-dot">·</span> ');
  return `
    <div class="v-section">
      ${data?.prompt ? `<p class="ig-prompt">${escapeHtml(data.prompt)}</p>` : ""}
      <div class="v-meta">${meta}</div>
      ${extra}
    </div>`;
}

function renderError(error: ToolError) {
  renderToken++;
  root.innerHTML = panel({ tool: "Image", aside: errorBadge(error), body: renderErrorState(error) });
}

function render(data: ImageData | null) {
  const token = ++renderToken;
  current = data;
  const images = data?.images ?? [];

  if (data?.status === "completed" && images.length) {
    const grid = images.length > 1 ? "is-grid" : "";
    root.innerHTML = panel({
      tool: "Image",
      aside: statusBadge("ready", "Ready"),
      enter: enterOnce(`${data.id}:ready`),
      flush: true,
      body: `
        <div class="v-canvas">
          <div class="ig-list ${grid}">
            ${images
              .map(
                (src, index) => `
              <figure class="ig-tile" style="${ratioStyle(data.aspectRatio)}">
                <img src="${escapeHtml(src)}" alt="${escapeHtml(data.prompt ?? "Generated image")}" loading="lazy">
                <figcaption class="ig-actions">
                  <button class="ig-act" data-action="animate" data-index="${index}" type="button">${FILM_ICON}Animate</button>
                  <span class="ig-actions-gap"></span>
                  <button class="ig-act ig-act-icon" data-action="download" data-index="${index}" type="button" title="Download" aria-label="Download">${DOWNLOAD_ICON}</button>
                  <button class="ig-act ig-act-icon" data-action="view" data-index="${index}" type="button" title="Open full size" aria-label="Open full size">${EXTERNAL_ICON}</button>
                </figcaption>
              </figure>`
              )
              .join("")}
          </div>
        </div>
        ${details(data, images.length, `<div class="v-quick-status" id="quick-status" hidden></div>`)}`,
    });
    return;
  }

  const count = Math.max(1, Number(data?.outputs) || 1);
  root.innerHTML = panel({
    tool: "Image",
    aside: statusBadge("live", "Generating"),
    enter: enterOnce(`${data?.id}:working`),
    flush: true,
    body: `
      <div class="v-canvas">
        <div class="ig-list ${count > 1 ? "is-grid" : ""}">
          ${Array.from({ length: count }, () => `<div class="ig-tile ig-skeleton" style="${ratioStyle(data?.aspectRatio)}"></div>`).join("")}
        </div>
      </div>
      <div class="v-section">
        ${progressBlock({ label: `Generating ${count > 1 ? `${count} images` : "image"}`, sublabel: "Usually 10–40 seconds", startedAt: startedAtFor(data?.id) })}
      </div>`,
  });

  if (data?.id && data.status === "generating") {
    void pollTool<ImageData>(app, {
      tool: "check_image_status",
      args: { id: data.id },
      isCurrent: () => token === renderToken,
      isDone: (next) => next.status === "completed",
      onUpdate: (next) => {
        if (next.status === "completed") render(next);
      },
      onError: renderError,
      maxMs: 7 * 60_000,
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
  name: "Verlab Image",
  onResult: (result) => render((result.structuredContent as ImageData | undefined) ?? null),
  onError: renderError,
});

root.addEventListener("click", (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-action]");
  if (!button || !current) return;
  const index = Number(button.dataset.index);
  const src = current.images?.[index];
  if (!src) return;

  if (button.dataset.action === "download") {
    void downloadUrl(app, current.downloads?.[index] ?? src, `verlab-image-${index + 1}.png`, "image/png");
  } else if (button.dataset.action === "animate") {
    const ref = current.refs?.[index] ?? src;
    const vertical = current.aspectRatio === "9:16" || current.aspectRatio === "2:3" || current.aspectRatio === "3:4";
    sendChatMessage(app, `Animate image ${ref} into a ${vertical ? "vertical 9:16" : "short"} video with generate_video.`, showQuickStatus);
  } else {
    openLink(app, src);
  }
});
