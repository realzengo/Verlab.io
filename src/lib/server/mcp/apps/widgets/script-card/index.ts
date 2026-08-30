import { connectApp, escapeHtml, sendChatMessage, LOGO_MARK, COPY_ICON, CHECK_ICON, MIC_ICON, LANGUAGES_ICON, MINIMIZE_ICON } from "../../shared/host";
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

function lineRow(segment: Segment, index: number): string {
  return `
    <div class="v-line">
      <span class="v-line-text">${escapeHtml(segment.text)}</span>
      <button type="button" class="v-icon-btn v-copy-line" data-index="${index}" aria-label="Copy line" title="Copy line">${COPY_ICON}</button>
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
        <div class="v-seg-block v-seg-${role}">
          <div class="v-seg-label">${escapeHtml(SEGMENT_LABEL[role])}</div>
          <div class="v-seg-lines">${rows}</div>
        </div>`;
    })
    .join("");
}

function render(data: ScriptData | null) {
  const raw = data?.text ?? "";
  fullScript = raw;
  segments = [];

  if (!raw) {
    root.innerHTML = `
      <div class="v-card">
        <div class="v-header">${LOGO_MARK}<span class="v-title">Verlab Script</span></div>
        <div class="v-empty">Generating…</div>
      </div>
    `;
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
    body = `<pre class="v-script">${escapeHtml(raw)}</pre>`;
  }

  root.innerHTML = `
    <div class="v-card">
      <div class="v-header">
        ${LOGO_MARK}
        <span class="v-title">${escapeHtml(parsed.title ?? "Verlab Script")}</span>
        <span class="v-spacer"></span>
        ${typeof data?.cost === "number" ? `<span class="v-pill">${data.cost} credit${data.cost === 1 ? "" : "s"}</span>` : ""}
      </div>
      <div class="v-meta">
        <span>${words} words</span>
        <span class="v-meta-dot">&middot;</span>
        <span>${duration} read</span>
      </div>
      ${
        hookType || revealDevice
          ? `<div class="v-tags">
              ${hookType ? `<span class="v-tag v-tag-ai">${escapeHtml(hookType)}</span>` : ""}
              ${revealDevice ? `<span class="v-tag v-tag-ai">${escapeHtml(revealDevice)}</span>` : ""}
            </div>`
          : ""
      }
      ${body}
      <div class="v-quick-actions">
        <button type="button" class="v-quick-pill" id="copy-all">${COPY_ICON}Copy script</button>
        <button type="button" class="v-quick-pill" id="action-shorten">${MINIMIZE_ICON}Shorten</button>
        <button type="button" class="v-quick-pill" id="action-translate">${LANGUAGES_ICON}Translate to Arabic</button>
        <button type="button" class="v-quick-pill" id="action-voiceover">${MIC_ICON}Send to voiceover</button>
      </div>
    </div>
  `;
}

function renderError(message: string) {
  root.innerHTML = `
    <div class="v-card">
      <div class="v-header">${LOGO_MARK}<span class="v-title">Verlab Script</span></div>
      <div class="v-error">${escapeHtml(message)}</div>
    </div>
  `;
}

render(null);
const app = connectApp({
  name: "Verlab Script",
  onResult: (result) => {
    if (result.isError) {
      const message = result.content?.find((block) => block.type === "text")?.text ?? "Script generation failed.";
      renderError(message);
      return;
    }
    render((result.structuredContent as ScriptData | undefined) ?? null);
  },
});

function flashCopied(button: HTMLButtonElement) {
  const original = button.innerHTML;
  button.innerHTML = CHECK_ICON;
  button.classList.add("is-done");
  setTimeout(() => {
    button.innerHTML = original;
    button.classList.remove("is-done");
  }, 1200);
}

root.addEventListener("click", (event) => {
  const target = event.target as HTMLElement;

  const copyLine = target.closest<HTMLButtonElement>(".v-copy-line");
  if (copyLine) {
    const segment = segments[Number(copyLine.dataset.index)];
    if (segment) void navigator.clipboard.writeText(segment.text).then(() => flashCopied(copyLine));
    return;
  }

  const copyAll = target.closest<HTMLButtonElement>("#copy-all");
  if (copyAll) {
    void navigator.clipboard.writeText(fullScript).then(() => flashCopied(copyAll));
    return;
  }

  if (target.closest("#action-shorten")) {
    sendChatMessage(app, "Shorten the script you just gave me, keeping the hook and call-to-action intact.");
    return;
  }
  if (target.closest("#action-translate")) {
    sendChatMessage(app, "Translate the script you just gave me into Arabic.");
    return;
  }
  if (target.closest("#action-voiceover")) {
    sendChatMessage(app, "Turn the script you just gave me into a voiceover.");
    return;
  }
});
