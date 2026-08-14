"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { MeshGradient } from "@paper-design/shaders-react";
import { GradientOrb } from "@/components/auth/GradientOrb";
import { MeshDriftShader } from "@/components/auth/MeshDriftShader";
import { TubesBackground } from "@/components/auth/TubesBackground";
import { ProtectedVideo } from "@/components/dashboard/ProtectedVideo";

const ROTATE_MS = 7500;

// Each tool gets its own background effect. Most reuse the shared mesh
// shader with different hue/scale/warp; swap a tool's entry to a different
// component to give it a distinct effect.
const FEATURES = [
  {
    tab: "Finder",
    title: "Niche Finder",
    subtitle: "Discover non-competitive faceless niches, backed by real transcripts.",
    background: () => (
      <MeshGradient
        className="absolute inset-0 h-full w-full"
        distortion={0.8}
        swirl={0.1}
        offsetX={0}
        offsetY={0}
        scale={1}
        rotation={0}
        speed={1}
        colors={["hsl(216, 90%, 27%)", "hsl(243, 68%, 36%)", "hsl(205, 91%, 64%)", "hsl(211, 61%, 57%)"]}
      />
    ),
  },
  {
    tab: "Bending",
    title: "Niche Bending",
    subtitle: "Reinvent proven formats into fresh angles for your channel.",
    background: () => <MeshDriftShader className="absolute inset-0" />,
  },
  {
    tab: "Scripts",
    title: "AI Scripts",
    subtitle: "Generate ready-to-record scripts from any transcript in seconds.",
    background: () => <TubesBackground className="absolute inset-0" />,
  },
  {
    tab: "Voice",
    title: "AI Voiceovers",
    subtitle: "Turn scripts into natural voiceovers with one click.",
    background: () => (
      <GradientOrb
        className="absolute inset-x-0 -top-24 bottom-0"
        config={{ background: "#08080c" }}
      />
    ),
  },
  {
    tab: "Images",
    title: "AI Images",
    subtitle: "Generate scroll-stopping thumbnails and cover art in seconds.",
    background: () => (
      <Image
        src="/auth-showcase-images-v2.jpg"
        alt=""
        fill
        priority
        className="object-cover"
      />
    ),
  },
  {
    tab: "Video",
    title: "AI Video",
    subtitle: "Turn a script into a fully edited video in minutes.",
    background: () => (
      <ProtectedVideo
        src="/videos/video-generator-showcase.mp4"
        poster="/videos/video-generator-showcase-poster.jpg"
        className="absolute inset-0 h-full w-full object-cover"
      />
    ),
  },
];

export function AuthShowcasePanel() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % FEATURES.length);
    }, ROTATE_MS);
    return () => clearInterval(id);
  }, []);

  const feature = FEATURES[index];

  return (
    <div className="relative h-full w-full overflow-hidden rounded-2xl bg-[#08080c]">
      <AnimatePresence mode="sync">
        <motion.div
          key={feature.tab}
          className="absolute inset-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.8, ease: [0.45, 0, 0.15, 1] }}
        >
          {feature.background()}
        </motion.div>
      </AnimatePresence>

      {/* bottom scrim for legibility */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black to-transparent"
      />

      <Image
        src="/verlab-studio-logo-white.png"
        alt="Verlab Studio"
        width={1500}
        height={384}
        className="absolute left-2 top-4 h-10 w-auto mix-blend-difference xl:left-3 xl:top-5 xl:h-12"
        priority
      />

      <div className="relative flex h-full flex-col justify-end p-10 xl:p-14">
        <div>
          <AnimatePresence mode="wait">
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
            >
              <h3 className="text-[40px] font-extrabold uppercase leading-[1.05] tracking-tight text-white xl:text-[52px]">
                {feature.title}
              </h3>
              <p className="mt-3 max-w-md text-[15px] leading-relaxed text-white/60">
                {feature.subtitle}
              </p>
            </motion.div>
          </AnimatePresence>

          <div className="mt-9 inline-flex flex-wrap items-stretch gap-0.5 rounded-2xl border border-white/10 bg-white/[0.04] p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-md">
            {FEATURES.map((f, i) => (
              <motion.button
                key={f.tab}
                type="button"
                onClick={() => setIndex(i)}
                whileHover={{ scale: i === index ? 1 : 1.03 }}
                whileTap={{ scale: 0.97 }}
                className={`relative flex flex-col items-center gap-2 rounded-xl px-3.5 pb-2 pt-2.5 outline-none transition-colors duration-300 focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-black ${
                  i === index ? "text-white" : "text-white/40 hover:text-white/70"
                }`}
              >
                {i === index && (
                  <motion.span
                    layoutId="auth-showcase-tab-pill"
                    className="absolute inset-0 rounded-xl bg-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.16)]"
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  />
                )}
                <span className="relative z-10 text-[10.5px] font-bold uppercase tracking-wider">
                  {f.tab}
                </span>
                <span className="relative z-10 h-[2.5px] w-8 overflow-hidden rounded-full bg-white/10">
                  {i < index && <span className="block h-full w-full bg-white" />}
                  {i === index && (
                    <motion.span
                      key={index}
                      className="block h-full bg-gradient-to-r from-white/70 to-white shadow-[0_0_6px_1px_rgba(255,255,255,0.5)]"
                      initial={{ width: "0%" }}
                      animate={{ width: "100%" }}
                      transition={{ duration: ROTATE_MS / 1000, ease: "linear" }}
                    />
                  )}
                </span>
              </motion.button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
