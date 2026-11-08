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
import { voiceoverCardHtml } from "./generated/voiceover-card";
import { voicesCardHtml } from "./generated/voices-card";
import { videoCardHtml } from "./generated/video-card";
import { clipsCardHtml } from "./generated/clips-card";
import { bendCardHtml } from "./generated/bend-card";
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
  VoiceoverCardSchema,
  VoicesCardSchema,
  VideoCardSchema,
  ClipsCardSchema,
  BendCardSchema,
} from "./schemas";

interface WidgetDefinition {
  resourceUri: string;
  html: string;
  outputSchema: Record<string, z.ZodTypeAny>;
  // Sandbox permissions this widget needs from the host (Permission Policy
  // grants) -- clipboardWrite for widgets with a Copy button, or whose
  // quick actions fall back to copying when the host can't send a message.
  permissions?: { clipboardWrite?: Record<string, never> };
}

const CLIPBOARD = { clipboardWrite: {} } as const;

// Versioned suffixes -- hosts commonly treat resource URIs as immutable, so a
// content change under the same URI can keep showing a stale cached copy.
// Bump a widget's suffix whenever its HTML changes meaningfully.
const WIDGETS = {
  statCard: { resourceUri: "ui://verlab/stat-card-v7.html", html: statCardHtml, outputSchema: StatCardSchema },
  listCard: { resourceUri: "ui://verlab/list-card-v7.html", html: listCardHtml, outputSchema: ListCardSchema, permissions: CLIPBOARD },
  videoGridCard: { resourceUri: "ui://verlab/video-grid-card-v7.html", html: videoGridCardHtml, outputSchema: VideoGridCardSchema, permissions: CLIPBOARD },
  scriptCard: { resourceUri: "ui://verlab/script-card-v8.html", html: scriptCardHtml, outputSchema: ScriptCardSchema, permissions: CLIPBOARD },
  imageGalleryCard: { resourceUri: "ui://verlab/image-gallery-card-v9.html", html: imageGalleryCardHtml, outputSchema: ImageGalleryCardSchema, permissions: CLIPBOARD },
  transcriptCard: { resourceUri: "ui://verlab/transcript-card-v8.html", html: transcriptCardHtml, outputSchema: TranscriptCardSchema, permissions: CLIPBOARD },
  downloadCard: { resourceUri: "ui://verlab/download-card-v7.html", html: downloadCardHtml, outputSchema: DownloadCardSchema, permissions: CLIPBOARD },
  creatorProfileCard: { resourceUri: "ui://verlab/creator-profile-card-v9.html", html: creatorProfileCardHtml, outputSchema: CreatorProfileCardSchema, permissions: CLIPBOARD },
  nicheFinderCard: { resourceUri: "ui://verlab/niche-finder-card-v8.html", html: nicheFinderCardHtml, outputSchema: FindNicheCardSchema },
  voiceoverCard: { resourceUri: "ui://verlab/voiceover-card-v3.html", html: voiceoverCardHtml, outputSchema: VoiceoverCardSchema, permissions: CLIPBOARD },
  voicesCard: { resourceUri: "ui://verlab/voices-card-v1.html", html: voicesCardHtml, outputSchema: VoicesCardSchema, permissions: CLIPBOARD },
  videoCard: { resourceUri: "ui://verlab/video-card-v1.html", html: videoCardHtml, outputSchema: VideoCardSchema, permissions: CLIPBOARD },
  clipsCard: { resourceUri: "ui://verlab/clips-card-v1.html", html: clipsCardHtml, outputSchema: ClipsCardSchema, permissions: CLIPBOARD },
  bendCard: { resourceUri: "ui://verlab/bend-card-v1.html", html: bendCardHtml, outputSchema: BendCardSchema, permissions: CLIPBOARD },
} as const satisfies Record<string, WidgetDefinition>;

// Maps every MCP tool to its widget. An async tool and its check_*_status
// counterpart share one card, shown in either its working or finished state.
export const TOOL_WIDGETS: Record<string, WidgetDefinition> = {
  get_credit_balance: WIDGETS.statCard,
  list_library: WIDGETS.listCard,
  list_scripts: WIDGETS.listCard,
  get_script: WIDGETS.scriptCard,
  browse_niche_videos: WIDGETS.videoGridCard,
  find_niche: WIDGETS.nicheFinderCard,
  check_niche_report_status: WIDGETS.nicheFinderCard,
  analyze_creator: WIDGETS.creatorProfileCard,
  check_creator_analysis_status: WIDGETS.creatorProfileCard,
  bend_niche: WIDGETS.bendCard,
  check_bend_status: WIDGETS.bendCard,
  create_sop: WIDGETS.bendCard,
  generate_script: WIDGETS.scriptCard,
  generate_image: WIDGETS.imageGalleryCard,
  check_image_status: WIDGETS.imageGalleryCard,
  list_voices: WIDGETS.voicesCard,
  generate_voiceover: WIDGETS.voiceoverCard,
  check_voiceover_status: WIDGETS.voiceoverCard,
  generate_video: WIDGETS.videoCard,
  check_video_status: WIDGETS.videoCard,
  create_clips: WIDGETS.clipsCard,
  check_clips_status: WIDGETS.clipsCard,
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
