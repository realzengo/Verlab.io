import type { SystemJob, SystemJobStatus } from "@/lib/types";

// Plain module (no "use client") so both the server-rendered System page and
// the client job table can read these.

export const JOB_TYPE_LABEL: Record<SystemJob["type"], string> = {
  "niche-bend": "Niche Bend",
  "sop-generation": "SOP generation",
  transcript: "Transcript",
  download: "Download",
  "video-generation": "Video generation",
  "image-generation": "Image generation",
  "voiceover-generation": "Voiceover generation",
};

export const JOB_STATUS_LABEL: Record<SystemJobStatus, string> = {
  success: "Succeeded",
  failed: "Failed",
  running: "Running",
  queued: "Queued",
};
