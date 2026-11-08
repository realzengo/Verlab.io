import { connectApp, escapeHtml, formatDuration, openLink, sendChatMessage, LOGO_MARK, PLAY_ICON, PAUSE_ICON, EXTERNAL_ICON } from "../../shared/host";

interface ScriptRow {
  id: string;
  prompt: string;
  preview?: string;
  words?: number;
  created_at: string;
}
interface ImageRow {
  id: string;
  prompt: string;
  model: string;
  thumbs: string[];
  urls: string[];
  refs: string[];
  created_at: string;
}
interface VideoRow {
  id: string;
  model: string;
  prompt: string;
  durationSeconds: number | null;
  aspectRatio: string | null;
  url: string;
  created_at: string;
}
interface VoiceoverRow {
  id: string;
  title: string;
  voiceId: string | null;
  durationSeconds: number;
  urls: string[];
  created_at: string;
}
interface ClipRow {
  id: string;
  title: string;
  channel: string | null;
  thumbnailUrl: string | null;
  status: string;
  clipCount: number;
  topScore: number | null;
  editorUrl: string;
  created_at: string;
}
interface SopRow {
  id: string;
  channelName: string | null;
  detectedNiche: string | null;
  bend: string | null;
  hasSop: boolean;
  avatarUrl: string | null;
  created_at: string;
}
interface ListData {
  kind?: string;
  type?: string;
  scripts?: ScriptRow[];
  images?: ImageRow[];
  videos?: VideoRow[];
  voiceovers?: VoiceoverRow[];
  clips?: ClipRow[];
  sops?: SopRow[];
  libraryUrl?: string | null;
}

const root = document.getElementById("root")!;
const player = new Audio();
let data: ListData = {};
let playingId: string | null = null;

player.addEventListener("ended", () => setPlaying(null));
player.addEventListener("pause", () => setPlaying(null));
player.addEventListener("error", () => setPlaying(null));

