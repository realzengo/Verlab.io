import type { Sop } from "@/lib/types";

export const SOPS: Sop[] = [
  {
    id: "sop-medmal-to-corpfraud",
    title: "Medical Malpractice → Corporate Fraud",
    sourceNicheId: "medical-malpractice",
    targetNicheId: "corporate-espionage",
    hookFormula:
      "\"The [dollar amount] [mistake/decision] that [company/institution] hoped you'd never find out about\"",
    structure: [
      "0-3s: Cold open on the number, the payout, the loss, the body count",
      "3-10s: Set the scene, who, where, what looked normal at first",
      "10-35s: The mistake or decision, told in chronological beats",
      "35-50s: The coverup, what they tried to hide and how it surfaced",
      "50-60s: The consequence, then a hook for part 2",
    ],
    pacing: "Cut every 2-3s on the reveal beats, hold 4-5s on the emotional turn.",
    dos: [
      "Open with a specific number, not a vague claim",
      "Name real dates and dollar figures where available",
      "End on an unresolved thread to justify a part 2",
    ],
    donts: [
      "Don't editorialize in the first 10 seconds. Let the facts hook",
      "Don't bury the twist past the 40s mark",
      "Don't use stock true-crime music beds. Feels generic",
    ],
    createdAt: "2026-06-02T10:00:00.000Z",
    savedByUser: true,
  },
  {
    id: "sop-corpfraud-to-fincollapse",
    title: "Corporate Espionage → Financial Collapse",
    sourceNicheId: "corporate-espionage",
    targetNicheId: "financial-collapse",
    hookFormula: "\"Every warning sign [institution] chose to ignore before [disaster]\"",
    structure: [
      "0-3s: State the outcome up front, the collapse, the number",
      "3-15s: Rewind to the first warning sign",
      "15-40s: Stack 3-4 more warning signs, escalating",
      "40-55s: The final decision that sealed it",
      "55-60s: One-line takeaway + follow prompt",
    ],
    pacing: "Fast list-style cuts (1.5-2s) on the warning-sign stack, slow down for the ending.",
    dos: ["Use a running counter overlay for each warning sign", "Cite a real source or article"],
    donts: ["Don't stack more than 5 warning signs. Attention drops"],
    createdAt: "2026-06-10T14:30:00.000Z",
    savedByUser: true,
  },
  {
    id: "sop-mildisaster-to-engfail",
    title: "Military Disasters → Engineering Failures",
    sourceNicheId: "military-disasters",
    targetNicheId: "engineering-failures",
    hookFormula: "\"The [small error] that caused [catastrophic outcome]\"",
    structure: [
      "0-4s: Show the aftermath first",
      "4-20s: Rewind to the design/planning stage",
      "20-45s: The overlooked detail, explained simply",
      "45-58s: The failure moment, slowed down",
      "58-60s: The fix that came too late",
    ],
    pacing: "Match cut aftermath-to-cause, then steady 3s beats through the explanation.",
    dos: ["Use simple diagrams/overlays to explain technical causes"],
    donts: ["Don't over-explain the physics. Keep it accessible"],
    createdAt: "2026-06-18T09:15:00.000Z",
  },
];
