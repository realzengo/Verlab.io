"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { Play } from "lucide-react";
import { ProtectedVideo } from "@/components/dashboard/ProtectedVideo";
import { cn } from "@/lib/utils";

/* The grey half of the sign-in page: a headline, three faceless shorts (two
 * cartoon explainers around an AI Video Generator clip), and the same "100k+"
 * social proof the landing hero carries. Auth routes are never themed, so the
 * colors are fixed light values. */

const EASE = [0.22, 1, 0.36, 1] as const;

const CLIPS = [
  {
    key: "school-college",
    video: "/videos/school-college.mp4",
    poster: "/videos/school-college-poster.jpg",
    views: "870K",
  },
  {
    key: "ai-video",
    video: "/videos/video-generator-showcase.mp4",
    poster: "/videos/video-generator-showcase-poster.jpg",
    views: "2.4M",
    featured: true,
  },
  {
    key: "misc",
    video: "/videos/misc.mp4",
    poster: "/videos/misc-poster.jpg",
    views: "1.3M",
  },
] as const;

const AVATARS = [
  "/reviewers/reviewer-02.jpeg",
  "/reviewers/reviewer-04.jpeg",
  "/reviewers/reviewer-07.jpeg",
  "/reviewers/reviewer-08.jpeg",
];

export function AuthShowcasePanel() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center px-10 py-14 text-center">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: EASE }}
      >
        <h2 className="text-balance text-[28px] font-bold leading-[1.1] tracking-[-0.03em] text-[#0f172a] xl:text-[32px]">
          Go viral without showing your face
        </h2>
        <p className="mt-3 text-balance text-[15px] text-[#5b6472] xl:text-base">
          Find the niche, write the script, make the video.
        </p>
      </motion.div>

      {/* Width is capped by the panel, a 600px ceiling, and the viewport
          height, so the tall middle clip never pushes the trust row off a
          short laptop screen. */}
      <div
        aria-hidden
        className="mt-10 grid grid-cols-[0.76fr_1fr_0.76fr] items-center gap-2.5 xl:mt-12 xl:gap-3"
        style={{ width: "min(100%, 600px, calc((100dvh - 330px) * 1.45))" }}
      >
        {CLIPS.map((clip, i) => {
          const featured = "featured" in clip && clip.featured;
          return (
            <motion.div
              key={clip.key}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.12 + (featured ? 0 : 0.1 + i * 0.04), ease: EASE }}
              className="relative"
            >
              <div
                className={cn(
                  "relative aspect-[9/16] overflow-hidden bg-zinc-200",
                  featured
                    ? "rounded-[18px] shadow-[0_28px_48px_-22px_rgba(15,23,42,0.45),0_8px_18px_-8px_rgba(15,23,42,0.18)]"
                    : "rounded-[14px] shadow-[0_18px_34px_-20px_rgba(15,23,42,0.4),0_4px_10px_-6px_rgba(15,23,42,0.12)]"
                )}
              >
                <ProtectedVideo
                  src={clip.video}
                  poster={clip.poster}
                  className="absolute inset-0 h-full w-full object-cover"
                />
                <div className="absolute inset-x-0 bottom-0 h-1/4 bg-gradient-to-t from-black/45 to-transparent" />
                <span
                  className={cn(
                    "absolute flex items-center gap-1 rounded-full border border-white/20 bg-black/60 font-semibold leading-none text-white backdrop-blur-sm",
                    featured
                      ? "bottom-2.5 left-2.5 px-2 py-1 text-[11px]"
                      : "bottom-2 left-2 px-1.5 py-[3px] text-[10px]"
                  )}
                >
                  <Play className="h-2.5 w-2.5 fill-white" strokeWidth={0} />
                  {featured ? `${clip.views} views` : clip.views}
                </span>
              </div>

            </motion.div>
          );
        })}
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.5, ease: EASE }}
        className="mt-10 flex items-center gap-3 xl:mt-12"
      >
        <div className="flex -space-x-2">
          {AVATARS.map((src) => (
            <Image
              key={src}
              src={src}
              alt=""
              width={64}
              height={64}
              className="h-8 w-8 rounded-full object-cover ring-2 ring-[#f5f5f6]"
            />
          ))}
        </div>
        <span className="text-[15px] font-medium tracking-[-0.01em] text-[#0f172a]">
          Trusted by 100k+ creators
        </span>
      </motion.div>
    </div>
  );
}
