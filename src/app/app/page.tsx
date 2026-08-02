import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import type { LucideIcon } from "lucide-react";
import { Captions, Clapperboard, Compass as CompassIcon, Download, Image as ImageIcon, PenLine, SquareDashed, SquarePlay, Wand2, Zap } from "lucide-react";
import { ToolGridCard, type ToolTone } from "@/components/dashboard/ToolGridCard";
import { createClient } from "@/lib/supabase/server";

function displayName(user: User | null): string {
  const meta = user?.user_metadata as { full_name?: string; name?: string } | undefined;
  return meta?.full_name ?? meta?.name ?? user?.email?.split("@")[0] ?? "there";
}

const QUICK_ACTIONS: { label: string; href: string; icon: LucideIcon }[] = [
  { label: "Quick Editor", href: "/app/bend", icon: Zap },
  { label: "Full Editor", href: "/app/bend", icon: SquareDashed },
  { label: "AI Videos", href: "/app/niches", icon: SquarePlay },
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
}[] = [
  {
    title: "Niche Bender",
    description: "Turn any viral niche into your own — steal the winning structure, swap the topic.",
    href: "/app/bend",
    icon: Wand2,
    tone: "cat-7",
  },
  {
    title: "Niche Finder",
    description: "Discover trending faceless niches on TikTok, ranked by momentum score.",
    href: "/app/niches",
    icon: CompassIcon,
    tone: "cat-2",
    comingSoon: true,
  },
  {
    title: "Transcript Extractor",
    description: "Pull clean, timestamped transcripts from any TikTok, Reels, or Shorts video instantly.",
    href: "/app/transcripts",
    icon: Captions,
    tone: "cat-5",
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
  },
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
              className="group relative isolate flex flex-col items-center gap-1.5 overflow-hidden rounded-xl border border-hairline bg-surface px-2 py-3 shadow-card transition-[transform,box-shadow,border-color] duration-300 ease-[cubic-bezier(0.19,1,0.22,1)] hover:-translate-y-1 hover:border-primary hover:shadow-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-app active:translate-y-0 active:scale-[0.98] active:shadow-card active:duration-150 dark:border-white/5 dark:bg-white/[0.04] dark:shadow-none dark:hover:border-primary/40 dark:hover:shadow-blue sm:flex-row sm:gap-3 sm:rounded-2xl sm:px-5 sm:py-4"
            >
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br from-primary to-primary-hover opacity-0 transition-opacity duration-300 ease-out group-hover:opacity-100"
              />
              <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-accent to-primary/15 text-primary transition-[transform,background-color,box-shadow,color] duration-300 ease-[cubic-bezier(0.19,1,0.22,1)] group-hover:scale-110 group-hover:bg-white/15 group-hover:text-white group-hover:ring-1 group-hover:ring-inset group-hover:ring-white/40 dark:bg-gradient-to-br dark:from-zinc-600 dark:to-zinc-900 dark:text-white dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.25),inset_0_-2px_2px_0_rgba(0,0,0,0.4),0_2px_6px_0_rgba(0,0,0,0.5)] dark:ring-1 dark:ring-white/10 dark:group-hover:bg-white/10 dark:group-hover:ring-white/25 dark:group-hover:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.2)] sm:h-10 sm:w-10 sm:rounded-xl">
                <action.icon className="h-4 w-4 sm:h-5 sm:w-5" />
              </span>
              <span className="relative text-center text-[11px] font-semibold text-heading transition-colors duration-300 group-hover:text-white sm:text-sm">
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
              />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
