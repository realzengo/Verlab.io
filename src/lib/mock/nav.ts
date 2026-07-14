import {
  Bot,
  Captions,
  Code2,
  Compass,
  FolderKanban,
  Home,
  Library,
  Wand2,
} from "lucide-react";
import type { NavItem } from "@/lib/types";

export const SIDEBAR_NAV: NavItem[] = [
  { label: "Home", href: "/app", icon: Home },
  { label: "Niche Finder", href: "/app/niches", icon: Compass },
  { label: "Niche Bending", href: "/app/bend", icon: Wand2 },
  { label: "Transcripts", href: "/app/transcripts", icon: Captions },
  { label: "Library", href: "/app/library", icon: Library },
  { label: "Collections", href: "/app/collections", icon: FolderKanban },
  { label: "AI Agents", href: "/app/agents", icon: Bot },
  { label: "Developer API", href: "/app/settings/api", icon: Code2 },
];

export const LANDING_NAV_LINKS: { label: string; href: string }[] = [
  { label: "Niche Bending", href: "#niche-bending" },
  { label: "Features", href: "#features" },
  { label: "Pricing", href: "#pricing" },
  { label: "API", href: "#developers" },
  { label: "MCP", href: "#developers" },
];
