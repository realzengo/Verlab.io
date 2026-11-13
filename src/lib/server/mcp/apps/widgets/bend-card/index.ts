import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import {
  connectApp,
  copyText,
  escapeHtml,
  flashButton,
  pad2,
  panel,
  sendChatMessage,
  statusBadge,
  errorBadge,
  toolError,
  CHECK_ICON,
  COPY_ICON,
  EXTERNAL_ICON,
  PEN_ICON,
  ARROW_RIGHT_ICON,
  CHEVRON_DOWN_ICON,
  pollTool,
  progressBlock,
  renderErrorState,
  stageList,
  startElapsedTicker,
  startedAtFor,
  enterOnce,
  type ToolError,
} from "../../shared/host";

interface Candidate {
  id: 1 | 2 | 3;
  nicheName: string;
  angle: string;
  exampleTitles: string[];
}
interface Analysis {
  channelName?: string;
  avatarUrl?: string | null;
  detectedNiche?: string;
  format?: string;
  topVideos?: { title: string; views: string }[];
}
interface SopContent {
  title: string;
  subtitle?: string;
  onelinePromise?: string;
  channelOverview?: { narrationPov?: string; avgLength?: string; recurringThemes?: string[]; yourChannelNote?: string };
  hookPlaybook?: { template: string; psychology?: string; whenToUse?: string; forYourChannelExamples?: string[] }[];
  scriptStructureBeats?: { beat: string; timing: string; function: string }[];
  storytellingFrameworks?: { name: string; howItWorks: string; steps?: string[] }[];
  retentionMechanics?: { rehookCatalog?: { phrase: string; whenToUse?: string }[]; patternInterrupts?: string[]; openLoopsRule?: string };
  openingClosingPatterns?: { first30SecondsTemplate?: string[]; hardRules?: string[]; howVideosEnd?: string };
  quickReferenceCard?: { beatStructureOneLine?: string; dos?: string[]; donts?: string[] };
}
interface BendData {
  jobId?: string;
  status?: string;
  statusText?: string | null;
  progress?: number | null;
  analysis?: Analysis;
  candidates?: Candidate[];
  sop?: { chosenBend: Candidate; content: SopContent };
  error?: { message: string };
  appUrl?: string | null;
}

const WORKING_STAGES = ["opening_channel", "reading_videos", "identifying_format", "generating_bends"];
const STAGE_LABELS = ["Opening the channel", "Reading the top videos", "Identifying the format", "Generating niche bends"];
const TOOL = "Niche bend";

const root = document.getElementById("root")!;
let current: BendData | null = null;
let renderToken = 0;
let inlineError: ToolError | null = null;
let building: number | null = null;
const openSections = new Set<string>(["quick", "hooks"]);

function channelRow(): string {
  const analysis = current?.analysis;
  if (!analysis?.channelName) return "";
  return `
    <div class="v-section bd-channel">
      ${analysis.avatarUrl ? `<img class="bd-avatar" src="${escapeHtml(analysis.avatarUrl)}" alt="">` : `<span class="bd-avatar">${escapeHtml(analysis.channelName.slice(0, 1))}</span>`}
      <div class="bd-channel-text">
        <div class="bd-channel-name">${escapeHtml(analysis.channelName)}${analysis.detectedNiche ? `<span class="bd-niche">${escapeHtml(analysis.detectedNiche)}</span>` : ""}</div>
        ${analysis.format ? `<div class="bd-format" title="${escapeHtml(analysis.format)}">${escapeHtml(analysis.format)}</div>` : ""}
      </div>
    </div>`;
}

function shell(options: { aside: string; body: string; footer?: string; enter: string }) {
  return panel({ tool: TOOL, aside: options.aside, flush: true, enter: options.enter, body: `${channelRow()}${options.body}`, footer: options.footer });
}

function renderError(error: ToolError) {
  renderToken++;
  root.innerHTML = shell({ aside: errorBadge(error), enter: "v-enter", body: `<div class="v-section">${renderErrorState(error)}</div>` });
}

