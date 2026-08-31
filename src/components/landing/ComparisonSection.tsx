"use client";

import Image from "next/image";
import { ArrowRight, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { APP_URL } from "@/lib/constants";
import { GlassCtaButton } from "@/components/landing/GlassCtaButton";
import { Reveal } from "@/components/ui/Reveal";

const OLD_WAY_ITEMS = [
  "Guessing viral trends in saturated markets",
  "Staring at a blank timeline for hours",
  "Manually typing out video transcripts",
  "Paying for 5 different AI and scraping tools",
  "Publishing without a proven structure",
];

const VERLAB_WAY_ITEMS = [
  "Discover non-competitive faceless niches instantly",
  "'Bend' proven viral structures to your topic",
  "Extract clean, timestamped transcripts in 1 click",
  "All-in-one: Prompts, Scripts, AI Images & Video",
  "Ship a proven, repeatable system every morning",
];

function ComparisonListItem({ children, tone }: { children: React.ReactNode; tone: "red" | "blue" }) {
  return (
    <li className="flex items-start gap-2 sm:gap-3">
      <span
        className={cn(
          "relative mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full sm:h-6 sm:w-6",
          tone === "red"
            ? "bg-red-50 text-red-400"
            : "bg-[linear-gradient(155deg,#6d8dff_0%,#335cff_55%,#1c3fd6_100%)] shadow-[0_2px_6px_rgba(51,92,255,0.45),0_0_0_1px_rgba(51,92,255,0.2)]",
        )}
      >
        {tone === "blue" && (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-1/2 rounded-t-full bg-gradient-to-b from-white/50 to-transparent"
          />
        )}
        {tone === "red" ? (
          <X className="h-3 w-3 sm:h-3.5 sm:w-3.5" strokeWidth={3} />
        ) : (
          <Check className="relative h-3 w-3 text-white drop-shadow-[0_1px_0.5px_rgba(15,23,42,0.15)] sm:h-3.5 sm:w-3.5" strokeWidth={3.25} />
        )}
      </span>
      <span
        className={cn(
          "whitespace-nowrap text-[11.5px] leading-snug sm:whitespace-normal sm:text-[17px]",
          tone === "red" ? "text-slate-400" : "text-slate-700",
        )}
      >
        {children}
      </span>
    </li>
  );
}

/** Layered "device bezel" card shape: a tinted outer frame with an inset
 * top highlight, holding a true white card inside. The Verlab card gets a
 * brighter blue bezel plus a soft ambient glow so it visibly attracts the
 * eye next to the neutral, muted Old Way card. */
function ComparisonCard({
  tone,
  title,
  items,
  cta,
}: {
  tone: "red" | "blue";
  title: React.ReactNode;
  items: string[];
  cta: React.ReactNode;
}) {
  const isRed = tone === "red";
  return (
    <div className="relative flex flex-1 flex-col">
      <div
        className={cn(
          "relative flex h-full flex-col rounded-[36px] p-2 sm:p-3.5",
          isRed
            ? "bg-gradient-to-b from-slate-100 to-slate-200/70 shadow-[0_24px_50px_-24px_rgba(15,23,42,0.28),0_10px_20px_-12px_rgba(15,23,42,0.18),0_0_0_1px_rgba(255,255,255,0.5)_inset] lg:rotate-y-6"
            : "bg-gradient-to-b from-blue-100 to-blue-200/80 shadow-[0_34px_80px_-22px_rgba(37,99,235,0.45),0_14px_28px_-14px_rgba(37,99,235,0.3),0_0_0_1px_rgba(255,255,255,0.6)_inset] lg:-rotate-y-6",
        )}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-[1px] rounded-[33px] bg-gradient-to-b from-white/70 to-transparent"
          style={{ height: "50%" }}
        />

        <div className="relative flex h-full flex-col overflow-hidden rounded-[28px] bg-white p-3.5 shadow-[0_2px_8px_rgba(15,23,42,0.06),0_0_0_1px_rgba(15,23,42,0.04)] sm:p-12">
          <div className="relative flex items-center justify-center">
            <h3
              className={cn(
                "font-display text-lg font-black uppercase tracking-tight sm:text-3xl",
                isRed ? "text-slate-500" : "text-heading",
              )}
            >
              {title}
            </h3>
          </div>
          <div aria-hidden className="relative mx-auto mt-3 mb-2 h-px w-full bg-slate-200 sm:mt-6" />

          <ul className="relative mt-4 flex flex-1 flex-col gap-3 sm:mt-9 sm:gap-6">
            {items.map((item) => (
              <ComparisonListItem key={item} tone={tone}>
                {item}
              </ComparisonListItem>
            ))}
          </ul>

          <div className="relative mt-5 sm:mt-10">{cta}</div>
        </div>
      </div>
    </div>
  );
}

export function ComparisonSection() {
  return (
    <section className="relative w-full overflow-hidden bg-[#F8F9FC] py-24 sm:py-32">
      <div className="relative mx-auto max-w-[88rem] px-4 sm:px-6">
        <Reveal className="text-center">
          <h2 className="font-display text-[28px] font-bold tracking-tight text-heading sm:text-3xl md:text-5xl">
            Before <span className="text-heading">vs</span> After Verlab
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-base font-normal text-subtle sm:mt-4 sm:text-lg">
            Verlab doesn&apos;t replace you. It multiplies you.
          </p>
        </Reveal>

        <div className="mt-12 flex flex-col items-stretch gap-8 sm:mt-16 lg:flex-row lg:items-stretch lg:gap-10 lg:perspective-[2200px]">
          <Reveal className="flex flex-1 flex-col">
            <ComparisonCard
              tone="red"
              title="The Old Way"
              items={OLD_WAY_ITEMS}
              cta={
                <span className="block w-full cursor-not-allowed select-none rounded-full bg-slate-100 py-3 text-center text-sm font-semibold text-slate-400 sm:py-4 sm:text-lg">
                  Stay Stuck
                </span>
              }
            />
          </Reveal>

          <Reveal delay={150} className="flex flex-1 flex-col">
            <ComparisonCard
              tone="blue"
              title={
                <Image
                  src="/verlab-studio-logo-hires.png"
                  alt="Verlab Studio"
                  width={1600}
                  height={474}
                  className="h-9 w-auto sm:h-12"
                />
              }
              items={VERLAB_WAY_ITEMS}
              cta={
                <GlassCtaButton
                  href={APP_URL}
                  radius={999}
                  className="w-full! justify-center py-3! text-sm! font-semibold! sm:py-4! sm:text-lg!"
                >
                  Join Verlab Now
                  <ArrowRight size={18} className="relative -mb-px ml-1 inline shrink-0" />
                </GlassCtaButton>
              }
            />
          </Reveal>
        </div>
      </div>
    </section>
  );
}
