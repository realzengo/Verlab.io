import { Captions, Compass, FileDown, Wand2 } from "lucide-react";
import type { ToolTileData } from "@/lib/types";

export const DASHBOARD_TOOLS: ToolTileData[] = [
  { label: "Transcript Extractor", href: "/transcripts", icon: Captions, tone: "blue" },
  { label: "Niche Finder", href: "/niches", icon: Compass, tone: "violet" },
  { label: "Niche Bender", href: "/bend", icon: Wand2, tone: "blue" },
  { label: "Caption Export", href: "/transcripts", icon: FileDown, tone: "sky" },
];
