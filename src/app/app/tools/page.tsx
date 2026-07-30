import { Captions, Download, Image as ImageIcon, PenSquare, type LucideIcon } from "lucide-react";
import type { ToolTone } from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { TOOL_TONE_CLASSES } from "@/lib/tone";
import { cn } from "@/lib/utils";

interface ToolCardData {
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
  tone: ToolTone;
}

const TOOLS: ToolCardData[] = [
  {
    title: "Image Generator",
    description: "Generate on-brand thumbnails and images with Nano Banana, GPT Image, and more.",
    href: "/app/image-generator",
    icon: ImageIcon,
    tone: "violet",
  },
  {
    title: "Script Writer",
    description: "Turn any topic into a scroll-stopping video script, hook and all.",
    href: "/app/scripts",
    icon: PenSquare,
    tone: "amber",
  },
  {
    title: "Transcripts",
    description: "Paste a link and get a clean, timestamped transcript in seconds.",
    href: "/app/transcripts",
    icon: Captions,
    tone: "blue",
  },
  {
    title: "Downloader",
    description: "Download videos from YouTube, TikTok, and Facebook in the best quality available.",
    href: "/app/downloads",
    icon: Download,
    tone: "green",
  },
];

function ToolCard({ title, description, href, icon: Icon, tone }: ToolCardData) {
  return (
    <Card hoverLift className="flex flex-col gap-4">
      <span className={cn("flex h-11 w-11 items-center justify-center rounded-2xl", TOOL_TONE_CLASSES[tone])}>
        <Icon className="h-5 w-5" />
      </span>
      <div className="flex-1">
        <h3 className="text-base font-semibold text-heading">{title}</h3>
        <p className="mt-1 text-sm text-body">{description}</p>
      </div>
      <Button href={href} variant="secondary" size="sm" className="w-full justify-center">
        Get Started
      </Button>
    </Card>
  );
}

export default function ToolsPage() {
  return (
    <div className="mt-4 flex flex-col gap-6 sm:mt-6">
      <p className="text-sm text-body">Everything Verlab can do, in one place.</p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {TOOLS.map((tool) => (
          <ToolCard key={tool.href} {...tool} />
        ))}
      </div>
    </div>
  );
}
