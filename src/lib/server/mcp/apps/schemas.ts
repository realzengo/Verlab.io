import { z } from "zod";

// One output schema per widget template (not per tool) -- shared by every
// tool that renders that template. Deliberately lenient/optional on fields
// that differ between a tool's "start" and "check_status" result shapes
// (e.g. `note` only appears on the still-processing branch).

export const StatCardSchema = {
  credits: z.number(),
};

const scriptRow = z.object({ id: z.string(), prompt: z.string(), content: z.string(), created_at: z.string() });
const imageRow = z.object({
  id: z.string(),
  prompt: z.string(),
  model: z.string(),
  outputs: z.array(z.string()),
  created_at: z.string(),
});
const sopRow = z.object({
  id: z.string(),
  created_at: z.string(),
  channelName: z.string().nullable(),
  detectedNiche: z.string().nullable(),
  topVideos: z.array(z.object({ title: z.string(), views: z.string() })),
});

export const ListCardSchema = {
  scripts: z.array(scriptRow).optional(),
  images: z.array(imageRow).optional(),
  sops: z.array(sopRow).optional(),
};

const videoRow = z.object({
  id: z.string(),
  title: z.string(),
  views: z.string(),
  coverUrl: z.string().nullable(),
  videoUrl: z.string(),
  author: z.string(),
  avatarUrl: z.string().nullable(),
  niche: z.string(),
  platform: z.enum(["tiktok", "youtube"]),
});

export const VideoGridCardSchema = {
  videos: z.array(videoRow),
  page: z.number(),
  limit: z.number(),
  hasMore: z.boolean(),
};

export const ScriptCardSchema = {
  text: z.string(),
  cost: z.number(),
  id: z.string(),
};

export const ImageGalleryCardSchema = {
  id: z.string(),
  status: z.string(),
  images: z.array(z.string()).optional(),
  note: z.string().optional(),
  error_message: z.string().nullable().optional(),
};

export const TranscriptCardSchema = {
  id: z.string(),
  status: z.string(),
  title: z.string().nullable().optional(),
  coverUrl: z.string().nullable().optional(),
  videoUrl: z.string().nullable().optional(),
  embedUrl: z.string().nullable().optional(),
  lines: z.array(z.object({ timestamp: z.string(), text: z.string() })).optional(),
  note: z.string().optional(),
  error_message: z.string().nullable().optional(),
};

export const DownloadCardSchema = {
  id: z.string(),
  status: z.string(),
  progress: z.number().nullable().optional(),
  title: z.string().nullable().optional(),
  url: z.string().nullable().optional(),
  file_path: z.string().nullable().optional(),
  note: z.string().optional(),
  error_message: z.string().nullable().optional(),
};

const creatorAnalysisDetail = z.object({
  executiveSummary: z.string(),
  hookFormula: z.string(),
  pacingAndStructure: z.string(),
  voiceAndTone: z.string(),
  recurringPatterns: z.string(),
  perVideoInsights: z.array(z.object({ title: z.string(), insight: z.string() })),
  actionSteps: z.array(z.string()),
});

export const CreatorProfileCardSchema = {
  id: z.string(),
  status: z.string(),
  channelName: z.string().nullable().optional(),
  videos: z.array(z.object({ title: z.string(), views: z.string(), url: z.string() })).optional(),
  summary: z.string().nullable().optional(),
  analysis: creatorAnalysisDetail.optional(),
  docBase64: z.string().optional(),
  docFilename: z.string().optional(),
  docMimeType: z.string().optional(),
  note: z.string().optional(),
  error_message: z.string().nullable().optional(),
};

const nicheReportVideo = z.object({
  title: z.string(),
  views: z.string(),
  coverUrl: z.string().nullable(),
  videoUrl: z.string().nullable(),
  author: z.string().nullable(),
  avatarUrl: z.string().nullable(),
});
const nicheReportEntry = z.object({
  name: z.string(),
  platform: z.enum(["youtube", "tiktok", "both"]),
  category: z.string(),
  description: z.string(),
  whyForYou: z.string(),
  angle: z.string(),
  momentumScore: z.number(),
  momentumTrend: z.enum(["up", "down", "flat"]),
  sampleVideos: z.array(nicheReportVideo),
});

export const FindNicheCardSchema = {
  stage: z.enum(["form", "processing", "result", "error"]),
  id: z.string().optional(),
  platform: z.enum(["youtube", "tiktok", "both"]).optional(),
  niches: z.array(nicheReportEntry).optional(),
  live: z.boolean().optional(),
  note: z.string().optional(),
  error_message: z.string().optional(),
};
