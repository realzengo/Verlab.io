import type { LucideIcon } from "lucide-react";
import { Captions, Clapperboard, Download, Image as ImageIcon, Mic2, PenLine, Wand2 } from "lucide-react";
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
    title: "Niche Bending",
    description: "Reverse-engineer a winning channel's format and bend it into a fresh, non-competing niche.",
    href: "/bend",
    icon: Wand2,
    tone: "cat-7",
    video: "/videos/niche-bender.mp4",
    videoPoster: "/videos/niche-bender-poster.jpg",
    videoDark: "/videos/niche-bender-dark.mp4",
    videoPosterDark: "/videos/niche-bender-dark-poster.jpg",
  },
  {
    title: "Image Generator",
    description: "Generate scroll-stopping thumbnails and cover images for your videos with AI.",
    href: "/image-generator",
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
    href: "/video-generator",
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
    href: "/scripts",
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
    href: "/transcripts",
    icon: Captions,
    tone: "cat-5",
    video: "/videos/transcript-extractor.mp4",
    videoPoster: "/videos/transcript-extractor-poster.jpg",
    videoDark: "/videos/transcript-extractor-dark.mp4",
    videoPosterDark: "/videos/transcript-extractor-dark-poster.jpg",
  },
  {
    title: "Downloader",
    description: "Save TikTok, Reels, and Shorts videos to your device without the watermark.",
    href: "/downloads",
    icon: Download,
    tone: "cat-1",
    video: "/videos/downloader.mp4",
    videoPoster: "/videos/downloader-poster.jpg",
    videoDark: "/videos/downloader-dark.mp4",
    videoPosterDark: "/videos/downloader-dark-poster.jpg",
    videoScale: 1.35,
  },
  {
    title: "Voiceover",
    description: "Turn scripts into natural-sounding voiceovers with AI voices in seconds.",
    href: "/voiceover-generator",
    icon: Mic2,
    tone: "cat-2",
    video: "/videos/voiceover-generator.mp4",
    videoPoster: "/videos/voiceover-generator-poster.jpg",
    videoDark: "/videos/voiceover-generator-dark.mp4",
    videoPosterDark: "/videos/voiceover-generator-dark-poster.jpg",
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
