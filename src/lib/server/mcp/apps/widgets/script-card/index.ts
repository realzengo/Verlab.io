import {
  connectApp,
  escapeHtml,
  pad2,
  panel,
  renderErrorState,
  sendChatMessage,
  statusBadge,
  errorBadge,
  COPY_ICON,
  CHECK_ICON,
  MIC_ICON,
  LANGUAGES_ICON,
  MINIMIZE_ICON,
  type ToolError,
} from "../../shared/host";
import { parseScriptOutput, splitIntoSegments, countWords, estimateDurationLabel } from "../../../../../script-format";

interface ScriptData {
  text?: string;
  cost?: number;
}

interface Segment {
  text: string;
  role: "hook" | "body" | "cta";
}

const root = document.getElementById("root")!;
let segments: Segment[] = [];
let fullScript = "";

// The generator's output is a strict "TITLE / SCRIPT / METRICS" envelope
// (see buildSystemPrompt in lib/server/script-generation.ts) except in idea
// -list mode, which has no such envelope. Only render the segmented Hook/
// Body/CTA view when that envelope actually parsed -- otherwise fall back
// to the plain script view so idea lists (and anything unexpected) still
// display in full instead of being mangled by a false-positive split.
function buildSegments(script: string): Segment[] {
  const lines = splitIntoSegments(script);
  if (lines.length <= 1) return lines.map((text) => ({ text, role: "body" as const }));
  if (lines.length === 2) return [{ text: lines[0], role: "hook" }, { text: lines[1], role: "cta" }];
  return [
    { text: lines[0], role: "hook" },
    ...lines.slice(1, -1).map((text) => ({ text, role: "body" as const })),
    { text: lines[lines.length - 1], role: "cta" },
  ];
}

// Numbered like a teleprompter: one mono index per line, continuous across blocks.
function lineRow(segment: Segment, index: number): string {
  return `
    <div class="sc-line">
      <span class="v-index">${pad2(index + 1)}</span>
      <span class="sc-line-text">${escapeHtml(segment.text)}</span>
      <button type="button" class="v-icon-btn sc-copy-line" data-index="${index}" aria-label="Copy line" title="Copy line">${COPY_ICON}</button>
    </div>`;
}

const SEGMENT_LABEL: Record<Segment["role"], string> = { hook: "Hook", body: "Body", cta: "Call to action" };

function segmentedBody(): string {
  const blocks: { role: Segment["role"]; start: number; end: number }[] = [];
  segments.forEach((segment, index) => {
    const last = blocks[blocks.length - 1];
    if (last && last.role === segment.role) last.end = index;
    else blocks.push({ role: segment.role, start: index, end: index });
  });

  return blocks
    .map(({ role, start, end }) => {
      const rows = segments
        .slice(start, end + 1)
        .map((segment, i) => lineRow(segment, start + i))
        .join("");
      return `
        <div class="sc-block sc-${role}">
          <div class="sc-block-label">${escapeHtml(SEGMENT_LABEL[role])}</div>
          <div class="sc-lines">${rows}</div>
        </div>`;
    })
    .join("");
}

