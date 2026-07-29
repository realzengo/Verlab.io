import { connectApp, escapeHtml } from "../../shared/host";

type Platform = "youtube" | "tiktok" | "both";
type Format = "long-form" | "shorts" | "not-sure";
type ProductionStyle = "ai-visuals" | "animation" | "real-footage" | "no-preference";
type MomentumTrend = "up" | "down" | "flat";

interface NicheReportVideo {
  title: string;
  views: string;
}
interface NicheReportEntry {
  name: string;
  platform: Platform;
  category: string;
  description: string;
  whyForYou: string;
  angle: string;
  momentumScore: number;
  momentumTrend: MomentumTrend;
  sampleVideos: NicheReportVideo[];
}
interface FindNicheData {
  stage?: "form" | "processing" | "result" | "error";
  id?: string;
  platform?: Platform;
  niches?: NicheReportEntry[];
  live?: boolean;
  note?: string;
  error_message?: string;
}

const root = document.getElementById("root")!;

const PLATFORM_OPTIONS: { value: Platform; label: string }[] = [
  { value: "youtube", label: "YouTube" },
  { value: "tiktok", label: "TikTok" },
  { value: "both", label: "Both" },
];
const FORMAT_OPTIONS: { value: Format; label: string }[] = [
  { value: "long-form", label: "Long-form" },
  { value: "shorts", label: "Shorts" },
  { value: "not-sure", label: "Both / not sure" },
];
const STYLE_OPTIONS: { value: ProductionStyle; label: string }[] = [
  { value: "ai-visuals", label: "AI visuals" },
  { value: "animation", label: "Animation" },
  { value: "real-footage", label: "Real footage" },
  { value: "no-preference", label: "No preference" },
];

const PLATFORM_LABEL: Record<Platform, string> = { youtube: "YouTube", tiktok: "TikTok", both: "YouTube & TikTok" };
const PLATFORM_ICON: Record<Platform, string> = { youtube: "▶️", tiktok: "🎵", both: "🌐" };
const TREND_ICON: Record<MomentumTrend, string> = { up: "📈", down: "📉", flat: "➖" };
const NICHE_EMOJI = ["🎯", "📚", "🎬", "⚡", "🧠", "🔥", "🌱", "🎮"];
const LOADING_MESSAGES = [
  "Searching what's going viral right now…",
  "Cross-referencing with your answers…",
  "Checking momentum across niches…",
  "Drafting your report…",
];

// The full form state, held outside the DOM (rather than as radio inputs)
// since the whole card is re-rendered from a template string on every state
// change -- also doubles as the "restore my answers" stash if research fails.
interface FormAnswers {
  interests: string;
  channelsTheyLike: string;
  platform: Platform | null;
  format: Format | null;
  productionStyle: ProductionStyle | null;
  background: string;
  budget: string;
}

function emptyAnswers(): FormAnswers {
  return { interests: "", channelsTheyLike: "", platform: null, format: null, productionStyle: null, background: "", budget: "" };
}

let lastAnswers: FormAnswers = emptyAnswers();
let loadingTimer: ReturnType<typeof setInterval> | undefined;

