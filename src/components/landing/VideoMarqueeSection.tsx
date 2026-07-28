import { Eye } from "lucide-react";
import { TikTokIcon, YouTubeIcon } from "@/components/landing/PlatformIcons";

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

  return (
    <div className="group shrink-0 rounded-[32px] bg-slate-100 p-2 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-black/5 transition-transform duration-500 ease-out hover:-translate-y-1.5">
      <div className="relative h-[334px] w-[184px] overflow-hidden rounded-[24px] bg-black shadow-[0_25px_50px_-12px_rgba(0,0,0,0.35)] md:h-[434px] md:w-[244px]">
        <video
          src={video.src}
          poster={video.poster}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          className="absolute inset-0 h-full w-full object-cover"
        />

        <div aria-hidden className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/45 to-transparent" />
        <div aria-hidden className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/55 to-transparent" />

        <div className="absolute left-1/2 top-3 flex -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-full bg-black/40 px-3 py-1.5 ring-1 ring-white/10 backdrop-blur-md">
          <Icon className="h-3.5 w-3.5 shrink-0 text-white" />
          <span className="text-[11px] font-semibold tracking-wide text-white">{PLATFORM_LABEL[video.platform]}</span>
        </div>

        <span className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-full bg-black/40 px-3 py-1.5 text-[10px] font-medium text-white ring-1 ring-white/10 backdrop-blur-md">
          <Eye className="h-3 w-3" />
          {video.views}
        </span>
      </div>
    </div>
  );
}

export function VideoMarqueeSection() {
  const track = [...VIDEOS, ...VIDEOS];

  return (
    <section className="relative w-full overflow-hidden bg-surface pb-10 pt-8 sm:pb-16 sm:pt-12">
      <div className="mb-5 flex flex-col items-center justify-center gap-2 sm:mb-8">
        <span className="text-center text-2xl font-light tracking-tight text-heading sm:text-4xl">
          Create Profitable <span className="font-black">Niches</span>
        </span>
        <svg aria-hidden width="16" height="16" viewBox="0 0 16 16" fill="none" className="mt-1 animate-bounce text-subtle sm:mt-2">
          <path d="M8 3v9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          <path d="M4 9L8 13L12 9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-1/2 z-0 h-[420px] -translate-y-1/2 bg-[radial-gradient(ellipse_60%_100%_at_50%_50%,var(--color-accent),transparent_70%)] opacity-70"
      />

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
