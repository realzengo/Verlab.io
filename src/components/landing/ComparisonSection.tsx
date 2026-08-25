"use client";

import { cn } from "@/lib/utils";
import { useAnimationGate } from "@/lib/hooks/useAnimationGate";
import { APP_URL } from "@/lib/constants";
import { GlassCtaButton } from "@/components/landing/GlassCtaButton";

const OTHER_TOOLS_ITEMS = [
  "Staring at a blank page",
  "Writing scripts from scratch (that flop)",
  "Digging for ideas for hours",
  "Copying viral videos by hand",
  "Posting whenever you get around to it",
  "Growth that feels like guessing",
];

const VERLAB_ITEMS = [
  "Viral-ready scripts in minutes",
  "Hooks & retention built into every draft",
  "Trending ideas pulled from your niche automatically",
  "Any viral video, rewritten in your style instantly",
  "A full content pipeline, always stocked",
  "More scripts → more posts → predictable views",
];

/** Three intersecting dashed circles with solid dots marking the intersections.
 * Shared by both cards; `dotClassName` swaps the dot color/glow between states. */
function IntersectingCirclesPattern({ dotClassName }: { dotClassName: string }) {
  return (
    <svg
      viewBox="0 0 400 400"
      fill="none"
      className="h-full w-full text-slate-300"
      aria-hidden
    >
      <circle cx="260" cy="120" r="110" stroke="currentColor" strokeDasharray="4 4" />
      <circle cx="320" cy="260" r="110" stroke="currentColor" strokeDasharray="4 4" />
      <circle cx="180" cy="300" r="110" stroke="currentColor" strokeDasharray="4 4" />

      <circle cx="292" cy="207" r="5" className={dotClassName} />
      <circle cx="222" cy="223" r="5" className={dotClassName} />
      <circle cx="262" cy="330" r="5" className={dotClassName} />
      <circle cx="337" cy="163" r="5" className={dotClassName} />
      <circle cx="196" cy="196" r="5" className={dotClassName} />
    </svg>
  );
}

function ComparisonListItem({
  icon,
  children,
  textClassName,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
  textClassName: string;
}) {
  return (
    <li className="flex items-center gap-3">
      {icon}
      <span className={cn("text-sm sm:text-base", textClassName)}>{children}</span>
    </li>
  );
}

export function ComparisonSection() {
  const { ref, inView } = useAnimationGate<HTMLDivElement>();

  return (
    <section className="w-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-50 via-white to-blue-50/30 px-4 pb-2 pt-10">
      <div className="text-center">
        <h2 className="font-display text-2xl font-bold tracking-tight text-heading sm:text-3xl md:text-5xl">
          Before vs. After{" "}
          <span className="text-primary">Verlab</span>
        </h2>
        <p className="mt-4 text-sm font-medium text-slate-500 sm:mt-5 sm:text-base md:text-lg">
          Verlab doesn&apos;t replace you. It multiplies you.
        </p>
      </div>

      <div className="mx-auto mt-10 grid max-w-6xl grid-cols-1 gap-6 sm:mt-16 sm:gap-8 lg:grid-cols-2">
        {/* Card 1: Other Tools */}
        <div className="relative overflow-hidden rounded-3xl border border-slate-100 bg-white p-5 shadow-sm sm:p-10 md:p-14">
          <div className="pointer-events-none absolute right-0 top-0 -z-10 h-full w-2/3 opacity-40">
            <IntersectingCirclesPattern dotClassName="fill-slate-400 stroke-none" />
          </div>

          <h3 className="mb-6 font-serif text-lg italic text-slate-700 sm:mb-8 sm:text-xl">Other Tools</h3>

          <ul className="flex flex-col gap-4 sm:gap-6">
            {OTHER_TOOLS_ITEMS.map((item) => (
              <ComparisonListItem
                key={item}
                textClassName="font-medium text-slate-600"
                icon={
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-400">
                    ✕
                  </span>
                }
              >
                {item}
              </ComparisonListItem>
            ))}
          </ul>
        </div>

        {/* Card 2: With Verlab */}
        <div
          ref={ref}
          data-inview={inView}
          className="anim-gate comparison-winner-border relative overflow-hidden rounded-3xl bg-white p-5 shadow-[0_8px_30px_rgb(0,0,0,0.08)] sm:p-10 md:p-14"
        >
          <div
            aria-hidden
            className="animate-winner-glow pointer-events-none absolute -inset-4 -z-20 rounded-[2rem] bg-blue-500/25 blur-2xl"
          />
          <div className="pointer-events-none absolute right-0 top-0 -z-10 h-full w-2/3 opacity-40">
            <IntersectingCirclesPattern dotClassName="fill-blue-500 stroke-none drop-shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
          </div>

          <div className="mb-6 flex items-center gap-2 sm:mb-8">
            <span className="font-serif text-lg italic text-slate-700 sm:text-xl">With</span>
            <span className="text-xl font-black text-slate-900 sm:text-2xl">VERLAB</span>
          </div>

          <ul className="flex flex-col gap-4 sm:gap-6">
            {VERLAB_ITEMS.map((item) => (
              <ComparisonListItem
                key={item}
                textClassName="font-semibold text-slate-900"
                icon={
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-500 text-xs font-bold text-white shadow-md shadow-blue-500/30">
                    ✓
                  </span>
                }
              >
                {item}
              </ComparisonListItem>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-10 text-center sm:mt-16">
        <GlassCtaButton
          href={APP_URL}
          radius={20}
          className="px-10! py-4! text-lg!"
          style={{
            boxShadow:
              "inset -3px -3px 4px rgba(191,229,251,0.4), inset 4px 4px 4px rgba(19,26,228,0.1)",
          }}
        >
          Try Verlab Now
        </GlassCtaButton>
      </div>
    </section>
  );
}