function setPlaying(id: string | null) {
  playingId = id;
  root.querySelectorAll<HTMLElement>("[data-play]").forEach((button) => {
    const active = button.dataset.play === id;
    button.innerHTML = active ? PAUSE_ICON : PLAY_ICON;
    button.classList.toggle("is-playing", active);
  });
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

const truncate = (text: string, max: number) => (text.length > max ? `${text.slice(0, max)}…` : text);

function sectionHtml(label: string, count: number, body: string, showLabel: boolean): string {
  if (!showLabel) return body || `<div class="v-empty">Nothing here yet.</div>`;
  return `<div class="v-section-label">${label}${count ? ` · ${count}` : ""}</div>${body || `<div class="lc-none">None yet</div>`}`;
}

function imagesHtml(rows: ImageRow[]): string {
  const tiles = rows.flatMap((row) =>
    row.thumbs.map(
      (thumb, i) => `
      <button type="button" class="lc-image" data-image="${escapeHtml(row.id)}" data-index="${i}" title="${escapeHtml(row.prompt)}">
        <img src="${escapeHtml(thumb)}" alt="" loading="lazy">
      </button>`
    )
  );
  return tiles.length ? `<div class="lc-image-grid">${tiles.slice(0, 24).join("")}</div>` : "";
}

function videosHtml(rows: VideoRow[]): string {
  if (!rows.length) return "";
  return `<div class="lc-video-grid">${rows
    .map(
      (row) => `
      <div class="lc-video">
        <button type="button" class="lc-video-frame" data-video="${escapeHtml(row.id)}" aria-label="Open video">
          <video src="${escapeHtml(row.url)}#t=0.1" muted playsinline loop preload="metadata"></video>
        </button>
        <div class="lc-video-meta">${escapeHtml([row.model, row.durationSeconds ? `${row.durationSeconds}s` : null].filter(Boolean).join(" · "))}</div>
      </div>`
    )
    .join("")}</div>`;
}

function voiceoversHtml(rows: VoiceoverRow[]): string {
  return rows
    .map(
      (row) => `
      <div class="lc-row">
        <button type="button" class="lc-play" data-play="${escapeHtml(row.id)}" aria-label="Play">${PLAY_ICON}</button>
        <div class="lc-main">
          <div class="lc-title">${escapeHtml(truncate(row.title, 70))}</div>
          <div class="lc-sub">${formatDuration(row.durationSeconds)} · ${formatDate(row.created_at)}${row.urls.length > 1 ? ` · ${row.urls.length} parts` : ""}</div>
        </div>
      </div>`
    )
    .join("");
}

function clipsHtml(rows: ClipRow[]): string {
  return rows
    .map(
      (row) => `
      <button type="button" class="lc-row lc-row-btn" data-open-url="${escapeHtml(row.editorUrl)}">
        ${row.thumbnailUrl ? `<img class="lc-thumb-wide" src="${escapeHtml(row.thumbnailUrl)}" alt="" loading="lazy">` : `<span class="lc-thumb-wide"></span>`}
        <div class="lc-main">
          <div class="lc-title">${escapeHtml(truncate(row.title, 70))}</div>
          <div class="lc-sub">${row.status === "ready" ? `${row.clipCount} clips${row.topScore ? ` · top ${row.topScore}` : ""}` : escapeHtml(row.status)} · ${formatDate(row.created_at)}</div>
        </div>
        <span class="lc-go">${EXTERNAL_ICON}</span>
      </button>`
    )
    .join("");
}

function sopsHtml(rows: SopRow[]): string {
  return rows
    .map(
      (row) => `
      <div class="lc-row">
        ${row.avatarUrl ? `<img class="lc-avatar" src="${escapeHtml(row.avatarUrl)}" alt="" loading="lazy">` : `<span class="lc-avatar">${escapeHtml((row.channelName ?? "?").slice(0, 1))}</span>`}
        <div class="lc-main">
          <div class="lc-title">${escapeHtml(row.channelName ?? "Saved channel")}${row.bend ? ` → ${escapeHtml(row.bend)}` : ""}</div>
          <div class="lc-sub">${escapeHtml(row.detectedNiche ?? "")}${row.detectedNiche ? " · " : ""}${formatDate(row.created_at)}</div>
        </div>
        ${row.hasSop ? `<button type="button" class="v-btn lc-action" data-sop="${escapeHtml(row.id)}">Write script</button>` : ""}
      </div>`
    )
    .join("");
}

function scriptsHtml(rows: ScriptRow[]): string {
  return rows
    .map(
      (row) => `
      <button type="button" class="lc-row lc-row-btn lc-script" data-script="${escapeHtml(row.id)}">
        <div class="lc-main">
          <div class="lc-title">${escapeHtml(truncate(row.prompt || "Untitled script", 80))}</div>
          ${row.preview ? `<div class="lc-preview">${escapeHtml(row.preview)}</div>` : ""}
          <div class="lc-sub">${formatDate(row.created_at)}${row.words ? ` · ${row.words} words` : ""}</div>
        </div>
        <span class="lc-go">${EXTERNAL_ICON}</span>
      </button>`
    )
    .join("");
}

function render(next: ListData | null) {
  if (!next) {
    root.innerHTML = `<div class="v-card"><div class="v-empty">Loading your library…</div></div>`;
    return;
  }
  data = next;
  const isScripts = next.kind === "scripts";
  const all = !isScripts && (next.type ?? "all") === "all";
  const wants = (type: string) => all || next.type === type;

  const sections = isScripts
    ? [sectionHtml("Scripts", next.scripts?.length ?? 0, scriptsHtml(next.scripts ?? []), false)]
    : [
        wants("image") ? sectionHtml("Images", next.images?.length ?? 0, imagesHtml(next.images ?? []), all) : "",
        wants("video") ? sectionHtml("Videos", next.videos?.length ?? 0, videosHtml(next.videos ?? []), all) : "",
        wants("voiceover") ? sectionHtml("Voiceovers", next.voiceovers?.length ?? 0, voiceoversHtml(next.voiceovers ?? []), all) : "",
        wants("clip") ? sectionHtml("Clip projects", next.clips?.length ?? 0, clipsHtml(next.clips ?? []), all) : "",
        wants("sop") ? sectionHtml("SOPs", next.sops?.length ?? 0, sopsHtml(next.sops ?? []), all) : "",
      ];

  const title = isScripts ? "Verlab Scripts" : "Verlab Library";
  root.innerHTML = `
    <div class="v-card v-enter">
      <div class="v-header">
        ${LOGO_MARK}
        <span class="v-title">${title}</span>
        <span class="v-spacer"></span>
        ${next.libraryUrl ? `<button type="button" class="v-link-btn" data-open-url="${escapeHtml(next.libraryUrl)}">Open library ${EXTERNAL_ICON}</button>` : ""}
      </div>
      <div class="lc-body">${sections.join("")}</div>
      <div class="v-quick-status" id="quick-status" hidden></div>
    </div>`;

  root.querySelectorAll<HTMLVideoElement>(".lc-video video").forEach((video) => {
    const frame = video.parentElement!;
    frame.addEventListener("mouseenter", () => void video.play().catch(() => undefined));
    frame.addEventListener("mouseleave", () => video.pause());
  });
}

function status(message: string) {
  const el = document.getElementById("quick-status");
  if (!el) return;
  el.hidden = false;
  el.textContent = message;
  setTimeout(() => (el.hidden = true), 3500);
}

render(null);
const app = connectApp({
  name: "Verlab Library",
  onResult: (result) => render((result.structuredContent as ListData | undefined) ?? null),
});

root.addEventListener("click", (event) => {
  const target = event.target as HTMLElement;
  const play = target.closest<HTMLElement>("[data-play]");
  if (play?.dataset.play) {
    const row = data.voiceovers?.find((v) => v.id === play.dataset.play);
    if (!row?.urls[0]) return;
    if (playingId === row.id) return player.pause();
    player.src = row.urls[0];
    void player.play().then(() => setPlaying(row.id)).catch(() => setPlaying(null));
    return;
  }
  const image = target.closest<HTMLElement>("[data-image]");
  if (image) {
    const row = data.images?.find((r) => r.id === image.dataset.image);
    openLink(app, row?.urls[Number(image.dataset.index)]);
    return;
  }
  const video = target.closest<HTMLElement>("[data-video]");
  if (video) {
    openLink(app, data.videos?.find((r) => r.id === video.dataset.video)?.url);
    return;
  }
  const sop = target.closest<HTMLElement>("[data-sop]");
  if (sop) {
    sendChatMessage(app, `Write a script with my SOP (generate_script with sopId ${sop.dataset.sop}). Ask me for the topic if you need it.`, status);
    return;
  }
  const script = target.closest<HTMLElement>("[data-script]");
  if (script) sendChatMessage(app, `Open my script ${script.dataset.script} (get_script).`, status);
});
