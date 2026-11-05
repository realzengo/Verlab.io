"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, type ComponentType, type CSSProperties, type SVGProps } from "react";
import { ArrowRight, ArrowUpRight, AudioLines, PenLine } from "lucide-react";
import { button3d } from "@/components/landing/button3d";
import { ClaudeMarkIcon } from "@/components/landing/AssistantIcons";
import { KlingLogo } from "@/components/landing/ModelLogos";
import { VerifiedBadge } from "@/components/landing/VerifiedBadge";
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

interface FeatureCard {
  title: string;
  subtitle: string;
  href: string;
  badge?: string;
  logo?: string;
  icon?: ComponentType<SVGProps<SVGSVGElement> & { strokeWidth?: number }>;
  /** Keep the icon's own colors instead of flattening it to ink. */
  iconColor?: boolean;
}

const FEATURE_CARDS: FeatureCard[] = [
  {
    title: "Kling 4.0",
    subtitle: "Now available on Verlab",
    href: `${APP_URL}/video-generator`,
    badge: "New",
    icon: KlingLogo,
  },
  {
    title: "Create images",
    subtitle: "with Nano Banana Pro",
    href: `${APP_URL}/image-generator`,
    logo: "/logos/ai/google-color.svg",
  },
  {
    title: "Write scripts",
    subtitle: "with AI Script Writer",
    href: `${APP_URL}/scripts`,
    icon: PenLine,
  },
  {
    title: "Connect your agent",
    subtitle: "with Verlab MCP",
    href: `${APP_URL}/mcp`,
    icon: ClaudeMarkIcon,
    iconColor: true,
  },
  {
    title: "Create voiceovers",
    subtitle: "with Voice Studio",
    href: `${APP_URL}/voiceover-generator`,
    icon: AudioLines,
  },
  {
    title: "Create videos",
    subtitle: "with Seedance 2.5",
    href: `${APP_URL}/video-generator`,
    logo: "/logos/ai/seedance.webp",
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

function FeatureLinkCard({ title, subtitle, href, badge, logo, icon: Icon, iconColor }: FeatureCard) {
  return (
    <Link
      href={href}
      className="group relative flex min-h-[128px] flex-col justify-between overflow-hidden rounded-[18px] bg-[#F5F5F5] p-4 shadow-[inset_0_1px_0_0_#ffffff,inset_0_-1px_0_0_rgba(16,24,40,0.14)] transition-shadow duration-300 [transition-timing-function:cubic-bezier(0.19,1,0.22,1)] hover:shadow-[inset_0_1px_0_0_#ffffff,inset_0_-1px_0_0_rgba(16,24,40,0.2)] sm:min-h-[140px] sm:p-5"
    >
      <span className="relative flex h-6 w-6 items-center justify-center">
        {logo ? (
          <Image src={logo} alt="" width={24} height={24} className="h-6 w-6 object-contain brightness-0" />
        ) : Icon ? (
          <Icon className={cn("h-6 w-6", !iconColor && "text-[#0f172a]", !iconColor && Icon === KlingLogo && "brightness-0")} strokeWidth={2} />
        ) : null}
      </span>
      <span className="relative block">
        <span className="flex items-center gap-2">
          <span className="text-[15px] font-semibold tracking-[-0.01em] text-[#0f172a] sm:text-[17px]">{title}</span>
          {badge && (
            <span className="inline-flex -skew-x-12 items-center rounded-[4px] border border-[#8fa8ff] bg-[linear-gradient(155deg,#6d8dff_0%,#335cff_55%,#1c3fd6_100%)] px-1.5 py-[3px] shadow-[0_3px_8px_-3px_rgba(51,92,255,0.7),inset_0_1px_0_rgba(255,255,255,0.35)]">
              <span className="inline-block skew-x-12 text-[9.5px] font-extrabold italic uppercase leading-none tracking-wide text-white">
                {badge}
              </span>
            </span>
          )}
        </span>
        <span className="mt-1 block text-[12.5px] text-slate-500 sm:text-[13.5px]">{subtitle}</span>
      </span>
    </Link>
  );
}

// Character tiles for the studio card: neon CRT-tinted cartoon portraits set
// in chrome key-cap frames, tilted, inside a fixed 260x230 art box pinned to
// the card's bottom-right. CHROME is the frame's banded polished-metal face;
// KEYCAP stacks 1px offsets into a visible metal side wall, then a soft drop
// shadow onto the card.
const CHROME =
  "linear-gradient(145deg,#ffffff 0%,#d3d8e0 16%,#f8f9fb 32%,#a3abb8 52%,#eef0f4 70%,#bcc3ce 86%,#ffffff 100%)";
const KEYCAP = [
  "0 1px 0 #d5dae1",
  "0 2px 0 #c4cad3",
  "0 3px 0 #b3bac5",
  "0 4px 0 #a3abb7",
  "0 5px 0 #959eab",
  "0 6px 0 #8a93a1",
  "0 7px 1px #7d8796",
  "0 26px 34px -12px rgba(15,23,42,0.5)",
  "0 10px 16px -8px rgba(15,23,42,0.25)",
].join(",");
const STUDIO_TILES = [
  { src: "/landing/studio/hero-green.jpg", left: 26, top: 22, size: 117, rotate: -10 },
  { src: "/landing/studio/hero-red.jpg", left: 158, top: 68, size: 84, rotate: 9 },
  { src: "/landing/studio/hero-amber.jpg", left: 13, top: 151, size: 84, rotate: 11 },
  { src: "/landing/studio/hero-blue.jpg", left: 123, top: 161, size: 82, rotate: -4 },
];

// Studio card backdrop: a fine square grid that shows only around the
// character tiles (radial mask) over a soft blue glow, keeping the text side
// clean.
const STUDIO_GRID: CSSProperties = {
  backgroundImage:
    "linear-gradient(to right, rgba(15,23,42,0.07) 1px, transparent 1px), linear-gradient(to bottom, rgba(15,23,42,0.07) 1px, transparent 1px)",
  backgroundSize: "26px 26px",
  backgroundPosition: "-1px -1px",
  maskImage: "radial-gradient(75% 85% at 82% 72%, black 0%, rgba(0,0,0,0.5) 45%, transparent 75%)",
  WebkitMaskImage: "radial-gradient(75% 85% at 82% 72%, black 0%, rgba(0,0,0,0.5) 45%, transparent 75%)",
};

function StudioCard() {
  return (
    <Link
      href={APP_URL}
      className="group relative flex min-h-[292px] flex-col overflow-hidden rounded-[24px] border border-[#e4e7ee] bg-[linear-gradient(180deg,#ffffff_0%,#f8faff_100%)] p-6 sm:p-7"
    >
      <span aria-hidden className="pointer-events-none absolute inset-0" style={STUDIO_GRID} />
      <span
        aria-hidden
        className="pointer-events-none absolute -bottom-24 -right-16 h-[340px] w-[380px] rounded-full bg-[radial-gradient(closest-side,rgba(51,92,255,0.16),rgba(51,92,255,0.05)_60%,transparent)]"
      />

      <span className="relative font-display text-[26px] font-extrabold uppercase leading-none tracking-[-0.025em] text-[#0b1220] sm:text-[30px]">
        Verlab Studio
      </span>
      <span className="relative mt-3 max-w-[250px] text-[15px] leading-[1.35] text-slate-500 xl:max-w-[205px]">
        Find a winning niche, bend it, and post faceless videos audiences come back for.
      </span>

      {/* 3D pill: face glows lighter at the bottom centre, a thin bright rim
          along the top, and a solid darker lip underneath */}
      <span
        className="relative mt-auto inline-flex h-[42px] w-fit items-center gap-3 rounded-full px-[22px] text-[15px] font-semibold tracking-[-0.005em] text-white transition-transform duration-200 group-hover:-translate-y-0.5"
        style={button3d(3)}
      >
        Open Studio
        <ArrowUpRight className="h-4 w-4" strokeWidth={2.25} />
      </span>

      <span
        aria-hidden
        className="pointer-events-none absolute bottom-0 right-0 h-[230px] w-[260px] origin-bottom-right scale-[0.78] sm:scale-100 xl:scale-[0.85] min-[1440px]:scale-100"
      >
        {STUDIO_TILES.map((t) => (
          <span
            key={t.src}
            className="absolute rounded-[24px] p-[6px] transition-transform duration-500 [transition-timing-function:cubic-bezier(0.19,1,0.22,1)] group-hover:-translate-y-1"
            style={{ left: t.left, top: t.top, width: t.size, height: t.size, rotate: `${t.rotate}deg`, backgroundImage: CHROME, boxShadow: KEYCAP }}
          >
            {/* bevel: lit top edge, shaded bottom edge */}
            <span className="pointer-events-none absolute inset-0 rounded-[24px] shadow-[inset_0_1.5px_1px_rgba(255,255,255,0.95),inset_0_-2px_2px_rgba(15,23,42,0.28),inset_1px_0_1px_rgba(255,255,255,0.55)]" />
            <span className="relative block h-full w-full overflow-hidden rounded-[18px]">
              <Image src={t.src} alt="" fill sizes="240px" className="object-cover" />
              {/* a faint glass reflection and a recessed inner edge */}
              <span className="absolute inset-0 bg-[linear-gradient(150deg,rgba(255,255,255,0.2)_0%,rgba(255,255,255,0.04)_30%,transparent_45%)]" />
              <span className="absolute inset-0 rounded-[18px] shadow-[inset_0_2px_5px_rgba(0,0,0,0.45),inset_0_0_0_1px_rgba(15,23,42,0.4)]" />
            </span>
          </span>
        ))}
      </span>
    </Link>
  );
}

export function FeaturesGridSection() {
  return (
    <section id="features" className="w-full pb-2 pt-10 sm:pb-3 sm:pt-16">
      <div className="mx-auto max-w-[1600px] px-6 md:px-12">
        <div className="flex flex-col items-center text-center">
          <VerifiedBadge label="AI Tools" className="mb-5 sm:mb-6" />
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

        <div className="mt-5 grid grid-cols-1 gap-3.5 xl:grid-cols-[minmax(0,0.58fr)_minmax(0,1fr)]">
          <StudioCard />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-3.5">
            {FEATURE_CARDS.map((card) => (
              <FeatureLinkCard key={card.title} {...card} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
