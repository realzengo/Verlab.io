"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { ProtectedVideo } from "@/components/dashboard/ProtectedVideo";

interface FeaturedTool {
  title: string;
  caption: string;
  href: string;
  video: string;
  videoPoster: string;
  videoDark: string;
  videoPosterDark: string;
  videoScale?: number;
}

const FEATURED: FeaturedTool[] = [
  {
    title: "AI Video Generator",
    caption: "Watermark-free, from a prompt or image",
    href: "/video-generator",
    video: "/videos/video-generator.mp4",
    videoPoster: "/videos/video-generator-poster.jpg",
    videoDark: "/videos/video-generator-dark.mp4",
    videoPosterDark: "/videos/video-generator-dark-poster.jpg",
    videoScale: 1.1,
  },
  {
    title: "AI Image Generator",
    caption: "Scroll-stopping thumbnails and cover art",
    href: "/image-generator",
    video: "/videos/image-generator.mp4",
    videoPoster: "/videos/image-generator-poster.jpg",
    videoDark: "/videos/image-generator-dark.mp4",
    videoPosterDark: "/videos/image-generator-dark-poster.jpg",
  },
  {
    title: "Niche Bender",
    caption: "Steal the format, swap the topic",
    href: "/bend",
    video: "/videos/niche-bender.mp4",
    videoPoster: "/videos/niche-bender-poster.jpg",
    videoDark: "/videos/niche-bender-dark.mp4",
    videoPosterDark: "/videos/niche-bender-dark-poster.jpg",
  },
];

export function CreativeToolsSection() {
  return (
    <section>
      <h2 className="mb-5 text-xl font-bold tracking-tight text-heading">Creative tools</h2>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURED.map((tool) => (
          <Link key={tool.title} href={tool.href} className="group flex flex-col">
            <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-accent shadow-card">
              <ProtectedVideo
                src={tool.video}
                srcDark={tool.videoDark}
                poster={tool.videoPoster}
                posterDark={tool.videoPosterDark}
                className="h-full w-full object-cover transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.03]"
                style={tool.videoScale && tool.videoScale !== 1 ? { transform: `scale(${tool.videoScale})` } : undefined}
              />
            </div>
            <span className="mt-3 inline-flex w-fit items-center gap-0.5 text-base font-bold text-heading transition-colors group-hover:text-primary">
              {tool.title}
              <ChevronRight className="h-4 w-4" />
            </span>
            <p className="mt-0.5 text-sm text-subtle">{tool.caption}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
