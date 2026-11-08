import {
  connectApp,
  copyText,
  downloadUrl,
  escapeHtml,
  flashButton,
  formatDuration,
  LOGO_MARK,
  DOWNLOAD_ICON,
  COPY_ICON,
  PLAY_ICON,
  PAUSE_ICON,
  pollTool,
  progressBlock,
  renderErrorState,
  startElapsedTicker,
  startedAtFor,
  type ToolError,
} from "../../shared/host";

interface VoiceoverData {
  id?: string;
  status?: string;
  title?: string | null;
  voiceId?: string | null;
  url?: string | null;
  downloadUrl?: string | null;
  parts?: string[];
  durationSeconds?: number | null;
}

const root = document.getElementById("root")!;
let current: VoiceoverData | null = null;
let partIndex = 0;
let renderToken = 0;

function shell(title: string, body: string, pill = "") {
  return `
    <div class="v-card v-enter">
      <div class="v-header">
        ${LOGO_MARK}
        <span class="v-title">${escapeHtml(title)}</span>
        <span class="v-spacer"></span>
        ${pill}
      </div>
      ${body}
    </div>`;
}

function renderError(error: ToolError) {
  renderToken++;
  root.innerHTML = shell(current?.title ?? "Verlab Voiceover", renderErrorState(error));
}

function render(data: VoiceoverData | null) {
  const token = ++renderToken;
  current = data;

  if (!data || data.status !== "completed" || !data.url) {
    const voice = data?.voiceId ? `Voice: ${data.voiceId}` : "Turning your script into speech";
    root.innerHTML = shell(
      data?.title ?? "Verlab Voiceover",
      progressBlock({ label: "Generating voiceover", sublabel: `${voice} · usually under a minute`, startedAt: startedAtFor(data?.id) })
    );
    if (data?.id && data.status === "generating") {
      void pollTool<VoiceoverData>(app, {
        tool: "check_voiceover_status",
        args: { id: data.id },
        isCurrent: () => token === renderToken,
        isDone: (next) => next.status === "completed",
        onUpdate: (next) => {
          if (next.status === "completed") render(next);
        },
        onError: renderError,
        maxMs: 10 * 60_000,
      });
    }
    return;
  }

  const parts = data.parts?.length ? data.parts : [data.url];
  partIndex = Math.min(partIndex, parts.length - 1);
  const meta = [data.voiceId ? escapeHtml(data.voiceId) : null, data.durationSeconds ? `≈ ${formatDuration(data.durationSeconds)}` : null]
    .filter(Boolean)
    .join(' <span class="v-meta-dot">&middot;</span> ');

  root.innerHTML = shell(
    data.title ?? "Verlab Voiceover",
    `
      <div class="vo-player">
        <button type="button" class="vo-play" id="vo-play" aria-label="Play">${PLAY_ICON}</button>
        <div class="vo-track">
          <input type="range" id="vo-seek" min="0" max="1000" value="0" aria-label="Seek">
          <div class="vo-times"><span id="vo-now">0:00</span><span id="vo-total">--:--</span></div>
        </div>
      </div>
      <audio id="vo-audio" preload="metadata" src="${escapeHtml(parts[partIndex])}"></audio>
      ${parts.length > 1 ? `<div class="vo-parts">${parts.map((_, i) => `<button type="button" class="v-tag${i === partIndex ? " v-tag-primary" : ""}" data-part="${i}">Part ${i + 1}</button>`).join("")}</div>` : ""}
      ${meta ? `<div class="v-meta vo-meta">${meta}</div>` : ""}
      <div class="v-btn-row">
        <button type="button" class="v-btn v-btn-primary" id="vo-download">${DOWNLOAD_ICON}Download</button>
        <button type="button" class="v-btn" id="vo-copy">${COPY_ICON}Copy link</button>
      </div>`,
    '<span class="v-pill v-pill-success">Ready</span>'
  );
  wirePlayer();
}

function wirePlayer() {
  const audio = document.getElementById("vo-audio") as HTMLAudioElement | null;
  const play = document.getElementById("vo-play") as HTMLButtonElement | null;
  const seek = document.getElementById("vo-seek") as HTMLInputElement | null;
  const now = document.getElementById("vo-now");
  const total = document.getElementById("vo-total");
  if (!audio || !play || !seek || !now || !total) return;

  const paint = () => {
    const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
    total.textContent = duration ? formatDuration(duration) : "--:--";
    now.textContent = formatDuration(audio.currentTime);
    const ratio = duration ? audio.currentTime / duration : 0;
    seek.value = String(Math.round(ratio * 1000));
    seek.style.setProperty("--fill", `${ratio * 100}%`);
  };
  audio.addEventListener("loadedmetadata", paint);
  audio.addEventListener("timeupdate", paint);
  audio.addEventListener("play", () => {
    play.innerHTML = PAUSE_ICON;
    play.setAttribute("aria-label", "Pause");
  });
  audio.addEventListener("pause", () => {
    play.innerHTML = PLAY_ICON;
    play.setAttribute("aria-label", "Play");
  });
  audio.addEventListener("ended", () => {
    audio.currentTime = 0;
    paint();
  });
  audio.addEventListener("error", () => {
    total.textContent = "unavailable";
  });
  play.addEventListener("click", () => {
    if (audio.paused) void audio.play().catch(() => undefined);
    else audio.pause();
  });
  seek.addEventListener("input", () => {
    if (Number.isFinite(audio.duration)) audio.currentTime = (Number(seek.value) / 1000) * audio.duration;
    paint();
  });
}

startElapsedTicker();
render(null);
const app = connectApp({
  name: "Verlab Voiceover",
  onResult: (result) => render((result.structuredContent as VoiceoverData | undefined) ?? null),
  onError: renderError,
});

root.addEventListener("click", (event) => {
  const target = event.target as HTMLElement;
  const part = target.closest<HTMLElement>("[data-part]");
  if (part && current) {
    partIndex = Number(part.dataset.part) || 0;
    render(current);
    return;
  }
  if (target.closest("#vo-download") && current?.downloadUrl) {
    const parts = current.parts ?? [];
    const base = (current.title ?? "voiceover").replace(/[^\w\- ]+/g, "").trim() || "voiceover";
    // The selected part when there are several; dl=1 is an unsigned presentation flag.
    const url = parts.length > 1 && parts[partIndex] ? `${parts[partIndex]}&dl=1` : current.downloadUrl;
    void downloadUrl(app, url, `${base}${parts.length > 1 ? ` part ${partIndex + 1}` : ""}.mp3`, "audio/mpeg");
    return;
  }
  const copy = target.closest<HTMLElement>("#vo-copy");
  if (copy && current?.downloadUrl) {
    void copyText(current.downloadUrl).then((ok) => flashButton(copy, ok ? "Copied" : "Copy failed"));
  }
});
