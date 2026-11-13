import {
  connectApp,
  copyText,
  escapeHtml,
  flashButton,
  openLink,
  panel,
  statusBadge,
  errorBadge,
  COPY_ICON,
  CHECK_ICON,
  DOWNLOAD_ICON,
  FILE_VIDEO_ICON,
  pollTool,
  progressBlock,
  renderErrorState,
  startElapsedTicker,
  startedAtFor,
  enterOnce,
  type ToolError,
} from "../../shared/host";

interface DownloadData {
  id?: string;
  status?: string;
  progress?: number | null;
  title?: string | null;
  url?: string | null;
  format?: string | null;
}

const root = document.getElementById("root")!;
let current: DownloadData | null = null;
let renderToken = 0;

function fileRow(meta: string): string {
  return `
    <div class="dl-file">
      <span class="dl-icon">${FILE_VIDEO_ICON}</span>
      <div class="dl-text">
        <div class="dl-title">${escapeHtml(current?.title ?? "Your video")}</div>
        <div class="v-meta">${meta}</div>
      </div>
    </div>`;
}

function renderError(error: ToolError) {
  renderToken++;
  root.innerHTML = panel({ tool: "Download", aside: errorBadge(error), body: renderErrorState(error) });
}

function render(data: DownloadData | null) {
  const token = ++renderToken;
  current = data;
  const format = escapeHtml(data?.format ?? "MP4");

  if (data?.status === "complete" && data.url) {
    root.innerHTML = panel({
      tool: "Download",
      aside: statusBadge("ready", "Ready"),
      enter: enterOnce(`${data.id}:complete`),
      body: fileRow(`${format} <span class="v-meta-dot">·</span> No watermark`),
      footer: `
        <button type="button" class="v-btn v-btn-primary" id="dl-open">${DOWNLOAD_ICON}Download file</button>
        <button type="button" class="v-btn" id="dl-copy">${COPY_ICON}Copy link</button>`,
    });
    return;
  }

  const percent = typeof data?.progress === "number" && data.progress > 0 ? data.progress : null;
  root.innerHTML = panel({
    tool: "Download",
    aside: statusBadge("live", percent ? `${percent}%` : "Preparing"),
    enter: enterOnce(`${data?.id}:working`),
    body: `
      ${data?.title ? `${fileRow(`${format} <span class="v-meta-dot">·</span> Fetching the original file`)}<div class="dl-gap"></div>` : ""}
      ${progressBlock({
        label: percent ? "Downloading" : "Preparing download",
        sublabel: data?.title ? undefined : "Fetching the original file",
        percent,
        startedAt: startedAtFor(data?.id),
      })}`,
  });

  if (data?.id && data.status === "processing") {
    void pollTool<DownloadData>(app, {
      tool: "check_download_status",
      args: { id: data.id },
      isCurrent: () => token === renderToken,
      isDone: (next) => next.status === "complete",
      onUpdate: (next) => {
        if (next.status === "complete" || next.progress !== current?.progress) render(next);
      },
      onError: renderError,
      intervalMs: 2500,
      maxMs: 9 * 60_000,
    });
  }
}

startElapsedTicker();
render(null);
const app = connectApp({
  name: "Verlab Download",
  onResult: (result) => render((result.structuredContent as DownloadData | undefined) ?? null),
  onError: renderError,
});

root.addEventListener("click", (event) => {
  const target = event.target as HTMLElement;
  if (target.closest("#dl-open")) openLink(app, current?.url);
  const copy = target.closest<HTMLElement>("#dl-copy");
  if (copy && current?.url) void copyText(current.url).then((ok) => flashButton(copy, ok ? `${CHECK_ICON}Copied` : "Copy failed"));
});
