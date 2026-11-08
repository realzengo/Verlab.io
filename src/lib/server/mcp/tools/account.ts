import "server-only";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUserCredits } from "@/lib/server/credits";
import type { NicheBendChannelAnalysis } from "@/lib/types";
import type { ClipMoment } from "@/lib/clips";
import { APP_LINKS, signMediaUrl } from "../links";
import { signThumbUrl } from "../thumb-proxy";
import { appResult, capText, errorResult, formatSeconds, READ_ONLY, UUID_PATTERN, type McpToolDefinition } from "./shared";

const PLAN_LABELS: Record<string, string> = { core: "Core", pro: "Pro", scale: "Scale" };

const getCreditBalanceTool: McpToolDefinition = {
  name: "get_credit_balance",
  title: "Get credit balance",
  description: "Returns the Verlab account's current credit balance and plan.",
  inputSchema: {},
  annotations: READ_ONLY,
  handler: async (userId) => {
    const [credits, { data: profile }] = await Promise.all([
      getUserCredits(userId),
      createAdminClient().from("profiles").select("plan").eq("id", userId).maybeSingle(),
    ]);
    const plan = typeof profile?.plan === "string" ? (PLAN_LABELS[profile.plan] ?? profile.plan) : null;
    return appResult(`The Verlab account has ${credits.toLocaleString()} credits${plan ? ` on the ${plan} plan` : ""}.`, {
      credits,
      plan,
      topUpUrl: APP_LINKS.credits,
    });
  },
};

