import type { FaqItem } from "@/lib/types";
import { CONTACT_EMAIL } from "@/lib/constants";

// Every billing answer here must match the Terms and Refund Policy, and the
// code: credits are only ever added (they carry over), yearly plans get the
// whole year's credits up front, and every tool needs an active plan.

const REFUND_POLICY_LINK = { label: "Read the Refund Policy.", href: "/legal/refunds" };

const CANCEL_ANSWER =
  "Anytime, with no reason or approval needed. Sign in at app.verlab.io, click your profile picture in the top right, then Settings → Subscription → Cancel subscription, and confirm. You keep full access until the end of the period you've already paid for, and you won't be charged again.";

const REFUND_ANSWER = `Yes. You can get a full refund within 14 days of any payment, including renewals and top-ups. Email ${CONTACT_EMAIL} with your account email and the payment date, and we'll reply within 24 hours.`;

const ROLLOVER_ANSWER =
  "Yes. Unused credits stay in your balance from one billing period to the next, and you can spend them as long as you have an active plan.";

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
    question: "How do I cancel?",
    answer: CANCEL_ANSWER,
    link: REFUND_POLICY_LINK,
  },
  {
    id: "faq-credit",
    question: "What is a credit?",
    answer:
      "Credits are what Verlab's AI tools run on. Clipping, scripts, Niche Bending, images, videos, voiceovers and creator analysis each use credits from your balance, depending on the job. Your plan adds credits every billing period, and a job that fails doesn't cost you anything.",
  },
  {
    id: "faq-usage",
    question: "How do I view my usage?",
    answer: "Go to Settings → Credits to see your current balance and a full history of every credit spent, tool by tool.",
  },
  {
    id: "faq-refund",
    question: "Do you have a refund policy?",
    answer: REFUND_ANSWER,
    link: REFUND_POLICY_LINK,
  },
  {
    id: "faq-paid-actions",
    question: "Is there a free plan?",
    answer:
      "No. Every Verlab tool needs an active paid plan. Most tools also use credits from your balance. Transcripts are included in every plan and don't use credits.",
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
    answer: ROLLOVER_ANSWER,
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
      "Yes. Tools you run through your assistant use credits the same way they do in the app, and transcripts are included in your plan without using credits. Your account needs an active plan for any tool to run.",
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
      "Credits are Verlab's currency across every AI tool: clipping, Niche Bending, the Script Writer, Image Generator, Video Generator, AI Voiceover and Creator Analysis all use credits when you generate something. Monthly plans add your plan's credits every month. Yearly plans add the whole year's credits (12 months' worth) at the start of the year.",
  },
  {
    id: "pricing-faq-rollover",
    question: "Do unused credits roll over?",
    answer: ROLLOVER_ANSWER,
  },
  {
    id: "pricing-faq-run-out",
    question: "What if I run out of credits mid-month?",
    answer: "Top up any time from Settings → Credits. Top-up credits are added straight to your balance and work on every plan.",
  },
  {
    id: "pricing-faq-cancel",
    question: "How do I cancel?",
    answer: CANCEL_ANSWER,
    link: REFUND_POLICY_LINK,
  },
  {
    id: "pricing-faq-refund",
    question: "Can I get a refund?",
    answer: REFUND_ANSWER,
    link: REFUND_POLICY_LINK,
  },
  {
    id: "pricing-faq-annual",
    question: "How does annual billing work?",
    answer:
      "Annual plans are billed once a year at a discounted monthly rate (the \"Save X%\" badge on each card above), and you get the whole year's credits at the start. Monthly plans bill month to month. Both renew automatically until you cancel, and both are covered by the 14-day refund policy.",
  },
  {
    id: "pricing-faq-monetize",
    question: "Can I monetize content made with Verlab?",
    answer:
      "Yes. Every script, image, video, and voiceover generated on your account is yours to publish, monetize, and run ads against. No attribution required and no revenue share.",
  },
];
