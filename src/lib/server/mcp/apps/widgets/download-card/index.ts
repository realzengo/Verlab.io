import {
  connectApp,
  copyText,
  escapeHtml,
  flashButton,
  openLink,
  LOGO_MARK,
  DOWNLOAD_ICON,
  COPY_ICON,
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

function shell(body: string, pill = "") {
  return `
    <div class="v-card ${enterOnce(`${current?.id}:${current?.status}`)}">
      <div class="v-header">
        ${LOGO_MARK}
        <span class="v-title">${escapeHtml(current?.title ?? "Verlab Download")}</span>
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

function render(data: DownloadData | null) {
  const token = ++renderToken;
  current = data;

  if (data?.status === "complete" && data.url) {
    root.innerHTML = shell(
      `
      <div class="dl-ready">
        <span class="dl-check">${DOWNLOAD_ICON}</span>
        <div>
          <div class="dl-ready-title">Ready to save</div>
          <div class="v-meta">${escapeHtml(data.format ?? "MP4")} · no watermark</div>
        </div>
      </div>
      <div class="v-btn-row">
        <button type="button" class="v-btn v-btn-primary" id="dl-open">${DOWNLOAD_ICON}Download file</button>
        <button type="button" class="v-btn" id="dl-copy">${COPY_ICON}Copy link</button>
      </div>`,
      '<span class="v-pill v-pill-success">Ready</span>'
    );
    return;
  }

  const percent = typeof data?.progress === "number" && data.progress > 0 ? data.progress : null;
  root.innerHTML = shell(
    progressBlock({
      label: percent ? `Downloading · ${percent}%` : "Preparing download",
      sublabel: data?.format ? `${data.format} · fetching the original file` : "Fetching the original file",
      percent,
      startedAt: startedAtFor(data?.id),
    })
  );

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
  if (copy && current?.url) void copyText(current.url).then((ok) => flashButton(copy, ok ? "Copied" : "Copy failed"));
});
