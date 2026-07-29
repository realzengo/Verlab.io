import { connectApp, escapeHtml, openLink } from "../../shared/host";

interface DownloadData {
  progress?: number | null;
  title?: string | null;
  url?: string | null;
  file_path?: string | null;
  note?: string;
  error_message?: string | null;
}

const root = document.getElementById("root")!;
let downloadUrl: string | null = null;

function render(data: DownloadData | null) {
  downloadUrl = data?.url ?? data?.file_path ?? null;

  let body: string;
  if (data?.error_message) {
    body = `<div class="v-error">${escapeHtml(data.error_message)}</div>`;
  } else if (downloadUrl) {
    body = `<button class="v-btn" id="download-btn">Download video</button>`;
  } else {
    const progress = typeof data?.progress === "number" ? ` (${data.progress}%)` : "";
    body = `<div class="v-empty">${escapeHtml((data?.note ?? "Preparing download…") + progress)}</div>`;
  }

  root.innerHTML = `
    <div class="v-card">
      <div class="v-header">
        <span class="v-title">${escapeHtml(data?.title ?? "Verlab Download")}</span>
      </div>
      ${body}
    </div>
  `;
}

render(null);
const app = connectApp({
  name: "Verlab Download",
  onResult: (result) => render((result.structuredContent as DownloadData | undefined) ?? null),
});

root.addEventListener("click", (event) => {
  if ((event.target as HTMLElement).closest("#download-btn")) openLink(app, downloadUrl);
});
