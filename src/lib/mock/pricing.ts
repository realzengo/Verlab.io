import type { ComparisonRow, PricingPlan } from "@/lib/types";

export const PRICING_PLANS: PricingPlan[] = [
  {
    id: "core",
    name: "Core",
    info: "Everything you need to get started finding winning videos.",
    price: { monthly: 17, yearly: 17 * 9 },
    cta: "Start Core",
    features: [
      { text: "1,000 Credits (AI Tools)" },
      { text: "20 Niche Bends (Per month)" },
      { text: "Unlimited Transcripts (TikTok, Reels & Shorts)" },
      { text: "5 Study Niches (Saved for reference)" },
      { text: "100 Saved Videos (Your library)" },
      { text: "1 Connected Channel (Your own audit)" },
    ],
  },
  {
    id: "pro",
    name: "Pro",
    info: "The most popular plan if you're serious about bending and scaling.",
    price: { monthly: 37, yearly: 29 * 12 },
    recommended: true,
    cta: "Start Pro",
    features: [
      { text: "3,000 Credits (AI Tools)" },
      { text: "Unlimited Niche Bends (No monthly cap)" },
      { text: "Unlimited Transcripts (TikTok, Reels & Shorts)" },
      { text: "15 Study Niches (Saved for reference)" },
      { text: "Unlimited Saved Videos (Your library)" },
      { text: "2 Connected Channels (Your own audit)" },
      { text: "Viral AI Agents (Hooks, structure & pacing)" },
      { text: "AI Exports (TXT, PDF & XML)" },
    ],
  },
  {
    id: "scale",
    name: "Scale",
    info: "The biggest plan to maximize your potential at scale.",
    price: { monthly: 77, yearly: 57 * 12 },
    cta: "Start Scale",
    features: [
      { text: "7,000 Credits (AI Tools)" },
      { text: "Unlimited Niche Bends (No monthly cap)" },
      { text: "Unlimited Transcripts (TikTok, Reels & Shorts)" },
      { text: "Unlimited Study Niches (Saved for reference)" },
      { text: "Unlimited Saved Videos (Your library)" },
      { text: "5 Connected Channels (Your own audit)" },
      { text: "Viral AI Agents (Hooks, structure & pacing)" },
      { text: "AI Exports (TXT, PDF & XML)" },
      { text: "API Access (Build on Clypa)" },
      { text: "MCP Connect (Claude & ChatGPT)" },
    ],
  },
];

export const COMPARISON_ROWS: ComparisonRow[] = [
  { feature: "Credits / month (AI tools)", core: "1,000", pro: "3,000", scale: "7,000" },
  { feature: "Niche bends / month", core: "20", pro: "Unlimited", scale: "Unlimited" },
  { feature: "Transcripts (TikTok / Reels / Shorts)", core: "Unlimited", pro: "Unlimited", scale: "Unlimited" },
  { feature: "Study niches saved", core: "5", pro: "15", scale: "Unlimited" },
  { feature: "Saved videos", core: "100", pro: "Unlimited", scale: "Unlimited" },
  { feature: "Connected channels", core: "1", pro: "2", scale: "5" },
  { feature: "Viral AI Agents", core: false, pro: true, scale: true },
  { feature: "AI exports (TXT/PDF/XML)", core: false, pro: true, scale: true },
  { feature: "API access", core: false, pro: false, scale: true },
  { feature: "MCP for Claude & ChatGPT", core: false, pro: false, scale: true },
];
