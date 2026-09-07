import {
  Activity,
  BarChart3,
  Coins,
  DollarSign,
  EyeOff,
  LayoutDashboard,
  Settings,
  Wallet,
  Tag,
  Ticket,
  Users,
  Home,
  Library,
  Telescope,
  Wand2,
  Folder,
  Key,
} from "lucide-react";
import { DiscordIcon } from "@/components/icons/DiscordIcon";
import type { NavItem } from "@/lib/types";

export const SIDEBAR_NAV: NavItem[] = [
  { label: "Home", href: "/", icon: Home },
  { label: "Library", href: "/library", icon: Library },
  { label: "Niche Finder", href: "/niches", icon: Telescope },
  { label: "Niche Bending", href: "/bend", icon: Wand2 },
  { label: "Tools", href: "/tools", icon: Folder },
  { label: "MCP", href: "/mcp", icon: Key },
  { label: "Discord", href: "/discord", icon: DiscordIcon },
];

export const ADMIN_NAV: NavItem[] = [
  { label: "Overview", href: "/admin", icon: LayoutDashboard },
  { label: "Users", href: "/admin/users", icon: Users },
  { label: "Plans", href: "/admin/plans", icon: Tag },
  { label: "Niche Channels", href: "/admin/niche-channels", icon: EyeOff },
  { label: "Credits", href: "/admin/credits", icon: Coins },
  { label: "Promo Codes", href: "/admin/promo-codes", icon: Ticket },
  { label: "Revenue", href: "/admin/revenue", icon: DollarSign },
  { label: "API Costs", href: "/admin/api-costs", icon: Wallet },
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
