import { connectApp, LOGO_MARK } from "../../shared/host";

interface StatData {
  credits?: number;
}

const root = document.getElementById("root")!;

function render(data: StatData | null) {
  if (!data || typeof data.credits !== "number") {
    root.innerHTML = `<div class="v-card"><div class="v-empty">Loading balance…</div></div>`;
    return;
  }

  root.innerHTML = `
    <div class="v-card">
      <div class="v-header">
        ${LOGO_MARK}
        <span class="v-title">Verlab</span>
      </div>
      <div class="v-stat">
        <div class="v-stat-value">${data.credits.toLocaleString()}</div>
        <div class="v-stat-label">credits remaining</div>
      </div>
    </div>
  `;
}

render(null);
connectApp({
  name: "Verlab Credit Balance",
  onResult: (result) => render((result.structuredContent as StatData | undefined) ?? null),
});
