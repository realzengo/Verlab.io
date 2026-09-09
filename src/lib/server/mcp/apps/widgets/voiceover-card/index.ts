import { connectApp, escapeHtml, openLink, LOGO_MARK } from "../../shared/host";

interface VoiceoverData {
  status?: string;
  title?: string | null;
  voiceId?: string | null;
  url?: string | null;
  durationSeconds?: number | null;
  note?: string;
  error_message?: string | null;
}

const root = document.getElementById("root")!;
let audioUrl: string | null = null;

function formatDuration(seconds: number | null | undefined): string {
  if (!seconds || seconds <= 0) return "";
  const total = Math.round(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function render(data: VoiceoverData | null) {
  audioUrl = data?.url ?? null;

  let body: string;
  if (data?.error_message) {
    body = `<div class="v-error">${escapeHtml(data.error_message)}</div>`;
  } else if (audioUrl) {
    const duration = formatDuration(data?.durationSeconds);
    const meta = [data?.voiceId ? escapeHtml(data.voiceId) : null, duration]
      .filter(Boolean)
      .join(' <span class="v-meta-dot">&middot;</span> ');
    body = `
      <audio class="v-audio" controls preload="metadata" src="${escapeHtml(audioUrl)}"></audio>
      ${meta ? `<div class="v-meta">${meta}</div>` : ""}
      <button class="v-btn v-btn-primary" id="download-btn">Download audio</button>
    `;
  } else {
    body = `<div class="v-empty">${escapeHtml(data?.note ?? "Generating voiceover…")}</div>`;
  }

  root.innerHTML = `
    <div class="v-card">
      <div class="v-header">
        ${LOGO_MARK}
        <span class="v-title">${escapeHtml(data?.title ?? "Verlab Voiceover")}</span>
      </div>
      ${body}
    </div>
  `;
}

render(null);
const app = connectApp({
  name: "Verlab Voiceover",
  onResult: (result) => render((result.structuredContent as VoiceoverData | undefined) ?? null),
});

root.addEventListener("click", (event) => {
  if ((event.target as HTMLElement).closest("#download-btn")) openLink(app, audioUrl);
});
