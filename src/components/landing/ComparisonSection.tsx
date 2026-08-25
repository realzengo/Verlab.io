"use client";

import Image from "next/image";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { APP_URL } from "@/lib/constants";

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

function ComparisonListItem({ children, tone }: { children: React.ReactNode; tone: "dim" | "bright" }) {
  return (
    <li className="flex items-start gap-3">
      <span
        className={cn(
          "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
          tone === "dim"
            ? "bg-slate-100 text-slate-400"
            : "bg-blue-600 text-white shadow-[0_2px_8px_rgba(37,99,235,0.35)]",
        )}
      >
        {tone === "dim" ? <X className="h-3 w-3" strokeWidth={2.5} /> : <Check className="h-3 w-3" strokeWidth={2.75} />}
      </span>
      <span className={cn("text-[15px] leading-snug", tone === "dim" ? "text-slate-400" : "text-slate-700")}>
        {children}
      </span>
    </li>
  );
}

/** The literal Verlab "bend" — a viral structure warped into a new shape,
 * reused as the connector between Old Way and Verlab Way instead of a flat
 * "VS" chip. Rotated -90deg on mobile so the same path reads top-to-bottom
 * between the stacked cards. */
function BendConnector() {
  return (
    <div className="relative flex shrink-0 flex-col items-center justify-center gap-2 py-2 lg:w-32 lg:py-0">
      <div aria-hidden className="pointer-events-none absolute h-28 w-28 rounded-full bg-btn-primary/20 blur-3xl" />
      <svg width="112" height="48" viewBox="0 0 112 48" fill="none" className="relative rotate-90 lg:rotate-0" aria-hidden>
        <defs>
          <linearGradient id="bend-line" x1="4" y1="24" x2="108" y2="24" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#cbd5e1" />
            <stop offset="1" stopColor="#335cff" />
          </linearGradient>
        </defs>
        <path d="M4 8 C 40 8, 40 40, 76 40" stroke="url(#bend-line)" strokeWidth="2.5" strokeLinecap="round" fill="none" />
        <path d="M68 32 L 78 40 L 68 46" stroke="#335cff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </svg>
      <span className="relative text-[10px] font-bold uppercase tracking-[1.4px] text-primary">The Bend</span>
    </div>
  );
}

export function ComparisonSection() {
  return (
    <section className="relative w-full overflow-hidden bg-[#F8F9FC] py-20 sm:py-28">
      <div className="relative mx-auto max-w-6xl px-4">
        <div className="flex justify-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/5 px-4 py-1.5 text-[13px] font-bold uppercase tracking-[1.4px] text-primary">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            The Transformation
          </span>
        </div>
        <h2 className="mt-4 text-center font-display text-3xl font-bold tracking-tight text-heading sm:text-4xl md:text-5xl">
          The Old Way <span className="text-slate-300">vs</span>{" "}
          <span className="bg-gradient-to-r from-blue-600 to-blue-500 bg-clip-text text-transparent">The Verlab Way</span>
        </h2>

        <div className="mt-14 flex flex-col items-stretch gap-3 lg:flex-row lg:items-center lg:gap-0 [perspective:1800px]">
          {/* The Old Way — tilted back, flat and receding */}
          <div className="flex flex-1 flex-col rounded-2xl border border-slate-200/70 bg-white/70 p-8 shadow-[0_1px_2px_rgba(15,23,42,0.03),0_24px_50px_-30px_rgba(15,23,42,0.15)] backdrop-blur-sm transition-transform duration-500 ease-out lg:[transform:rotateY(6deg)] lg:hover:[transform:rotateY(0deg)_translateY(-4px)]">
            <h3 className="border-b border-slate-200 pb-5 text-center text-2xl font-semibold text-slate-400">
              The Old Way
            </h3>

            <ul className="mt-7 flex flex-1 flex-col gap-5">
              {OLD_WAY_ITEMS.map((item) => (
                <ComparisonListItem key={item} tone="dim">
                  {item}
                </ComparisonListItem>
              ))}
            </ul>

            <span className="mt-8 block w-full cursor-not-allowed select-none rounded-full border border-dashed border-slate-300 py-3 text-center font-semibold text-slate-400">
              Continue Guessing
            </span>
          </div>

          <BendConnector />

          {/* The Verlab Way — tilted forward, popping toward the viewer */}
          <div className="relative flex flex-1 flex-col">
            <div
              aria-hidden
              className="pointer-events-none absolute -inset-4 rounded-[28px] bg-gradient-to-b from-blue-400/20 via-blue-400/5 to-transparent blur-2xl"
            />
            <div className="absolute -top-3.5 left-1/2 z-10 -translate-x-1/2 rounded-full bg-gradient-to-r from-blue-500 to-blue-600 px-4 py-1 text-[11px] font-bold uppercase tracking-[1.2px] text-white shadow-[0_4px_14px_rgba(51,92,255,0.45)]">
              Recommended
            </div>

            <div className="relative flex flex-1 flex-col overflow-hidden rounded-2xl bg-gradient-to-b from-white to-blue-50/50 p-8 shadow-[0_30px_70px_-25px_rgba(15,23,42,0.18),0_0_40px_rgba(59,130,246,0.1)] ring-1 ring-inset ring-blue-200 transition-transform duration-500 ease-out lg:[transform:rotateY(-6deg)] lg:hover:[transform:rotateY(0deg)_translateY(-6px)]">
              <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-400/70 to-transparent" />
              <div
                aria-hidden
                className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-blue-400 opacity-15 blur-[80px]"
              />
              <div
                aria-hidden
                className="pointer-events-none absolute -bottom-20 -left-10 h-48 w-48 rounded-full bg-indigo-400 opacity-10 blur-[90px]"
              />

              <div className="relative flex items-center justify-center gap-2.5 border-b border-slate-200 pb-5">
                <Image src="/logo-icon.png" alt="" width={28} height={28} className="rounded-full ring-1 ring-slate-200" />
                <h3 className="text-2xl font-bold text-heading">Verlab Studio</h3>
              </div>

              <ul className="relative mt-7 flex flex-1 flex-col gap-5">
                {VERLAB_WAY_ITEMS.map((item) => (
                  <ComparisonListItem key={item} tone="bright">
                    {item}
                  </ComparisonListItem>
                ))}
              </ul>

              <a
                href={APP_URL}
                className="group relative mt-8 flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-blue-500 to-blue-600 py-3 text-center font-semibold text-white shadow-[0_10px_25px_-5px_rgba(59,130,246,0.45)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_30px_-5px_rgba(59,130,246,0.55)]"
              >
                Try Verlab Now
                <span aria-hidden className="transition-transform duration-200 group-hover:translate-x-0.5">
                  →
                </span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
