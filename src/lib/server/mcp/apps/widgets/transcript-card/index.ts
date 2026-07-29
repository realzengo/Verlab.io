import { connectApp, escapeHtml, openLink } from "../../shared/host";

interface Line {
  timestamp: string;
  text: string;
}
interface TranscriptData {
  title?: string | null;
  coverUrl?: string | null;
  videoUrl?: string | null;
  embedUrl?: string | null;
  lines?: Line[];
  note?: string;
  error_message?: string | null;
}

const root = document.getElementById("root")!;
let watchUrl: string | null = null;

function render(data: TranscriptData | null) {
  watchUrl = data?.videoUrl ?? data?.embedUrl ?? null;
  const lines = data?.lines ?? [];

  let body: string;
  if (data?.error_message) {
    body = `<div class="v-error">${escapeHtml(data.error_message)}</div>`;
  } else if (lines.length) {
    body = `<div class="v-transcript">${lines
      .map(
        (line) =>
          `<div class="v-line"><span class="v-line-ts">${escapeHtml(line.timestamp)}</span><span>${escapeHtml(line.text)}</span></div>`
      )
      .join("")}</div>`;
  } else {
    body = `<div class="v-empty">${escapeHtml(data?.note ?? "Extracting transcript…")}</div>`;
  }

  root.innerHTML = `
    <div class="v-card">
      <div class="v-header">
        ${data?.coverUrl ? `<img src="${data.coverUrl}" alt="">` : `<img src="https://verlab.io/logo-icon.png" alt="">`}
        <span class="v-title">${escapeHtml(data?.title ?? "Verlab Transcript")}</span>
        <span class="v-spacer"></span>
        ${watchUrl ? `<button class="v-btn" id="watch-btn">Watch</button>` : ""}
      </div>
      ${body}
    </div>
  `;
}

render(null);
const app = connectApp({
  name: "Verlab Transcript",
  onResult: (result) => render((result.structuredContent as TranscriptData | undefined) ?? null),
});

root.addEventListener("click", (event) => {
  if ((event.target as HTMLElement).closest("#watch-btn")) openLink(app, watchUrl);
});
