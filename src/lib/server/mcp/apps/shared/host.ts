import { App, PostMessageTransport, applyDocumentTheme } from "@modelcontextprotocol/ext-apps";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

// Verlab's brand mark, inlined as SVG path data so every widget carries the
// actual logo instead of a generic dot/icon or plain wordmark.
export const LOGO_MARK = `<svg viewBox="0 0 2363 2363" fill="currentColor" aria-hidden="true"><path d="M192,236 34,532 1019,2234 1343,2238 2331,519 2187,246 1442,239 1332,999 1690,1135 1334,1279 1203,1638 1058,1281 700,1149 1054,1002 915,239Z"/></svg>`;

// Small stroke-style icon set (Lucide-equivalent paths, hand-inlined so the
// vanilla widget bundles don't pull in the lucide-react runtime) shared by
// widgets that need copy/export/quick-action affordances.
const ICON_ATTRS = 'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';
export const COPY_ICON = `<svg ${ICON_ATTRS}><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;
export const CHECK_ICON = `<svg ${ICON_ATTRS}><path d="M20 6 9 17l-5-5"/></svg>`;
export const DOWNLOAD_ICON = `<svg ${ICON_ATTRS}><path d="M12 15V3"/><path d="m7 10 5 5 5-5"/><path d="M20 21H4"/></svg>`;
export const MIC_ICON = `<svg ${ICON_ATTRS}><path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v1a7 7 0 0 1-14 0v-1"/><path d="M12 18v4"/></svg>`;
export const LANGUAGES_ICON = `<svg ${ICON_ATTRS}><path d="m5 8 6 6"/><path d="m4 14 6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/><path d="m22 22-5-10-5 10"/><path d="M14 18h6"/></svg>`;
export const MINIMIZE_ICON = `<svg ${ICON_ATTRS}><path d="M8 3v3a2 2 0 0 1-2 2H3"/><path d="M21 8h-3a2 2 0 0 1-2-2V3"/><path d="M3 16h3a2 2 0 0 1 2 2v3"/><path d="M16 21v-3a2 2 0 0 1 2-2h3"/></svg>`;
export const CHEVRON_DOWN_ICON = `<svg ${ICON_ATTRS}><path d="m6 9 6 6 6-6"/></svg>`;

// Boilerplate shared by every Verlab widget: construct the App, wire the
// handshake, and connect. Callers only supply what differs per widget
// (rendering the initial/updated tool result). Widgets are light-mode only
// (see shared/base.css), so unlike a typical MCP App this deliberately does
// not sync to the host's theme context.
export interface ConnectAppOptions {
  name: string;
  onResult: (result: CallToolResult) => void;
  onLoading?: () => void;
  // Fires once, right after the ui/initialize handshake completes -- for
  // widget-specific post-connect setup (e.g. requesting a display mode)
  // that most widgets don't need, so it isn't baked into the shared flow.
  onConnected?: (app: App) => void;
}

export function connectApp({ name, onResult, onLoading, onConnected }: ConnectAppOptions): App {
  const app = new App({ name, version: "1.0.0" });

  app.onteardown = async () => ({});
  app.onerror = (error) => console.error(`[verlab:${name}]`, error);
  app.ontoolinput = () => onLoading?.();
  app.ontoolresult = (result) => onResult(result as CallToolResult);
  // Hosts that implement the theme handshake report light/dark here --
  // applyDocumentTheme sets [data-theme] on <html>, which base.css's dark
  // overrides key off. Hosts that don't implement it just never call this,
  // and prefers-color-scheme covers the fallback.
  app.onhostcontextchanged = (ctx) => {
    if (ctx.theme) applyDocumentTheme(ctx.theme);
  };

  app.connect(new PostMessageTransport(window.parent, window.parent)).then(() => {
    const theme = app.getHostContext()?.theme;
    if (theme) applyDocumentTheme(theme);
    onConnected?.(app);
  });

  return app;
}

// Hosts that don't yet implement a given ui/* method just never reply --
// the SDK's default request timeout is 60s, which reads as a dead button for
// that whole time. Fail fast instead so the fallback below kicks in quickly.
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

// Posts a user-authored follow-up message into the chat thread -- how a
// widget's quick-action pills (e.g. "Shorten", "Send to voiceover") hand off
// to Claude/other connected tools, since the widget itself can't call tools
// outside its own server. Hosts that don't support (or reject) it get the
// same clipboard fallback as the transcript export, so the pill never
// dead-ends silently.
export function sendChatMessage(app: App, text: string) {
  const fallback = () => void navigator.clipboard.writeText(text).catch(() => {});
  app
    .sendMessage({ role: "user", content: [{ type: "text", text }] }, { timeout: ACTION_TIMEOUT_MS })
    .then((result) => {
      if (result.isError) fallback();
    })
    .catch(fallback);
}

const ESCAPE_MAP: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ESCAPE_MAP[char]);
}
