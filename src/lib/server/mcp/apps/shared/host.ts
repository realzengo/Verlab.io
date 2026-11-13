import { App, PostMessageTransport } from "@modelcontextprotocol/ext-apps";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

// Verlab's brand mark, inlined as SVG path data so every widget carries the
// actual logo instead of a generic dot/icon or plain wordmark.
export const LOGO_MARK = `<svg viewBox="0 0 2363 2363" fill="currentColor" aria-hidden="true"><path d="M192,236 34,532 1019,2234 1343,2238 2331,519 2187,246 1442,239 1332,999 1690,1135 1334,1279 1203,1638 1058,1281 700,1149 1054,1002 915,239Z"/></svg>`;

// Small stroke-style icon set (Lucide paths, hand-inlined so the vanilla
// widget bundles don't pull in the lucide-react runtime). One stroke weight
// everywhere; no sparkles or wands for AI actions -- each icon says what the
// action does.
const ICON_ATTRS = 'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';
export const COPY_ICON = `<svg ${ICON_ATTRS}><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;
export const CHECK_ICON = `<svg ${ICON_ATTRS}><path d="M20 6 9 17l-5-5"/></svg>`;
export const DOWNLOAD_ICON = `<svg ${ICON_ATTRS}><path d="M12 15V3"/><path d="m7 10 5 5 5-5"/><path d="M20 21H4"/></svg>`;
export const MIC_ICON = `<svg ${ICON_ATTRS}><path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v1a7 7 0 0 1-14 0v-1"/><path d="M12 18v4"/></svg>`;
export const LANGUAGES_ICON = `<svg ${ICON_ATTRS}><path d="m5 8 6 6"/><path d="m4 14 6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/><path d="m22 22-5-10-5 10"/><path d="M14 18h6"/></svg>`;
export const MINIMIZE_ICON = `<svg ${ICON_ATTRS}><path d="M8 3v3a2 2 0 0 1-2 2H3"/><path d="M21 8h-3a2 2 0 0 1-2-2V3"/><path d="M3 16h3a2 2 0 0 1 2 2v3"/><path d="M16 21v-3a2 2 0 0 1 2-2h3"/></svg>`;
export const CHEVRON_DOWN_ICON = `<svg ${ICON_ATTRS}><path d="m6 9 6 6 6-6"/></svg>`;
export const CHEVRON_RIGHT_ICON = `<svg ${ICON_ATTRS}><path d="m9 18 6-6-6-6"/></svg>`;
export const EXTERNAL_ICON = `<svg ${ICON_ATTRS}><path d="M7 7h10v10"/><path d="M7 17 17 7"/></svg>`;
export const ARROW_RIGHT_ICON = `<svg ${ICON_ATTRS}><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>`;
export const SEARCH_ICON = `<svg ${ICON_ATTRS}><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>`;
export const PEN_ICON = `<svg ${ICON_ATTRS}><path d="M12 20h9"/><path d="M16.38 3.62a1 1 0 0 1 3 3L7.37 18.64a2 2 0 0 1-.86.5l-2.87.84a.5.5 0 0 1-.62-.62l.84-2.87a2 2 0 0 1 .5-.86z"/></svg>`;
export const REFRESH_ICON = `<svg ${ICON_ATTRS}><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>`;
export const FILE_VIDEO_ICON = `<svg ${ICON_ATTRS}><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="m10 11 5 3-5 3Z"/></svg>`;
export const PLAY_ICON = `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.14v13.72a1 1 0 0 0 1.5.86l11-6.86a1 1 0 0 0 0-1.72l-11-6.86A1 1 0 0 0 8 5.14Z"/></svg>`;
export const PAUSE_ICON = `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>`;
export const ALERT_ICON = `<svg ${ICON_ATTRS}><circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>`;
export const FILM_ICON = `<svg ${ICON_ATTRS}><rect x="2" y="2" width="20" height="20" rx="2.18"/><path d="M7 2v20"/><path d="M17 2v20"/><path d="M2 12h20"/><path d="M2 7h5"/><path d="M2 17h5"/><path d="M17 17h5"/><path d="M17 7h5"/></svg>`;
export const SCISSORS_ICON = `<svg ${ICON_ATTRS}><circle cx="6" cy="6" r="3"/><path d="M8.12 8.12 12 12"/><path d="M20 4 8.12 15.88"/><circle cx="6" cy="18" r="3"/><path d="M14.8 14.8 20 20"/></svg>`;

const ESCAPE_MAP: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

