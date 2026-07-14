import type { ComparisonRow, PricingPlan } from "@/lib/types";

export const PRICING_PLANS: PricingPlan[] = [
  {
    id: "free",
    name: "Free",
    price: 0,
    billingPeriod: "forever",
    cta: "Get started free",
    limits: "Transcripts only · 5/day · no card required",
    features: ["5 transcripts per day", "TikTok, Reels & Shorts", "Copy & basic export"],
  },
  {
    id: "monthly",
    name: "Monthly",
    price: 10,
    billingPeriod: "mo",
    cta: "Start monthly",
    features: [
      "Everything except API access",
      "Unlimited niche bending",
      "Unlimited transcripts & SOPs",
      "Script Maker & AI agents",
      "Cloud library & collections",
    ],
  },
  {
    id: "annual",
    name: "Annual",
    price: 39,
    billingPeriod: "yr",
    priceNote: "~$3.25/mo · save $81",
    recommended: true,
    cta: "Start annual",
    features: [
      "Everything, including API access",
      "Unlimited niche bending",
      "Unlimited transcripts & SOPs",
      "Script Maker & AI agents",
      "Cloud library & collections",
      "MCP for Claude & ChatGPT",
    ],
  },
];

export const COMPARISON_ROWS: ComparisonRow[] = [
  { feature: "Transcripts (TikTok / Reels / Shorts)", free: "5/day", monthly: "Unlimited", annual: "Unlimited" },
  { feature: "Niche Finder", free: false, monthly: true, annual: true },
  { feature: "Niche Bending", free: false, monthly: true, annual: true },
  { feature: "SOP Builder", free: false, monthly: true, annual: true },
  { feature: "Script Maker", free: false, monthly: true, annual: true },
  { feature: "Viral AI Agents", free: false, monthly: true, annual: true },
  { feature: "Collections (bulk 50)", free: false, monthly: true, annual: true },
  { feature: "Cloud library", free: false, monthly: true, annual: true },
  { feature: "AI exports (TXT/PDF/XML)", free: false, monthly: true, annual: true },
  { feature: "API access", free: false, monthly: false, annual: true },
  { feature: "MCP for Claude & ChatGPT", free: false, monthly: false, annual: true },
];