const listScriptsTool: McpToolDefinition = {
  name: "list_scripts",
  title: "List generated scripts",
  description:
    "Lists the scripts generated on this Verlab account, newest first, with a short preview of each. Use get_script with an id to read one in full.",
  inputSchema: {
    search: z.string().optional().describe("Only scripts whose topic or text contains this."),
    limit: z.number().int().min(1).max(50).optional().describe("How many to return, 1-50. Defaults to 20."),
  },
  annotations: READ_ONLY,
  handler: async (userId, args) => {
    const limit = Math.min(50, Math.max(1, Number(args.limit) || 20));
    const search = typeof args.search === "string" ? args.search.trim().replace(/[%_,()]/g, " ").slice(0, 100) : "";

    let query = createAdminClient()
      .from("scripts")
      .select("id, prompt, content, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (search) query = query.or(`prompt.ilike.%${search}%,content.ilike.%${search}%`);

    const { data, error } = await query;
    if (error) return errorResult("Couldn't load your scripts. Please try again.");

    const scripts = (data ?? []).map((row) => ({
      id: row.id as string,
      prompt: (row.prompt as string | null) ?? "",
      preview: String(row.content ?? "").slice(0, 280),
      words: String(row.content ?? "").split(/\s+/).filter(Boolean).length,
      created_at: row.created_at as string,
    }));

    const text = scripts.length
      ? `${scripts.length} script${scripts.length === 1 ? "" : "s"}${search ? ` matching "${search}"` : ""}:\n` +
        scripts
          .map((s) => `- ${s.id} · ${s.created_at.slice(0, 10)} · ${s.words} words · ${s.prompt.slice(0, 90) || "(no topic)"}`)
          .join("\n")
      : search
        ? `No scripts match "${search}".`
        : "No scripts yet.";
    return appResult(text, { kind: "scripts", scripts });
  },
};

const getScriptTool: McpToolDefinition = {
  name: "get_script",
  title: "Open a saved script",
  description: "Returns one saved Verlab script in full, by the id from list_scripts or generate_script.",
  inputSchema: { id: z.string().describe("The script id.") },
  annotations: READ_ONLY,
  handler: async (userId, args) => {
    const id = String(args.id ?? "").trim();
    if (!UUID_PATTERN.test(id)) return errorResult("That isn't a valid script id.", "invalid_input");
    const { data } = await createAdminClient()
      .from("scripts")
      .select("id, prompt, content")
      .eq("id", id)
      .eq("user_id", userId)
      .maybeSingle();
    if (!data) return errorResult("That script wasn't found on this account.", "not_found");
    const text = String(data.content ?? "");
    return appResult(text, { text, id: data.id, cost: 0, prompt: data.prompt ?? "" });
  },
};

const LIBRARY_TYPES = ["all", "image", "video", "voiceover", "clip", "sop"] as const;
type LibraryType = (typeof LIBRARY_TYPES)[number];

interface VoiceoverSegment {
  durationSeconds?: number;
}

const listLibraryTool: McpToolDefinition = {
  name: "list_library",
  title: "Browse the Verlab library",
  description:
    "Shows what this Verlab account has made: AI images, AI videos, voiceovers, clip projects and SOPs (channel playbooks from bend_niche/create_sop), newest first, with playable previews. " +
    "Pick one type to see more of it. Image refs in the result (image:<id>:<n>) can be passed to generate_video or generate_image as inputs.",
  inputSchema: {
    type: z.enum(LIBRARY_TYPES).optional().describe("What to show. Defaults to all."),
  },
  annotations: READ_ONLY,
  handler: async (userId, args) => {
    const type: LibraryType = (LIBRARY_TYPES as readonly string[]).includes(String(args.type)) ? (args.type as LibraryType) : "all";
    const wants = (kind: LibraryType) => type === "all" || type === kind;
    const limit = type === "all" ? 8 : 30;
    const admin = createAdminClient();
    const none = Promise.resolve({ data: [] as Record<string, unknown>[], error: null });

    const [images, videos, voiceovers, clips, sops] = await Promise.all([
      wants("image")
        ? admin
            .from("image_generations")
            .select("id, prompt, model, outputs, aspect_ratio, created_at")
            .eq("user_id", userId)
            .eq("status", "completed")
            .order("created_at", { ascending: false })
            .limit(limit)
        : none,
      wants("video")
        ? admin
            .from("video_generations")
            .select("id, mode, model, prompt, params, output_video_path, created_at")
            .eq("user_id", userId)
            .eq("status", "completed")
            // Raw edit-source uploads aren't deliverables (same filter as the web Library).
            .neq("operation", "uploaded")
            .not("output_video_path", "is", null)
            .order("created_at", { ascending: false })
            .limit(limit)
        : none,
      wants("voiceover")
        ? admin
            .from("voiceover_generations")
            .select("id, title, voice_id, style_prompt, segments, created_at")
            .eq("user_id", userId)
            .eq("status", "completed")
            .order("created_at", { ascending: false })
            .limit(limit)
        : none,
      wants("clip")
        ? admin
            .from("clip_projects")
            .select("id, title, channel_title, thumbnail_url, duration_seconds, status, clips, created_at")
            .eq("user_id", userId)
            .order("created_at", { ascending: false })
            .limit(limit)
        : none,
      wants("sop")
        ? admin
            .from("niche_bend_jobs")
            .select("id, analysis, chosen_bend, status, created_at")
            .eq("user_id", userId)
            .or("saved.eq.true,status.eq.sop_ready")
            .order("created_at", { ascending: false })
            .limit(limit)
        : none,
    ]);

    const failed = [images, videos, voiceovers, clips, sops].find((result) => result.error);
    if (failed) return errorResult("Couldn't load your library. Please try again.");

    const imageItems = (images.data ?? []).map((row) => {
      const id = String(row.id);
      const count = Math.max(1, Number(row.outputs) || 1);
      return {
        id,
        prompt: String(row.prompt ?? ""),
        model: String(row.model ?? ""),
        aspectRatio: (row.aspect_ratio as string | null) ?? null,
        created_at: String(row.created_at),
        refs: Array.from({ length: count }, (_, i) => `image:${id}:${i}`),
        thumbs: Array.from({ length: count }, (_, i) => signMediaUrl("image", id, i, { width: 480 })),
        urls: Array.from({ length: count }, (_, i) => signMediaUrl("image", id, i)),
      };
    });

    const videoItems = (videos.data ?? []).map((row) => {
      const id = String(row.id);
      const params = (row.params ?? {}) as { durationSeconds?: number; aspectRatio?: string };
      return {
        id,
        mode: String(row.mode ?? "create"),
        model: String(row.model ?? ""),
        prompt: (row.prompt as string | null) ?? "",
        durationSeconds: typeof params.durationSeconds === "number" ? Math.round(params.durationSeconds * 10) / 10 : null,
        aspectRatio: params.aspectRatio ?? null,
        created_at: String(row.created_at),
        url: signMediaUrl("video", id),
        downloadUrl: signMediaUrl("video", id, 0, { download: true }),
      };
    });

    const voiceoverItems = (voiceovers.data ?? []).map((row) => {
      const id = String(row.id);
      const segments: VoiceoverSegment[] = Array.isArray(row.segments) ? (row.segments as VoiceoverSegment[]) : [];
      return {
        id,
        title: String(row.title ?? "Untitled Voiceover"),
        voiceId: (row.voice_id as string | null) ?? null,
        durationSeconds: segments.reduce((sum, s) => sum + (typeof s.durationSeconds === "number" ? s.durationSeconds : 0), 0),
        created_at: String(row.created_at),
        urls: segments.map((_, i) => signMediaUrl("voiceover", id, i)),
      };
    });

    const clipItems = (clips.data ?? []).map((row) => {
      const moments = Array.isArray(row.clips) ? (row.clips as ClipMoment[]) : [];
      return {
        id: String(row.id),
        title: String(row.title ?? ""),
        channel: (row.channel_title as string | null) ?? null,
        thumbnailUrl: signThumbUrl(row.thumbnail_url as string | null),
        durationSeconds: Number(row.duration_seconds) || 0,
        status: String(row.status),
        clipCount: moments.length,
        topScore: moments.reduce((best, clip) => Math.max(best, clip.score ?? 0), 0) || null,
        created_at: String(row.created_at),
        editorUrl: APP_LINKS.clipProject(String(row.id)),
      };
    });

    const sopItems = (sops.data ?? []).map((row) => {
      const analysis = row.analysis as NicheBendChannelAnalysis | null;
      const chosen = row.chosen_bend as { nicheName?: string } | null;
      return {
        id: String(row.id),
        created_at: String(row.created_at),
        channelName: analysis?.channelName ?? null,
        detectedNiche: analysis?.detectedNiche ?? null,
        bend: chosen?.nicheName ?? null,
        hasSop: row.status === "sop_ready",
        avatarUrl: signThumbUrl(analysis?.avatarUrl),
        topVideos: (analysis?.topVideos ?? []).slice(0, 8).map((video) => ({ title: video.title, views: video.views })),
      };
    });

    const lines: string[] = [];
    if (wants("image")) {
      lines.push(`Images (${imageItems.length}):`);
      for (const item of imageItems) lines.push(`- ${item.refs.join(", ")} · ${item.model} · "${item.prompt.slice(0, 80)}"`);
    }
    if (wants("video")) {
      lines.push(`Videos (${videoItems.length}):`);
      for (const item of videoItems)
        lines.push(`- ${item.id} · ${item.model}${item.durationSeconds ? ` · ${item.durationSeconds}s` : ""} · "${item.prompt.slice(0, 80)}"`);
    }
    if (wants("voiceover")) {
      lines.push(`Voiceovers (${voiceoverItems.length}):`);
      for (const item of voiceoverItems) lines.push(`- ${item.id} · ${item.title} · ${formatSeconds(item.durationSeconds)}`);
    }
    if (wants("clip")) {
      lines.push(`Clip projects (${clipItems.length}):`);
      for (const item of clipItems) lines.push(`- ${item.id} · ${item.status} · ${item.clipCount} clips · "${item.title.slice(0, 80)}"`);
    }
    if (wants("sop")) {
      lines.push(`SOPs (${sopItems.length}):`);
      for (const item of sopItems)
        lines.push(`- ${item.id} · ${item.channelName ?? "Channel"}${item.bend ? ` → ${item.bend}` : ""}${item.hasSop ? " (SOP ready, usable as sopId in generate_script)" : ""}`);
    }

    return appResult(capText(lines.join("\n"), 6000, "list shortened"), {
      kind: "library",
      type,
      images: imageItems,
      videos: videoItems,
      voiceovers: voiceoverItems,
      clips: clipItems,
      sops: sopItems,
      libraryUrl: APP_LINKS.library,
    });
  },
};

export const ACCOUNT_TOOLS: McpToolDefinition[] = [getCreditBalanceTool, listLibraryTool, listScriptsTool, getScriptTool];
