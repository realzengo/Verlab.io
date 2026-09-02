"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, type ComponentType, type SVGProps } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  CheckCircle2,
  Images,
  LayoutTemplate,
  PenSquare,
  Wand2,
} from "lucide-react";
import { ClaudeIcon, ClaudeMarkIcon } from "@/components/landing/AssistantIcons";
import { KlingLogo } from "@/components/landing/ModelLogos";
import { Reveal } from "@/components/ui/Reveal";
import { useAnimationGate } from "@/lib/hooks/useAnimationGate";
import { TOOL_TONE_CLASSES } from "@/lib/tone";
import type { ToolTone } from "@/lib/types";
import { cn } from "@/lib/utils";
import { APP_URL } from "@/lib/constants";

const MCP_USE_CASES: { label: string; icon: LucideIcon; tone: ToolTone }[] = [
  { label: "Hook Swap", icon: Wand2, tone: "blue" },
  { label: "Format Match", icon: LayoutTemplate, tone: "violet" },
  { label: "Script Bend", icon: PenSquare, tone: "rose" },
  { label: "Thumbnail Remix", icon: Images, tone: "orange" },
];

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
    title: "Downloader",
    description: "Download TikTok, Reels, and Shorts, watermark-free.",
    href: `${APP_URL}/downloads`,
    video: "/videos/downloader-marquee.mp4",
    poster: "/videos/downloader-marquee-poster.jpg",
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
      className="group relative flex h-full flex-col overflow-hidden rounded-card border border-[#E0E4F2] bg-surface shadow-card transition-all duration-200 sm:hover:-translate-y-0.5 sm:hover:shadow-card-hover"
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

/** Chat-reveal timeline, in ms per phase, driven by a single `phase` counter
 * that loops 0→8→0. Kept as JS state (rather than the file's usual infinite
 * CSS % keyframe) because the sequence needs a real cross-fade (typing dots
 * morphing into Claude's reply) and spring physics on each beat — much
 * easier to get right with framer-motion than hand-tuned keyframe percents.
 * Every block stays mounted for the whole cycle and is driven by opacity /
 * transform only, so the card's height never changes and it can't jostle
 * the grid row it shares with the tool-logo cards next to it. */
const MCP_PHASE_DURATIONS = [400, 650, 950, 750, 1650, 400, 750, 1900, 450] as const;

const SPRING_SNAPPY = { type: "spring", stiffness: 420, damping: 28 } as const;

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-0.5">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="h-1 w-1 rounded-full bg-slate-400"
          animate={{ y: [0, -3, 0], opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 0.9, repeat: Infinity, ease: "easeInOut", delay: i * 0.15 }}
        />
      ))}
    </span>
  );
}

