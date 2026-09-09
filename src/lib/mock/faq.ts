import type { FaqItem } from "@/lib/types";

export const FAQ_ITEMS: FaqItem[] = [
  {
    id: "faq-niche-bending",
    question: "What is Niche Bending?",
    answer:
      "It answers \"what is your channel about?\" Instead of copying an existing niche, it bends underexplored angles into one that's yours, helping you stand out and find a Blue Ocean instead of competing head-on.",
  },
  {
    id: "faq-script-bending",
    question: "What is Script Bending?",
    answer:
      "It answers \"what do I post?\" It bends proven script structures into videos for your niche, so AI can handle about 95% of the writing and you can scale a whole network of channels from it.",
  },
  {
    id: "faq-cancel",
    question: "Can I cancel my plan?",
    answer:
      "Yes. Cancel anytime from Settings → Subscription, no approval needed. You'll keep full access to your plan until the end of the current billing cycle.",
  },
  {
    id: "faq-credit",
    question: "What is a credit?",
    answer:
      "Credits are Verlab's usage unit. Niche Bending, SOP Builder, and Script Maker each spend credits when you generate something, based on length and complexity.",
  },
  {
    id: "faq-usage",
    question: "How do I view my usage?",
    answer: "Go to Settings → Credits to see your current balance and a full history of every credit spent, tool by tool.",
  },
  {
    id: "faq-refund",
    question: "Do you have a refund policy?",
    answer:
      "No. All plans, credits, and add-ons are billed in advance and are non-refundable, including unused credits. See our Refund Policy for the full details.",
  },
  {
    id: "faq-paid-actions",
    question: "What counts as a paid action?",
    answer: "Niche Bending, SOP Builder, and Script Maker all draw from your credit balance. Transcripts are free, 5 a day on any plan.",
  },
  {
    id: "faq-monetize",
    question: "Can I monetize content made with Verlab?",
    answer:
      "Yes. Every script, SOP, and bent niche is yours to publish, monetize, and run ads against, no attribution required and no revenue share.",
  },
  {
    id: "faq-languages",
    question: "Can I generate in other languages?",
    answer:
      "Yes. Transcripts can be translated and Script Maker can write in other languages, so you can bend a niche found in one language into content for another.",
  },
  {
    id: "faq-rollover",
    question: "Do unused credits roll over?",
    answer: "No. Credits are tied to your current billing cycle and don't carry over, in line with our no-refund policy.",
  },
];

export const MCP_FAQ_ITEMS: FaqItem[] = [
  {
    id: "mcp-faq-what",
    question: "What is MCP?",
    answer:
      "Model Context Protocol is an open standard that lets AI assistants like Claude and ChatGPT call an app's tools directly from a conversation. Connecting Verlab over MCP gives your assistant access to your account's tools without switching tabs.",
  },
  {
    id: "mcp-faq-assistants",
    question: "Which assistants does this work with?",
    answer: "Any MCP-compatible client that supports remote connectors, including Claude and ChatGPT. Add the same link in both if you use both.",
  },
  {
    id: "mcp-faq-credits",
    question: "Do actions through my assistant use my credits?",
    answer:
      "Yes. Generating scripts, images, or creator analyses through your assistant spends credits the same way it would in the app. Free actions like transcripts stay free.",
  },
  {
    id: "mcp-faq-security",
    question: "Is it safe to connect?",
    answer:
      "You log into Verlab and approve access before anything connects, the same OAuth flow you'd use for any third-party app. Nothing runs on your account without that approval.",
  },
  {
    id: "mcp-faq-revoke",
    question: "How do I disconnect it later?",
    answer: "Go to Settings → MCP in Verlab and remove the connector. Your assistant loses access immediately.",
  },
];

export const PRICING_FAQ_ITEMS: FaqItem[] = [
  {
    id: "pricing-faq-credits",
    question: "How do credits work?",
    answer:
      "Credits are Verlab's currency across every AI tool — Niche Bending, the Script Writer, Image Generator, Video Generator, AI Voiceover, and Creator Analysis all spend credits when you generate something. Your plan refills a fixed number of credits every month.",
  },
  {
    id: "pricing-faq-rollover",
    question: "Do unused credits roll over?",
    answer: "No. Credits are tied to your current billing cycle and don't carry over, in line with our no-refund policy.",
  },
  {
    id: "pricing-faq-run-out",
    question: "What if I run out of credits mid-month?",
    answer: "Top up any time from Settings → Credits — top-up credits are added straight to your balance and work on every plan.",
  },
  {
    id: "pricing-faq-change-plan",
    question: "Can I change or cancel my plan later?",
    answer:
      "Yes. Upgrade, downgrade, or cancel anytime from Settings → Subscription, no approval needed. You'll keep full access to your current plan until the end of the billing cycle.",
  },
  {
    id: "pricing-faq-annual",
    question: "How does annual billing work?",
    answer:
      "Annual plans are billed once a year at a discounted monthly rate — that's the \"Save X%\" badge on each card above. Monthly plans bill month to month and can be canceled anytime.",
  },
  {
    id: "pricing-faq-monetize",
    question: "Can I monetize content made with Verlab?",
    answer:
      "Yes. Every script, image, video, and voiceover generated on your account is yours to publish, monetize, and run ads against — no attribution required and no revenue share.",
  },
];
