import type { BendResult } from "@/lib/types";

export const BEND_RESULTS: BendResult[] = [
  {
    id: "bend-medmal-corpfraud",
    sourceNiche: "Medical Malpractice",
    targetNiche: "Corporate Fraud",
    createdAt: "2026-06-02T10:00:00.000Z",
    analysis:
      "Medical Malpractice works because every video opens on a concrete number (a payout, a body count) before any context is given — the specificity is the hook, not the drama. Corporate Fraud has the same shape: a dollar figure, a coverup, a reveal. Bending it keeps the cold-open structure and swaps hospitals for boardrooms.",
    sop: {
      hookFormula:
        "\"The [dollar amount] [decision] that [company] hoped you'd never find out about\"",
      structure: [
        "0-3s: Cold open on the number",
        "3-10s: Set the scene",
        "10-35s: The decision, told in chronological beats",
        "35-50s: The coverup and how it surfaced",
        "50-60s: Consequence + hook for part 2",
      ],
      pacing: "Cut every 2-3s on reveal beats, hold 4-5s on the emotional turn.",
      dos: [
        "Open with a specific number, not a vague claim",
        "Name real dates and dollar figures",
        "End on an unresolved thread",
      ],
      donts: [
        "Don't editorialize in the first 10 seconds",
        "Don't bury the twist past the 40s mark",
      ],
    },
    scriptIdeas: [
      "The expense report line item that took down a CFO",
      "How one auditor's question unraveled a decade of fraud",
      "The shell company nobody thought to check",
      "The whistleblower email that sat unread for six months",
      "Every red flag the board saw and dismissed",
    ],
    scripts: [
      "HOOK: The $340M expense report line that took down a CFO.\n\nBODY: In 2019, a routine audit flagged a single line item — $340M in \"consulting fees\" with no invoices attached. The CFO signed off on it personally, three years running. What the audit missed the first two times: the consulting firm didn't exist.\n\nCTA: Follow for part 2 — how they finally caught it.",
      "HOOK: How one auditor's question unraveled a decade of fraud.\n\nBODY: She asked to see the original vendor contract. It took the finance team four days to produce one — because there wasn't one. That four-day delay is what triggered the internal investigation that ended the company's largest division.\n\nCTA: Save this for the full breakdown next week.",
    ],
  },
  {
    id: "bend-corpfraud-fincollapse",
    sourceNiche: "Corporate Espionage",
    targetNiche: "Financial Collapse",
    createdAt: "2026-06-10T14:30:00.000Z",
    analysis:
      "Corporate Espionage's escalating-reveal structure (mole → leak → exposure) maps cleanly onto Financial Collapse's warning-sign format. Both rely on a stacked list building toward an inevitable outcome the viewer already knows is coming.",
    sop: {
      hookFormula: "\"Every warning sign [institution] chose to ignore before [collapse]\"",
      structure: [
        "0-3s: State the outcome up front",
        "3-15s: First warning sign",
        "15-40s: Stack 3-4 more, escalating",
        "40-55s: The final decision",
        "55-60s: One-line takeaway",
      ],
      pacing: "Fast list cuts (1.5-2s) on the stack, slow for the ending.",
      dos: ["Use a running counter overlay", "Cite a real source"],
      donts: ["Don't stack more than 5 warning signs"],
    },
    scriptIdeas: [
      "Every warning sign before the 2008 hedge fund that vanished overnight",
      "The risk report nobody read until it was too late",
    ],
    scripts: [
      "HOOK: Every warning sign before this hedge fund vanished overnight.\n\nBODY: Warning sign one: their returns never varied by more than 0.1% for six straight years — statistically almost impossible. Warning sign two: their auditor was a two-person firm in a strip mall. Warning sign three...\n\nCTA: Which one would you have caught? Comment below.",
    ],
  },
];
