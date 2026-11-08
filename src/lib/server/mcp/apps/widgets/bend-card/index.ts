import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import {
  connectApp,
  copyText,
  escapeHtml,
  flashButton,
  sendChatMessage,
  toolError,
  LOGO_MARK,
  COPY_ICON,
  EXTERNAL_ICON,
  SPARK_ICON,
  CHEVRON_DOWN_ICON,
  pollTool,
  progressBlock,
  renderErrorState,
  stageList,
  startElapsedTicker,
  startedAtFor,
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

const root = document.getElementById("root")!;
let current: BendData | null = null;
let renderToken = 0;
let inlineError: ToolError | null = null;
let building: number | null = null;
const openSections = new Set<string>(["quick", "hooks"]);

function shell(body: string, pill = "") {
  const analysis = current?.analysis;
  return `
    <div class="v-card v-enter">
      <div class="v-header">
        ${LOGO_MARK}
        <span class="v-title">Verlab Bend</span>
        <span class="v-spacer"></span>
        ${pill}
      </div>
      ${
        analysis?.channelName
          ? `<div class="bd-channel">
              ${analysis.avatarUrl ? `<img class="bd-avatar" src="${escapeHtml(analysis.avatarUrl)}" alt="">` : `<span class="bd-avatar">${escapeHtml(analysis.channelName.slice(0, 1))}</span>`}
              <div class="bd-channel-text">
                <div class="bd-channel-name">${escapeHtml(analysis.channelName)}</div>
                ${analysis.detectedNiche ? `<div class="bd-niche">${escapeHtml(analysis.detectedNiche)}</div>` : ""}
                ${analysis.format ? `<div class="bd-format" title="${escapeHtml(analysis.format)}">${escapeHtml(analysis.format)}</div>` : ""}
              </div>
            </div>`
          : ""
      }
      ${body}
    </div>`;
}

function renderError(error: ToolError) {
  renderToken++;
  root.innerHTML = shell(renderErrorState(error));
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

function candidateCard(candidate: Candidate): string {
  const busy = building === candidate.id;
  return `
    <div class="bd-candidate">
      <div class="bd-candidate-head">
        <span class="bd-num">${candidate.id}</span>
        <div class="bd-candidate-title">${escapeHtml(candidate.nicheName)}</div>
        <span class="v-tag v-tag-ai">${escapeHtml(candidate.angle)}</span>
      </div>
      <ul class="bd-titles">${candidate.exampleTitles.slice(0, 3).map((title) => `<li>${escapeHtml(title)}</li>`).join("")}</ul>
      <button type="button" class="v-btn bd-build" data-build="${candidate.id}" ${building !== null ? "disabled" : ""}>
        ${busy ? "Starting…" : `${SPARK_ICON}Build SOP`}
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

function sopView(content: SopContent): string {
  const quick = content.quickReferenceCard;
  const retention = content.retentionMechanics;
  const opening = content.openingClosingPatterns;
  return `
    <div class="bd-sop-head">
      <div class="bd-sop-title">${escapeHtml(content.title)}</div>
      ${content.onelinePromise ? `<p class="bd-sop-promise">${escapeHtml(content.onelinePromise)}</p>` : ""}
    </div>
    ${section(
      "quick",
      "Quick reference",
      `${quick?.beatStructureOneLine ? `<p class="bd-p"><b>Structure:</b> ${escapeHtml(quick.beatStructureOneLine)}</p>` : ""}
       <div class="bd-dodont">
         <div><div class="bd-mini do">Do</div>${list(quick?.dos)}</div>
         <div><div class="bd-mini dont">Don't</div>${list(quick?.donts)}</div>
       </div>`
    )}
    ${section(
      "hooks",
      `Hook playbook (${content.hookPlaybook?.length ?? 0})`,
      (content.hookPlaybook ?? [])
        .map(
          (hook) => `<div class="bd-hook"><div class="bd-hook-t">${escapeHtml(hook.template)}</div>
            ${hook.psychology ? `<div class="bd-hook-s">${escapeHtml(hook.psychology)}</div>` : ""}
            ${hook.forYourChannelExamples?.length ? `<div class="bd-hook-e">e.g. “${escapeHtml(hook.forYourChannelExamples[0])}”</div>` : ""}</div>`
        )
        .join("")
    )}
    ${section(
      "beats",
      "Script structure",
      `<ol class="bd-beats">${(content.scriptStructureBeats ?? [])
        .map((beat) => `<li><span class="bd-timing">${escapeHtml(beat.timing)}</span><div><b>${escapeHtml(beat.beat)}</b><div class="bd-hook-s">${escapeHtml(beat.function)}</div></div></li>`)
        .join("")}</ol>`
    )}
    ${section(
      "story",
      "Storytelling frameworks",
      (content.storytellingFrameworks ?? [])
        .map((f) => `<div class="bd-hook"><div class="bd-hook-t">${escapeHtml(f.name)}</div><div class="bd-hook-s">${escapeHtml(f.howItWorks)}</div>${f.steps?.length ? `<div class="bd-hook-e">${f.steps.map(escapeHtml).join(" → ")}</div>` : ""}</div>`)
        .join("")
    )}
    ${section(
      "retention",
      "Retention & rehooks",
      `${retention?.rehookCatalog?.length ? `<div class="bd-chips">${retention.rehookCatalog.map((r) => `<span class="v-tag">“${escapeHtml(r.phrase)}”</span>`).join("")}</div>` : ""}
       ${list(retention?.patternInterrupts)}
       ${retention?.openLoopsRule ? `<p class="bd-p"><b>Open loops:</b> ${escapeHtml(retention.openLoopsRule)}</p>` : ""}`
    )}
    ${section(
      "opening",
      "Openings & endings",
      `${opening?.first30SecondsTemplate?.length ? `<p class="bd-p"><b>First 30 seconds:</b> ${opening.first30SecondsTemplate.map(escapeHtml).join(" → ")}</p>` : ""}
       ${list(opening?.hardRules)}
       ${opening?.howVideosEnd ? `<p class="bd-p"><b>Endings:</b> ${escapeHtml(opening.howVideosEnd)}</p>` : ""}`
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
    root.innerHTML = shell(
      `
      <div class="bd-chosen">Bend: <b>${escapeHtml(data.sop.chosenBend.nicheName)}</b> <span class="v-tag v-tag-ai">${escapeHtml(data.sop.chosenBend.angle)}</span></div>
      ${sopView(data.sop.content)}
      <div class="v-btn-row">
        <button type="button" class="v-btn v-btn-primary" id="bd-script">${SPARK_ICON}Write a script with this SOP</button>
        <button type="button" class="v-btn" id="bd-copy">${COPY_ICON}Copy SOP</button>
        ${data.appUrl ? `<button type="button" class="v-btn" data-open-url="${escapeHtml(data.appUrl)}">${EXTERNAL_ICON}Open in Verlab</button>` : ""}
      </div>
      <div class="v-quick-status" id="quick-status" hidden></div>`,
      '<span class="v-pill v-pill-success">SOP ready</span>'
    );
    return;
  }

  if (status === "generating_sop") {
    root.innerHTML = shell(
      progressBlock({ label: "Writing your SOP", sublabel: "Hook playbook, beat structure and retention rules -- about 1-2 minutes", startedAt: startedAtFor(`${data?.jobId}:sop`) })
    );
    if (data?.jobId) poll(data.jobId, token, (next) => next.status === "sop_ready" || next.status === "ready");
    return;
  }

  if (status === "ready" && data?.candidates?.length) {
    const lastError = inlineError ?? (data.error ? { message: data.error.message } : null);
    root.innerHTML = shell(
      `
      <div class="v-section-label">Pick a niche bend to build its script SOP</div>
      <div class="bd-candidates">${data.candidates.map(candidateCard).join("")}</div>
      ${lastError ? `<div class="bd-inline-error">${renderErrorState(lastError)}</div>` : ""}`,
      '<span class="v-pill">3 bends</span>'
    );
    return;
  }

  const index = Math.max(0, WORKING_STAGES.indexOf(status));
  root.innerHTML = shell(`
    ${progressBlock({
      label: data?.statusText ?? "Opening the channel…",
      sublabel: "Reading real transcripts takes 1-3 minutes",
      percent: typeof data?.progress === "number" ? data.progress : null,
      startedAt: startedAtFor(data?.jobId),
    })}
    ${stageList(STAGE_LABELS, index)}`);
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
    fresh.innerHTML = sopView(current.sop.content);
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
    void copyText(sopMarkdown(current.sop.content, current.sop.chosenBend)).then((ok) => flashButton(copy, ok ? `${COPY_ICON}Copied` : "Copy failed"));
  }
});
