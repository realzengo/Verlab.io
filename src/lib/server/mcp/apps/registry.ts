import type { z } from "zod";
import { statCardHtml } from "./generated/stat-card";
import { listCardHtml } from "./generated/list-card";
import { videoGridCardHtml } from "./generated/video-grid-card";
import { scriptCardHtml } from "./generated/script-card";
import { imageGalleryCardHtml } from "./generated/image-gallery-card";
import { transcriptCardHtml } from "./generated/transcript-card";
import { downloadCardHtml } from "./generated/download-card";
import { creatorProfileCardHtml } from "./generated/creator-profile-card";
import { nicheFinderCardHtml } from "./generated/niche-finder-card";
import {
  StatCardSchema,
  ListCardSchema,
  VideoGridCardSchema,
  ScriptCardSchema,
  ImageGalleryCardSchema,
  TranscriptCardSchema,
  DownloadCardSchema,
  CreatorProfileCardSchema,
  FindNicheCardSchema,
} from "./schemas";

interface WidgetDefinition {
  resourceUri: string;
  html: string;
  outputSchema: Record<string, z.ZodTypeAny>;
  // Sandbox permissions this widget needs from the host (maps to Permission
  // Policy grants) -- e.g. clipboardWrite for widgets with a "Copy" button.
  // Omitted entirely means none requested (the host's secure default).
  permissions?: { clipboardWrite?: Record<string, never> };
}

// Versioned suffixes -- MCP hosts commonly treat resource URIs as
// cacheable/immutable, so a content change alone (same URI) can keep
// showing a stale cached fetch. Bump a widget's suffix whenever its HTML
// changes meaningfully to force hosts to refetch.
const WIDGETS = {
  statCard: { resourceUri: "ui://verlab/stat-card-v4.html", html: statCardHtml, outputSchema: StatCardSchema },
  listCard: { resourceUri: "ui://verlab/list-card-v4.html", html: listCardHtml, outputSchema: ListCardSchema },
  videoGridCard: {
    resourceUri: "ui://verlab/video-grid-card-v4.html",
    html: videoGridCardHtml,
    outputSchema: VideoGridCardSchema,
  },
  scriptCard: {
    resourceUri: "ui://verlab/script-card-v5.html",
    html: scriptCardHtml,
    outputSchema: ScriptCardSchema,
    permissions: { clipboardWrite: {} },
  },
  imageGalleryCard: {
    resourceUri: "ui://verlab/image-gallery-card-v6.html",
    html: imageGalleryCardHtml,
    outputSchema: ImageGalleryCardSchema,
  },
  transcriptCard: {
    resourceUri: "ui://verlab/transcript-card-v5.html",
    html: transcriptCardHtml,
    outputSchema: TranscriptCardSchema,
    // Export panel falls back to a clipboard copy when the host can't do a
    // mediated file download (see exportTranscript's catch in the widget).
    permissions: { clipboardWrite: {} },
  },
  downloadCard: {
    resourceUri: "ui://verlab/download-card-v4.html",
    html: downloadCardHtml,
    outputSchema: DownloadCardSchema,
  },
  creatorProfileCard: {
    resourceUri: "ui://verlab/creator-profile-card-v6.html",
    html: creatorProfileCardHtml,
    outputSchema: CreatorProfileCardSchema,
  },
  nicheFinderCard: {
    resourceUri: "ui://verlab/niche-finder-card-v5.html",
    html: nicheFinderCardHtml,
    outputSchema: FindNicheCardSchema,
  },
} as const satisfies Record<string, WidgetDefinition>;

// Maps each of the 16 MCP tool names to its widget. Several tools
// intentionally share one widget/resource (e.g. an async tool and its
// check_*_status counterpart show the same card in either the "processing"
// or "complete" state).
export const TOOL_WIDGETS: Record<string, WidgetDefinition> = {
  get_credit_balance: WIDGETS.statCard,
  list_scripts: WIDGETS.listCard,
  list_library: WIDGETS.listCard,
  browse_niche_videos: WIDGETS.videoGridCard,
  find_niche: WIDGETS.nicheFinderCard,
  check_niche_report_status: WIDGETS.nicheFinderCard,
  generate_script: WIDGETS.scriptCard,
  generate_image: WIDGETS.imageGalleryCard,
  check_image_status: WIDGETS.imageGalleryCard,
  extract_transcript: WIDGETS.transcriptCard,
  check_transcript_status: WIDGETS.transcriptCard,
  download_video: WIDGETS.downloadCard,
  check_download_status: WIDGETS.downloadCard,
  analyze_creator: WIDGETS.creatorProfileCard,
  check_creator_analysis_status: WIDGETS.creatorProfileCard,
};

// Resources are registered once per unique URI (not once per tool) --
// `registerAppResource` on a name the SDK already has registered throws.
export const UNIQUE_WIDGETS: WidgetDefinition[] = Object.values(
  Object.fromEntries(Object.values(WIDGETS).map((widget) => [widget.resourceUri, widget]))
);
