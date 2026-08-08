"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import { Eye } from "lucide-react";
import { TikTokIcon, YouTubeIcon } from "@/components/landing/PlatformIcons";
import { useAnimationGate } from "@/lib/hooks/useAnimationGate";

type Platform = "youtube" | "tiktok";

const PLATFORM_LABEL: Record<Platform, string> = {
  youtube: "YouTube",
  tiktok: "TikTok",
};

type MarqueeVideo = {
  src: string;
  poster: string;
  platform: Platform;
  views: string;
};

const PLATFORM_ICON: Record<Platform, typeof YouTubeIcon> = {
  youtube: YouTubeIcon,
  tiktok: TikTokIcon,
};

const VIDEOS: MarqueeVideo[] = [
  { src: "/videos/babe-ruth.mp4", poster: "/videos/babe-ruth-poster.jpg", platform: "youtube", views: "10.3M" },
  { src: "/videos/einstein.mp4", poster: "/videos/einstein-poster.jpg", platform: "tiktok", views: "7.1M" },
  { src: "/videos/cat.mp4", poster: "/videos/cat-poster.jpg", platform: "youtube", views: "14.8M" },
  { src: "/videos/school-college.mp4", poster: "/videos/school-college-poster.jpg", platform: "youtube", views: "5.6M" },
  { src: "/videos/braces.mp4", poster: "/videos/braces-poster.jpg", platform: "tiktok", views: "9.2M" },
  { src: "/videos/misc.mp4", poster: "/videos/misc-poster.jpg", platform: "tiktok", views: "8.4M" },
];

function VideoCard({ video }: { video: MarqueeVideo }) {
  const Icon = PLATFORM_ICON[video.platform];
  const videoRef = useRef<HTMLVideoElement>(null);

  // The track is an infinite marquee, so most of the 12 clips are off-screen
  // (or off the horizontal edge) at any given moment. Decoding all of them
  // continuously is the single biggest source of jank on this page, so only
  // the ones actually on screen are allowed to play.
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
      { threshold: 0 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="group shrink-0 rounded-[32px] bg-slate-100 p-2 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-black/5 transition-transform duration-500 ease-out hover:-translate-y-1.5">
      <div className="relative h-[334px] w-[184px] overflow-hidden rounded-[24px] bg-black shadow-[0_25px_50px_-12px_rgba(0,0,0,0.35)] md:h-[434px] md:w-[244px]">
        <video
          ref={videoRef}
          src={video.src}
          poster={video.poster}
          muted
          loop
          playsInline
          preload="metadata"
          className="absolute inset-0 h-full w-full object-cover"
        />

        <div aria-hidden className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/45 to-transparent" />
        <div aria-hidden className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/55 to-transparent" />

        <div className="absolute left-1/2 top-3 flex -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-full bg-black/65 px-3 py-1.5 ring-1 ring-white/10">
          <Icon className="h-3.5 w-3.5 shrink-0 text-white" />
          <span className="text-[11px] font-semibold tracking-wide text-white">{PLATFORM_LABEL[video.platform]}</span>
        </div>

        <span className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-full bg-black/65 px-3 py-1.5 text-[10px] font-medium text-white ring-1 ring-white/10">
          <Eye className="h-3 w-3" />
          {video.views}
        </span>
      </div>
    </div>
  );
}

export function VideoMarqueeSection() {
  const track = [...VIDEOS, ...VIDEOS];
  const { ref, inView } = useAnimationGate<HTMLElement>();

  return (
    <section
      id="niches-marquee"
      ref={ref}
      data-inview={inView}
      className="anim-gate relative w-full overflow-hidden bg-surface py-10 sm:py-16"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-1/2 z-0 h-[420px] -translate-y-1/2 bg-[radial-gradient(ellipse_60%_100%_at_50%_50%,var(--color-accent),transparent_70%)] opacity-70"
      />

      <div className="relative z-20 mb-2 pl-32 sm:mb-3 sm:pl-56">
        <Image
          src="/create-profitable-niches.png"
          alt="Create profitable niches"
          width={1500}
          height={384}
          sizes="(min-width: 640px) 250px, 180px"
          className="h-auto w-[180px] sm:w-[250px]"
          priority
        />
      </div>

      <div aria-hidden className="pointer-events-none absolute inset-y-0 left-0 z-10 w-32 bg-gradient-to-r from-surface to-transparent md:w-64" />
      <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 z-10 w-32 bg-gradient-to-l from-surface to-transparent md:w-64" />

      <div className="relative z-[1] flex w-max animate-marquee gap-5 md:gap-7">
        {track.map((video, i) => (
          <VideoCard key={i} video={video} />
        ))}
      </div>
    </section>
  );
}
