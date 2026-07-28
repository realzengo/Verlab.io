import { Captions, Compass, FileDown, Wand2 } from "lucide-react";
import type { ToolTileData } from "@/lib/types";

export const DASHBOARD_TOOLS: ToolTileData[] = [
  { label: "Transcript Extractor", href: "/app/transcripts", icon: Captions, tone: "blue" },
  { label: "Niche Finder", href: "/app/niches", icon: Compass, tone: "violet" },
  { label: "Niche Bender", href: "/app/bend", icon: Wand2, tone: "blue" },
  { label: "Caption Export", href: "/app/transcripts", icon: FileDown, tone: "sky" },
];
