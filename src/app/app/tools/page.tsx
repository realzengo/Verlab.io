import type { LucideIcon } from "lucide-react";
import { Captions, Download, Image as ImageIcon, PenLine } from "lucide-react";
import { ToolGridCard, type ToolTone } from "@/components/dashboard/ToolGridCard";

// Thumbnails: drop a screenshot/mockup at /public/tools/<slug>.png and set
// `thumbnail` below to "/tools/<slug>.png" -- cards fall back to a tinted
// icon tile until then, so this can be filled in one tool at a time.
const TOOLS: {
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
  tone: ToolTone;
  badge?: string;
  thumbnail?: string;
}[] = [
  {
    title: "Image Generator",
    description: "Generate scroll-stopping thumbnails and cover images for your videos with AI.",
    href: "/app/image-generator",
    icon: ImageIcon,
    tone: "cat-3",
  },
  {
    title: "Scriptwriter",
    description: "Create engaging scripts for your videos with AI-powered writing assistance.",
    href: "/app/scripts",
    icon: PenLine,
    tone: "cat-6",
  },
  {
    title: "Transcript Extractor",
    description: "Pull clean, timestamped transcripts from any TikTok, Reels, or Shorts video instantly.",
    href: "/app/transcripts",
    icon: Captions,
    tone: "cat-5",
  },
  {
    title: "Downloader",
    description: "Save TikTok, Reels, and Shorts videos to your device without the watermark.",
    href: "/app/downloads",
    icon: Download,
    tone: "cat-1",
  },
];

export default function ToolsPage() {
  return (
    <div className="flex flex-col gap-2 pt-2">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-heading sm:text-4xl">
          Tools
        </h1>
        <p className="mt-2 text-xs font-medium tracking-wide text-body/60 sm:text-sm">
          Everything Verlab can do, in one place.
        </p>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {TOOLS.map((tool) => (
          <ToolGridCard
            key={tool.title}
            title={tool.title}
            description={tool.description}
            href={tool.href}
            icon={tool.icon}
            tone={tool.tone}
            badge={tool.badge}
            thumbnail={tool.thumbnail}
          />
        ))}
      </div>
    </div>
  );
}