export function escapeHtml(value: string): string {
  return String(value).replace(/[&<>"']/g, (char) => ESCAPE_MAP[char]);
}

// ----------------------------------------------------------------- panel

export interface PanelOptions {
  /** The tool's name in the brand bar: "Verlab / Voices". Plain text. */
  tool: string;
  /** Right side of the brand bar (status, a count, a link). HTML. */
  aside?: string;
  body: string;
  /** Actions for the grey tray along the foot. HTML. */
  footer?: string;
  /** Body built from full-bleed .v-section blocks instead of one padded box. */
  flush?: boolean;
  /** Entrance class -- "v-enter", or "" so progress ticks don't replay it. */
  enter?: string;
}

/**
 * Every widget is one full-bleed panel: the brand bar, the content, then an
 * optional action tray. It fills the host's frame, so there's no card edge.
 */
export function panel({ tool, aside = "", body, footer = "", flush = false, enter = "v-enter" }: PanelOptions): string {
  return `
    <div class="v-card ${enter}">
      <header class="v-header">
        <span class="v-brand">${LOGO_MARK}<span class="v-brand-name">Verlab</span><span class="v-brand-sep" aria-hidden="true">/</span><span class="v-brand-tool">${escapeHtml(tool)}</span></span>
        ${aside ? `<span class="v-spacer"></span>${aside}` : ""}
      </header>
      <div class="v-body${flush ? " is-flush" : ""}">${body}</div>
      ${footer ? `<footer class="v-footer">${footer}</footer>` : ""}
    </div>`;
}

/** Brand-bar status: a 6px dot and a word. `live` breathes while a job runs. */
export function statusBadge(kind: "ready" | "live" | "idle" | "error", label: string): string {
  return `<span class="v-status is-${kind}">${escapeHtml(label)}</span>`;
}

/** "01", "02" -- the mono index used for ranks, steps and lines. */
export function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

// ---------------------------------------------------------------- errors

export interface ToolError {
  message: string;
  code?: string;
  actionUrl?: string;
  retryable?: boolean;
}

/** The error a tool result carries, or null for a successful result. */
export function toolError(result: CallToolResult): ToolError | null {
  if (!result.isError) return null;
  const structured = (result.structuredContent as { error?: ToolError } | undefined)?.error;
  if (structured?.message) return structured;
  const text = result.content?.find((item) => item.type === "text");
  return { message: text && "text" in text ? text.text : "Something went wrong. Please try again." };
}

/** Error state, with a top-up/upgrade button when that's the fix. */
export function renderErrorState(error: ToolError): string {
  const cta =
    error.code === "insufficient_credits" && error.actionUrl
      ? `<button type="button" class="v-btn v-btn-primary" data-open-url="${escapeHtml(error.actionUrl)}">Top up credits${EXTERNAL_ICON}</button>`
      : error.code === "plan_required" && error.actionUrl
        ? `<button type="button" class="v-btn v-btn-primary" data-open-url="${escapeHtml(error.actionUrl)}">See plans${EXTERNAL_ICON}</button>`
        : "";
  return `
    <div class="v-error-state" role="alert">
      <span class="v-error-icon">${ALERT_ICON}</span>
      <div class="v-error-body">
        <div class="v-error-title">${error.code === "insufficient_credits" ? "Not enough credits" : error.code === "plan_required" ? "Upgrade needed" : "Couldn't finish that"}</div>
        <div class="v-error-text">${escapeHtml(error.message)}</div>
        ${cta ? `<div class="v-error-actions">${cta}</div>` : ""}
      </div>
    </div>`;
}

/** "Verlab Niche Finder" -> "Niche finder": sentence case for the brand bar. */
export function toolLabel(name: string): string {
  const label = name.replace(/^Verlab\s+/, "") || name;
  return label.charAt(0) + label.slice(1).toLowerCase();
}

/**
 * Brand-bar status for an error: "Failed" when a job broke, nothing for a
 * credit or plan gate -- the job never ran, and the panel's own title
 * ("Not enough credits", "Upgrade needed") already says so once.
 */
export function errorBadge(error: ToolError): string {
  return error.code === "insufficient_credits" || error.code === "plan_required" ? "" : statusBadge("error", "Failed");
}

/** A complete panel wrapping an error state -- the default when a widget doesn't render errors itself. */
export function errorCard(title: string, error: ToolError): string {
  return panel({ tool: toolLabel(title), aside: errorBadge(error), body: renderErrorState(error) });
}

// ------------------------------------------------------------ connection

export interface ConnectAppOptions {
  name: string;
  onResult: (result: CallToolResult) => void;
  /** Error results. Defaults to replacing #root with an error card titled `name`. */
  onError?: (error: ToolError) => void;
  onLoading?: () => void;
  // Fires once, right after the ui/initialize handshake completes.
  onConnected?: (app: App) => void;
}

// Boilerplate shared by every Verlab widget: construct the App, wire the
// handshake, route error results to a real error state (they used to fall
// through to each widget's loading placeholder and spin forever), and make
// any element with data-open-url open that link through the host.
// Widgets are light-mode only (see shared/base.css) by design.
export function connectApp({ name, onResult, onError, onLoading, onConnected }: ConnectAppOptions): App {
  const app = new App({ name, version: "2.0.0" });
  const root = document.getElementById("root");

  app.onteardown = async () => ({});
  app.onerror = (error) => console.error(`[verlab:${name}]`, error);
  app.ontoolinput = () => onLoading?.();
  app.ontoolresult = (result) => {
    const error = toolError(result as CallToolResult);
    if (!error) return onResult(result as CallToolResult);
    if (onError) onError(error);
    else if (root) root.innerHTML = errorCard(name, error);
  };

  document.addEventListener("click", (event) => {
    const target = (event.target as HTMLElement).closest<HTMLElement>("[data-open-url]");
    if (!target?.dataset.openUrl) return;
    event.preventDefault();
    openLink(app, target.dataset.openUrl);
  });
  startScrollFades();

  app.connect(new PostMessageTransport(window.parent, window.parent)).then(() => {
    onConnected?.(app);
  });

  return app;
}

// Hosts that don't implement a given ui/* method never reply -- the SDK's
// default request timeout is 60s, which reads as a dead button. Fail fast so
// the fallback kicks in quickly.
const ACTION_TIMEOUT_MS = 8000;

export function openLink(app: App, url: string | null | undefined) {
  if (!url) return;
  const fallback = () => window.open(url, "_blank", "noopener,noreferrer");
  app
    .openLink({ url }, { timeout: ACTION_TIMEOUT_MS })
    .then((result) => {
      if (result.isError) fallback();
    })
    .catch(fallback);
}

// Posts a user-authored follow-up message into the chat -- how quick-action
// pills hand off to Claude and other connected tools. Hosts that don't
// support it get a clipboard fallback; `onFallback` reports which happened.
export function sendChatMessage(app: App, text: string, onFallback?: (message: string) => void) {
  const fallback = () => {
    navigator.clipboard
      .writeText(text)
      .then(() => onFallback?.("This host can't send messages from here -- copied the prompt to your clipboard instead."))
      .catch(() => onFallback?.("Couldn't send that -- this host doesn't support messages or clipboard access."));
  };
  app
    .sendMessage({ role: "user", content: [{ type: "text", text }] }, { timeout: ACTION_TIMEOUT_MS })
    .then((result) => {
      if (result.isError) fallback();
    })
    .catch(fallback);
}

/** Mediated download (the host fetches the URL itself), falling back to opening it. */
export async function downloadUrl(app: App, url: string, filename: string, mimeType: string) {
  try {
    const result = await app.downloadFile({ contents: [{ type: "resource_link", uri: url, name: filename, mimeType }] }, { timeout: ACTION_TIMEOUT_MS });
    if (result.isError) throw new Error("denied");
  } catch {
    openLink(app, url);
  }
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

// --------------------------------------------------------------- polling

export interface PollOptions<T> {
  tool: string;
  args: Record<string, unknown>;
  /** Still the widget's current job? Stops the loop when the card moved on. */
  isCurrent: () => boolean;
  isDone: (data: T) => boolean;
  onUpdate: (data: T) => void;
  onError: (error: ToolError) => void;
  intervalMs?: number;
  maxMs?: number;
  timeoutMessage?: string;
}

// A tool call can hand back "still working" before its job finishes, and the
// host has no obligation to route a later status result into this same
// iframe -- so every async card polls its status tool itself until the job
// settles. Network blips and retryable server errors keep polling; a real
// error result ends it.
export async function pollTool<T>(app: App, options: PollOptions<T>): Promise<void> {
  const { tool, args, isCurrent, isDone, onUpdate, onError } = options;
  const interval = options.intervalMs ?? 3000;
  const deadline = Date.now() + (options.maxMs ?? 6 * 60_000);
  let delay = Math.min(1500, interval);

  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, delay));
    delay = interval;
    if (!isCurrent()) return;
    try {
      const result = (await app.callServerTool({ name: tool, arguments: args }, { timeout: 90_000 })) as CallToolResult;
      if (!isCurrent()) return;
      const error = toolError(result);
      if (error) {
        if (error.retryable) continue;
        onError(error);
        return;
      }
      const data = result.structuredContent as T | undefined;
      if (!data) continue;
      onUpdate(data);
      if (isDone(data)) {
        // The model never saw this result (the card fetched it), so hand it
        // the finished job's summary -- ids, links, transcript text -- for
        // the user's next message.
        if (result.content?.length) void app.updateModelContext({ content: result.content }, { timeout: ACTION_TIMEOUT_MS }).catch(() => undefined);
        return;
      }
    } catch {
      // Transient (timeout, dropped message) -- try again next tick.
    }
  }
  if (isCurrent()) onError({ message: options.timeoutMessage ?? "This is taking longer than expected. Check back in a few minutes, or try again." });
}

