import { App, PostMessageTransport, applyDocumentTheme } from "@modelcontextprotocol/ext-apps";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

// Boilerplate shared by every Verlab widget: construct the App, wire the
// handshake + theme sync, and connect. Callers only supply what differs
// per widget (rendering the initial/updated tool result).
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
  app.onhostcontextchanged = (ctx) => {
    if (ctx.theme) applyDocumentTheme(ctx.theme);
  };

  app.connect(new PostMessageTransport(window.parent, window.parent)).then(() => {
    const ctx = app.getHostContext();
    if (ctx?.theme) applyDocumentTheme(ctx.theme);
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
