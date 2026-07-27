import Link from "next/link";
import {
  ArrowRight,
  Check,
  Compass,
  Link2,
  MousePointer2,
  Shuffle,
  Sparkles,
  Wand2,
  type LucideIcon,
} from "lucide-react";
import { TikTokIcon, YouTubeIcon } from "@/components/landing/PlatformIcons";
import { StarIcon } from "@/components/landing/StarIcon";
import { cn } from "@/lib/utils";

const BEND_CHIPS = [
  { label: "Workplace Karma", cat: 1, delay: 0 },
  { label: "HOA Nightmares", cat: 3, delay: 1 },
  { label: "Landlord Justice", cat: 5, delay: 2 },
  { label: "Retail Karens", cat: 6, delay: 5 },
  { label: "Roommate Chaos", cat: 7, delay: 4 },
  { label: "Airport Meltdowns", cat: 4, delay: 3 },
];

function StepPanelFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative aspect-[4/3] overflow-hidden rounded-t-2xl bg-accent p-5 sm:p-6">
      {children}
    </div>
  );
}

function FloatingBadge({
  icon: Icon,
  className,
  rotate,
  delay = 0,
}: {
  icon: LucideIcon;
  className: string;
  rotate: number;
  delay?: number;
}) {
  return (
    <div className={cn("pointer-events-none absolute z-20", className)}>
      <span
        aria-hidden
        className="animate-craft-glow absolute inset-0 -z-10 scale-[1.5] rounded-2xl bg-primary/40 blur-lg"
        style={{ animationDelay: `${delay}s` }}
      />
      <div style={{ transform: `rotate(${rotate}deg)` }}>
        <span
          className="animate-tooltip-bounce flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary-hover text-white shadow-blue"
          style={{ animationDelay: `${delay}s` }}
        >
          <Icon className="h-5 w-5" strokeWidth={2} />
        </span>
      </div>
    </div>
  );
}

function LinkPanel() {
  return (
    <StepPanelFrame>
      <div className="flex h-full w-full items-center justify-center">
        <div className="flex w-[86%] flex-col items-center gap-2.5 rounded-xl border-2 border-dashed border-accent-line bg-surface px-4 py-6 text-center shadow-card">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-primary">
            <Compass className="h-4.5 w-4.5" strokeWidth={1.8} />
          </span>
          <p className="text-[12.5px] font-semibold text-heading">
            Paste a profile or clip link
            <span
              aria-hidden
              className="animate-caret-blink ml-0.5 inline-block h-3 w-[1.5px] translate-y-[2px] bg-primary align-middle"
            />
          </p>
          <span className="rounded-md border border-hairline bg-app px-2.5 py-1 text-[11px] font-medium text-subtle">
            Browse Library
          </span>
        </div>
      </div>
      <span
        className="animate-tooltip-bounce absolute right-3 top-3 flex h-9 w-9 rotate-[9deg] items-center justify-center rounded-xl bg-surface shadow-card ring-1 ring-hairline"
        style={{ animationDelay: "0.2s" }}
      >
        <TikTokIcon className="h-4 w-4 text-heading" />
      </span>
      <span
        className="animate-tooltip-bounce absolute bottom-3 left-3 flex h-9 w-9 rotate-[-8deg] items-center justify-center rounded-xl bg-surface shadow-card ring-1 ring-hairline"
        style={{ animationDelay: "0.6s" }}
      >
        <YouTubeIcon className="h-4 w-4 text-red-500" />
      </span>
    </StepPanelFrame>
  );
}

function BendPanel() {
  return (
    <StepPanelFrame>
      <div className="relative h-full w-full">
        <div className="grid h-full w-full grid-cols-3 gap-2">
          {BEND_CHIPS.map((chip) => (
            <div key={chip.label} className="relative">
              <span
                className="animate-bend-select flex h-full w-full items-center gap-1.5 rounded-lg border border-hairline bg-surface px-2 text-left text-[10px] font-bold leading-tight text-subtle shadow-card"
                style={
                  {
                    animationDelay: `${chip.delay}s`,
                    "--accent": `var(--color-cat-${chip.cat})`,
                    "--accent-tint": `var(--color-cat-${chip.cat}-tint)`,
                  } as React.CSSProperties
                }
              >
                <span
                  className="h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: `var(--color-cat-${chip.cat})` }}
                />
                {chip.label}
              </span>
              <span
                className="animate-bend-check shadow-blue pointer-events-none absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-white"
                style={{ animationDelay: `${chip.delay}s` }}
              >
                <Check className="h-2.5 w-2.5" strokeWidth={3} />
              </span>
            </div>
          ))}
        </div>
        <span className="animate-bend-cursor pointer-events-none absolute left-0 top-0 z-20">
          <span className="animate-bend-ripple absolute left-1/2 top-1/2 h-7 w-7 rounded-full border-2 border-primary/70" />
          <MousePointer2
            className="relative h-4 w-4 text-heading drop-shadow-[0_2px_3px_rgba(0,0,0,0.25)]"
            fill="white"
            strokeWidth={1.75}
          />
        </span>
      </div>
    </StepPanelFrame>
  );
}

