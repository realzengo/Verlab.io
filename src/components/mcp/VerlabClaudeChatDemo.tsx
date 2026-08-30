"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Captions,
  Compass,
  Download,
  Image as ImageIcon,
  PenLine,
  type LucideIcon,
  UserSearch,
} from "lucide-react";
import { ClaudeIcon } from "@/components/landing/AssistantIcons";
import { cn } from "@/lib/utils";

type Tone = "cat-1" | "cat-2" | "cat-3" | "cat-4" | "cat-5" | "cat-6" | "cat-7";

const TONE_ICON: Record<Tone, string> = {
  "cat-1": "text-cat-1",
  "cat-2": "text-cat-2",
  "cat-3": "text-cat-3",
  "cat-4": "text-cat-4",
  "cat-5": "text-cat-5",
  "cat-6": "text-cat-6",
  "cat-7": "text-cat-7",
};

const TONE_CHIP: Record<Tone, string> = {
  "cat-1": "bg-cat-1-tint",
  "cat-2": "bg-cat-2-tint",
  "cat-3": "bg-cat-3-tint",
  "cat-4": "bg-cat-4-tint",
  "cat-5": "bg-cat-5-tint",
  "cat-6": "bg-cat-6-tint",
  "cat-7": "bg-cat-7-tint",
};

interface Scenario {
  prompt: string;
  tool: string;
  params: string[];
  resultTitle: string;
  resultFile: string;
  resultMeta: string;
  icon: LucideIcon;
  tone: Tone;
}

const SCENARIOS: Scenario[] = [
  {
    prompt: "Find me a faceless YouTube niche with low competition and high RPM.",
    tool: "find_niche",
    params: ["Faceless", "Low competition", "High RPM"],
    resultTitle: "Niche is ready",
    resultFile: "stoic-philosophy.md",
    resultMeta: "$18 RPM",
    icon: Compass,
    tone: "cat-7",
  },
  {
    prompt: "Write a 60 second script about a viral TikTok cooking hack.",
    tool: "generate_script",
    params: ["Cooking hack", "60s", "Hook-driven"],
    resultTitle: "Script is ready",
    resultFile: "cooking-hack.txt",
    resultMeta: "60s",
    icon: PenLine,
    tone: "cat-6",
  },
  {
    prompt: "Break down @mrbeast's content strategy for me.",
    tool: "analyze_creator",
    params: ["@mrbeast", "24 videos", "Full report"],
    resultTitle: "Analysis is ready",
    resultFile: "mrbeast-report.docx",
    resultMeta: "24 videos",
    icon: UserSearch,
    tone: "cat-2",
  },
  {
    prompt: "Grab the transcript from this TikTok video.",
    tool: "extract_transcript",
    params: ["TikTok", "Timestamped", "38 lines"],
    resultTitle: "Transcript is ready",
    resultFile: "transcript.srt",
    resultMeta: "38 lines",
    icon: Captions,
    tone: "cat-5",
  },
  {
    prompt: "Download this Reel with no watermark.",
    tool: "download_video",
    params: ["Reel", "1080p", "No watermark"],
    resultTitle: "Video is ready",
    resultFile: "reel-download.mp4",
    resultMeta: "1080p",
    icon: Download,
    tone: "cat-1",
  },
  {
    prompt: "Generate a thumbnail of a shocked man pointing at a chart.",
    tool: "generate_image",
    params: ["Shocked man", "1024×1024", "4 variations"],
    resultTitle: "Image is ready",
    resultFile: "thumbnail.png",
    resultMeta: "4 variations",
    icon: ImageIcon,
    tone: "cat-3",
  },
];

const STEP_DURATION_MS = 5600;
const EASE = [0.16, 1, 0.3, 1] as const;

type Stage = "typing" | "running" | "done";

