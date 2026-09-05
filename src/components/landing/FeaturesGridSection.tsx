"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, type ComponentType, type SVGProps } from "react";
import { ArrowRight, CheckCircle2, Wrench } from "lucide-react";
import { ClaudeIcon, ClaudeMarkIcon } from "@/components/landing/AssistantIcons";
import { KlingLogo } from "@/components/landing/ModelLogos";
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
    video: "/videos/video-generator-marquee.mp4",
    poster: "/videos/video-generator-marquee-poster.jpg",
  },
  {
    title: "AI Voice Over",
    description: "Generate lifelike voiceovers in dozens of languages.",
    href: `${APP_URL}/voiceover-generator`,
    video: "/videos/voiceover-marquee.mp4",
    poster: "/videos/voiceover-marquee-poster.jpg",
  },
  {
    title: "AI Image Generator",
    description: "Create AI images from text prompts, ready to use.",
    href: `${APP_URL}/image-generator`,
    video: "/videos/image-generator-marquee.mp4",
    poster: "/videos/image-generator-marquee-poster.jpg",
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

const TOOL_LOGOS: ToolLogo[] = [
  {
    title: "Nano Banana Pro",
    description: "Generate realistic images",
    href: `${APP_URL}/image-generator`,
    badge: "Image",
    logo: "/logos/ai/google-color.svg",
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
    title: "Verlab MCP",
    description: "Bend any niche with Claude",
    href: `${APP_URL}/mcp`,
    badge: "Trending",
    icon: ClaudeMarkIcon,
    iconClassName: "h-6 w-6",
  },
  {
    title: "Voice Studio",
    description: "Generate lifelike voiceovers",
    href: `${APP_URL}/voiceover-generator`,
    badge: "New",
    logo: "/logos/verlab-mark-blue.png",
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
    <Link
      href={href}
      className="group relative flex h-full flex-col overflow-hidden rounded-card border border-hairline bg-surface transition-all duration-200 sm:hover:-translate-y-0.5"
    >
      <div className="flex flex-1 flex-col p-2.5">
        <div className="relative aspect-video w-full shrink-0 overflow-hidden rounded-card-sm bg-white">
          <video
            ref={videoRef}
            src={video}
            poster={poster}
            className="absolute inset-0 h-full w-full object-cover"
            loop
            muted
            playsInline
            preload="metadata"
            controlsList="nodownload noremoteplayback"
            disablePictureInPicture
            onContextMenu={(event) => event.preventDefault()}
          />
        </div>
        <div className="flex flex-1 flex-col pt-2.5">
          <h3 className="text-sm font-bold tracking-tight text-heading lg:text-base">{title}</h3>
          <p className="mt-0 mb-1 text-xs font-semibold leading-relaxed text-slate-500 lg:text-xs">{description}</p>
        </div>
      </div>
      <div className="mt-auto px-2.5 pb-2.5">
        <span className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#1E5CFE] py-2 text-sm font-semibold text-white transition-colors lg:py-2.5">
          <span className="transition-transform duration-200 sm:group-hover:-translate-x-0.5">Try Now</span>
          <ArrowRight className="h-3 w-3 translate-x-0 opacity-100 transition-all duration-200 sm:-translate-x-1 sm:opacity-0 sm:group-hover:translate-x-0 sm:group-hover:opacity-100" />
        </span>
      </div>
    </Link>
  );
}

function ToolLogoCard({ title, description, href, badge, logo, icon: Icon, iconClassName }: ToolLogo) {
  return (
    <Link
      href={href}
      className="group flex h-full flex-col rounded-xl bg-[#F5F5F5] p-3 shadow-[inset_0_1px_0_0_#ffffff,inset_0_-1px_0_0_rgba(16,24,40,0.14)] transition-shadow duration-300 [transition-timing-function:cubic-bezier(0.19,1,0.22,1)] hover:shadow-[inset_0_1px_0_0_#ffffff,inset_0_-1px_0_0_rgba(16,24,40,0.2)] sm:rounded-2xl sm:p-5"
    >
      <div className="flex items-center justify-between gap-1.5 sm:gap-2">
        <span className="flex h-5 w-5 shrink-0 items-center justify-center transition-transform duration-300 [transition-timing-function:cubic-bezier(0.19,1,0.22,1)] group-hover:-translate-y-0.5 group-hover:scale-110 sm:h-7 sm:w-7">
          {logo ? (
            <Image src={logo} alt="" width={28} height={28} className="h-full w-full object-contain brightness-0" />
          ) : Icon ? (
            <Icon className={cn(iconClassName ?? "h-5 w-5", "h-full w-full brightness-0")} strokeWidth={1.75} />
          ) : null}
        </span>
        {badge && (
          <span className="inline-flex -skew-x-12 items-center rounded-md bg-heading bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.35),rgba(255,255,255,0)_65%)] px-1.5 py-0.5 sm:px-2 sm:py-1">
            <span className="inline-block skew-x-12 text-[9px] font-extrabold italic uppercase tracking-wide text-app sm:text-[11px]">
              {badge}
            </span>
          </span>
        )}
      </div>

      <h4 className="mt-2.5 text-[13px] font-bold text-heading sm:mt-4 sm:text-[15px]">{title}</h4>
      <p className="mt-0.5 text-[11px] leading-snug text-subtle sm:mt-1 sm:text-sm">{description}</p>
    </Link>
  );
}

const NICHE_STATS = ["8.7 score", "Low competition", "2.4M avg views"];

function McpDemoCard() {
  return (
    <Link
      href={`${APP_URL}/mcp`}
      className="group relative flex h-full min-h-[132px] flex-col overflow-hidden rounded-3xl border border-hairline bg-white transition-all duration-200 sm:hover:-translate-y-0.5"
    >
      <div className="flex items-center justify-between border-b border-hairline px-4 py-3 sm:px-5">
        <span className="inline-flex items-center gap-1.5 text-sm font-bold text-heading">
          <ClaudeIcon className="h-4 w-4 shrink-0 rounded-[4px]" />
          Claude
        </span>
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-hairline bg-app px-2.5 py-1 text-[10px] font-semibold text-subtle">
          <span className="relative flex h-1.5 w-1.5 shrink-0">
            <span className="absolute inset-0 animate-ping rounded-full bg-blue-500/60" />
            <span className="relative h-1.5 w-1.5 rounded-full bg-blue-500" />
          </span>
          Verlab MCP
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-3 px-4 py-4 sm:px-5 sm:py-5">
        <div className="flex justify-end">
          <span className="max-w-[88%] rounded-2xl rounded-br-md bg-heading px-3.5 py-2 text-[12.5px] font-medium leading-snug text-white sm:text-[13px]">
            Find me a trending faceless niche in fitness
          </span>
        </div>

        <div className="flex items-start gap-2">
          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-orange-100 bg-[#FAF0EC]">
            <ClaudeIcon className="h-3.5 w-3.5 shrink-0" />
          </span>
          <div className="flex min-w-0 flex-col gap-2">
            <span className="inline-flex w-fit items-center gap-1.5 rounded-lg border border-hairline bg-app px-2.5 py-1.5 text-[11px] font-medium text-subtle">
              <Wrench className="h-3 w-3 shrink-0" strokeWidth={2.25} />
              <span className="font-mono text-[10.5px] text-slate-600">verlab.find_niche</span>
              <CheckCircle2 className="h-3 w-3 shrink-0 text-emerald-500" strokeWidth={2.5} />
            </span>
            <p className="text-[12.5px] leading-relaxed text-body sm:text-[13px]">
              Found a strong opportunity: <span className="font-semibold text-heading">AI home workouts</span> — low
              competition, rising search volume.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {NICHE_STATS.map((label) => (
                <span
                  key={label}
                  className="rounded-full border border-hairline bg-app px-2 py-0.5 text-[10px] font-medium text-subtle"
                >
                  {label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-hairline px-4 py-3 sm:px-5">
        <div>
          <span className="block text-sm font-bold text-heading">Verlab MCP</span>
          <span className="block text-xs text-subtle">Bend any niche with Claude</span>
        </div>
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-blue-500 text-white transition-transform duration-200 group-hover:translate-x-0.5">
          <ArrowRight className="h-3.5 w-3.5" />
        </span>
      </div>
    </Link>
  );
}

export function FeaturesGridSection() {
  return (
    <section id="features" className="w-full pb-2 pt-10 sm:pb-3 sm:pt-16">
      <div className="mx-auto max-w-[1600px] px-6 md:px-12">
        <div className="flex flex-col items-center text-center">
          <h2 className="font-display text-[28px] font-bold tracking-tight text-heading sm:text-3xl md:text-5xl">
            Every AI tool, in one place.
          </h2>
          <p className="mt-4 max-w-xl text-base font-medium leading-snug text-slate-500 sm:mt-5 sm:text-lg">
            Generate videos, images, voiceovers, and scripts, all in one place.
          </p>
        </div>

        <div
          className={cn(
            "mt-8 -mx-6 flex snap-x snap-mandatory gap-4 overflow-x-auto overflow-y-hidden touch-pan-x px-3 pb-1 scroll-pl-3",
            "[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
            "sm:mx-0 sm:mt-10 sm:grid sm:grid-cols-3 sm:gap-5 sm:overflow-visible sm:px-0 sm:pb-0"
          )}
        >
          {HERO_TOOLS.map((tool) => (
            <div key={tool.title} className="h-full w-[78%] shrink-0 snap-start sm:w-auto sm:shrink">
              <HeroToolCard {...tool} />
            </div>
          ))}
        </div>

        <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-5">
          <div className="-mx-3 sm:mx-0 lg:col-span-2">
            <McpDemoCard />
          </div>
          <div className="-mx-3 grid grid-cols-2 gap-3 sm:mx-0 sm:grid-cols-3 sm:gap-4 lg:col-span-3">
            {TOOL_LOGOS.map((tool) => (
              <ToolLogoCard key={tool.title} {...tool} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
