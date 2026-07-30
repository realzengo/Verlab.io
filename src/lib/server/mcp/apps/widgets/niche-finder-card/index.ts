import { connectApp, escapeHtml, openLink } from "../../shared/host";

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

// Verlab's brand mark, inlined as SVG path data so the widget carries the
// actual brand mark instead of a generic dot/icon.
const LOGO_MARK = `<svg viewBox="0 0 2363 2363" fill="currentColor" aria-hidden="true"><path d="M192,236 34,532 1019,2234 1343,2238 2331,519 2187,246 1442,239 1332,999 1690,1135 1334,1279 1203,1638 1058,1281 700,1149 1054,1002 915,239Z"/></svg>`;

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

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

function pillsHtml(options: { value: string; label: string }[], selected: string | null, group: "platform" | "format" | "style"): string {
  return options
    .map(
      (opt) => `
      <button type="button" class="vf-pill${selected === opt.value ? " active" : ""}" data-group="${group}" data-value="${opt.value}">
        ${escapeHtml(opt.label)}
      </button>`
    )
    .join("");
}

function eyebrow(): string {
  return `<div class="vf-eyebrow">${LOGO_MARK}Verlab &middot; Find a niche</div>`;
}

function renderForm() {
  stopLoadingRotation();
  root.innerHTML = `
    <div class="vf-card">
      ${eyebrow()}
      <h1 class="vf-title">Who are you, really?</h1>
      <p class="vf-sub">The sharper I get you, the sharper the niche. Seven quick ones.</p>

      <div class="vf-q">
        <div class="vf-q-num">1</div>
        <div class="vf-q-body">
          <div class="vf-q-title">What could you talk about for hours?</div>
          <div class="vf-q-help">Obsessions, rabbit holes, the stuff you already know too much about.</div>
          <textarea class="vf-input" id="nf-interests" rows="3" placeholder="e.g. history, fitness, sci-fi lore, personal finance, cars, psychology...">${escapeHtml(lastAnswers.interests)}</textarea>
        </div>
      </div>

      <div class="vf-q">
        <div class="vf-q-num">2</div>
        <div class="vf-q-body">
          <div class="vf-q-title">Channels you already love or watch?</div>
          <div class="vf-q-help">Names or @handles — even ones outside the niche you're chasing.</div>
          <textarea class="vf-input" id="nf-channels" rows="2" placeholder="e.g. Kurzgesagt, @somechannel...">${escapeHtml(lastAnswers.channelsTheyLike)}</textarea>
        </div>
      </div>

      <div class="vf-q">
        <div class="vf-q-num">3</div>
        <div class="vf-q-body">
          <div class="vf-q-title">YouTube or TikTok?</div>
          <div class="vf-q-help">Where you actually want to build.</div>
          <div class="vf-pills" id="nf-platform">${pillsHtml(PLATFORM_OPTIONS, lastAnswers.platform, "platform")}</div>
        </div>
      </div>

      <div class="vf-q">
        <div class="vf-q-num">4</div>
        <div class="vf-q-body">
          <div class="vf-q-title">Long-form or Shorts?</div>
          <div class="vf-q-help">Where you want to live. No wrong answer.</div>
          <div class="vf-pills" id="nf-format">${pillsHtml(FORMAT_OPTIONS, lastAnswers.format, "format")}</div>
        </div>
      </div>

      <div class="vf-q">
        <div class="vf-q-num">5</div>
        <div class="vf-q-body">
          <div class="vf-q-title">How do you want the videos made?</div>
          <div class="vf-q-help">This sets your cost floor, so be honest about your appetite.</div>
          <div class="vf-pills" id="nf-style">${pillsHtml(STYLE_OPTIONS, lastAnswers.productionStyle, "style")}</div>
        </div>
      </div>

      <div class="vf-q">
        <div class="vf-q-num">6</div>
        <div class="vf-q-body">
          <div class="vf-q-title">Any job, background, or skill to pull from?</div>
          <div class="vf-q-help">Unfair advantages hide here — a trade, a degree, a hobby you're good at.</div>
          <textarea class="vf-input" id="nf-background" rows="2" placeholder="e.g. ex-teacher, gym coach, coder, editor, sales, gamer since forever...">${escapeHtml(lastAnswers.background)}</textarea>
        </div>
      </div>

      <div class="vf-q">
        <div class="vf-q-num">7</div>
        <div class="vf-q-body">
          <div class="vf-q-title">Monthly budget</div>
          <div class="vf-q-help">Roughly what you'd spend to produce videos each month.</div>
          <input class="vf-input" id="nf-budget" type="number" min="0" step="50" placeholder="1500" value="${escapeHtml(lastAnswers.budget)}">
        </div>
      </div>

      <button type="button" class="vf-submit" id="nf-submit">Find my niche</button>
      <div class="vf-error" id="nf-error" hidden></div>
    </div>
  `;
}

