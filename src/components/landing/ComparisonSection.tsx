"use client";

import Image from "next/image";
import { ArrowRight, X } from "lucide-react";
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
      {tone === "red" ? (
        <span className="relative mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white text-slate-400 ring-1 ring-inset ring-slate-200 sm:h-6 sm:w-6">
          <X className="h-2.5 w-2.5 sm:h-3 sm:w-3" strokeWidth={2.5} />
        </span>
      ) : (
        <Image
          src="/icons/tick-blue-glass.svg"
          alt=""
          width={24}
          height={24}
          className="mt-0.5 h-5 w-5 shrink-0 sm:h-6 sm:w-6"
        />
      )}
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

/** Bordered-shell card: a thick tinted outer frame (matching the
 * VerlabProcess step cards) wrapping a true white inner panel. The Verlab
 * card gets a blue-tinted border and glow so it visibly attracts the eye
 * next to the neutral, muted Old Way card. */
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
      <div className="flex h-full flex-col rounded-[24px] border-[3px] border-[#EEF0F3] bg-white p-1 shadow-[0_1px_2px_rgba(15,23,42,0.03),0_14px_28px_-20px_rgba(15,23,42,0.14)] sm:rounded-[28px] sm:border-[4px]">
        <div className="relative flex h-full flex-col overflow-hidden rounded-[20px] bg-white p-3.5 sm:rounded-[24px] sm:p-12">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-56 sm:h-80"
            style={{
              backgroundImage: isRed
                ? "linear-gradient(to bottom, #c3cad4 0%, #d7dce3 28%, #eceef1 52%, #f9fafb 74%, #ffffff 90%)"
                : "linear-gradient(to bottom, #5b82f5 0%, #7a9df8 28%, #a4bffa 52%, #dde6fd 74%, #ffffff 90%)",
            }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-56 opacity-40 sm:h-80"
            style={{
              backgroundImage: "radial-gradient(rgba(15,23,42,0.45) 0.7px, transparent 1px)",
              backgroundSize: "6px 6px",
              WebkitMaskImage: "linear-gradient(to bottom, black 0%, black 20%, transparent 74%)",
              maskImage: "linear-gradient(to bottom, black 0%, black 20%, transparent 74%)",
            }}
          />

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

        <div className="mt-12 flex flex-col items-stretch gap-8 sm:mt-16 lg:flex-row lg:items-stretch lg:gap-10">
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
                  src="/verlab-studio-logo-outline-white.png"
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
