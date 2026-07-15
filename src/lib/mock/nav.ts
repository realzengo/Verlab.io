import {
  Captions,
  Compass,
  Download,
  Home,
  Plug,
  Wand2,
} from "lucide-react";
import type { NavItem } from "@/lib/types";

export const SIDEBAR_NAV: NavItem[] = [
  { label: "Home", href: "/app", icon: Home },
  { label: "Niche Finder", href: "/app/niches", icon: Compass },
  { label: "Niche Bending", href: "/app/bend", icon: Wand2 },
  { label: "Transcripts", href: "/app/transcripts", icon: Captions },
  { label: "Downloader", href: "/app/downloader", icon: Download },
  { label: "MCP", href: "/app/mcp", icon: Plug },
];

export const LANDING_NAV_LINKS: { label: string; href: string }[] = [
  { label: "Niche Bending", href: "#niche-bending" },
  { label: "Features", href: "#features" },
  { label: "Pricing", href: "#pricing" },
  { label: "API", href: "#developers" },
  { label: "MCP", href: "#developers" },
];
