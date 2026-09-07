import { connectApp, escapeHtml, openLink, LOGO_MARK } from "../../shared/host";

interface ImageData {
  id?: string;
  status?: string;
  images?: string[];
  note?: string;
  error_message?: string | null;
}

const EYE_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z"/><circle cx="12" cy="12" r="3"/></svg>`;
const DOWNLOAD_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14" aria-hidden="true"><path d="M12 3v12m0 0 4-4m-4 4-4-4"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/></svg>`;

const root = document.getElementById("root")!;
let images: string[] = [];
// Bumped on every render() so a poll loop started by a now-superseded
// "generating" state can tell it's stale and stop instead of clobbering
// whatever the widget has since moved on to.
let renderToken = 0;

function render(data: ImageData | null) {
  const token = ++renderToken;
  images = data?.images ?? [];

  let body: string;
  if (data?.error_message) {
    body = `<div class="v-error">${escapeHtml(data.error_message)}</div>`;
  } else if (images.length) {
    body = `<div class="v-image-list">${images
      .map(
        (src, index) => `
        <figure class="v-image-frame">
          <img src="${escapeHtml(src)}" alt="">
          <figcaption class="v-image-actions">
            <button class="v-btn" data-action="view" data-index="${index}" type="button">${EYE_ICON}View</button>
            <button class="v-btn v-btn-primary" data-action="download" data-index="${index}" type="button">${DOWNLOAD_ICON}Download</button>
          </figcaption>
        </figure>`
      )
      .join("")}</div>`;
  } else {
    body = `<div class="v-empty">${escapeHtml(data?.note ?? "Generating image…")}</div>`;
  }

  root.innerHTML = `
    <div class="v-card">
      <div class="v-header">
        ${LOGO_MARK}
        <span class="v-title">Verlab Image</span>
        <span class="v-spacer"></span>
        ${data?.status ? `<span class="v-pill">${escapeHtml(data.status)}</span>` : ""}
      </div>
      ${body}
    </div>
  `;

  // A tool call can time out server-side before the image finishes and hand
  // back { status: "generating", id } instead of the final images -- and the
  // host has no obligation to route a later check_image_status result back
  // into this same iframe. Rather than depend on that, poll the status tool
  // directly from inside the widget until it settles.
  if (!data?.error_message && !images.length && data?.status === "generating" && data.id) {
    void pollStatus(data.id, token);
  }
}

const POLL_INTERVAL_MS = 3000;
const MAX_POLLS = 130; // ~6.5 min, mirrors the server-side stuck-row sweep window

async function pollStatus(id: string, token: number) {
  for (let i = 0; i < MAX_POLLS; i++) {
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    if (token !== renderToken) return;

    try {
      const result = await app.callServerTool({ name: "check_image_status", arguments: { id } });
      if (result.isError) continue;
      const data = result.structuredContent as ImageData | undefined;
      if (!data || data.status === "generating") continue;
      if (token !== renderToken) return;
      render(data);
      return;
    } catch {
      // transient -- keep polling
    }
  }
  if (token === renderToken) render({ error_message: "This is taking longer than expected. Please try again." });
}

render(null);
const app = connectApp({
  name: "Verlab Image",
  onResult: (result) => render((result.structuredContent as ImageData | undefined) ?? null),
});

function filenameFor(url: string, index: number): string {
  const fromUrl = url.split("/").pop()?.split(/[?#]/)[0];
  return fromUrl && /\.[a-z0-9]{2,5}$/i.test(fromUrl) ? fromUrl : `verlab-image-${index + 1}.png`;
}

async function downloadImage(url: string, index: number) {
  try {
    // resource_link -- the host fetches the bytes itself, so this works
    // for a same-origin/CORS-restricted image URL the widget can't fetch
    // from inside its own sandboxed iframe.
    const result = await app.downloadFile(
      { contents: [{ type: "resource_link", uri: url, name: filenameFor(url, index), mimeType: "image/*" }] },
      { timeout: 8000 }
    );
    if (result.isError) throw new Error("denied");
  } catch {
    // Host doesn't support (or denied) a mediated download -- opening the
    // image is the next best thing so the button never dead-ends silently.
    openLink(app, url);
  }
}

root.addEventListener("click", (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-action]");
  if (!button) return;
  const src = images[Number(button.dataset.index)];
  if (!src) return;
  if (button.dataset.action === "download") void downloadImage(src, Number(button.dataset.index));
  else openLink(app, src);
});
