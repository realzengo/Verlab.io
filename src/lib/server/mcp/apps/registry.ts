import type { z } from "zod";
import { statCardHtml } from "./generated/stat-card";
import { listCardHtml } from "./generated/list-card";
import { videoGridCardHtml } from "./generated/video-grid-card";
import { scriptCardHtml } from "./generated/script-card";
import { imageGalleryCardHtml } from "./generated/image-gallery-card";
import { transcriptCardHtml } from "./generated/transcript-card";
import { downloadCardHtml } from "./generated/download-card";
import {
  StatCardSchema,
  ListCardSchema,
  VideoGridCardSchema,
  ScriptCardSchema,
  ImageGalleryCardSchema,
  TranscriptCardSchema,
  DownloadCardSchema,
} from "./schemas";

interface WidgetDefinition {
  resourceUri: string;
  html: string;
  outputSchema: Record<string, z.ZodTypeAny>;
}

const WIDGETS = {
  statCard: { resourceUri: "ui://verlab/stat-card.html", html: statCardHtml, outputSchema: StatCardSchema },
  listCard: { resourceUri: "ui://verlab/list-card.html", html: listCardHtml, outputSchema: ListCardSchema },
  videoGridCard: {
    resourceUri: "ui://verlab/video-grid-card.html",
    html: videoGridCardHtml,
    outputSchema: VideoGridCardSchema,
  },
  scriptCard: { resourceUri: "ui://verlab/script-card.html", html: scriptCardHtml, outputSchema: ScriptCardSchema },
  imageGalleryCard: {
    resourceUri: "ui://verlab/image-gallery-card.html",
    html: imageGalleryCardHtml,
    outputSchema: ImageGalleryCardSchema,
  },
  transcriptCard: {
    resourceUri: "ui://verlab/transcript-card.html",
    html: transcriptCardHtml,
    outputSchema: TranscriptCardSchema,
  },
  downloadCard: {
    resourceUri: "ui://verlab/download-card.html",
    html: downloadCardHtml,
    outputSchema: DownloadCardSchema,
  },
} as const satisfies Record<string, WidgetDefinition>;

// Maps each of the 11 MCP tool names to its widget. Several tools
// intentionally share one widget/resource (e.g. an async tool and its
// check_*_status counterpart show the same card in either the "processing"
// or "complete" state).
export const TOOL_WIDGETS: Record<string, WidgetDefinition> = {
  get_credit_balance: WIDGETS.statCard,
  list_scripts: WIDGETS.listCard,
  list_library: WIDGETS.listCard,
  browse_niche_videos: WIDGETS.videoGridCard,
  generate_script: WIDGETS.scriptCard,
  generate_image: WIDGETS.imageGalleryCard,
  check_image_status: WIDGETS.imageGalleryCard,
  extract_transcript: WIDGETS.transcriptCard,
  check_transcript_status: WIDGETS.transcriptCard,
  download_video: WIDGETS.downloadCard,
  check_download_status: WIDGETS.downloadCard,
};

// Resources are registered once per unique URI (not once per tool) --
// `registerAppResource` on a name the SDK already has registered throws.
export const UNIQUE_WIDGETS: WidgetDefinition[] = Object.values(
  Object.fromEntries(Object.values(WIDGETS).map((widget) => [widget.resourceUri, widget]))
);
