import {
  Activity,
  BarChart3,
  Captions,
  Compass,
  DollarSign,
  Download,
  Home,
  Image as ImageIcon,
  LayoutDashboard,
  Library,
  PenSquare,
  Plug,
  Settings,
  Tag,
  Users,
  Wand2,
} from "lucide-react";
import type { NavItem } from "@/lib/types";

export const SIDEBAR_NAV: NavItem[] = [
  { label: "Home", href: "/app", icon: Home },
  { label: "Niche Finder", href: "/app/niches", icon: Compass },
  { label: "Niche Bending", href: "/app/bend", icon: Wand2 },
  { label: "Script Writer", href: "/app/scripts", icon: PenSquare },
  { label: "Image Generator", href: "/app/image-generator", icon: ImageIcon },
  { label: "Library", href: "/app/library", icon: Library },
  { label: "Transcripts", href: "/app/transcripts", icon: Captions },
  { label: "Downloader", href: "/app/downloads", icon: Download },
  { label: "MCP", href: "/app/mcp", icon: Plug },
];

export const ADMIN_NAV: NavItem[] = [
  { label: "Overview", href: "/admin", icon: LayoutDashboard },
  { label: "Users", href: "/admin/users", icon: Users },
  { label: "Plans", href: "/admin/plans", icon: Tag },
  { label: "Revenue", href: "/admin/revenue", icon: DollarSign },
  { label: "Usage & Tools", href: "/admin/usage", icon: BarChart3 },
  { label: "System", href: "/admin/system", icon: Activity },
  { label: "Settings", href: "/admin/settings", icon: Settings },
];

export const LANDING_NAV_LINKS: { label: string; href: string }[] = [
  { label: "Niche Bending", href: "#niche-bending" },
  { label: "Features", href: "#features" },
  { label: "Pricing", href: "#pricing" },
  { label: "API", href: "#developers" },
  { label: "MCP", href: "#developers" },
];
