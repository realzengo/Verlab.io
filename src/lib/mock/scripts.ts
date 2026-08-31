import type { Script } from "@/lib/types";

export const SCRIPTS: Script[] = [
  {
    id: "script-cfo-expense",
    title: "The $340M expense line",
    topic: "Corporate fraud, expense report",
    sopId: "sop-medmal-to-corpfraud",
    hook: "The $340M expense report line that took down a CFO.",
    body: "In 2019, a routine audit flagged a single line item, $340M in \"consulting fees\" with no invoices attached. The CFO signed off on it personally, three years running. What the audit missed the first two times: the consulting firm didn't exist.",
    cta: "Follow for part 2 to see how they finally caught it.",
    createdAt: "2026-06-03T11:20:00.000Z",
  },
  {
    id: "script-auditor-question",
    title: "The question that unraveled a decade",
    topic: "Corporate fraud, internal audit",
    sopId: "sop-medmal-to-corpfraud",
    hook: "How one auditor's question unraveled a decade of fraud.",
    body: "She asked to see the original vendor contract. It took the finance team four days to produce one, because there wasn't one. That four-day delay is what triggered the internal investigation that ended the company's largest division.",
    cta: "Save this for the full breakdown next week.",
    createdAt: "2026-06-04T09:05:00.000Z",
  },
  {
    id: "script-hedge-fund",
    title: "The fund that vanished overnight",
    topic: "Financial collapse, hedge fund",
    sopId: "sop-corpfraud-to-fincollapse",
    hook: "Every warning sign before this hedge fund vanished overnight.",
    body: "Warning sign one: their returns never varied by more than 0.1% for six straight years. Statistically almost impossible. Warning sign two: their auditor was a two-person firm in a strip mall. Warning sign three: the firm's biggest investor tried to redeem in 2007 and was quietly talked out of it.",
    cta: "Which one would you have caught? Comment below.",
    createdAt: "2026-06-11T16:40:00.000Z",
  },
  {
    id: "script-bridge-decimal",
    title: "The decimal that collapsed a bridge",
    topic: "Engineering failure",
    sopId: "sop-mildisaster-to-engfail",
    hook: "The decimal point error that collapsed a bridge.",
    body: "The load calculation was off by a single decimal place, a tenth of the actual stress the structure would face. Nobody caught it because three separate engineers each assumed someone else had double-checked the math.",
    cta: "Part 2: the redesign that fixed it for good.",
    createdAt: "2026-06-19T13:10:00.000Z",
  },
];
