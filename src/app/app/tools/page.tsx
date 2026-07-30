import type { ReactNode } from "react";
import { ToolCard } from "@/components/dashboard/ToolCard";
import {
  DownloaderPreview,
  ImageGeneratorPreview,
  ScriptPreview,
  TranscriptPreview,
} from "@/components/dashboard/ToolPreviews";

const TOOLS: { title: string; description: string; href: string; preview: ReactNode; beta?: boolean }[] = [
  {
    title: "Image Generator",
    description: "Generate scroll-stopping thumbnails and cover images for your videos with AI.",
    href: "/app/image-generator",
    preview: <ImageGeneratorPreview />,
  },
  {
    title: "Scriptwriter",
    description: "Create engaging scripts for your videos with AI-powered writing assistance.",
    href: "/app/scripts",
    preview: <ScriptPreview />,
    beta: true,
  },
  {
    title: "Transcript Extractor",
    description: "Pull clean, timestamped transcripts from any TikTok, Reels, or Shorts video instantly.",
    href: "/app/transcripts",
    preview: <TranscriptPreview />,
  },
  {
    title: "Downloader",
    description: "Save TikTok, Reels, and Shorts videos to your device without the watermark.",
    href: "/app/downloads",
    preview: <DownloaderPreview />,
  },
];

export default function ToolsPage() {
  return (
    <div className="mt-4 flex flex-col gap-6 sm:mt-6">
      <p className="text-sm text-body">Everything Verlab can do, in one place.</p>
      <div className="grid justify-center gap-5 [grid-template-columns:repeat(auto-fill,minmax(min(340px,100%),340px))]">
        {TOOLS.map((tool) => (
          <ToolCard
            key={tool.title}
            title={tool.title}
            description={tool.description}
            href={tool.href}
            previewSlot={tool.preview}
            beta={tool.beta}
          />
        ))}
      </div>
    </div>
  );
}
