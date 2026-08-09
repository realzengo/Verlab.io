import type { SupabaseClient } from "@supabase/supabase-js";
import type { FacelessChannelVideo, FacelessSort, NicheBendPlatform, NicheChannel } from "@/lib/types";

const DEFAULT_PAGE_SIZE = 24;
const MAX_PAGE_SIZE = 60;

const SELECT_COLUMNS = [
  "id",
  "platform",
  "channel_url",
  "channel_title",
  "channel_description",
  "avatar_url",
  "subscriber_count",
  "total_views",
  "niche",
  "visual_tags",
  "recent_videos",
  "is_faceless",
  "faceless_confidence",
  "faceless_category",
  "complexity",
  "viral_velocity_score",
  "classification_reasoning",
  "verified_at",
  "created_at",
].join(", ");

export interface FacelessChannelFilters {
  niche?: string;
  complexity?: string;
  /** faceless_category, e.g. "2D Animation" */
  style?: string;
  platform?: NicheBendPlatform;
  sort?: FacelessSort;
  page?: number;
  pageSize?: number;
}

export interface FacelessChannelPage {
  channels: NicheChannel[];
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
}

interface NicheChannelRow {
  id: string;
  platform: NicheBendPlatform;
  channel_url: string;
  channel_title: string;
  channel_description: string;
  avatar_url: string | null;
  subscriber_count: number;
  total_views: number;
  niche: string | null;
  visual_tags: string[];
  recent_videos: FacelessChannelVideo[];
  is_faceless: boolean | null;
  faceless_confidence: number | null;
  faceless_category: NicheChannel["facelessCategory"];
  complexity: NicheChannel["complexity"];
  viral_velocity_score: number | null;
  classification_reasoning: string | null;
  verified_at: string | null;
  created_at: string;
}

function mapRow(row: NicheChannelRow): NicheChannel {
  return {
    id: row.id,
    platform: row.platform,
    channelUrl: row.channel_url,
    channelTitle: row.channel_title,
    channelDescription: row.channel_description,
    avatarUrl: row.avatar_url,
    subscriberCount: row.subscriber_count,
    totalViews: row.total_views,
    niche: row.niche,
    visualTags: row.visual_tags ?? [],
    recentVideos: row.recent_videos ?? [],
    isFaceless: row.is_faceless,
    facelessConfidence: row.faceless_confidence,
    facelessCategory: row.faceless_category,
    complexity: row.complexity,
    viralVelocityScore: row.viral_velocity_score,
    classificationReasoning: row.classification_reasoning,
    verifiedAt: row.verified_at,
    createdAt: row.created_at,
  };
}

/**
 * Fetches channels for the public Niche Finder page -- raw/unclassified by
 * default (no is_faceless/faceless_confidence gate as of 2026-08-09; see
 * supabase/migrations/20260809120000_niche_channels_drop_faceless_gate.sql),
 * optionally narrowed by niche/complexity/style/platform, sorted, and
 * paginated. Channels that do have a real classification (via manual
 * "Auto-Classify"/"Batch Classify" in the admin UI) still carry it through
 * facelessCategory/complexity/etc.; unclassified ones just render those as
 * null/"—" in the UI.
 */
export async function getFacelessChannels(
  supabase: SupabaseClient,
  filters: FacelessChannelFilters = {}
): Promise<FacelessChannelPage> {
  const page = Math.max(1, Math.floor(filters.page ?? 1));
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(filters.pageSize ?? DEFAULT_PAGE_SIZE)));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase.from("niche_channels").select(SELECT_COLUMNS, { count: "exact" });

  if (filters.niche) query = query.eq("niche", filters.niche);
  if (filters.complexity) query = query.eq("complexity", filters.complexity);
  if (filters.style) query = query.eq("faceless_category", filters.style);
  if (filters.platform) query = query.eq("platform", filters.platform);

  switch (filters.sort ?? "trending") {
    case "newest":
      query = query.order("created_at", { ascending: false });
      break;
    case "views":
      query = query.order("total_views", { ascending: false });
      break;
    case "trending":
    default:
      query = query.order("viral_velocity_score", { ascending: false });
      break;
  }

  const { data, error, count } = await query.range(from, to).returns<NicheChannelRow[]>();

  if (error) {
    throw new Error(`Failed to fetch faceless channels: ${error.message}`);
  }

  const channels = (data ?? []).map(mapRow);
  const total = count ?? channels.length;

  return {
    channels,
    page,
    pageSize,
    total,
    hasMore: from + channels.length < total,
  };
}
