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
  Wrench,
  Scissors,
  Key,
} from "lucide-react";
import { DiscordIcon } from "@/components/icons/DiscordIcon";
import type { NavItem } from "@/lib/types";

export const SIDEBAR_NAV: NavItem[] = [
  { label: "Home", href: "/", icon: Home },
  { label: "Library", href: "/library", icon: Library },
  { label: "Niche Finder", href: "/niches", icon: Telescope },
  { label: "Niche Bending", href: "/bend", icon: Wand2 },
  { label: "Clipping", href: "/clipping", icon: Scissors },
  { label: "Tools", href: "/tools", icon: Wrench },
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

// The admin sidebar's grouping of ADMIN_NAV. Kept as hrefs so a page added to
// ADMIN_NAV but forgotten here still shows up (under "More").
const ADMIN_NAV_GROUPS: { label: string | null; hrefs: string[] }[] = [
  { label: null, hrefs: ["/admin"] },
  { label: "Customers", hrefs: ["/admin/users", "/admin/credits", "/admin/promo-codes"] },
  { label: "Revenue", hrefs: ["/admin/revenue", "/admin/plans", "/admin/api-costs"] },
  { label: "Product", hrefs: ["/admin/usage", "/admin/niche-channels"] },
  { label: "Operations", hrefs: ["/admin/system", "/admin/settings"] },
];

export const ADMIN_NAV_SECTIONS: { label: string | null; items: NavItem[] }[] = (() => {
  const grouped = new Set(ADMIN_NAV_GROUPS.flatMap((g) => g.hrefs));
  const sections = ADMIN_NAV_GROUPS.map((g) => ({
    label: g.label,
    items: g.hrefs.map((href) => ADMIN_NAV.find((item) => item.href === href)).filter((item): item is NavItem => !!item),
  }));
  const rest = ADMIN_NAV.filter((item) => !grouped.has(item.href));
  return rest.length ? [...sections, { label: "More", items: rest }] : sections;
})();

export const LANDING_NAV_LINKS: { label: string; href: string }[] = [
  { label: "Niche Bending", href: "#niche-bending" },
  { label: "Features", href: "#features" },
  { label: "Pricing", href: "#pricing" },
  { label: "API", href: "#developers" },
  { label: "MCP", href: "#developers" },
];
