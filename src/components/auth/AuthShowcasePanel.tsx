"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { MeshGradient } from "@paper-design/shaders-react";
import { GradientOrb } from "@/components/auth/GradientOrb";
import { MeshDriftShader } from "@/components/auth/MeshDriftShader";
import { TubesBackground } from "@/components/auth/TubesBackground";
import { WavesShader } from "@/components/auth/WavesShader";
import { RippleLinesShader } from "@/components/auth/RippleLinesShader";

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
    background: () => <WavesShader className="absolute inset-0" />,
  },
  {
    tab: "Video",
    title: "AI Video",
    subtitle: "Turn a script into a fully edited video in minutes.",
    background: () => <RippleLinesShader className="absolute inset-0" />,
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
    <div className="relative h-full w-full overflow-hidden rounded-xl bg-[#08080c]">
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

          <div className="mt-10">
            <div className="flex gap-2">
              {FEATURES.map((f, i) => (
                <div
                  key={f.tab}
                  className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/15"
                >
                  {i < index && <div className="h-full w-full bg-white" />}
                  {i === index && (
                    <motion.div
                      key={index}
                      className="h-full bg-white"
                      initial={{ width: "0%" }}
                      animate={{ width: "100%" }}
                      transition={{ duration: ROTATE_MS / 1000, ease: "linear" }}
                    />
                  )}
                </div>
              ))}
            </div>

            <div className="mt-3 flex gap-6">
              {FEATURES.map((f, i) => (
                <button
                  key={f.tab}
                  type="button"
                  onClick={() => setIndex(i)}
                  className={`text-[11px] font-semibold uppercase tracking-wide transition-colors ${
                    i === index ? "text-white" : "text-white/35 hover:text-white/60"
                  }`}
                >
                  {f.tab}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
