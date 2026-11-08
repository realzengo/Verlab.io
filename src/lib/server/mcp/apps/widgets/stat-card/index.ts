import { connectApp, escapeHtml, LOGO_MARK } from "../../shared/host";

interface StatData {
  credits?: number;
  plan?: string | null;
  topUpUrl?: string | null;
}

const root = document.getElementById("root")!;

function render(data: StatData | null) {
  if (!data || typeof data.credits !== "number") {
    root.innerHTML = `<div class="v-card"><div class="v-empty">Loading balance…</div></div>`;
    return;
  }

  root.innerHTML = `
    <div class="v-card v-enter">
      <div class="v-header">
        ${LOGO_MARK}
        <span class="v-title">Verlab</span>
        <span class="v-spacer"></span>
        ${data.plan ? `<span class="v-pill">${escapeHtml(data.plan)} plan</span>` : ""}
      </div>
      <div class="v-stat">
        <div class="v-stat-label">Credits remaining</div>
        <div class="v-stat-value">${data.credits.toLocaleString()}</div>
      </div>
      ${data.topUpUrl ? `<div class="v-btn-row"><button type="button" class="v-btn" data-open-url="${escapeHtml(data.topUpUrl)}">Top up credits</button></div>` : ""}
    </div>
  `;
}

render(null);
connectApp({
  name: "Verlab Credits",
  onResult: (result) => render((result.structuredContent as StatData | undefined) ?? null),
});