export function VerlabClaudeChatDemo({ className }: { className?: string }) {
  const [index, setIndex] = useState(0);
  const [stage, setStage] = useState<Stage>("typing");
  const [stageResetIndex, setStageResetIndex] = useState(index);

  if (index !== stageResetIndex) {
    setStageResetIndex(index);
    setStage("typing");
  }

  const scenario = SCENARIOS[index];

  useEffect(() => {
    const timers = [
      setTimeout(() => setStage("running"), 700),
      setTimeout(() => setStage("done"), 2600),
    ];
    const advance = setTimeout(() => {
      setIndex((i) => (i + 1) % SCENARIOS.length);
    }, STEP_DURATION_MS);

    return () => {
      timers.forEach(clearTimeout);
      clearTimeout(advance);
    };
  }, [index]);

  const showTool = stage === "running" || stage === "done";
  const isDone = stage === "done";
  const Icon = scenario.icon;

  return (
    <div className={cn("relative", className)}>
      <div className="overflow-hidden rounded-[24px] border border-black/[0.06] bg-white sm:rounded-[28px] dark:border-white/[0.08] dark:bg-zinc-950">
        <div className="flex items-center justify-between border-b border-black/[0.06] px-6 py-4 sm:px-10 dark:border-white/[0.08]">
          <div className="flex items-center gap-1.5">
            <ClaudeIcon className="h-4 w-4 rounded-[4px]" />
            <span className="text-sm font-semibold tracking-tight text-slate-900 dark:text-white">Claude</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
            </span>
            <span className="text-[13px] font-medium text-slate-500 dark:text-slate-400">Verlab connected</span>
          </div>
        </div>

        <div className="min-h-[340px] bg-slate-50 px-6 py-6 sm:min-h-[400px] sm:px-10 sm:py-8 dark:bg-white/[0.02]">
          <AnimatePresence mode="wait">
            <motion.div
              key={index}
              layout
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.45, ease: EASE }}
              className="flex flex-col gap-4"
            >
              <div className="flex justify-end">
                <motion.div
                  initial={{ opacity: 0, scale: 0.6, y: 14 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ type: "spring", stiffness: 480, damping: 32, mass: 0.6 }}
                  style={{ transformOrigin: "bottom right" }}
                  className="max-w-[75%] rounded-[20px] rounded-br-[6px] bg-btn-primary px-4 py-2.5 text-sm leading-relaxed text-white shadow-[0_1px_2px_rgba(51,92,255,0.15),0_6px_16px_-6px_rgba(51,92,255,0.45)] sm:text-[15px]"
                >
                  {scenario.prompt}
                  {stage === "typing" && (
                    <motion.span
                      aria-hidden
                      animate={{ opacity: [1, 0] }}
                      transition={{ duration: 0.6, repeat: Infinity, repeatType: "reverse" }}
                      className="ml-0.5 inline-block h-[1em] w-[2px] translate-y-[2px] bg-white align-middle"
                    />
                  )}
                </motion.div>
              </div>

              <AnimatePresence>
                {showTool && (
                  <motion.div
                    layout
                    initial={{ opacity: 0, y: 10, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.4, ease: EASE }}
                    className="rounded-2xl border border-black/[0.06] bg-white px-4 py-4 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_20px_-12px_rgba(15,23,42,0.12)] dark:border-white/[0.08] dark:bg-white/[0.03]"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2 text-[13px]">
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                        <span className="shrink-0 text-slate-500 dark:text-slate-400">Verlab</span>
                        <span className="truncate font-mono text-[13px] font-semibold text-heading">
                          {scenario.tool}
                        </span>
                      </div>
                      <span
                        className={cn(
                          "shrink-0 text-[13px] font-medium",
                          isDone ? "text-emerald-600 dark:text-emerald-400" : "text-primary"
                        )}
                      >
                        {isDone ? "Done" : "Running"}
                      </span>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {scenario.params.map((param) => (
                        <span
                          key={param}
                          className="rounded-full border border-black/[0.08] bg-white px-3 py-1 text-[13px] text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
                        >
                          {param}
                        </span>
                      ))}
                    </div>

                    <div className="mt-3.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-white/10">
                      <motion.div
                        className="h-full rounded-full bg-primary"
                        initial={{ width: "4%" }}
                        animate={{ width: isDone ? "100%" : "88%" }}
                        transition={{ duration: isDone ? 0.3 : 1.7, ease: EASE }}
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence>
                {isDone && (
                  <motion.div
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.4, ease: EASE }}
                    className="flex items-center gap-3.5 rounded-2xl bg-white px-4 py-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_20px_-12px_rgba(15,23,42,0.12)] dark:bg-white/[0.03]"
                  >
                    <span
                      className={cn(
                        "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl",
                        TONE_CHIP[scenario.tone]
                      )}
                    >
                      <Icon className={cn("h-5 w-5", TONE_ICON[scenario.tone])} />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-[15px] font-semibold tracking-tight text-heading">
                        {scenario.resultTitle}
                      </p>
                      <p className="truncate text-[13px] text-subtle">
                        {scenario.resultFile} · {scenario.resultMeta}
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-center gap-1.5">
        {SCENARIOS.map((s, i) => (
          <span
            key={s.tool}
            className={cn(
              "h-1.5 rounded-full transition-all duration-300",
              i === index ? "w-4 bg-primary" : "w-1.5 bg-slate-200 dark:bg-white/15"
            )}
          />
        ))}
      </div>
    </div>
  );
}
