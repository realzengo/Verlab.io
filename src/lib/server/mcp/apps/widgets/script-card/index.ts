import { connectApp, escapeHtml } from "../../shared/host";

interface ScriptData {
  text?: string;
  cost?: number;
}

const root = document.getElementById("root")!;

function render(data: ScriptData | null) {
  const text = data?.text ?? "";
  root.innerHTML = `
    <div class="v-card">
      <div class="v-header">
        <img src="https://verlab.io/logo-icon.png" alt="">
        <span class="v-title">Verlab Script</span>
        <span class="v-spacer"></span>
        ${typeof data?.cost === "number" ? `<span class="v-pill">${data.cost} credits</span>` : ""}
      </div>
      <pre class="v-script">${text ? escapeHtml(text) : "Generating…"}</pre>
    </div>
  `;
}

render(null);
connectApp({
  name: "Verlab Script",
  onResult: (result) => render((result.structuredContent as ScriptData | undefined) ?? null),
});