function McpDemoCard() {
  const { ref, inView } = useAnimationGate<HTMLAnchorElement>();
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    if (!inView) return;
    const id = setTimeout(
      () => setPhase((p) => (p + 1) % MCP_PHASE_DURATIONS.length),
      MCP_PHASE_DURATIONS[phase]
    );
    return () => clearTimeout(id);
  }, [phase, inView]);

  const fading = phase === 0 || phase === 8;
  const userIn = phase >= 1;
  const typing = phase === 2;
  const replyIn = phase >= 3;
  const resultsIn = phase >= 4;
  const analyzing = phase >= 4 && phase < 5;
  const done = phase >= 5;
  const tilesIn = phase >= 6;

  return (
    <Link
      ref={ref}
      data-inview={inView}
      href={`${APP_URL}/mcp`}
      className="anim-gate group relative flex h-full min-h-[260px] flex-col overflow-hidden rounded-2xl border border-hairline bg-white sm:min-h-[300px]"
    >
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 sm:px-5 sm:py-3.5">
        <span className="text-sm font-bold text-heading sm:text-base">Verlab MCP</span>
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-slate-200 bg-white py-1 pl-3 pr-1 text-[10px] font-semibold text-slate-900 shadow-sm transition-transform duration-200 group-hover:translate-x-0.5 sm:text-xs">
          Try now
          <span className="grid h-4 w-4 place-items-center rounded-full bg-blue-500 text-white sm:h-5 sm:w-5">
            <ArrowRight className="h-2.5 w-2.5" />
          </span>
        </span>
      </div>

      <div className="flex items-center justify-between px-4 pt-2.5 text-[9px] font-medium text-slate-500 sm:px-5 sm:text-[11px]">
        <span className="inline-flex items-center gap-1">
          <span className="relative flex h-1.5 w-1.5 shrink-0">
            <span className="absolute inset-0 animate-ping rounded-full bg-blue-500/60" />
            <span className="relative h-1.5 w-1.5 rounded-full bg-blue-500" />
          </span>
          Verlab connected
        </span>
        <span className="inline-flex items-center gap-1">
          <ClaudeIcon className="h-2.5 w-2.5 shrink-0" />
          Powered by Claude
        </span>
      </div>

      <motion.div
        className="flex flex-1 flex-col justify-center gap-2 px-4 pb-4 pt-3 sm:px-5"
        animate={{ opacity: fading ? 0 : 1 }}
        transition={{ duration: phase === 1 ? 0.5 : 0.4, ease: "easeInOut" }}
      >
        <motion.div
          className="flex justify-end"
          animate={{ opacity: userIn ? 1 : 0, y: userIn ? 0 : 8, scale: userIn ? 1 : 0.92 }}
          transition={SPRING_SNAPPY}
        >
          <span className="inline-block max-w-[85%] truncate rounded-2xl rounded-br-md bg-blue-500 px-4 py-1.5 text-[9px] font-semibold text-white shadow-sm sm:text-[11px]">
            Show me what Verlab MCP can do
          </span>
        </motion.div>

        <motion.div
          className="flex items-start gap-1.5"
          animate={{ opacity: typing || replyIn ? 1 : 0, y: typing || replyIn ? 0 : 8 }}
          transition={SPRING_SNAPPY}
        >
          <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-orange-100 bg-[#FAF0EC] sm:h-5 sm:w-5">
            <ClaudeIcon className="h-2 w-2 shrink-0 sm:h-2.5 sm:w-2.5" />
          </span>

          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <div className="relative flex h-6 w-fit items-center overflow-hidden rounded-2xl rounded-bl-md bg-slate-100 px-3 sm:h-7">
              <AnimatePresence mode="wait" initial={false}>
                {typing ? (
                  <motion.span
                    key="typing"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                  >
                    <TypingDots />
                  </motion.span>
                ) : (
                  <motion.span
                    key="reply"
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="whitespace-nowrap text-[9px] font-medium text-slate-700 sm:text-[11px]"
                  >
                    Bending your niche with <span className="font-mono text-slate-500">bend_niche</span>&hellip;
                  </motion.span>
                )}
              </AnimatePresence>
            </div>

            <motion.div
              className="relative overflow-hidden rounded-lg border border-slate-100 bg-slate-50 p-2.5"
              animate={{ opacity: resultsIn ? 1 : 0, y: resultsIn ? 0 : 6, scale: resultsIn ? 1 : 0.97 }}
              transition={{ type: "spring", stiffness: 380, damping: 30 }}
            >
              <div className="flex items-center justify-between text-[8px] font-medium text-slate-400 sm:text-[10px]">
                <span className="inline-flex min-w-0 items-center gap-1 truncate">
                  <span className="h-1 w-1 shrink-0 rounded-full bg-blue-500" />
                  <span className="truncate">
                    Verlab <span className="font-mono text-slate-500">bend_niche</span> Top use cases
                  </span>
                </span>
                <span className="relative inline-flex h-3.5 shrink-0 items-center">
                  <AnimatePresence mode="wait" initial={false}>
                    {!done ? (
                      <motion.span
                        key="analyzing"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="whitespace-nowrap"
                      >
                        Analyzing&hellip;
                      </motion.span>
                    ) : (
                      <motion.span
                        key="done"
                        initial={{ opacity: 0, scale: 0.6 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ type: "spring", stiffness: 500, damping: 20 }}
                        className="inline-flex items-center gap-0.5 whitespace-nowrap font-semibold text-emerald-600"
                      >
                        <CheckCircle2 className="h-2.5 w-2.5" strokeWidth={2.5} />
                        Done
                      </motion.span>
                    )}
                  </AnimatePresence>
                </span>
              </div>

              <div className="relative mt-1.5 h-1 w-full overflow-hidden rounded-full bg-slate-200">
                <motion.div
                  className="absolute inset-y-0 left-0 w-full origin-left rounded-full bg-blue-500"
                  animate={{ scaleX: resultsIn ? 1 : 0 }}
                  transition={{ duration: resultsIn ? 1.5 : 0, ease: [0.16, 1, 0.3, 1] }}
                />
                <AnimatePresence>
                  {analyzing && (
                    <motion.span
                      key="shine"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="animate-shimmer-sweep absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/70 to-transparent"
                    />
                  )}
                </AnimatePresence>
              </div>

              <div className="mt-2.5 grid grid-cols-4 gap-1.5 sm:gap-2">
                {MCP_USE_CASES.map(({ label, icon: Icon, tone }, i) => (
                  <motion.div
                    key={label}
                    className="flex flex-col items-center gap-1 rounded-md bg-white p-1.5 text-center shadow-sm sm:p-2"
                    animate={{ opacity: tilesIn ? 1 : 0, y: tilesIn ? 0 : 8, scale: tilesIn ? 1 : 0.85 }}
                    transition={{ type: "spring", stiffness: 420, damping: 24, delay: tilesIn ? i * 0.08 : 0 }}
                  >
                    <span
                      className={cn(
                        "flex h-5 w-5 items-center justify-center rounded-md sm:h-6 sm:w-6",
                        TOOL_TONE_CLASSES[tone]
                      )}
                    >
                      <Icon className="h-3 w-3" strokeWidth={2} />
                    </span>
                    <span className="w-full truncate text-[7px] font-medium text-slate-600 sm:text-[8px]">
                      {label}
                    </span>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>
        </motion.div>
      </motion.div>
    </Link>
  );
}

export function FeaturesGridSection() {
  return (
    <section id="features" className="w-full pb-2 pt-10 sm:pb-3 sm:pt-16">
      <div className="mx-auto max-w-[1600px] px-6 md:px-12">
        <Reveal className="flex flex-col items-center text-center">
          <h2 className="font-display text-[28px] font-bold tracking-tight text-heading sm:text-3xl md:text-5xl">
            Every AI tool, in one place.
          </h2>
          <p className="mt-4 max-w-xl text-base font-medium leading-snug text-slate-500 sm:mt-5 sm:text-lg">
            Generate videos, images, voiceovers, and scripts, all in one place.
          </p>
        </Reveal>

        <div
          className={cn(
            "mt-8 -mx-6 flex snap-x snap-mandatory gap-4 overflow-x-auto overflow-y-hidden touch-pan-x px-3 pb-1 scroll-pl-3",
            "[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
            "sm:mx-0 sm:mt-10 sm:grid sm:grid-cols-3 sm:gap-5 sm:overflow-visible sm:px-0 sm:pb-0"
          )}
        >
          {HERO_TOOLS.map((tool, i) => (
            <Reveal key={tool.title} delay={i * 90} className="h-full w-[78%] shrink-0 snap-start sm:w-auto sm:shrink">
              <HeroToolCard {...tool} />
            </Reveal>
          ))}
        </div>

        <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-5">
          <Reveal className="-mx-3 sm:mx-0 lg:col-span-2">
            <McpDemoCard />
          </Reveal>
          <div className="-mx-3 grid grid-cols-2 gap-3 sm:mx-0 sm:grid-cols-3 sm:gap-4 lg:col-span-3">
            {TOOL_LOGOS.map((tool, i) => (
              <Reveal key={tool.title} delay={i * 60}>
                <ToolLogoCard {...tool} />
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