function GeneratePanel() {
  return (
    <StepPanelFrame>
      <div className="flex h-full w-full flex-col items-center justify-center gap-3">
        <div className="flex flex-col items-center gap-2 rounded-xl border border-hairline bg-surface px-6 py-5 shadow-card">
          <span className="relative flex h-12 w-12 items-center justify-center">
            <span className="absolute inset-0 rounded-full border-4 border-accent-line" />
            <span className="absolute inset-0 animate-spin rounded-full border-4 border-primary border-t-transparent [animation-duration:1.4s]" />
            <Wand2 className="h-5 w-5 text-primary" strokeWidth={1.8} />
          </span>
          <p className="text-[12px] font-semibold text-heading">Generating SOP&hellip;</p>
          <p className="text-[10.5px] text-subtle">Ready in seconds</p>
        </div>
        <div className="flex items-center gap-1.5 text-[10.5px] font-bold text-primary">
          <Sparkles className="h-3 w-3" strokeWidth={2.2} />
          Powered By Verlab AI
        </div>
        <div className="h-1 w-[70%] overflow-hidden rounded-full bg-accent-line">
          <div className="animate-indeterminate-bar h-full w-1/3 rounded-full bg-primary" />
        </div>
      </div>
      <div className="absolute -top-2 -right-2 w-28 rotate-[6deg] rounded-xl border border-hairline bg-surface p-2.5 shadow-card sm:w-32">
        <div className="animate-line-grow mb-1.5 h-1.5 w-full origin-left rounded bg-accent" style={{ animationDelay: "0s" }} />
        <div className="animate-line-grow mb-1.5 h-1.5 w-[80%] origin-left rounded bg-accent-line" style={{ animationDelay: "-0.8s" }} />
        <div className="animate-line-grow h-1.5 w-[60%] origin-left rounded bg-app" style={{ animationDelay: "-1.6s" }} />
      </div>
    </StepPanelFrame>
  );
}

const STEPS = [
  {
    title: "Drop in a viral link",
    description: "Paste any TikTok, Reel, or Short. Niche Finder pulls the transcript and momentum data instantly.",
    Panel: LinkPanel,
    badgeIcon: Link2,
    badgeClassName: "-top-4 -left-4",
    badgeRotate: -8,
  },
  {
    title: "Pick your bend",
    description: "The Bender maps the proven format onto your own niche — see fresh angles in one click.",
    Panel: BendPanel,
    badgeIcon: Shuffle,
    badgeClassName: "-top-4 -right-4",
    badgeRotate: 8,
  },
  {
    title: "Generate your SOP & scripts",
    description: "SOP Builder and Script Writer turn the bent format into ready-to-film scripts.",
    Panel: GeneratePanel,
    badgeIcon: Sparkles,
    badgeClassName: "-bottom-4 -right-4",
    badgeRotate: -6,
  },
];

export function LoopSteps() {
  return (
    <section id="workflow" className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
      <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center sm:gap-8">
        <div>
          <h2 className="text-[26px] font-bold leading-[1.1] tracking-[-1px] text-heading sm:text-[34px] lg:text-[40px]">
            Workflows To Go Viral
          </h2>
          <p className="mt-2 text-base text-body sm:text-lg">
            Example: see how Verlab bends a viral niche into your own
          </p>
        </div>
        <Link
          href="/app"
          className="inline-flex shrink-0 items-center justify-center gap-2.5 rounded-xl bg-btn-primary px-7 py-3.5 text-base font-bold text-white hover:bg-btn-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-app"
        >
          <StarIcon className="h-5 w-5 shrink-0" />
          Get started free
          <ArrowRight className="h-5 w-5 shrink-0" />
        </Link>
      </div>

      <div className="mt-10 grid grid-cols-1 gap-8 sm:mt-12 lg:grid-cols-3 lg:gap-10">
        {STEPS.map((step, i) => (
          <div key={step.title} className="relative rounded-2xl border border-hairline bg-surface shadow-card">
            <step.Panel />
            <FloatingBadge
              icon={step.badgeIcon}
              className={step.badgeClassName}
              rotate={step.badgeRotate}
              delay={i * 0.3}
            />
            <div className="p-6 sm:p-8">
              <div className="flex items-center gap-2.5">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-[12px] font-bold text-white">
                  {i + 1}
                </span>
                <h3 className="text-[17px] font-bold text-heading">{step.title}</h3>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-subtle">{step.description}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
