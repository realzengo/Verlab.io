import type { LucideIcon } from "lucide-react";
import { Captions, Clapperboard, Download, Image as ImageIcon, PenLine } from "lucide-react";
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
  video?: string;
  videoPoster?: string;
  videoDark?: string;
  videoPosterDark?: string;
  videoScale?: number;
}[] = [
  {
    title: "Image Generator",
    description: "Generate scroll-stopping thumbnails and cover images for your videos with AI.",
    href: "/app/image-generator",
    icon: ImageIcon,
    tone: "cat-3",
    video: "/videos/image-generator.mp4",
    videoPoster: "/videos/image-generator-poster.jpg",
    videoDark: "/videos/image-generator-dark.mp4",
    videoPosterDark: "/videos/image-generator-dark-poster.jpg",
  },
  {
    title: "Video Generator",
    description: "Create, edit, and animate watermark-free AI videos from a text prompt or image.",
    href: "/app/video-generator",
    icon: Clapperboard,
    tone: "cat-4",
    video: "/videos/video-generator.mp4",
    videoPoster: "/videos/video-generator-poster.jpg",
    videoDark: "/videos/video-generator-dark.mp4",
    videoPosterDark: "/videos/video-generator-dark-poster.jpg",
    videoScale: 1.1,
  },
  {
    title: "Scriptwriter",
    description: "Create engaging scripts for your videos with AI-powered writing assistance.",
    href: "/app/scripts",
    icon: PenLine,
    tone: "cat-6",
    video: "/videos/scriptwriter.mp4",
    videoPoster: "/videos/scriptwriter-poster.jpg",
    videoDark: "/videos/scriptwriter-dark.mp4",
    videoPosterDark: "/videos/scriptwriter-dark-poster.jpg",
    videoScale: 1.15,
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
    video: "/videos/downloader.mp4",
    videoPoster: "/videos/downloader-poster.jpg",
    videoDark: "/videos/downloader-dark.mp4",
    videoPosterDark: "/videos/downloader-dark-poster.jpg",
    videoScale: 1.35,
  },
];

export default function ToolsPage() {
  return (
    <div className="flex flex-col items-center gap-2 pt-2 lg:mx-auto lg:max-w-[1270px]">
      <div className="w-full text-left">
        <h1 className="text-3xl font-extrabold tracking-tight text-heading sm:text-4xl">
          Tools
        </h1>
        <p className="mt-2 text-xs font-medium tracking-wide text-body/60 sm:text-sm">
          Everything Verlab can do, in one place.
        </p>
      </div>

      <div className="mt-6 w-full">
        <div className="-m-6 overflow-x-auto p-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-[repeat(3,410px)] lg:justify-start lg:gap-5">
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
                video={tool.video}
                videoPoster={tool.videoPoster}
                videoDark={tool.videoDark}
                videoPosterDark={tool.videoPosterDark}
                videoScale={tool.videoScale}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
