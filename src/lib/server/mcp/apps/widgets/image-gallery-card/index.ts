import { connectApp, escapeHtml, LOGO_MARK } from "../../shared/host";

interface ImageData {
  status?: string;
  images?: string[];
  note?: string;
  error_message?: string | null;
}

const root = document.getElementById("root")!;

function render(data: ImageData | null) {
  const images = data?.images ?? [];

  let body: string;
  if (data?.error_message) {
    body = `<div class="v-error">${escapeHtml(data.error_message)}</div>`;
  } else if (images.length) {
    body = `<div class="v-gallery">${images.map((src) => `<img src="${src}" alt="">`).join("")}</div>`;
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
connectApp({
  name: "Verlab Image",
  onResult: (result) => render((result.structuredContent as ImageData | undefined) ?? null),
});
