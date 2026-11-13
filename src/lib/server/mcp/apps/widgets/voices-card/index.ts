import { connectApp, escapeHtml, panel, sendChatMessage, PLAY_ICON, PAUSE_ICON, MIC_ICON, SEARCH_ICON } from "../../shared/host";

interface Voice {
  voiceId: string;
  name: string;
  source: "default" | "saved" | "clone";
  description?: string;
  meta?: string;
  previewUrl?: string | null;
}

interface VoicesData {
  voices?: Voice[];
  appUrl?: string | null;
}

const SECTIONS: { source: Voice["source"]; label: string }[] = [
  { source: "clone", label: "Your cloned voices" },
  { source: "saved", label: "Saved from the Voice Library" },
  { source: "default", label: "Default voices" },
];

// ElevenLabs voice ids are 20 alphanumeric characters. Voices saved by
// pasting a bare id carry it as their meta line -- set it as an id, not prose.
const VOICE_ID = /^[A-Za-z0-9]{20}$/;

const root = document.getElementById("root")!;
const player = new Audio();
let voices: Voice[] = [];
let appUrl: string | null = null;
let query = "";
let playingId: string | null = null;

player.addEventListener("ended", () => setPlaying(null));
player.addEventListener("pause", () => setPlaying(null));
player.addEventListener("error", () => setPlaying(null));

function setPlaying(id: string | null) {
  playingId = id;
  root.querySelectorAll<HTMLButtonElement>("[data-play]").forEach((button) => {
    const active = button.dataset.play === id;
    button.innerHTML = active ? PAUSE_ICON : PLAY_ICON;
    button.classList.toggle("is-playing", active);
    button.setAttribute("aria-label", `${active ? "Pause" : "Preview"} ${button.dataset.name ?? "voice"}`);
  });
}

function voiceRow(voice: Voice): string {
  const isId = Boolean(voice.meta && VOICE_ID.test(voice.meta));
  const meta = isId ? "" : [voice.meta, voice.description].filter(Boolean).join(" · ");
  return `
    <div class="vv-row">
      ${
        voice.previewUrl
          ? `<button type="button" class="vv-play" data-play="${escapeHtml(voice.voiceId)}" data-name="${escapeHtml(voice.name)}" aria-label="Preview ${escapeHtml(voice.name)}">${PLAY_ICON}</button>`
          : `<span class="vv-play is-static" title="No preview">${MIC_ICON}</span>`
      }
      <div class="vv-text">
        <div class="vv-name"><span class="vv-name-text">${escapeHtml(voice.name)}</span>${voice.source === "clone" ? '<span class="v-tag vv-tag">Clone</span>' : ""}</div>
        ${isId ? `<div class="vv-meta vv-id">${escapeHtml(voice.meta!)}</div>` : meta ? `<div class="vv-meta">${escapeHtml(meta)}</div>` : ""}
      </div>
      <button type="button" class="v-btn v-btn-sm vv-use" data-use="${escapeHtml(voice.voiceId)}">Use</button>
    </div>`;
}

function renderList(): string {
  const wanted = query.trim().toLowerCase();
  const matches = voices.filter((voice) => !wanted || `${voice.name} ${voice.meta ?? ""} ${voice.description ?? ""}`.toLowerCase().includes(wanted));
  if (!matches.length) return `<div class="v-empty">No voices match “${escapeHtml(query.trim())}”</div>`;
  return SECTIONS.map(({ source, label }) => {
    const rows = matches.filter((voice) => voice.source === source);
    return rows.length
      ? `<div class="vv-group"><div class="vv-group-label">${label}</div>${rows.map(voiceRow).join("")}</div>`
      : "";
  }).join("");
}

function render(data: VoicesData | null) {
  if (!data) {
    root.innerHTML = panel({ tool: "Voices", enter: "", body: `<div class="v-empty">Loading voices…</div>`, flush: true });
    return;
  }
  voices = data.voices ?? [];
  appUrl = data.appUrl ?? null;
  const clones = voices.filter((voice) => voice.source === "clone").length;
  root.innerHTML = panel({
    tool: "Voices",
    aside: `<span class="v-aside v-aside-mono">${voices.length} voices</span>`,
    flush: true,
    body: `
      <label class="vv-search">
        ${SEARCH_ICON}
        <input id="vv-search" type="search" placeholder="Search voices" value="${escapeHtml(query)}" aria-label="Search voices by name, accent or style" autocomplete="off" spellcheck="false">
      </label>
      <div class="vv-results v-scroll" id="vv-results">${renderList()}</div>
      <div class="v-quick-status vv-status" id="quick-status" hidden></div>`,
    footer:
      !clones && appUrl
        ? `<span class="v-footer-note">Narrate in your own voice</span><button type="button" class="v-btn" data-open-url="${escapeHtml(appUrl)}">${MIC_ICON}Clone a voice</button>`
        : "",
  });
}

render(null);
const app = connectApp({
  name: "Verlab Voices",
  onResult: (result) => render((result.structuredContent as VoicesData | undefined) ?? null),
});

root.addEventListener("input", (event) => {
  const input = event.target as HTMLInputElement;
  if (input.id !== "vv-search") return;
  query = input.value;
  const results = document.getElementById("vv-results");
  if (results) {
    results.innerHTML = renderList();
    results.scrollTop = 0;
  }
  setPlaying(playingId);
});

root.addEventListener("click", (event) => {
  const target = event.target as HTMLElement;
  const play = target.closest<HTMLElement>("[data-play]");
  if (play?.dataset.play) {
    const voice = voices.find((v) => v.voiceId === play.dataset.play);
    if (!voice?.previewUrl) return;
    if (playingId === voice.voiceId) {
      player.pause();
      return;
    }
    player.src = voice.previewUrl;
    void player.play().then(() => setPlaying(voice.voiceId)).catch(() => setPlaying(null));
    return;
  }
  const use = target.closest<HTMLElement>("[data-use]");
  if (use?.dataset.use) {
    const voice = voices.find((v) => v.voiceId === use.dataset.use);
    if (!voice) return;
    sendChatMessage(app, `Use the voice "${voice.name}" (voiceId ${voice.voiceId}) for my voiceover.`, (message) => {
      const status = document.getElementById("quick-status");
      if (!status) return;
      status.hidden = false;
      status.textContent = message;
    });
  }
});
