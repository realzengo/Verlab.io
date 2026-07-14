import {
  Bot,
  Captions,
  ClipboardList,
  CloudCog,
  Compass,
  Download,
  FileDown,
  Flame,
  FolderKanban,
  Gauge,
  PenSquare,
  Plug,
  Wand2,
  Code2,
} from "lucide-react";
import type { FeatureGridItem, ToolTileData } from "@/lib/types";

export const FEATURE_GRID_ITEMS: FeatureGridItem[] = [
  {
    title: "Niche Bending",
    description: "Transfer a viral niche's winning structure into your own — keep the formula, swap the topic.",
    icon: Wand2,
  },
  {
    title: "Niche Finder",
    description: "Discover trending faceless niches on TikTok, ranked by momentum score.",
    icon: Compass,
  },
  {
    title: "SOP Builder",
    description: "Reverse-engineer any niche's hook, structure, and pacing into a repeatable SOP.",
    icon: ClipboardList,
  },
  {
    title: "Accurate transcripts",
    description: "Clean, timestamped transcripts from TikTok, Reels, and Shorts in seconds.",
    icon: Captions,
  },
  {
    title: "Script Maker",
    description: "Generate ready-to-film scripts — hook, body, and CTA — from a bent SOP.",
    icon: PenSquare,
  },
  {
    title: "Viral AI agents",
    description: "Hooks, rewrites, and virality breakdowns on demand.",
    icon: Bot,
  },
  {
    title: "AI exports",
    description: "Export scripts and SOPs as TXT, PDF, or XML for your editing workflow.",
    icon: FileDown,
  },
  {
    title: "Download media",
    description: "Pull the original source video alongside its transcript.",
    icon: Download,
  },
  {
    title: "Collections & playlists",
    description: "Import a full collection and bulk transcribe up to 50 videos at once.",
    icon: FolderKanban,
  },
  {
    title: "Cloud library",
    description: "Every transcript, SOP, and script saved and searchable in one place.",
    icon: CloudCog,
  },
  {
    title: "MCP for Claude & ChatGPT",
    description: "Connect Clypa to your AI workflow — bend niches and pull transcripts from chat.",
    icon: Plug,
    badge: "Developer favorite",
  },
  {
    title: "API access",
    description: "Full REST API access to every Clypa tool for your own pipeline.",
    icon: Code2,
  },
];

export const DASHBOARD_TOOLS: ToolTileData[] = [
  { label: "Transcript Extractor", href: "/app/transcripts", icon: Captions },
  { label: "Niche Finder", href: "/app/niches", icon: Compass },
  { label: "SOP Builder", href: "/app/sops", icon: ClipboardList },
  { label: "Script Maker", href: "/app/scripts", icon: PenSquare },
  { label: "Hook Generator", href: "/app/agents", icon: Flame },
  { label: "Niche Bender", href: "/app/bend", icon: Wand2 },
  { label: "Media Downloader", href: "/app/library", icon: Download },
  { label: "Virality Analyzer", href: "/app/agents", icon: Gauge },
  { label: "Caption Export", href: "/app/transcripts", icon: FileDown },
];