function poll(jobId: string, token: number, done: (data: BendData) => boolean) {
  void pollTool<BendData>(app, {
    tool: "check_bend_status",
    args: { jobId },
    isCurrent: () => token === renderToken,
    isDone: (next) => next.status === "failed" || done(next),
    onUpdate: (next) => {
      if (next.status !== current?.status || next.progress !== current?.progress) render(next);
    },
    onError: renderError,
    maxMs: 12 * 60_000,
  });
}

function candidateRow(candidate: Candidate): string {
  const busy = building === candidate.id;
  return `
    <div class="bd-candidate">
      <span class="v-index">${pad2(candidate.id)}</span>
      <div class="bd-cand-body">
        <div class="bd-cand-head">
          <span class="bd-cand-title">${escapeHtml(candidate.nicheName)}</span>
          <span class="v-tag">${escapeHtml(candidate.angle)}</span>
        </div>
        <ul class="bd-titles">${candidate.exampleTitles
          .slice(0, 3)
          .map((title) => `<li>${escapeHtml(title)}</li>`)
          .join("")}</ul>
      </div>
      <button type="button" class="v-btn v-btn-sm bd-build" data-build="${candidate.id}" ${building !== null ? "disabled" : ""}>
        ${busy ? `<span class="bd-btn-spinner"></span>Starting` : `Build SOP${ARROW_RIGHT_ICON}`}
      </button>
    </div>`;
}

function section(key: string, title: string, body: string): string {
  if (!body.trim()) return "";
  const open = openSections.has(key);
  return `
    <div class="bd-section${open ? " is-open" : ""}">
      <button type="button" class="bd-section-head" data-section="${key}" aria-expanded="${open}">
        <span>${escapeHtml(title)}</span>${CHEVRON_DOWN_ICON}
      </button>
      ${open ? `<div class="bd-section-body">${body}</div>` : ""}
    </div>`;
}

const list = (items: string[] | undefined) => (items?.length ? `<ul class="bd-ul">${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : "");

function sopSections(content: SopContent): string {
  const quick = content.quickReferenceCard;
  const retention = content.retentionMechanics;
  const opening = content.openingClosingPatterns;
  const hooks = content.hookPlaybook ?? [];
  return `
    ${section(
      "quick",
      "Quick reference",
      `${quick?.beatStructureOneLine ? `<div class="bd-kv"><span class="bd-k">Structure</span><span class="bd-mono">${escapeHtml(quick.beatStructureOneLine)}</span></div>` : ""}
       <div class="bd-dodont">
         <div><div class="bd-mini is-do">Do</div>${list(quick?.dos)}</div>
         <div><div class="bd-mini is-dont">Don't</div>${list(quick?.donts)}</div>
       </div>`
    )}
    ${section(
      "hooks",
      `Hook playbook`,
      hooks
        .map(
          (hook, index) => `<div class="bd-hook"><span class="v-index">${pad2(index + 1)}</span><div class="bd-hook-body"><div class="bd-hook-t">${escapeHtml(hook.template)}</div>
            ${hook.psychology ? `<div class="bd-hook-s">${escapeHtml(hook.psychology)}</div>` : ""}
            ${hook.forYourChannelExamples?.length ? `<div class="bd-hook-e">“${escapeHtml(hook.forYourChannelExamples[0])}”</div>` : ""}</div></div>`
        )
        .join("")
    )}
    ${section(
      "beats",
      "Script structure",
      `<ol class="bd-beats">${(content.scriptStructureBeats ?? [])
        .map((beat) => `<li><span class="bd-timing">${escapeHtml(beat.timing)}</span><div><div class="bd-beat">${escapeHtml(beat.beat)}</div><div class="bd-hook-s">${escapeHtml(beat.function)}</div></div></li>`)
        .join("")}</ol>`
    )}
    ${section(
      "story",
      "Storytelling frameworks",
      (content.storytellingFrameworks ?? [])
        .map(
          (f) =>
            `<div class="bd-framework"><div class="bd-hook-t">${escapeHtml(f.name)}</div><div class="bd-hook-s">${escapeHtml(f.howItWorks)}</div>${f.steps?.length ? `<div class="bd-mono bd-steps">${f.steps.map(escapeHtml).join(" → ")}</div>` : ""}</div>`
        )
        .join("")
    )}
    ${section(
      "retention",
      "Retention and rehooks",
      `${retention?.rehookCatalog?.length ? `<div class="v-tags bd-chips">${retention.rehookCatalog.map((r) => `<span class="v-tag">“${escapeHtml(r.phrase)}”</span>`).join("")}</div>` : ""}
       ${list(retention?.patternInterrupts)}
       ${retention?.openLoopsRule ? `<div class="bd-kv"><span class="bd-k">Open loops</span><span>${escapeHtml(retention.openLoopsRule)}</span></div>` : ""}`
    )}
    ${section(
      "opening",
      "Openings and endings",
      `${opening?.first30SecondsTemplate?.length ? `<div class="bd-kv"><span class="bd-k">First 30 seconds</span><span class="bd-mono">${opening.first30SecondsTemplate.map(escapeHtml).join(" → ")}</span></div>` : ""}
       ${list(opening?.hardRules)}
       ${opening?.howVideosEnd ? `<div class="bd-kv"><span class="bd-k">Endings</span><span>${escapeHtml(opening.howVideosEnd)}</span></div>` : ""}`
    )}`;
}

function sopMarkdown(content: SopContent, bend: Candidate): string {
  const lines = [`# ${content.title}`, content.onelinePromise ?? "", `Niche: ${bend.nicheName} (${bend.angle})`, ""];
  if (content.quickReferenceCard) {
    lines.push("## Quick reference", content.quickReferenceCard.beatStructureOneLine ?? "");
    (content.quickReferenceCard.dos ?? []).forEach((d) => lines.push(`- Do: ${d}`));
    (content.quickReferenceCard.donts ?? []).forEach((d) => lines.push(`- Don't: ${d}`));
    lines.push("");
  }
  lines.push("## Hook playbook");
  (content.hookPlaybook ?? []).forEach((h) => lines.push(`- ${h.template}${h.psychology ? ` (${h.psychology})` : ""}`));
  lines.push("", "## Script structure");
  (content.scriptStructureBeats ?? []).forEach((b) => lines.push(`- [${b.timing}] ${b.beat}: ${b.function}`));
  lines.push("", "## Storytelling frameworks");
  (content.storytellingFrameworks ?? []).forEach((f) => lines.push(`- ${f.name}: ${f.howItWorks}`));
  return lines.join("\n");
}

