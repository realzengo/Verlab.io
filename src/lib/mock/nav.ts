import {
  Activity,
  BarChart3,
  Coins,
  Compass,
  DollarSign,
  Home,
  LayoutDashboard,
  Library,
  Plug,
  Settings,
  Wallet,
  Tag,
  Ticket,
  Users,
  Wand2,
  Wrench,
} from "lucide-react";
import type { NavItem } from "@/lib/types";

export const SIDEBAR_NAV: NavItem[] = [
  { label: "Home", href: "/app", icon: Home },
  { label: "Library", href: "/app/library", icon: Library },
  { label: "Niche Finder", href: "/app/niches", icon: Compass },
  { label: "Niche Bending", href: "/app/bend", icon: Wand2 },
  { label: "Tools", href: "/app/tools", icon: Wrench },
  { label: "MCP", href: "/app/mcp", icon: Plug },
];

export const ADMIN_NAV: NavItem[] = [
  { label: "Overview", href: "/admin", icon: LayoutDashboard },
  { label: "Users", href: "/admin/users", icon: Users },
  { label: "Plans", href: "/admin/plans", icon: Tag },
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
