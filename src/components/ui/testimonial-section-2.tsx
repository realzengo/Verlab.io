"use client";

import { useState } from "react";
import Image from "next/image";
import dynamic from "next/dynamic";
import { CircleDot } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAnimationGate } from "@/lib/hooks/useAnimationGate";
import type { Testimonial } from "./TestimonialModal";

// The modal (and the framer-motion it pulls in) is only ever needed after a
// user clicks a testimonial capsule, so it's kept out of the initial page
// bundle and fetched on first click instead.
const TestimonialModal = dynamic(() => import("./TestimonialModal").then((m) => m.TestimonialModal), { ssr: false });

const testimonials: Testimonial[] = [
  {
    id: "1",
    name: "Maya R.",
    role: "Faceless Reddit channel",
    image: "/reviewers/reviewer-01.jpeg",
    quote: "I paste the top videos in my niche and Verlab hands me a bent SOP in seconds.",
  },
  {
    id: "2",
    name: "Jonathan K.",
    role: "Clipping agency",
    image: "/reviewers/reviewer-02.jpeg",
    quote: "Niche Bending and the MCP alone replaced three tools we were paying for across the team.",
  },
  {
    id: "3",
    name: "Deni O.",
    role: "Motivation Shorts",
    image: "/reviewers/reviewer-03.jpeg",
    quote: "The MCP is the killer feature — I run everything from inside Claude without leaving my workflow.",
  },
  {
    id: "4",
    name: "Priya N.",
    role: "Faceless YouTube channel",
    image: "/reviewers/reviewer-04.jpeg",
    quote: "We went from guessing formats to shipping a proven script every morning.",
  },
  {
    id: "5",
    name: "Marcus T.",
    role: "Solo clipper",
    image: "/reviewers/reviewer-05.jpeg",
    quote: "I run five niches solo now. Verlab's SOPs mean I'm never staring at a blank timeline.",
  },
  {
    id: "6",
    name: "Elena V.",
    role: "Content studio lead",
    image: "/reviewers/reviewer-06.jpeg",
    quote: "Onboarding new editors used to take weeks. Now I hand them a Verlab breakdown and they're cutting on day one.",
  },
  {
    id: "7",
    name: "Owen D.",
    role: "Shorts creator",
    image: "/reviewers/reviewer-07.jpeg",
    quote: "The pacing and hook data alone paid for the subscription in the first week.",
  },
  {
    id: "8",
    name: "Sana R.",
    role: "Growth marketer",
    image: "/reviewers/reviewer-08.jpeg",
    quote: "Verlab turned our competitor research into a repeatable system instead of a Friday afternoon scramble.",
  },
  {
    id: "9",
    name: "Kabir L.",
    role: "Video editor",
    image: "/reviewers/reviewer-09.jpeg",
    quote: "Every brief I get now already has the structure mapped out. I just execute.",
  },
];

export default function Testimonial2() {
  const [selected, setSelected] = useState<Testimonial | null>(null);
  // Once true, stays true — keeps the modal mounted after it's first opened
  // so its close/exit transition can still play, instead of the dynamic
  // import getting torn down mid-animation.
  const [hasOpenedOnce, setHasOpenedOnce] = useState(false);
  const { ref, inView } = useAnimationGate<HTMLDivElement>();

  const row1 = testimonials.slice(0, 3);
  const row2 = testimonials.slice(3, 6);
  const row3 = testimonials.slice(6, 9);

  return (
    <div className="relative w-full py-12 sm:py-20 overflow-hidden bg-white dark:bg-background text-neutral-900 dark:text-white">
      <div className="max-w-7xl mx-auto px-4 text-center mb-8 sm:mb-12">
        <span
          className="relative mb-8 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium text-slate-100 [text-shadow:0_1px_1px_rgba(0,0,0,0.5)]"
          style={{
            backgroundImage:
              "linear-gradient(160deg, #e2e8f0 0%, #94a3b8 10%, #334155 32%, #0b1220 52%, #1e293b 70%, #64748b 88%, #cbd5e1 100%)",
            boxShadow:
              "inset 0 1px 1px rgba(255,255,255,0.7), inset 0 -1px 2px rgba(0,0,0,0.8), inset 0 0 0 1px rgba(255,255,255,0.08), 0 10px 24px -6px rgba(15,23,42,0.55), 0 2px 4px rgba(15,23,42,0.4)",
          }}
        >
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-5 top-px h-px rounded-full bg-gradient-to-r from-transparent via-white/80 to-transparent"
          />
          <CircleDot className="h-3.5 w-3.5 text-slate-300" />
          Reviews
          <CircleDot className="h-3.5 w-3.5 text-slate-300" />
        </span>
        <h2 className="text-2xl sm:text-3xl md:text-5xl font-bold tracking-tight">What our users are saying</h2>
      </div>

      {/* Main Container acting as the viewport for background and fades */}
      <div ref={ref} data-inview={inView} className="anim-gate relative w-full">
        {/* Shaded Background - Matches the height of this container exactly */}
        <div className="absolute inset-0 z-0 opacity-10 bg-[repeating-linear-gradient(315deg,currentColor_0,currentColor_1px,transparent_0,transparent_50%)] bg-[length:10px_10px] border-y border-black dark:border-white pointer-events-none"></div>

        {/* Fades - Match the height of this container exactly */}
        <div className="absolute left-0 top-0 bottom-0 w-40 bg-gradient-to-r from-white dark:from-black to-transparent z-20 pointer-events-none"></div>
        <div className="absolute right-0 top-0 bottom-0 w-40 bg-gradient-to-l from-white dark:from-black to-transparent z-20 pointer-events-none"></div>

        {/* Content Rows */}
        <div className="relative z-10 flex flex-col gap-5 py-8 sm:gap-8 sm:py-12 items-center justify-center overflow-hidden">
          {[row1, row2, row3].map((row, rowIndex) => (
            <div
              key={rowIndex}
              className={cn(
                "flex min-w-max items-center gap-6",
                rowIndex % 2 === 0 ? "animate-testimonial-marquee" : "animate-testimonial-marquee-reverse",
              )}
            >
              {[...row, ...row, ...row, ...row].map((testimonial, i) => (
                <Capsule
                  key={`${testimonial.id}-${i}`}
                  testimonial={testimonial}
                  onClick={() => {
                    setSelected(testimonial);
                    setHasOpenedOnce(true);
                  }}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Modal — dynamically imported, so only mount it once it's actually needed */}
      {hasOpenedOnce && <TestimonialModal selected={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function Capsule({ testimonial, onClick }: { testimonial: Testimonial; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className="group flex items-center gap-4 p-2 pr-8 rounded-full bg-white dark:bg-black/90 border border-neutral-300 hover:border-(--color-primary) hover:border-dashed dark:hover:border-(--color-primary) dark:border-neutral-800 cursor-pointer transition-all shadow-sm hover:shadow-md hover:scale-105 active:scale-95"
    >
      <div className="relative w-14 h-14 rounded-full overflow-hidden border border-black group-hover:border-(--color-primary) dark:group-hover:border-(--color-primary) dark:border-white transition-colors">
        <Image src={testimonial.image} alt={testimonial.name} fill sizes="56px" className="object-cover object-top" />
      </div>
      <div className="flex flex-col items-start leading-tight">
        <span className="text-sm font-bold text-neutral-900 dark:text-white">{testimonial.name}</span>
        <span className="text-xs text-neutral-500 dark:text-neutral-400">{testimonial.role}</span>
      </div>
    </div>
  );
}
