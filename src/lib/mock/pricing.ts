import type { ComparisonRow, PricingPlan } from "@/lib/types";

export const PRICING_PLANS: PricingPlan[] = [
  {
    id: "core",
    name: "Core",
    info: "Transcripts and niche bending to get started",
    price: { monthly: 19, yearly: 19 * 12 },
    monthlyOnly: true,
    cta: "Start Core",
    features: [
      { text: "Unlimited transcripts" },
      { text: "TikTok, Reels & Shorts" },
      { text: "20 niche bends per month" },
      { text: "Script Maker" },
      { text: "TXT export" },
    ],
  },
  {
    id: "pro",
    name: "Pro",
    info: "Everything you need to bend and scale",
    price: { monthly: 39, yearly: 30 * 12 },
    recommended: true,
    cta: "Start Pro",
    features: [
      { text: "Everything in Core" },
      { text: "Unlimited niche bending" },
      { text: "Viral AI agents" },
      { text: "Cloud library" },
      { text: "AI exports (TXT/PDF/XML)" },
    ],
  },
  {
    id: "scale",
    name: "Scale",
    info: "For teams and power users who need API access",
    price: { monthly: 89, yearly: 66 * 12 },
    cta: "Start Scale",
    features: [
      { text: "Everything in Pro" },
      { text: "Priority support" },
      {
        text: "API access",
        tooltip: "Programmatic access to your transcripts, SOPs and scripts",
      },
      {
        text: "MCP for Claude & ChatGPT",
        tooltip: "Connect your library directly to Claude or ChatGPT via MCP",
      },
    ],
  },
];

export const COMPARISON_ROWS: ComparisonRow[] = [
  { feature: "Transcripts (TikTok / Reels / Shorts)", core: "Unlimited", pro: "Unlimited", scale: "Unlimited" },
  { feature: "Niche Finder", core: true, pro: true, scale: true },
  { feature: "Niche Bending", core: "20/month", pro: "Unlimited", scale: "Unlimited" },
  { feature: "Script Maker", core: true, pro: true, scale: true },
  { feature: "Viral AI Agents", core: false, pro: true, scale: true },
  { feature: "Cloud library", core: false, pro: true, scale: true },
  { feature: "AI exports (TXT/PDF/XML)", core: "TXT only", pro: true, scale: true },
  { feature: "API access", core: false, pro: false, scale: true },
  { feature: "MCP for Claude & ChatGPT", core: false, pro: false, scale: true },
  { feature: "Priority support", core: false, pro: false, scale: true },
];
