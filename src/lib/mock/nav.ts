import {
  Activity,
  BarChart3,
  Coins,
  DollarSign,
  Folder,
  Image as ImageIcon,
  LayoutDashboard,
  Settings,
  Wallet,
  Tag,
  Ticket,
  Users,
  Telescope,
  Megaphone,
} from "lucide-react";
import {
  BinocularsIcon,
  ClosedCaptioningIcon,
  FilmSlateIcon,
  ImageIcon as ImageFillIcon,
  MagicWandIcon,
  MicrophoneIcon,
  PencilLineIcon,
  ScissorsIcon,
} from "@phosphor-icons/react/dist/ssr";
import { DiscordIcon } from "@/components/icons/DiscordIcon";
import { McpIcon } from "@/components/icons/McpIcon";
import { RailClipIcon, RailHomeIcon, RailToolsIcon, RailVideoIcon, RailWizardIcon } from "@/components/icons/RailIcons";
import type { NavItem, NavMenuItem, NavMenuSection } from "@/lib/types";

// Every tool, grouped the way the sidebar's Tools hover menu shows them:
// one array per column, each a list of titled sections.
export const TOOLS_MENU: NavMenuSection[][] = [
  [
    {
      title: "Video and images",
      items: [
        { title: "Video Generator", description: "AI video from a prompt or image", href: "/video-generator", icon: FilmSlateIcon, tone: "purple" },
        { title: "Image Generator", description: "Thumbnails and covers with AI", href: "/image-generator", icon: ImageFillIcon, tone: "orange" },
        { title: "Clipping", description: "Viral clips from a long video", href: "/clipping", icon: ScissorsIcon, tone: "red", badge: "Beta" },
      ],
    },
    {
      title: "Voice and text",
      items: [
        { title: "Scriptwriter", description: "Write a script for your video", href: "/scripts", icon: PencilLineIcon, tone: "blue" },
        { title: "Voiceover", description: "Turn a script into a voice", href: "/voiceover-generator", icon: MicrophoneIcon, tone: "pink" },
      ],
    },
  ],
  [
    {
      title: "Niche research",
      items: [
        { title: "Niche Finder", description: "Trending videos, by niche", href: "/niches", icon: BinocularsIcon, tone: "green" },
        { title: "Niche Bending", description: "Remix a winning channel's format", href: "/bend", icon: MagicWandIcon, tone: "purple" },
      ],
    },
    {
      title: "Transcripts",
      items: [
        { title: "Transcript Extractor", description: "Pull the script from any video", href: "/transcripts", icon: ClosedCaptioningIcon, tone: "blue" },
      ],
    },
  ],
];

/** A tool's TOOLS_MENU entry by its page, so other screens draw it with the
 * same icon and tone (see ToolTile). */
export function toolMenuItem(href: string): NavMenuItem | undefined {
  return TOOLS_MENU.flat()
    .flatMap((section) => section.items)
    .find((entry) => entry.href === href);
}

// Order and grouping are the app sidebar's: rows without a `section` form the
// top group, then each `section` gets a small heading. Tools links to /tools
// and shows TOOLS_MENU beside the rail on hover.
export const SIDEBAR_NAV: NavItem[] = [
  { label: "Home", href: "/", icon: RailHomeIcon },
  { label: "Niche Finder", href: "/niches", icon: Telescope },
  { label: "Niche Bending", href: "/bend", icon: RailWizardIcon },
  { label: "Clipping", href: "/clipping", icon: RailClipIcon, badge: "Beta" },
  { label: "Video Generator", href: "/video-generator", icon: RailVideoIcon },
  { label: "Image Generator", href: "/image-generator", icon: ImageIcon },
  { label: "Tools", href: "/tools", icon: RailToolsIcon, menu: TOOLS_MENU },
  { label: "MCP", href: "/mcp", icon: McpIcon },
  { label: "My library", href: "/library", icon: Folder, section: "Library" },
  { label: "Discord", href: "/discord", icon: DiscordIcon, section: "Library" },
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
  { label: "Announcements", href: "/admin/announcements", icon: Megaphone },
  { label: "System", href: "/admin/system", icon: Activity },
  { label: "Settings", href: "/admin/settings", icon: Settings },
];

// The admin sidebar's grouping of ADMIN_NAV. Kept as hrefs so a page added to
// ADMIN_NAV but forgotten here still shows up (under "More").
const ADMIN_NAV_GROUPS: { label: string | null; hrefs: string[] }[] = [
  { label: null, hrefs: ["/admin"] },
  { label: "Customers", hrefs: ["/admin/users", "/admin/credits", "/admin/promo-codes"] },
  { label: "Revenue", hrefs: ["/admin/revenue", "/admin/plans", "/admin/api-costs"] },
  { label: "Product", hrefs: ["/admin/usage", "/admin/announcements"] },
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