// -------------------------------------------------------------- progress

export function formatDuration(seconds: number | null | undefined): string {
  if (!seconds || seconds <= 0) return "0:00";
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Progress block: a label, an optional sublabel, a bar (determinate when
 * `percent` is given, a calm indeterminate sweep otherwise) and a live
 * elapsed-time readout ticking from `startedAt`.
 */
export function progressBlock(options: { label: string; sublabel?: string; percent?: number | null; startedAt?: number }): string {
  const percent = typeof options.percent === "number" ? Math.max(3, Math.min(100, options.percent)) : null;
  const startedAt = options.startedAt ?? Date.now();
  return `
    <div class="v-progress" role="status" aria-live="polite">
      <div class="v-progress-head">
        <span class="v-progress-label">${escapeHtml(options.label)}</span>
        <span class="v-progress-time" data-elapsed-since="${startedAt}">${formatDuration((Date.now() - startedAt) / 1000)}</span>
      </div>
      <div class="v-progress-track${percent === null ? " is-indeterminate" : ""}">
        <div class="v-progress-fill" ${percent === null ? "" : `style="width:${percent}%"`}></div>
      </div>
      ${options.sublabel ? `<div class="v-progress-sub">${escapeHtml(options.sublabel)}</div>` : ""}
    </div>`;
}

/** Vertical stage list (done / active / upcoming) for multi-step jobs. */
export function stageList(stages: string[], activeIndex: number): string {
  return `<ol class="v-stages">${stages
    .map((stage, index) => {
      const state = index < activeIndex ? "is-done" : index === activeIndex ? "is-active" : "";
      return `<li class="v-stage ${state}"><span class="v-stage-dot">${index < activeIndex ? CHECK_ICON : ""}</span>${escapeHtml(stage)}</li>`;
    })
    .join("")}</ol>`;
}

// ---------------------------------------------------------- scroll fades

function updateScrollFade(el: HTMLElement) {
  el.toggleAttribute("data-more", el.scrollHeight - el.scrollTop - el.clientHeight > 1);
}

let fadesStarted = false;
/**
 * Keeps every .v-scroll list's data-more flag current (see shared/base.css):
 * set while there's more to scroll, cleared at the end. Started by connectApp.
 */
export function startScrollFades() {
  if (fadesStarted) return;
  fadesStarted = true;
  const refresh = () => document.querySelectorAll<HTMLElement>(".v-scroll").forEach(updateScrollFade);
  document.addEventListener(
    "scroll",
    (event) => {
      if (event.target instanceof HTMLElement && event.target.classList.contains("v-scroll")) updateScrollFade(event.target);
    },
    true
  );
  // Renders swap the DOM; images and video metadata can change heights later.
  new MutationObserver(() => requestAnimationFrame(refresh)).observe(document.body, { childList: true, subtree: true });
  document.addEventListener("load", refresh, true);
  window.addEventListener("resize", refresh);
  refresh();
}

let tickerStarted = false;
/** Keeps every [data-elapsed-since] readout ticking. Safe to call more than once. */
export function startElapsedTicker() {
  if (tickerStarted) return;
  tickerStarted = true;
  setInterval(() => {
    document.querySelectorAll<HTMLElement>("[data-elapsed-since]").forEach((el) => {
      const since = Number(el.dataset.elapsedSince);
      if (since) el.textContent = formatDuration((Date.now() - since) / 1000);
    });
  }, 1000);
}

/** Remembers when a job id was first seen, so re-renders keep one continuous timer. */
const startTimes = new Map<string, number>();
export function startedAtFor(id: string | undefined, createdAt?: string | null): number {
  if (!id) return Date.now();
  const existing = startTimes.get(id);
  if (existing) return existing;
  const parsed = createdAt ? Date.parse(createdAt) : NaN;
  const value = Number.isFinite(parsed) && parsed <= Date.now() ? parsed : Date.now();
  startTimes.set(id, value);
  return value;
}

/** Flashes "Copied" (or a failure note) on a button, then restores it. */
export function flashButton(button: HTMLElement, label: string, ms = 1600) {
  const original = button.innerHTML;
  button.innerHTML = label;
  button.classList.add("is-done");
  setTimeout(() => {
    button.innerHTML = original;
    button.classList.remove("is-done");
  }, ms);
}

let lastEnterKey: string | null = null;
/** "v-enter" the first time a key is rendered, "" on repeat renders (progress ticks shouldn't replay the entrance). */
export function enterOnce(key: string): string {
  if (key === lastEnterKey) return "";
  lastEnterKey = key;
  return "v-enter";
}
