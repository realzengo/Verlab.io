import { connectApp, escapeHtml, openLink, pad2, panel, statusBadge } from "../../shared/host";

type Platform = "youtube" | "tiktok" | "both";
type Format = "long-form" | "shorts" | "not-sure";
type ProductionStyle = "ai-visuals" | "animation" | "real-footage" | "no-preference";
type MomentumTrend = "up" | "down" | "flat";

interface NicheReportVideo {
  title: string;
  views: string;
  coverUrl: string | null;
  videoUrl: string | null;
  author: string | null;
  avatarUrl: string | null;
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
const TOOL = "Niche finder";

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
const TREND_LABEL: Record<MomentumTrend, string> = { up: "Rising", down: "Cooling", flat: "Steady" };

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

function optionsHtml(options: { value: string; label: string }[], selected: string | null, group: "platform" | "format" | "style"): string {
  return options
    .map(
      (opt) =>
        `<button type="button" class="nf-option${selected === opt.value ? " active" : ""}" data-group="${group}" data-value="${opt.value}" aria-pressed="${selected === opt.value}">${escapeHtml(opt.label)}</button>`
    )
    .join("");
}

function question(index: number, title: string, help: string, control: string): string {
  return `
    <div class="v-section nf-q">
      <span class="v-index">${pad2(index)}</span>
      <div class="nf-q-body">
        <div class="nf-q-title">${title}</div>
        <div class="nf-q-help">${help}</div>
        ${control}
      </div>
    </div>`;
}

function renderForm() {
  stopLoadingRotation();
  root.innerHTML = panel({
    tool: TOOL,
    aside: `<span class="v-aside">7 questions</span>`,
    flush: true,
    body: `
      <div class="v-section nf-intro">
        <h1 class="v-title-lg">Who are you, really?</h1>
        <p class="nf-sub">The sharper I get you, the sharper the niche. Seven quick ones.</p>
      </div>
      ${question(
        1,
        "What could you talk about for hours?",
        "Obsessions, rabbit holes, the stuff you already know too much about",
        `<textarea class="v-input nf-input" id="nf-interests" rows="3" placeholder="e.g. history, fitness, sci-fi lore, personal finance, cars, psychology">${escapeHtml(lastAnswers.interests)}</textarea>`
      )}
      ${question(
        2,
        "Channels you already love or watch?",
        "Names or @handles, even ones outside the niche you're chasing",
        `<textarea class="v-input nf-input" id="nf-channels" rows="2" placeholder="e.g. Kurzgesagt, @somechannel">${escapeHtml(lastAnswers.channelsTheyLike)}</textarea>
         <div class="nf-error" id="nf-error" role="alert" hidden></div>`
      )}
      ${question(3, "YouTube or TikTok?", "Where you actually want to build", `<div class="nf-options" id="nf-platform">${optionsHtml(PLATFORM_OPTIONS, lastAnswers.platform, "platform")}</div>`)}
      ${question(4, "Long-form or Shorts?", "Where you want to live. No wrong answer", `<div class="nf-options" id="nf-format">${optionsHtml(FORMAT_OPTIONS, lastAnswers.format, "format")}</div>`)}
      ${question(
        5,
        "How do you want the videos made?",
        "This sets your cost floor, so be honest about your appetite",
        `<div class="nf-options" id="nf-style">${optionsHtml(STYLE_OPTIONS, lastAnswers.productionStyle, "style")}</div>`
      )}
      ${question(
        6,
        "Any job, background or skill to pull from?",
        "Unfair advantages hide here: a trade, a degree, a hobby you're good at",
        `<textarea class="v-input nf-input" id="nf-background" rows="2" placeholder="e.g. ex-teacher, gym coach, coder, editor, sales, gamer since forever">${escapeHtml(lastAnswers.background)}</textarea>`
      )}
      ${question(
        7,
        "Monthly budget",
        "Roughly what you'd spend to produce videos each month",
        `<div class="nf-budget"><span class="nf-currency">$</span><input class="v-input nf-input" id="nf-budget" type="number" min="0" step="50" placeholder="1500" value="${escapeHtml(lastAnswers.budget)}"></div>
         <div class="nf-error" id="nf-budget-error" role="alert" hidden></div>`
      )}`,
    footer: `
      <span class="v-footer-note">The first two answers matter most</span>
      <button type="button" class="v-btn v-btn-primary nf-submit" id="nf-submit">Find my niche</button>`,
  });
}

const LOADING_MESSAGES = [
  "Searching what's going viral right now…",
  "Cross-referencing with your answers…",
  "Checking momentum across niches…",
  "Drafting your report…",
];

function renderLoading() {
  stopLoadingRotation();
  root.innerHTML = panel({
    tool: TOOL,
    aside: statusBadge("live", "Researching"),
    body: `
      <div class="nf-loading" role="status" aria-live="polite">
        <span class="nf-spinner"></span>
        <p class="nf-loading-text" id="nf-loading-text">${LOADING_MESSAGES[0]}</p>
      </div>`,
  });
  let i = 0;
  loadingTimer = setInterval(() => {
    i = (i + 1) % LOADING_MESSAGES.length;
    const el = document.getElementById("nf-loading-text");
    if (el) el.textContent = LOADING_MESSAGES[i];
  }, 3000);
}

let allVideos: NicheReportVideo[] = [];

function renderVideoList(videos: NicheReportVideo[]): string {
  if (!videos.length) return "";
  const startIndex = allVideos.length;
  allVideos = allVideos.concat(videos);

  return `
    <div class="v-section-label nf-videos-label">Trending in this niche</div>
    <div class="nf-videos">
      ${videos
        .map((video, i) => {
          const clickable = Boolean(video.videoUrl);
          const cover = video.coverUrl ? `<img class="nf-video-cover" src="${escapeHtml(video.coverUrl)}" alt="">` : `<span class="nf-video-cover"></span>`;
          const avatar = video.avatarUrl ? `<img class="nf-video-avatar" src="${escapeHtml(video.avatarUrl)}" alt="">` : "";
          const author = video.author ? `<span class="nf-video-author">@${escapeHtml(video.author)}</span>` : "";
          return `
          <button type="button" class="nf-video${clickable ? " nf-video-link" : ""}" data-video-index="${startIndex + i}" ${clickable ? "" : 'tabindex="-1"'}>
            ${cover}
            <span class="nf-video-meta">
              <span class="nf-video-title">${escapeHtml(video.title)}</span>
              <span class="nf-video-sub">${avatar}${author}</span>
            </span>
            <span class="nf-video-views">${escapeHtml(video.views)}</span>
          </button>`;
        })
        .join("")}
    </div>`;
}

function renderReport(platform: Platform, niches: NicheReportEntry[], live: boolean) {
  stopLoadingRotation();
  allVideos = [];

  const blocks = niches
    .map(
      (entry, index) => `
      <div class="v-section nf-block">
        <div class="nf-block-head">
          <span class="v-index">${pad2(index + 1)}</span>
          <h2 class="nf-block-title">${escapeHtml(entry.name)}</h2>
        </div>
        <div class="v-tags nf-tags">
          <span class="v-tag">${escapeHtml(PLATFORM_LABEL[entry.platform])}</span>
          <span class="v-tag">${escapeHtml(entry.category)}</span>
          <span class="v-tag nf-trend is-${entry.momentumTrend}">${TREND_LABEL[entry.momentumTrend]}<span class="nf-score">${Math.round(entry.momentumScore)}/100</span></span>
        </div>
        <p class="nf-text">${escapeHtml(entry.description)}</p>
        <div class="nf-callouts">
          <div class="nf-callout">
            <div class="nf-callout-label">Why this fits you</div>
            <p>${escapeHtml(entry.whyForYou)}</p>
          </div>
          <div class="nf-callout">
            <div class="nf-callout-label">Starter angle</div>
            <p>${escapeHtml(entry.angle)}</p>
          </div>
        </div>
        ${renderVideoList(entry.sampleVideos)}
      </div>`
    )
    .join("");

  root.innerHTML = panel({
    tool: TOOL,
    aside: `<span class="v-aside v-aside-mono">${niches.length} niches <span class="v-meta-dot">·</span> ${escapeHtml(PLATFORM_LABEL[platform])}</span>`,
    flush: true,
    body: `
      <div class="v-section nf-intro">
        <h1 class="v-title-lg">Your niche report</h1>
        <p class="nf-sub">${live ? "Live research on what's going viral right now, matched to what you told me." : "Matched to what you told me, from general trend knowledge."}</p>
        ${live ? "" : `<div class="nf-notice">Live web search was temporarily unavailable, so this report is based on general trend knowledge instead of real-time results. Momentum and view counts here are approximate.</div>`}
      </div>
      ${blocks}`,
    footer: `<button type="button" class="v-btn" id="nf-restart">Start over</button>`,
  });
}

function showFormError(message: string) {
  const el = document.getElementById("nf-error") as HTMLElement | null;
  if (!el) return;
  el.hidden = false;
  el.textContent = message;
}

function showBudgetError(message: string | null) {
  const el = document.getElementById("nf-budget-error") as HTMLElement | null;
  if (!el) return;
  el.hidden = !message;
  el.textContent = message ?? "";
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
const MAX_POLLS = 75; // ~5 minutes, the research job's own ceiling

async function pollReport(id: string) {
  for (let i = 0; i < MAX_POLLS; i++) {
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    try {
      const result = await app.callServerTool({ name: "check_niche_report_status", arguments: { id } });
      if (result.isError) continue;
      const data = result.structuredContent as FindNicheData | undefined;
      if (data?.stage === "result" && data.niches) {
        renderReport(data.platform ?? "both", data.niches, data.live ?? true);
        // The model never saw this result (the card fetched it) -- hand it
        // the report so follow-ups like "go with #2" work.
        if (result.content?.length) void app.updateModelContext({ content: result.content }).catch(() => undefined);
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
  failResearch("This is taking longer than expected. Try again in a moment.");
}

renderForm();
const app = connectApp({
  name: "Verlab Niche Finder",
  onResult: (result) => applyResult((result.structuredContent as FindNicheData | undefined) ?? null),
  onLoading: renderLoading,
  // "Open on the side" -- pip is the closest thing MCP Apps offers to a
  // persistent side panel. Silently stays inline if the host doesn't
  // support/grant it (result.mode reflects what the host actually chose).
  onConnected: (connectedApp) => {
    const ctx = connectedApp.getHostContext();
    if (ctx?.availableDisplayModes?.includes("pip")) {
      void connectedApp.requestDisplayMode({ mode: "pip" }).catch(() => {});
    }
  },
});

root.addEventListener("click", async (event) => {
  const target = event.target as HTMLElement;

  const video = target.closest<HTMLButtonElement>(".nf-video-link");
  if (video) {
    const clicked = allVideos[Number(video.dataset.videoIndex)];
    openLink(app, clicked?.videoUrl);
    return;
  }

  const option = target.closest<HTMLButtonElement>(".nf-option");
  if (option) {
    const group = option.dataset.group as "platform" | "format" | "style";
    const value = option.dataset.value as Platform | Format | ProductionStyle;
    if (group === "platform") lastAnswers.platform = value as Platform;
    else if (group === "format") lastAnswers.format = value as Format;
    else lastAnswers.productionStyle = value as ProductionStyle;

    const containerId = group === "platform" ? "nf-platform" : group === "format" ? "nf-format" : "nf-style";
    const container = document.getElementById(containerId);
    container?.querySelectorAll(".nf-option").forEach((el) => {
      el.classList.remove("active");
      el.setAttribute("aria-pressed", "false");
    });
    option.classList.add("active");
    option.setAttribute("aria-pressed", "true");
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
    showFormError("Answer at least the first two questions, that's what actually drives the report.");
    document.getElementById("nf-interests")?.focus();
    return;
  }

  if (lastAnswers.budget && (!Number.isFinite(Number(lastAnswers.budget)) || Number(lastAnswers.budget) < 0)) {
    showBudgetError("Enter a budget of 0 or more.");
    return;
  }
  showBudgetError(null);

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
