import type { FaqItem } from "@/lib/types";

export const FAQ_ITEMS: FaqItem[] = [
  {
    id: "faq-cancel",
    question: "Can I cancel my plan?",
    answer:
      "Yes — cancel anytime from Settings → Subscription, no approval needed. You'll keep full access to your plan until the end of the current billing cycle.",
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
      "No — all plans, credits, and add-ons are billed in advance and are non-refundable, including unused credits. See our Refund Policy for the full details.",
  },
  {
    id: "faq-paid-actions",
    question: "What counts as a paid action?",
    answer: "Niche Bending, SOP Builder, and Script Maker all draw from your credit balance. Transcripts are free — 5 a day on any plan.",
  },
  {
    id: "faq-monetize",
    question: "Can I monetize content made with Verlab?",
    answer:
      "Yes. Every script, SOP, and bent niche is yours to publish, monetize, and run ads against — no attribution required and no revenue share.",
  },
  {
    id: "faq-languages",
    question: "Can I generate in other languages?",
    answer:
      "Yes — transcripts can be translated and Script Maker can write in other languages, so you can bend a niche found in one language into content for another.",
  },
  {
    id: "faq-rollover",
    question: "Do unused credits roll over?",
    answer: "No — credits are tied to your current billing cycle and don't carry over, in line with our no-refund policy.",
  },
];
