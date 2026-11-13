import { connectApp, escapeHtml, panel, EXTERNAL_ICON } from "../../shared/host";

interface StatData {
  credits?: number;
  plan?: string | null;
  topUpUrl?: string | null;
}

const root = document.getElementById("root")!;

function render(data: StatData | null) {
  if (!data || typeof data.credits !== "number") {
    root.innerHTML = panel({ tool: "Credits", enter: "", body: `<div class="v-empty">Loading balance…</div>` });
    return;
  }

  root.innerHTML = panel({
    tool: "Credits",
    aside: data.plan ? `<span class="v-aside">${escapeHtml(data.plan)} plan</span>` : "",
    body: `
      <div class="sc-label">Credits remaining</div>
      <div class="sc-value">${data.credits.toLocaleString("en-US")}</div>`,
    footer: data.topUpUrl
      ? `<span class="v-footer-note">Credits never expire while your plan is active</span>
         <button type="button" class="v-btn" data-open-url="${escapeHtml(data.topUpUrl)}">Top up credits${EXTERNAL_ICON}</button>`
      : "",
  });
}

render(null);
connectApp({
  name: "Verlab Credits",
  onResult: (result) => render((result.structuredContent as StatData | undefined) ?? null),
});
