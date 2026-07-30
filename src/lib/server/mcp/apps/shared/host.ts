import { App, PostMessageTransport } from "@modelcontextprotocol/ext-apps";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

// Verlab's brand mark, inlined as SVG path data so every widget carries the
// actual logo instead of a generic dot/icon or plain wordmark.
export const LOGO_MARK = `<svg viewBox="0 0 2363 2363" fill="currentColor" aria-hidden="true"><path d="M192,236 34,532 1019,2234 1343,2238 2331,519 2187,246 1442,239 1332,999 1690,1135 1334,1279 1203,1638 1058,1281 700,1149 1054,1002 915,239Z"/></svg>`;

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

  app.connect(new PostMessageTransport(window.parent, window.parent)).then(() => {
    onConnected?.(app);
  });

  return app;
}

export function openLink(app: App, url: string | null | undefined) {
  if (!url) return;
  void app.openLink({ url });
}

const ESCAPE_MAP: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ESCAPE_MAP[char]);
}
