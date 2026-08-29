import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import type { LucideIcon } from "lucide-react";
import { Captions, Clapperboard, Download, Image as ImageIcon, Mic2, PenLine, Plug, SquarePlay, Wand2 } from "lucide-react";
import { ToolGridCard, type ToolTone } from "@/components/dashboard/ToolGridCard";
import { createClient } from "@/lib/supabase/server";

function displayName(user: User | null): string {
  const meta = user?.user_metadata as { full_name?: string; name?: string } | undefined;
  return meta?.full_name ?? meta?.name ?? user?.email?.split("@")[0] ?? "there";
}

const QUICK_ACTIONS: { label: string; href: string; icon: LucideIcon }[] = [
  { label: "AI Images", href: "/image-generator", icon: ImageIcon },
  { label: "MCP", href: "/mcp", icon: Plug },
  { label: "AI Videos", href: "/video-generator", icon: SquarePlay },
];

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
  comingSoon?: boolean;
  thumbnail?: string;
  video?: string;
  videoPoster?: string;
  videoDark?: string;
  videoPosterDark?: string;
  videoScale?: number;
  videoSkipRanges?: [number, number][];
}[] = [
  {
    title: "Niche Bender",
    description: "Turn any viral niche into your own — steal the winning structure, swap the topic.",
    href: "/bend",
    icon: Wand2,
    tone: "cat-7",
    video: "/videos/niche-bender.mp4",
    videoPoster: "/videos/niche-bender-poster.jpg",
    videoDark: "/videos/niche-bender-dark.mp4",
    videoPosterDark: "/videos/niche-bender-dark-poster.jpg",
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
    // The clip opens on a ~0.3s blown-out focus-pull that flashes white on every loop -- skip it.
    videoSkipRanges: [[0, 0.3]],
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
    // The doc card sits blank for ~1.1s before the lines draw in -- skip the empty hold.
    videoSkipRanges: [[1.8, 2.9]],
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

export default async function AppHome() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="flex flex-col gap-4 pt-8 sm:pt-12">
      <section>
        <div className="mb-6 text-center">
          <h1 className="bg-gradient-to-b from-heading to-heading/60 bg-clip-text text-xl font-semibold leading-[1.15] tracking-[-0.02em] text-transparent sm:text-2xl">
            Hello {displayName(user)}, what would you like to create today?
          </h1>
        </div>
        <div className="mb-8 grid grid-cols-3 gap-2 sm:mb-12 sm:flex sm:flex-wrap sm:items-center sm:justify-center sm:gap-4">
          {QUICK_ACTIONS.map((action) => (
            <Link
              key={action.label}
              href={action.href}
              className="group relative isolate flex flex-col items-center gap-1.5 overflow-hidden rounded-xl border border-[#E0E4F2] bg-white/70 px-2 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.06),0_1px_1px_rgba(15,23,42,0.04)] backdrop-blur-xl transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-1 hover:border-primary/25 hover:bg-white/90 hover:shadow-[0_24px_48px_-18px_rgba(37,99,235,0.35),0_0_0_1px_rgba(37,99,235,0.12)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-app active:translate-y-0 active:scale-[0.98] active:duration-150 dark:border-white/[0.07] dark:bg-transparent dark:bg-gradient-to-b dark:from-[#13151b] dark:to-[#08090c] dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04),0_1px_2px_rgba(0,0,0,0.6)] dark:hover:border-blue-500/40 dark:hover:from-[#1b2748] dark:hover:via-[#0d1424] dark:hover:to-[#050608] dark:hover:bg-gradient-to-br dark:hover:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08),0_28px_56px_-16px_rgba(37,99,235,0.5),0_0_0_1px_rgba(59,130,246,0.2)] sm:w-44 sm:flex-row sm:justify-start sm:gap-3 sm:rounded-2xl sm:px-5 sm:py-4"
            >
              <span
                aria-hidden
                className="pointer-events-none absolute inset-y-0 -left-1/3 z-0 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-white/30 to-transparent opacity-0 transition-[transform,opacity] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-x-[420%] group-hover:opacity-100 dark:via-white/10"
              />
              <span className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-accent to-primary/15 text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] ring-1 ring-black/[0.03] transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:-translate-y-0.5 group-hover:scale-[1.06] group-hover:from-primary/20 group-hover:to-primary/35 group-hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_6px_16px_-4px_rgba(37,99,235,0.4)] group-hover:ring-primary/25 dark:bg-gradient-to-br dark:from-zinc-600 dark:to-zinc-900 dark:text-white dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.25),inset_0_-2px_2px_0_rgba(0,0,0,0.4),0_2px_6px_0_rgba(0,0,0,0.5)] dark:ring-1 dark:ring-white/10 dark:group-hover:from-[#2f4a8c] dark:group-hover:to-[#0e1730] dark:group-hover:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.3),0_6px_20px_-4px_rgba(59,130,246,0.55)] dark:group-hover:ring-blue-400/40 sm:h-10 sm:w-10 sm:rounded-xl">
                <action.icon className="h-4 w-4 sm:h-5 sm:w-5" />
              </span>
              <span className="relative z-10 text-center text-[11px] font-semibold text-heading transition-colors duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:text-primary sm:text-sm dark:group-hover:text-white">
                {action.label}
              </span>
            </Link>
          ))}
        </div>
        <div className="-m-6 overflow-x-auto p-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-[repeat(3,410px)] lg:justify-center lg:gap-5">
            {TOOLS.map((tool) => (
              <ToolGridCard
                key={tool.title}
                title={tool.title}
                description={tool.description}
                href={tool.href}
                icon={tool.icon}
                tone={tool.tone}
                badge={tool.badge}
                comingSoon={tool.comingSoon}
                thumbnail={tool.thumbnail}
                video={tool.video}
                videoPoster={tool.videoPoster}
                videoDark={tool.videoDark}
                videoPosterDark={tool.videoPosterDark}
                videoScale={tool.videoScale}
                videoSkipRanges={tool.videoSkipRanges}
              />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
