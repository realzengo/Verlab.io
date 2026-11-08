import { z } from "zod";

// One output schema per widget template (not per tool), shared by every tool
// that renders it. The SDK validates every successful result against these
// and turns a mismatch into a hard error, so they stay deliberately lenient:
// top-level fields typed for documentation, everything optional or nullable
// where a start/status result differs, and nested rows as open records (the
// widgets read them defensively). A strict nested schema once made
// list_library fail for every account with images.

const row = z.record(z.string(), z.unknown());
const rows = z.array(row);
const text = z.string().nullable().optional();
const num = z.number().nullable().optional();

export const StatCardSchema = {
  credits: z.number(),
  plan: text,
  topUpUrl: text,
};

export const ListCardSchema = {
  kind: z.string().optional(),
  type: z.string().optional(),
  scripts: rows.optional(),
  images: rows.optional(),
  videos: rows.optional(),
  voiceovers: rows.optional(),
  clips: rows.optional(),
  sops: rows.optional(),
  libraryUrl: text,
};

export const VideoGridCardSchema = {
  videos: rows,
  page: z.number(),
  limit: z.number(),
  hasMore: z.boolean(),
  niche: text,
};

export const ScriptCardSchema = {
  text: z.string(),
  cost: z.number(),
  id: z.string(),
  prompt: text,
};

export const ImageGalleryCardSchema = {
  id: z.string(),
  status: z.string(),
  images: z.array(z.string()).optional(),
  downloads: z.array(z.string()).optional(),
  refs: z.array(z.string()).optional(),
  outputs: num,
  model: text,
  aspectRatio: text,
  prompt: text,
  cost: num,
};

export const TranscriptCardSchema = {
  id: z.string(),
  status: z.string(),
  title: text,
  coverUrl: text,
  videoUrl: text,
  embedUrl: text,
  lines: rows.optional(),
};

export const DownloadCardSchema = {
  id: z.string(),
  status: z.string(),
  progress: num,
  title: text,
  url: text,
  format: text,
};

export const VoiceoverCardSchema = {
  id: z.string(),
  status: z.string(),
  title: text,
  voiceId: text,
  url: text,
  downloadUrl: text,
  parts: z.array(z.string()).optional(),
  durationSeconds: num,
};

export const VoicesCardSchema = {
  voices: rows,
  appUrl: text,
};

export const VideoCardSchema = {
  id: z.string(),
  status: z.string(),
  model: text,
  prompt: text,
  durationSeconds: num,
  aspectRatio: text,
  resolution: text,
  cost: num,
  createdAt: text,
  url: text,
  downloadUrl: text,
  appUrl: text,
};

export const ClipsCardSchema = {
  id: z.string(),
  status: z.string(),
  stage: text,
  title: text,
  channel: text,
  thumbnailUrl: text,
  durationSeconds: num,
  sourceUrl: text,
  creditsCharged: num,
  clips: rows.optional(),
  editorUrl: text,
  error_message: text,
};

export const CreatorProfileCardSchema = {
  id: z.string(),
  status: z.string(),
  channelName: text,
  videos: rows.optional(),
  summary: text,
  analysis: row.optional(),
  docUrl: text,
  docFilename: text,
};

export const FindNicheCardSchema = {
  stage: z.enum(["form", "processing", "result", "error"]),
  id: z.string().optional(),
  platform: z.enum(["youtube", "tiktok", "both"]).optional(),
  niches: rows.optional(),
  live: z.boolean().optional(),
  error_message: z.string().optional(),
};

export const BendCardSchema = {
  jobId: z.string(),
  status: z.string(),
  statusText: text,
  progress: num,
  saved: z.boolean().optional(),
  analysis: row.optional(),
  candidates: rows.optional(),
  sop: row.optional(),
  error: row.optional(),
  appUrl: text,
};