function render(data: ScriptData | null) {
  const raw = data?.text ?? "";
  fullScript = raw;
  segments = [];

  if (!raw) {
    root.innerHTML = panel({ tool: "Script", aside: statusBadge("live", "Writing"), enter: "", body: `<div class="v-empty">Writing your script…</div>`, flush: true });
    return;
  }

  const parsed = parseScriptOutput(raw);
  const scriptBody = parsed.script || raw;
  const words = countWords(scriptBody);
  const duration = estimateDurationLabel(words);
  const hookType = parsed.metrics.find((m) => m.label === "Extracted Hook Type")?.value;
  const revealDevice = parsed.metrics.find((m) => m.label === "Applied Reveal Device")?.value;

  const isStructured = Boolean(parsed.title || parsed.metrics.length);
  fullScript = scriptBody;

  let body: string;
  if (isStructured) {
    segments = buildSegments(scriptBody);
    body = segmentedBody();
  } else {
    body = `<pre class="sc-plain">${escapeHtml(raw)}</pre>`;
  }

  root.innerHTML = panel({
    tool: "Script",
    aside: typeof data?.cost === "number" ? `<span class="v-aside v-aside-mono">${data.cost} credit${data.cost === 1 ? "" : "s"}</span>` : "",
    flush: true,
    body: `
      <div class="v-section sc-head">
        ${parsed.title ? `<h1 class="v-title-lg">${escapeHtml(parsed.title)}</h1>` : ""}
        <div class="v-meta">
          <span>${words} words</span><span class="v-meta-dot">·</span><span>${duration} read</span>
        </div>
        ${
          hookType || revealDevice
            ? `<div class="v-tags sc-tags">
                ${hookType ? `<span class="v-tag"><span class="sc-tag-key">Hook</span>${escapeHtml(hookType)}</span>` : ""}
                ${revealDevice ? `<span class="v-tag"><span class="sc-tag-key">Reveal</span>${escapeHtml(revealDevice)}</span>` : ""}
              </div>`
            : ""
        }
      </div>
      <div class="v-section sc-script">${body}</div>`,
    footer: `
      <button type="button" class="v-btn" id="copy-all">${COPY_ICON}Copy script</button>
      <button type="button" class="v-btn v-btn-ghost" id="action-shorten">${MINIMIZE_ICON}Shorten</button>
      <button type="button" class="v-btn v-btn-ghost" id="action-translate">${LANGUAGES_ICON}Translate to Arabic</button>
      <span class="v-spacer"></span>
      <button type="button" class="v-btn v-btn-primary" id="action-voiceover">${MIC_ICON}Send to voiceover</button>
      <div class="v-quick-status" id="quick-status" hidden></div>`,
  });
}

function showQuickStatus(message: string) {
  const el = document.getElementById("quick-status") as HTMLElement | null;
  if (!el) return;
  el.hidden = false;
  el.textContent = message;
  setTimeout(() => {
    el.hidden = true;
  }, 3000);
}

function renderError(error: ToolError) {
  root.innerHTML = panel({ tool: "Script", aside: errorBadge(error), body: renderErrorState(error) });
}

render(null);
const app = connectApp({
  name: "Verlab Script",
  onResult: (result) => render((result.structuredContent as ScriptData | undefined) ?? null),
  onError: renderError,
});

function flashCopied(button: HTMLButtonElement, label?: string) {
  const original = button.innerHTML;
  button.innerHTML = label ? `${CHECK_ICON}${label}` : CHECK_ICON;
  button.classList.add("is-done");
  setTimeout(() => {
    button.innerHTML = original;
    button.classList.remove("is-done");
  }, 1200);
}

root.addEventListener("click", (event) => {
  const target = event.target as HTMLElement;

  const copyLine = target.closest<HTMLButtonElement>(".sc-copy-line");
  if (copyLine) {
    const segment = segments[Number(copyLine.dataset.index)];
    if (segment) void navigator.clipboard.writeText(segment.text).then(() => flashCopied(copyLine));
    return;
  }

  const copyAll = target.closest<HTMLButtonElement>("#copy-all");
  if (copyAll) {
    void navigator.clipboard.writeText(fullScript).then(() => flashCopied(copyAll, "Copied"));
    return;
  }

  if (target.closest("#action-shorten")) {
    sendChatMessage(app, "Shorten the script you just gave me, keeping the hook and call-to-action intact.", showQuickStatus);
    return;
  }
  if (target.closest("#action-translate")) {
    sendChatMessage(app, "Translate the script you just gave me into Arabic.", showQuickStatus);
    return;
  }
  if (target.closest("#action-voiceover")) {
    sendChatMessage(app, "Turn the script you just gave me into a voiceover.", showQuickStatus);
    return;
  }
});
