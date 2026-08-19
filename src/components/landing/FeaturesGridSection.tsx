"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, type ComponentType, type SVGProps } from "react";
import type { LucideIcon } from "lucide-react";
import { ArrowUpRight, Image as ImageBadgeIcon, Mic2, Play, Video as VideoBadgeIcon } from "lucide-react";
import { ClaudeIcon } from "@/components/landing/AssistantIcons";
import { KlingLogo } from "@/components/landing/ModelLogos";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { APP_URL } from "@/lib/constants";

interface HeroTool {
  title: string;
  description: string;
  href: string;
  video: string;
  poster: string;
}

const HERO_TOOLS: HeroTool[] = [
  {
    title: "AI Video Generator",
    description: "Generate AI videos without watermarks, ready to post.",
    href: `${APP_URL}/video-generator`,
    video: "/videos/video-generator.mp4",
    poster: "/videos/video-generator-poster.jpg",
  },
  {
    title: "Downloader",
    description: "Download TikTok, Reels, and Shorts, watermark-free.",
    href: `${APP_URL}/downloads`,
    video: "/videos/downloader.mp4",
    poster: "/videos/downloader-poster.jpg",
  },
  {
    title: "AI Image Generator",
    description: "Create AI images from text prompts, ready to use.",
    href: `${APP_URL}/image-generator`,
    video: "/videos/image-generator.mp4",
    poster: "/videos/image-generator-poster.jpg",
  },
];

interface ToolLogo {
  title: string;
  description: string;
  href: string;
  badge?: string;
  logo?: string;
  icon?: ComponentType<SVGProps<SVGSVGElement>>;
  iconClassName?: string;
}

const BADGE_TONE: Record<string, string> = {
  Image: "bg-slate-100 text-slate-600",
  Video: "bg-slate-100 text-slate-600",
  New: "bg-btn-primary text-white",
  Trending: "bg-btn-primary text-white",
};

const BADGE_ICON: Partial<Record<string, LucideIcon>> = {
  Image: ImageBadgeIcon,
  Video: VideoBadgeIcon,
};

const TOOL_LOGOS: ToolLogo[] = [
  {
    title: "Nano Banana Pro",
    description: "Generate realistic images",
    href: `${APP_URL}/image-generator`,
    badge: "Image",
    logo: "/logos/ai/gemini.svg",
  },
  {
    title: "Seedance 2.5",
    description: "Create high quality videos",
    href: `${APP_URL}/video-generator`,
    badge: "New",
    logo: "/logos/ai/seedance.webp",
  },
  {
    title: "Kling 3.0 Turbo",
    description: "Create stunning videos in seconds",
    href: `${APP_URL}/video-generator`,
    badge: "New",
    icon: KlingLogo,
    iconClassName: "h-6 w-6",
  },
  {
    title: "Niche Bender MCP",
    description: "Bend any niche with Claude",
    href: `${APP_URL}/mcp`,
    badge: "Trending",
    icon: ClaudeIcon,
    iconClassName: "h-8 w-8",
  },
  {
    title: "Voice Studio",
    description: "Generate lifelike voiceovers",
    href: `${APP_URL}/voiceover-generator`,
    badge: "New",
    icon: Mic2,
  },
  {
    title: "Script Writer",
    description: "Real, hook-driven scripts",
    href: `${APP_URL}/scripts`,
    logo: "/logos/verlab-mark-blue.png",
  },
];

function HeroToolCard({ title, description, href, video, poster }: HeroTool) {
  const videoRef = useRef<HTMLVideoElement>(null);

  // Only play the copies actually on screen -- this section carries three
  // multi-MB clips, no reason to force all of them to fetch on page load.
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.play().catch(() => {});
        } else {
          el.pause();
        }
      },
      { threshold: 0 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <Link href={href} className="group flex flex-col">
      <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-gradient-to-br from-slate-100 to-blue-50">
        <video
          ref={videoRef}
          src={video}
          poster={poster}
          className="absolute inset-0 h-full w-full object-cover"
          loop
          muted
          playsInline
          preload="metadata"
        />
      </div>
      <div className="pt-4">
        <h3 className="text-sm font-bold text-heading transition-colors duration-200 group-hover:text-btn-primary">
          {title}
        </h3>
        <p className="mt-1 text-xs font-bold text-slate-500">{description}</p>
      </div>
    </Link>
  );
}

function ToolLogoCard({ title, description, href, badge, logo, icon: Icon, iconClassName }: ToolLogo) {
  return (
    <Link
      href={href}
      className="group flex h-full flex-col justify-between gap-3 rounded-xl bg-[#F0F6FF] p-3.5"
    >
      <div className="flex items-center justify-between">
        <span className="flex h-9 w-9 items-center justify-center">
          {logo ? (
            <Image src={logo} alt="" width={24} height={24} className="h-6 w-6 object-contain" />
          ) : Icon ? (
            <Icon className={cn(iconClassName ?? "h-5 w-5", "text-slate-900")} strokeWidth={1.75} />
          ) : null}
        </span>
        {badge &&
          (() => {
            const BadgeIcon = BADGE_ICON[badge];
            return (
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold",
                  BADGE_TONE[badge]
                )}
              >
                {BadgeIcon && <BadgeIcon className="h-3 w-3" strokeWidth={2} />}
                {badge}
              </span>
            );
          })()}
      </div>
      <div>
        <h4 className="text-sm font-bold text-heading transition-colors duration-200 group-hover:text-btn-primary">
          {title}
        </h4>
        <p className="mt-1 text-xs text-slate-500">{description}</p>
      </div>
    </Link>
  );
}

function VoiceoverCard() {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.play().catch(() => {});
        } else {
          el.pause();
        }
      },
      { threshold: 0 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <Link
      href={`${APP_URL}/voiceover-generator`}
      className="group flex h-full flex-col gap-3 rounded-2xl bg-gradient-to-br from-slate-100 to-blue-50 p-3.5"
    >
      <div className="relative flex-1 overflow-hidden rounded-xl">
        <video
          ref={videoRef}
          src="/videos/voiceover-generator.mp4"
          poster="/videos/voiceover-generator-poster.jpg"
          className="absolute inset-0 h-full w-full object-cover"
          loop
          muted
          playsInline
          preload="metadata"
        />
      </div>

      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-heading">Voiceover</h3>
        <span className="flex h-9 w-9 items-center justify-center transition-transform duration-200 group-hover:translate-x-0.5">
          <ArrowUpRight className="h-4 w-4 text-slate-900" />
        </span>
      </div>
    </Link>
  );
}

export function FeaturesGridSection() {
  return (
    <section id="features" className="w-full pb-2 pt-10 sm:pb-3 sm:pt-16">
      <div className="mx-auto max-w-7xl px-5 sm:px-6">
        <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-start">
          <div>
            <h2 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl md:text-4xl">
              Every AI tool, in one place.
            </h2>
            <p className="mt-3 text-xs font-medium text-slate-500 sm:text-sm">
              Generate videos, images, voiceovers, and scripts, all in one place.
            </p>
          </div>
          <Button href={APP_URL} size="md" bevel={false} className="shrink-0 rounded-xl! px-7 py-3.5 text-xl font-bold! shadow-none">
            Make an account
            <Play className="h-3.5 w-3.5 shrink-0 fill-current" />
          </Button>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-3">
          {HERO_TOOLS.map((tool) => (
            <HeroToolCard key={tool.title} {...tool} />
          ))}
        </div>

        <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <VoiceoverCard />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:col-span-3">
            {TOOL_LOGOS.map((tool) => (
              <ToolLogoCard key={tool.title} {...tool} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