const LOADING_MESSAGES = [
  "Searching what's going viral right now…",
  "Cross-referencing with your answers…",
  "Checking momentum across niches…",
  "Drafting your report…",
];

function renderLoading() {
  stopLoadingRotation();
  root.innerHTML = `
    <div class="vf-card vf-loading">
      ${eyebrow()}
      <div class="vf-spinner"></div>
      <p class="vf-loading-text" id="nf-loading-text">${LOADING_MESSAGES[0]}</p>
    </div>
  `;
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
    <div class="vf-videos-label">Popping off in this niche right now</div>
    <div class="vf-videos">
      ${videos
        .map((video, i) => {
          const clickable = Boolean(video.videoUrl);
          const cover = video.coverUrl
            ? `<img class="vf-video-cover" src="${video.coverUrl}" alt="">`
            : `<div class="vf-video-cover-empty"></div>`;
          const avatar = video.avatarUrl
            ? `<img class="vf-video-avatar" src="${video.avatarUrl}" alt="">`
            : "";
          const author = video.author ? `<span class="vf-video-author">@${escapeHtml(video.author)}</span>` : "";
          return `
          <button type="button" class="vf-video${clickable ? " vf-video-link" : ""}" data-video-index="${startIndex + i}" ${clickable ? "" : "tabindex=\"-1\""}>
            ${cover}
            <div class="vf-video-meta">
              <div class="vf-video-title">${escapeHtml(truncate(video.title, 55))}</div>
              <div class="vf-video-sub">${avatar}${author}</div>
            </div>
            <span class="vf-video-views">${escapeHtml(video.views)}</span>
          </button>`;
        })
        .join("")}
    </div>
  `;
}

function renderReport(platform: Platform, niches: NicheReportEntry[], live: boolean) {
  stopLoadingRotation();
  allVideos = [];

  const blocks = niches
    .map(
      (entry, index) => `
      <div class="vf-block">
        <div class="vf-block-head">
          <span class="vf-block-rank">${index + 1}</span>
          <h2 class="vf-block-title">${escapeHtml(entry.name)}</h2>
        </div>
        <div class="vf-tags">
          <span class="vf-tag">${escapeHtml(PLATFORM_LABEL[entry.platform])}</span>
          <span class="vf-tag vf-tag-neutral">${escapeHtml(entry.category)}</span>
          <span class="vf-tag ${entry.momentumTrend === "up" ? "vf-tag-up" : entry.momentumTrend === "down" ? "vf-tag-down" : "vf-tag-neutral"}">${TREND_LABEL[entry.momentumTrend]} · ${Math.round(entry.momentumScore)}/100</span>
        </div>
        <p class="vf-text">${escapeHtml(entry.description)}</p>
        <div class="vf-callout">
          <div class="vf-callout-label">Why this fits you</div>
          <p>${escapeHtml(entry.whyForYou)}</p>
        </div>
        <div class="vf-callout">
          <div class="vf-callout-label">Starter angle</div>
          <p>${escapeHtml(entry.angle)}</p>
        </div>
        ${renderVideoList(entry.sampleVideos)}
      </div>`
    )
    .join(`<hr class="vf-divider">`);

  root.innerHTML = `
    <div class="vf-card">
      ${eyebrow()}
      <h1 class="vf-title">Your niche report</h1>
      <p class="vf-sub">${live ? "Live research on what's going viral right now, matched to what you told me." : "Matched to what you told me, from general trend knowledge."}</p>
      <div class="vf-meta">
        <span class="vf-meta-pill">${niches.length} niches</span>
        <span class="vf-meta-pill">${escapeHtml(PLATFORM_LABEL[platform])}</span>
      </div>
      ${live ? "" : `<div class="vf-notice">Live web search was temporarily unavailable, so this report is based on general trend knowledge instead of real-time results — momentum and view counts here are approximate.</div>`}
      <hr class="vf-divider">
      ${blocks}
      <button type="button" class="vf-restart" id="nf-restart">Start over</button>
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

  const video = target.closest<HTMLButtonElement>(".vf-video-link");
  if (video) {
    const clicked = allVideos[Number(video.dataset.videoIndex)];
    openLink(app, clicked?.videoUrl);
    return;
  }

  const pill = target.closest<HTMLButtonElement>(".vf-pill");
  if (pill) {
    const group = pill.dataset.group as "platform" | "format" | "style";
    const value = pill.dataset.value as Platform | Format | ProductionStyle;
    if (group === "platform") lastAnswers.platform = value as Platform;
    else if (group === "format") lastAnswers.format = value as Format;
    else lastAnswers.productionStyle = value as ProductionStyle;

    const containerId = group === "platform" ? "nf-platform" : group === "format" ? "nf-format" : "nf-style";
    const container = document.getElementById(containerId);
    container?.querySelectorAll(".vf-pill").forEach((el) => el.classList.remove("active"));
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
