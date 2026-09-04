"use client";

import Image from "next/image";
import { ArrowRight, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { APP_URL } from "@/lib/constants";
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
        <span className="relative mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/10 text-slate-300 ring-1 ring-inset ring-white/15 sm:h-6 sm:w-6">
          <X className="h-2.5 w-2.5 sm:h-3 sm:w-3" strokeWidth={2.5} />
        </span>
      ) : (
        <span className="relative mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/40 text-primary ring-1 ring-inset ring-white/70 sm:h-6 sm:w-6">
          <Check className="h-3 w-3 sm:h-3.5 sm:w-3.5" strokeWidth={3} />
        </span>
      )}
      <span
        className={cn(
          "whitespace-nowrap text-[11.5px] leading-snug sm:whitespace-normal sm:text-[17px]",
          tone === "red" ? "text-slate-300" : "text-slate-700",
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
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage: isRed
                ? 'url("/old-way-card-bg.jpeg")'
                : 'url("/verlab-card-meadow-bg.jpeg")',
              backgroundSize: "cover",
              backgroundPosition: isRed ? "center 40%" : "center 30%",
              backgroundRepeat: "no-repeat",
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

          <div
            className={cn(
              "relative flex flex-1 flex-col rounded-2xl border p-3.5 shadow-[0_8px_30px_rgba(15,23,42,0.06)] sm:rounded-3xl sm:p-8",
              isRed ? "border-white/10 bg-slate-950/45 backdrop-blur-md" : "border-white/50 bg-white/25 backdrop-blur-xl",
            )}
          >
            <div className="flex items-center justify-center">
              <h3
                className={cn(
                  "font-display text-lg font-black uppercase tracking-tight sm:text-3xl",
                  isRed ? "text-slate-200" : "text-heading",
                )}
              >
                {title}
              </h3>
            </div>
            <div aria-hidden className={cn("mx-auto mt-3 mb-2 h-px w-full sm:mt-6", isRed ? "bg-white/15" : "bg-slate-200")} />

            <ul className="mt-4 flex flex-1 flex-col gap-3 sm:mt-9 sm:gap-6">
              {items.map((item) => (
                <ComparisonListItem key={item} tone={tone}>
                  {item}
                </ComparisonListItem>
              ))}
            </ul>

            <div className="mt-5 sm:mt-10">{cta}</div>
          </div>
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
                <span className="block w-full cursor-not-allowed select-none rounded-2xl border border-white/15 bg-white/10 py-3 text-center text-sm font-semibold text-slate-300 sm:py-4 sm:text-lg">
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
                <a
                  href={APP_URL}
                  className="group relative isolate flex w-full items-center justify-center overflow-hidden rounded-2xl bg-[radial-gradient(220%_220%_at_28%_18%,#6d9bff_0%,#335cff_65%,#1c3fd6_100%)] py-3 text-sm font-bold text-white shadow-[0_4px_0_0_#1a37c4,0_10px_24px_-8px_rgba(28,63,214,0.5),inset_0_1px_0_0_rgba(255,255,255,0.5),inset_0_-1px_0_0_rgba(0,0,0,0.25)] transition-[transform,box-shadow] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] hover:shadow-[0_4px_0_0_#1a37c4,0_12px_28px_-8px_rgba(28,63,214,0.55),inset_0_1px_0_0_rgba(255,255,255,0.6),inset_0_-1px_0_0_rgba(0,0,0,0.3)] active:translate-y-1 active:shadow-[0_0_0_0_#1a37c4,0_4px_10px_-6px_rgba(28,63,214,0.5),inset_0_1px_0_0_rgba(255,255,255,0.5),inset_0_-1px_0_0_rgba(0,0,0,0.25)] active:duration-100 sm:py-4 sm:text-lg"
                >
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-0 bg-[radial-gradient(140%_140%_at_50%_50%,#6d9bff_0%,#335cff_65%,#1c3fd6_100%)] opacity-0 transition-opacity duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:opacity-100"
                  />
                  <span className="relative flex items-center">
                    Join Verlab Now
                    <ArrowRight size={18} className="relative -mb-px ml-1 inline shrink-0" />
                  </span>
                </a>
              }
            />
          </Reveal>
        </div>
      </div>
    </section>
  );
}
