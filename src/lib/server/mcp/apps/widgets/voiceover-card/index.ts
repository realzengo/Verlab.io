import {
  connectApp,
  copyText,
  downloadUrl,
  escapeHtml,
  flashButton,
  formatDuration,
  panel,
  statusBadge,
  errorBadge,
  CHECK_ICON,
  DOWNLOAD_ICON,
  COPY_ICON,
  PLAY_ICON,
  PAUSE_ICON,
  pollTool,
  progressBlock,
  renderErrorState,
  startElapsedTicker,
  startedAtFor,
  enterOnce,
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

function titleBlock(data: VoiceoverData | null, meta: string): string {
  if (!data?.title && !meta) return "";
  return `
    <div class="vo-head">
      ${data?.title ? `<div class="v-title-md">${escapeHtml(data.title)}</div>` : ""}
      ${meta ? `<div class="v-meta">${meta}</div>` : ""}
    </div>`;
}

function renderError(error: ToolError) {
  renderToken++;
  root.innerHTML = panel({ tool: "Voiceover", aside: errorBadge(error), body: `${titleBlock(current, "")}${renderErrorState(error)}` });
}

function render(data: VoiceoverData | null) {
  const token = ++renderToken;
  current = data;

  if (!data || data.status !== "completed" || !data.url) {
    root.innerHTML = panel({
      tool: "Voiceover",
      aside: statusBadge("live", "Generating"),
      enter: enterOnce(`${data?.id}:working`),
      body: `
        ${titleBlock(data, "")}
        ${progressBlock({
          label: "Generating voiceover",
          sublabel: `${data?.voiceId ? `Voice: ${data.voiceId}` : "Turning your script into speech"} · usually under a minute`,
          startedAt: startedAtFor(data?.id),
        })}`,
    });
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
  const meta = [data.voiceId ? escapeHtml(data.voiceId) : null, data.durationSeconds ? formatDuration(data.durationSeconds) : null, parts.length > 1 ? `${parts.length} parts` : null]
    .filter(Boolean)
    .join(' <span class="v-meta-dot">·</span> ');

  root.innerHTML = panel({
    tool: "Voiceover",
    aside: statusBadge("ready", "Ready"),
    enter: enterOnce(`${data.id}:ready`),
    body: `
      ${titleBlock(data, meta)}
      <div class="vo-player">
        <button type="button" class="vo-play" id="vo-play" aria-label="Play">${PLAY_ICON}</button>
        <input type="range" class="vo-seek" id="vo-seek" min="0" max="1000" value="0" aria-label="Seek">
        <span class="vo-times"><span id="vo-now">0:00</span><span class="vo-times-sep">/</span><span id="vo-total">${data.durationSeconds && parts.length === 1 ? formatDuration(data.durationSeconds) : "--:--"}</span></span>
      </div>
      <audio id="vo-audio" preload="metadata" src="${escapeHtml(parts[partIndex])}"></audio>
      ${
        parts.length > 1
          ? `<div class="v-segmented vo-parts" role="tablist">${parts
              .map((_, i) => `<button type="button" role="tab" aria-selected="${i === partIndex}" class="${i === partIndex ? "is-active" : ""}" data-part="${i}">Part ${i + 1}</button>`)
              .join("")}</div>`
          : ""
      }`,
    footer: `
      <button type="button" class="v-btn v-btn-primary" id="vo-download">${DOWNLOAD_ICON}Download${parts.length > 1 ? ` part ${partIndex + 1}` : " MP3"}</button>
      <button type="button" class="v-btn" id="vo-copy">${COPY_ICON}Copy link</button>`,
  });
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
    if (duration) total.textContent = formatDuration(duration);
    now.textContent = formatDuration(audio.currentTime);
    const ratio = duration ? audio.currentTime / duration : 0;
    seek.value = String(Math.round(ratio * 1000));
    seek.style.setProperty("--fill", `${ratio * 100}%`);
  };
  audio.addEventListener("loadedmetadata", paint);
  audio.addEventListener("timeupdate", paint);
  audio.addEventListener("play", () => {
    play.innerHTML = PAUSE_ICON;
    play.classList.add("is-playing");
    play.setAttribute("aria-label", "Pause");
  });
  audio.addEventListener("pause", () => {
    play.innerHTML = PLAY_ICON;
    play.classList.remove("is-playing");
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
    void copyText(current.downloadUrl).then((ok) => flashButton(copy, ok ? `${CHECK_ICON}Copied` : "Copy failed"));
  }
});