function render(data: BendData | null) {
  const token = ++renderToken;
  current = data;
  const status = data?.status ?? "opening_channel";

  if (status === "failed") {
    renderError({ message: data?.error?.message ?? "The analysis failed. Your credits were refunded." });
    return;
  }

  if (status === "sop_ready" && data?.sop) {
    const content = data.sop.content;
    root.innerHTML = shell({
      aside: statusBadge("ready", "SOP ready"),
      enter: enterOnce(`${data.jobId}:sop`),
      body: `
        <div class="v-section bd-sop-head">
          <div class="bd-chosen"><span class="bd-k">Bend</span>${escapeHtml(data.sop.chosenBend.nicheName)}<span class="v-tag">${escapeHtml(data.sop.chosenBend.angle)}</span></div>
          <h1 class="v-title-lg">${escapeHtml(content.title)}</h1>
          ${content.onelinePromise ? `<p class="bd-promise">${escapeHtml(content.onelinePromise)}</p>` : ""}
        </div>
        <div class="bd-sections" id="bd-sections">${sopSections(content)}</div>`,
      footer: `
        <button type="button" class="v-btn v-btn-primary" id="bd-script">${PEN_ICON}Write a script with this SOP</button>
        <button type="button" class="v-btn" id="bd-copy">${COPY_ICON}Copy SOP</button>
        <span class="v-spacer"></span>
        ${data.appUrl ? `<button type="button" class="v-btn v-btn-ghost v-trail" data-open-url="${escapeHtml(data.appUrl)}">Open in Verlab${EXTERNAL_ICON}</button>` : ""}
        <div class="v-quick-status" id="quick-status" hidden></div>`,
    });
    return;
  }

  if (status === "generating_sop") {
    root.innerHTML = shell({
      aside: statusBadge("live", "Writing SOP"),
      enter: enterOnce(`${data?.jobId}:generating_sop`),
      body: `<div class="v-section">${progressBlock({
        label: "Writing your SOP",
        sublabel: "Hook playbook, beat structure and retention rules, about 1–2 minutes",
        startedAt: startedAtFor(`${data?.jobId}:sop`),
      })}</div>`,
    });
    if (data?.jobId) poll(data.jobId, token, (next) => next.status === "sop_ready" || next.status === "ready");
    return;
  }

  if (status === "ready" && data?.candidates?.length) {
    const lastError = inlineError ?? (data.error ? { message: data.error.message } : null);
    root.innerHTML = shell({
      aside: statusBadge("ready", `${data.candidates.length} bends`),
      enter: enterOnce(`${data.jobId}:ready`),
      body: `
        <div class="v-section">
          <div class="v-section-label">Pick a bend to build its script SOP</div>
          <div class="bd-candidates">${data.candidates.map(candidateRow).join("")}</div>
          ${lastError ? `<div class="bd-inline-error">${renderErrorState(lastError)}</div>` : ""}
        </div>`,
    });
    return;
  }

  const index = Math.max(0, WORKING_STAGES.indexOf(status));
  root.innerHTML = shell({
    aside: statusBadge("live", "Analyzing"),
    enter: enterOnce(`${data?.jobId}:working`),
    body: `
      <div class="v-section">
        ${progressBlock({
          label: data?.statusText ?? "Opening the channel…",
          sublabel: "Reading real transcripts takes 1–3 minutes",
          percent: typeof data?.progress === "number" ? data.progress : null,
          startedAt: startedAtFor(data?.jobId),
        })}
        ${stageList(STAGE_LABELS, index)}
      </div>`,
  });
  if (data?.jobId) poll(data.jobId, token, (next) => next.status === "ready" || next.status === "sop_ready");
}

