import { Flame, Gauge, MessageSquareText, Repeat, Sparkles, Wand2 } from "lucide-react";
import type { Agent } from "@/lib/types";

export const AGENTS: Agent[] = [
  {
    id: "agent-hook-generator",
    name: "Hook Generator",
    category: "hooks",
    description: "Generates 10 hook variations from a topic or existing script.",
    icon: Flame,
  },
  {
    id: "agent-hook-rater",
    name: "Hook Rater",
    category: "hooks",
    description: "Scores a hook against your niche's proven hook formula.",
    icon: Sparkles,
  },
  {
    id: "agent-script-rewriter",
    name: "Script Rewriter",
    category: "rewrite",
    description: "Rewrites a script in a different tone, length, or pacing.",
    icon: Repeat,
  },
  {
    id: "agent-niche-translator",
    name: "Niche Translator",
    category: "rewrite",
    description: "Rewrites a script's examples and references for a new niche.",
    icon: Wand2,
  },
  {
    id: "agent-virality-breakdown",
    name: "Virality Breakdown",
    category: "virality",
    description: "Explains why a specific video performed the way it did, beat by beat.",
    icon: Gauge,
  },
  {
    id: "agent-comment-analyzer",
    name: "Comment Analyzer",
    category: "virality",
    description: "Summarizes what viewers loved, questioned, or pushed back on.",
    icon: MessageSquareText,
  },
];
