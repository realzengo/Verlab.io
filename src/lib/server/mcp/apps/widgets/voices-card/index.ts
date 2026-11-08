import { connectApp, escapeHtml, sendChatMessage, LOGO_MARK, PLAY_ICON, PAUSE_ICON, MIC_ICON } from "../../shared/host";

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
  });
}

function voiceRow(voice: Voice): string {
  return `
    <div class="vv-row" data-row="${escapeHtml(voice.voiceId)}">
      ${
        voice.previewUrl
          ? `<button type="button" class="vv-play" data-play="${escapeHtml(voice.voiceId)}" aria-label="Preview ${escapeHtml(voice.name)}">${PLAY_ICON}</button>`
          : `<span class="vv-play is-static">${MIC_ICON}</span>`
      }
      <div class="vv-text">
        <div class="vv-name">${escapeHtml(voice.name)}${voice.source === "clone" ? ' <span class="v-tag v-tag-ai">Clone</span>' : ""}</div>
        <div class="vv-meta">${escapeHtml([voice.meta, voice.description].filter(Boolean).join(" · "))}</div>
      </div>
      <button type="button" class="v-btn vv-use" data-use="${escapeHtml(voice.voiceId)}">Use</button>
    </div>`;
}

function renderList(): string {
  const wanted = query.trim().toLowerCase();
  const matches = voices.filter((voice) => !wanted || `${voice.name} ${voice.meta ?? ""} ${voice.description ?? ""}`.toLowerCase().includes(wanted));
  if (!matches.length) return `<div class="v-empty">No voices match "${escapeHtml(query)}".</div>`;
  return SECTIONS.map(({ source, label }) => {
    const rows = matches.filter((voice) => voice.source === source);
    return rows.length ? `<div class="v-section-label">${label}</div><div class="vv-list">${rows.map(voiceRow).join("")}</div>` : "";
  }).join("");
}

function render(data: VoicesData | null) {
  if (!data) {
    root.innerHTML = `<div class="v-card"><div class="v-empty">Loading voices…</div></div>`;
    return;
  }
  voices = data.voices ?? [];
  appUrl = data.appUrl ?? null;
  const clones = voices.filter((voice) => voice.source === "clone").length;
  root.innerHTML = `
    <div class="v-card v-enter">
      <div class="v-header">
        ${LOGO_MARK}
        <span class="v-title">Verlab Voices</span>
        <span class="v-spacer"></span>
        <span class="v-pill">${voices.length} voices</span>
      </div>
      <input class="vv-search" id="vv-search" type="search" placeholder="Search by name, accent or style" value="${escapeHtml(query)}">
      <div id="vv-results">${renderList()}</div>
      ${!clones && appUrl ? `<button type="button" class="v-link-btn vv-clone" data-open-url="${escapeHtml(appUrl)}">${MIC_ICON}Clone your own voice in Verlab</button>` : ""}
      <div class="v-quick-status" id="quick-status" hidden></div>
    </div>`;
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
  if (results) results.innerHTML = renderList();
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
      if (status) {
        status.hidden = false;
        status.textContent = message;
      }
    });
  }
});