async function buildSop(bend: number) {
  if (!current?.jobId || building !== null) return;
  building = bend;
  inlineError = null;
  render(current);
  try {
    const result = (await app.callServerTool({ name: "create_sop", arguments: { jobId: current.jobId, bend } }, { timeout: 60_000 })) as CallToolResult;
    building = null;
    const error = toolError(result);
    if (error) {
      inlineError = error;
      render(current);
      return;
    }
    render((result.structuredContent as BendData | undefined) ?? current);
  } catch {
    building = null;
    inlineError = { message: "Couldn't reach Verlab. Please try again." };
    render(current);
  }
}

function showQuickStatus(message: string) {
  const el = document.getElementById("quick-status");
  if (!el) return;
  el.hidden = false;
  el.textContent = message;
  setTimeout(() => (el.hidden = true), 3500);
}

startElapsedTicker();
render(null);
const app = connectApp({
  name: "Verlab Bend",
  onResult: (result) => render((result.structuredContent as BendData | undefined) ?? null),
  onError: renderError,
});

root.addEventListener("click", (event) => {
  const target = event.target as HTMLElement;
  const build = target.closest<HTMLElement>("[data-build]");
  if (build) {
    void buildSop(Number(build.dataset.build));
    return;
  }
  const sectionHead = target.closest<HTMLElement>("[data-section]");
  if (sectionHead?.dataset.section && current?.sop) {
    const key = sectionHead.dataset.section;
    if (openSections.has(key)) openSections.delete(key);
    else openSections.add(key);
    const holder = sectionHead.closest(".bd-section");
    const fresh = document.createElement("div");
    fresh.innerHTML = sopSections(current.sop.content);
    const replacement = fresh.querySelector(`[data-section="${key}"]`)?.closest(".bd-section");
    if (holder && replacement) holder.replaceWith(replacement);
    return;
  }
  if (target.closest("#bd-script") && current?.jobId) {
    sendChatMessage(app, `Write a script with my SOP (generate_script with sopId ${current.jobId}). Ask me for the topic if you need it.`, showQuickStatus);
    return;
  }
  const copy = target.closest<HTMLElement>("#bd-copy");
  if (copy && current?.sop) {
    void copyText(sopMarkdown(current.sop.content, current.sop.chosenBend)).then((ok) => flashButton(copy, ok ? `${CHECK_ICON}Copied` : "Copy failed"));
  }
});
