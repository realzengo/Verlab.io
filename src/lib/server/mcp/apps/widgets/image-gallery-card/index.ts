import { connectApp, escapeHtml, openLink, LOGO_MARK } from "../../shared/host";

interface ImageData {
  status?: string;
  images?: string[];
  note?: string;
  error_message?: string | null;
}

const EYE_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z"/><circle cx="12" cy="12" r="3"/></svg>`;
const DOWNLOAD_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14" aria-hidden="true"><path d="M12 3v12m0 0 4-4m-4 4-4-4"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/></svg>`;

const root = document.getElementById("root")!;
let images: string[] = [];

function render(data: ImageData | null) {
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
            <button class="v-btn v-btn-ghost" data-action="view" data-index="${index}" type="button">${EYE_ICON}View</button>
            <a class="v-btn" href="${escapeHtml(src)}" download="verlab-image-${index + 1}.png">${DOWNLOAD_ICON}Download</a>
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
}

render(null);
const app = connectApp({
  name: "Verlab Image",
  onResult: (result) => render((result.structuredContent as ImageData | undefined) ?? null),
});

root.addEventListener("click", (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-action="view"]');
  if (!button) return;
  openLink(app, images[Number(button.dataset.index)]);
});
