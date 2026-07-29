import { connectApp, escapeHtml } from "../../shared/host";

interface ScriptRow {
  prompt: string;
  created_at: string;
}
interface ImageRow {
  prompt: string;
  outputs: string[];
  created_at: string;
}
interface SopRow {
  created_at: string;
}
interface ListData {
  scripts?: ScriptRow[];
  images?: ImageRow[];
  sops?: SopRow[];
}

const root = document.getElementById("root")!;

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

function renderRows(data: ListData): string {
  const rows: string[] = [];

  for (const script of data.scripts ?? []) {
    rows.push(`
      <div class="v-row">
        <div class="v-row-main">
          <div class="v-row-title">${escapeHtml(truncate(script.prompt, 70))}</div>
          <div class="v-row-sub">Script · ${formatDate(script.created_at)}</div>
        </div>
      </div>
    `);
  }

  for (const image of data.images ?? []) {
    const thumb = image.outputs?.[0];
    rows.push(`
      <div class="v-row">
        ${thumb ? `<img class="v-row-thumb" src="${thumb}" alt="">` : ""}
        <div class="v-row-main">
          <div class="v-row-title">${escapeHtml(truncate(image.prompt, 60))}</div>
          <div class="v-row-sub">Image · ${formatDate(image.created_at)}</div>
        </div>
      </div>
    `);
  }

  for (const sop of data.sops ?? []) {
    rows.push(`
      <div class="v-row">
        <div class="v-row-main">
          <div class="v-row-title">Saved style analysis</div>
          <div class="v-row-sub">SOP · ${formatDate(sop.created_at)}</div>
        </div>
      </div>
    `);
  }

  return rows.join("") || `<div class="v-empty">Nothing here yet.</div>`;
}

function render(data: ListData | null) {
  root.innerHTML = `
    <div class="v-card">
      <div class="v-header">
        <img src="https://verlab.io/logo-icon.png" alt="">
        <span class="v-title">Verlab Library</span>
      </div>
      <div class="v-list">${renderRows(data ?? {})}</div>
    </div>
  `;
}

render(null);
connectApp({
  name: "Verlab Library",
  onResult: (result) => render((result.structuredContent as ListData | undefined) ?? null),
});
