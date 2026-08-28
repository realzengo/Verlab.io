"use client";

import { useState } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Check, Clapperboard, Download, Image as ImageIcon, Wand2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ToolTone } from "./ToolGridCard";

export interface OnboardingSteps {
  download: boolean;
  image: boolean;
  niche: boolean;
  video: boolean;
}

// Same static tone->class mapping as ToolGridCard (Tailwind needs the full
// class names statically, so this can't be built with `${}`).
const TONE_CLASSES: Record<ToolTone, { chip: string; icon: string }> = {
  "cat-1": { chip: "bg-cat-1-tint", icon: "text-cat-1" },
  "cat-2": { chip: "bg-cat-2-tint", icon: "text-cat-2" },
  "cat-3": { chip: "bg-cat-3-tint", icon: "text-cat-3" },
  "cat-4": { chip: "bg-cat-4-tint", icon: "text-cat-4" },
  "cat-5": { chip: "bg-cat-5-tint", icon: "text-cat-5" },
  "cat-6": { chip: "bg-cat-6-tint", icon: "text-cat-6" },
  "cat-7": { chip: "bg-cat-7-tint", icon: "text-cat-7" },
};

const STEPS: { key: keyof OnboardingSteps; title: string; description: string; href: string; cta: string; icon: LucideIcon; tone: ToolTone }[] = [
  {
    key: "download",
    title: "Download a video",
    description: "Save any TikTok, Reels, or Shorts video without the watermark.",
    href: "/downloads",
    cta: "Download",
    icon: Download,
    tone: "cat-1",
  },
  {
    key: "image",
    title: "Generate an AI image",
    description: "Create a scroll-stopping thumbnail or cover image.",
    href: "/image-generator",
    cta: "Generate",
    icon: ImageIcon,
    tone: "cat-3",
  },
  {
    key: "niche",
    title: "Bend a niche",
    description: "Steal a winning video structure and swap in your own topic.",
    href: "/bend",
    cta: "Bend a niche",
    icon: Wand2,
    tone: "cat-7",
  },
  {
    key: "video",
    title: "Generate an AI video",
    description: "Create a watermark-free video from a text prompt or image.",
    href: "/video-generator",
    cta: "Generate",
    icon: Clapperboard,
    tone: "cat-4",
  },
];

export function OnboardingChecklist({ dismissed, steps }: { dismissed: boolean; steps: OnboardingSteps }) {
  const completedCount = STEPS.filter((step) => steps[step.key]).length;
  const [visible, setVisible] = useState(!dismissed && completedCount < STEPS.length);

  if (!visible) return null;

  function dismiss() {
    setVisible(false);
    fetch("/api/onboarding/dismiss", { method: "POST" }).catch(() => {
      // Best-effort -- the card stays hidden for this session even if the
      // write fails, and a retry next load is harmless.
    });
  }

  return (
    <div className="relative mx-auto mb-8 w-full max-w-2xl rounded-card border border-hairline bg-surface p-5 sm:p-6">
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss checklist"
        className="absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-full text-subtle transition-colors hover:bg-accent hover:text-heading"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="mb-4 pr-8">
        <h2 className="text-sm font-semibold text-heading">Get started with Verlab</h2>
        <p className="mt-0.5 text-xs text-subtle">
          {completedCount} of {STEPS.length} done — try each tool to see what it can do.
        </p>
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-accent">
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-500 ease-out"
            style={{ width: `${(completedCount / STEPS.length) * 100}%` }}
          />
        </div>
      </div>

      <ul className="flex flex-col gap-1">
        {STEPS.map((step) => {
          const done = steps[step.key];
          const tone = TONE_CLASSES[step.tone];
          return (
            <li key={step.key} className="flex items-center gap-3 rounded-chip px-1.5 py-2">
              <div
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-chip transition-colors",
                  done ? "bg-primary" : tone.chip
                )}
              >
                {done ? <Check className="h-4 w-4 text-white" /> : <step.icon className={cn("h-4 w-4", tone.icon)} strokeWidth={1.6} />}
              </div>
              <div className="min-w-0 flex-1">
                <p className={cn("text-sm font-medium", done ? "text-subtle line-through" : "text-heading")}>{step.title}</p>
                <p className="truncate text-xs text-subtle">{step.description}</p>
              </div>
              {!done && (
                <Link
                  href={step.href}
                  className="shrink-0 rounded-full border border-hairline px-3 py-1.5 text-xs font-semibold text-heading transition-colors hover:bg-accent"
                >
                  {step.cta}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