function stopLoadingRotation() {
  if (loadingTimer) clearInterval(loadingTimer);
  loadingTimer = undefined;
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

function pillsHtml(options: { value: string; label: string }[], selected: string | null, group: "platform" | "format" | "style"): string {
  return options
    .map(
      (opt) => `
      <button type="button" class="nf-pill${selected === opt.value ? " active" : ""}" data-group="${group}" data-value="${opt.value}">
        ${escapeHtml(opt.label)}
      </button>`
    )
    .join("");
}

function renderForm() {
  stopLoadingRotation();
  root.innerHTML = `
    <div class="nf-card">
      <div class="nf-eyebrow"><span class="nf-dot"></span>Verlab &middot; Find a niche</div>
      <h1 class="nf-title">Who are you, really?</h1>
      <p class="nf-sub">The sharper I get you, the sharper the niche. Seven quick ones. Answer straight — instinct beats polish here.</p>

      <div class="nf-q">
        <div class="nf-q-num">01</div>
        <div class="nf-q-body">
          <div class="nf-q-title">What could you talk about for hours?</div>
          <div class="nf-q-help">Obsessions, rabbit holes, the stuff you already know too much about. Don't filter.</div>
          <textarea class="nf-input" id="nf-interests" rows="3" placeholder="e.g. history, fitness, sci-fi lore, personal finance, cars, psychology...">${escapeHtml(lastAnswers.interests)}</textarea>
        </div>
      </div>

      <div class="nf-q">
        <div class="nf-q-num">02</div>
        <div class="nf-q-body">
          <div class="nf-q-title">Channels you already love or watch?</div>
          <div class="nf-q-help">Names or @handles — even ones outside the niche you're chasing.</div>
          <textarea class="nf-input" id="nf-channels" rows="2" placeholder="e.g. Kurzgesagt, @somechannel...">${escapeHtml(lastAnswers.channelsTheyLike)}</textarea>
        </div>
      </div>

      <div class="nf-q">
        <div class="nf-q-num">03</div>
        <div class="nf-q-body">
          <div class="nf-q-title">YouTube or TikTok?</div>
          <div class="nf-q-help">Where you actually want to build. Pick both if you're not sure yet.</div>
          <div class="nf-pills" id="nf-platform">${pillsHtml(PLATFORM_OPTIONS, lastAnswers.platform, "platform")}</div>
        </div>
      </div>

      <div class="nf-q">
        <div class="nf-q-num">04</div>
        <div class="nf-q-body">
          <div class="nf-q-title">Long-form or Shorts?</div>
          <div class="nf-q-help">Where you want to live. No wrong answer.</div>
          <div class="nf-pills" id="nf-format">${pillsHtml(FORMAT_OPTIONS, lastAnswers.format, "format")}</div>
        </div>
      </div>

      <div class="nf-q">
        <div class="nf-q-num">05</div>
        <div class="nf-q-body">
          <div class="nf-q-title">How do you want the videos made?</div>
          <div class="nf-q-help">This sets your cost floor, so be honest about your appetite.</div>
          <div class="nf-pills" id="nf-style">${pillsHtml(STYLE_OPTIONS, lastAnswers.productionStyle, "style")}</div>
        </div>
      </div>

      <div class="nf-q">
        <div class="nf-q-num">06</div>
        <div class="nf-q-body">
          <div class="nf-q-title">Any job, background, or skill to pull from?</div>
          <div class="nf-q-help">Unfair advantages hide here — a trade, a degree, a hobby you're good at.</div>
          <textarea class="nf-input" id="nf-background" rows="2" placeholder="e.g. ex-teacher, gym coach, coder, editor, sales, gamer since forever...">${escapeHtml(lastAnswers.background)}</textarea>
        </div>
      </div>

      <div class="nf-q">
        <div class="nf-q-num">07</div>
        <div class="nf-q-body">
          <div class="nf-q-title">Monthly budget</div>
          <div class="nf-q-help">Roughly what you'd spend to produce videos each month.</div>
          <input class="nf-input" id="nf-budget" type="number" min="0" step="50" placeholder="1500" value="${escapeHtml(lastAnswers.budget)}">
        </div>
      </div>

      <button type="button" class="nf-submit" id="nf-submit">Find my niche</button>
      <div class="nf-error" id="nf-error" hidden></div>
    </div>
  `;
}

function renderLoading() {
  stopLoadingRotation();
  root.innerHTML = `
    <div class="nf-card nf-loading">
      <div class="nf-eyebrow"><span class="nf-dot"></span>Verlab &middot; Find a niche</div>
      <div class="nf-spinner"></div>
      <p class="nf-loading-text" id="nf-loading-text">${LOADING_MESSAGES[0]}</p>
    </div>
  `;
  let i = 0;
  loadingTimer = setInterval(() => {
    i = (i + 1) % LOADING_MESSAGES.length;
    const el = document.getElementById("nf-loading-text");
    if (el) el.textContent = LOADING_MESSAGES[i];
  }, 3000);
}

function renderVideoList(videos: NicheReportVideo[]): string {
  if (!videos.length) return "";
  return `
    <div class="nr-videos-label">🔥 Trending right now</div>
    <ul class="nr-video-list">
      ${videos
        .map(
          (video) => `
        <li>
          <span class="nr-video-title">${escapeHtml(truncate(video.title, 60))}</span>
          <span class="nr-video-views">${escapeHtml(video.views)}</span>
        </li>`
        )
        .join("")}
    </ul>
  `;
}

function renderReport(platform: Platform, niches: NicheReportEntry[], live: boolean) {
  stopLoadingRotation();
  const blocks = niches
    .map(
      (entry, index) => `
      <div class="nr-block">
        <div class="nr-block-head">
          <span class="nr-block-emoji">${NICHE_EMOJI[index % NICHE_EMOJI.length]}</span>
          <h2 class="nr-block-title">${escapeHtml(entry.name)}</h2>
        </div>
        <div class="nr-tags">
          <span class="nr-tag nr-tag-platform">${PLATFORM_ICON[entry.platform]} ${escapeHtml(PLATFORM_LABEL[entry.platform])}</span>
          <span class="nr-tag nr-tag-category">${escapeHtml(entry.category)}</span>
          <span class="nr-tag nr-tag-momentum nr-momentum-${entry.momentumTrend}">${TREND_ICON[entry.momentumTrend]} ${Math.round(entry.momentumScore)}/100</span>
        </div>
        <p class="nr-text">${escapeHtml(entry.description)}</p>
        <div class="nr-callout nr-callout-blue">
          <div class="nr-callout-label">💡 Why this fits you</div>
          <p>${escapeHtml(entry.whyForYou)}</p>
        </div>
        <div class="nr-callout nr-callout-amber">
          <div class="nr-callout-label">🎬 Starter angle</div>
          <p>${escapeHtml(entry.angle)}</p>
        </div>
        ${renderVideoList(entry.sampleVideos)}
      </div>`
    )
    .join(`<hr class="nr-divider">`);

  root.innerHTML = `
    <div class="nr-doc">
      <div class="nr-doc-icon">🚀</div>
      <h1 class="nr-doc-title">Your Niche Report</h1>
      <p class="nr-doc-sub">${live ? "Live research on what's going viral right now, matched to what you told me." : "Matched to what you told me, from general trend knowledge."}</p>
      <div class="nr-doc-meta">
        <span class="nr-meta-pill">${niches.length} niches</span>
        <span class="nr-meta-pill">${PLATFORM_ICON[platform]} ${escapeHtml(PLATFORM_LABEL[platform])}</span>
      </div>
      ${
        live
          ? ""
          : `<div class="nr-callout nr-callout-amber nr-live-notice">⚠️ Live web search was temporarily unavailable, so this report is based on general trend knowledge instead of real-time results — momentum and view counts here are approximate.</div>`
      }
      <hr class="nr-divider">
      ${blocks}
      <button type="button" class="nr-restart" id="nf-restart">↺ Start over</button>
    </div>
  `;
}

function showFormError(message: string) {
  const el = document.getElementById("nf-error") as HTMLElement | null;
  if (!el) return;
  el.hidden = false;
  el.textContent = message;
}

function setSubmitting(submitting: boolean) {
  const btn = document.getElementById("nf-submit") as HTMLButtonElement | null;
  if (!btn) return;
  btn.disabled = submitting;
  btn.textContent = submitting ? "Matching…" : "Find my niche";
}

function failResearch(message: string) {
  renderForm();
  showFormError(message);
}

function applyResult(data: FindNicheData | null) {
  if (data?.stage === "result" && data.niches) {
    renderReport(data.platform ?? "both", data.niches, data.live ?? true);
    return;
  }
  if (data?.stage === "processing" && data.id) {
    renderLoading();
    void pollReport(data.id);
    return;
  }
  if (data?.stage === "error") {
    failResearch(data.error_message ?? "Could not build the report.");
    return;
  }
  renderForm();
}

const POLL_INTERVAL_MS = 4000;
const MAX_POLLS = 45; // ~3 minutes

async function pollReport(id: string) {
  for (let i = 0; i < MAX_POLLS; i++) {
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    try {
      const result = await app.callServerTool({ name: "check_niche_report_status", arguments: { id } });
      if (result.isError) continue;
      const data = result.structuredContent as FindNicheData | undefined;
      if (data?.stage === "result" && data.niches) {
        renderReport(data.platform ?? "both", data.niches, data.live ?? true);
        return;
      }
      if (data?.stage === "error") {
        failResearch(data.error_message ?? "Could not build the report.");
        return;
      }
      // stage is still "processing" -- keep polling.
    } catch {
      // transient -- keep polling.
    }
  }
  failResearch("This is taking longer than expected — try again in a moment.");
}

renderForm();
const app = connectApp({
  name: "Verlab Niche Finder",
  onResult: (result) => applyResult((result.structuredContent as FindNicheData | undefined) ?? null),
  onLoading: renderLoading,
});

root.addEventListener("click", async (event) => {
  const target = event.target as HTMLElement;

  const pill = target.closest<HTMLButtonElement>(".nf-pill");
  if (pill) {
    const group = pill.dataset.group as "platform" | "format" | "style";
    const value = pill.dataset.value as Platform | Format | ProductionStyle;
    if (group === "platform") lastAnswers.platform = value as Platform;
    else if (group === "format") lastAnswers.format = value as Format;
    else lastAnswers.productionStyle = value as ProductionStyle;

    const containerId = group === "platform" ? "nf-platform" : group === "format" ? "nf-format" : "nf-style";
    const container = document.getElementById(containerId);
    container?.querySelectorAll(".nf-pill").forEach((el) => el.classList.remove("active"));
    pill.classList.add("active");
    return;
  }

  if (target.closest("#nf-restart")) {
    lastAnswers = emptyAnswers();
    renderForm();
    return;
  }

  const submit = target.closest<HTMLButtonElement>("#nf-submit");
  if (!submit || submit.disabled) return;

  lastAnswers.interests = (document.getElementById("nf-interests") as HTMLTextAreaElement | null)?.value.trim() ?? "";
  lastAnswers.channelsTheyLike = (document.getElementById("nf-channels") as HTMLTextAreaElement | null)?.value.trim() ?? "";
  lastAnswers.background = (document.getElementById("nf-background") as HTMLTextAreaElement | null)?.value.trim() ?? "";
  lastAnswers.budget = (document.getElementById("nf-budget") as HTMLInputElement | null)?.value ?? "";

  if (!lastAnswers.interests && !lastAnswers.channelsTheyLike) {
    showFormError("Answer at least the first two questions — that's what actually drives the report.");
    return;
  }

  const errorEl = document.getElementById("nf-error") as HTMLElement | null;
  if (errorEl) errorEl.hidden = true;
  setSubmitting(true);

  try {
    const budgetNum = lastAnswers.budget ? Number(lastAnswers.budget) : undefined;
    const result = await app.callServerTool({
      name: "find_niche",
      arguments: {
        interests: lastAnswers.interests,
        channelsTheyLike: lastAnswers.channelsTheyLike,
        platform: lastAnswers.platform ?? "both",
        format: lastAnswers.format ?? "not-sure",
        productionStyle: lastAnswers.productionStyle ?? "no-preference",
        background: lastAnswers.background,
        ...(budgetNum !== undefined ? { budget: budgetNum } : {}),
      },
    });

    if (result.isError) {
      const message = result.content?.find((block) => block.type === "text")?.text ?? "Could not build the report.";
      setSubmitting(false);
      showFormError(message);
      return;
    }

    applyResult((result.structuredContent as FindNicheData | undefined) ?? null);
  } catch (error) {
    setSubmitting(false);
    showFormError(error instanceof Error ? error.message : "Could not build the report.");
  }
});
