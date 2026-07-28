"use client";

import { useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { CircleDot, X } from "lucide-react";

interface Testimonial {
  id: string;
  name: string;
  role: string;
  image: string;
  quote: string;
}

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
        <h2 className="text-3xl md:text-5xl font-bold tracking-tight">What our users are saying</h2>
      </div>

      {/* Main Container acting as the viewport for background and fades */}
      <div className="relative w-full">
        {/* Shaded Background - Matches the height of this container exactly */}
        <div className="absolute inset-0 z-0 opacity-10 bg-[repeating-linear-gradient(315deg,currentColor_0,currentColor_1px,transparent_0,transparent_50%)] bg-[length:10px_10px] border-y border-black dark:border-white pointer-events-none"></div>

        {/* Fades - Match the height of this container exactly */}
        <div className="absolute left-0 top-0 bottom-0 w-40 bg-gradient-to-r from-white dark:from-black to-transparent z-20 pointer-events-none"></div>
        <div className="absolute right-0 top-0 bottom-0 w-40 bg-gradient-to-l from-white dark:from-black to-transparent z-20 pointer-events-none"></div>

        {/* Content Rows */}
        <div className="relative z-10 flex flex-col gap-5 py-8 sm:gap-8 sm:py-12 items-center justify-center overflow-hidden">
          {[row1, row2, row3].map((row, rowIndex) => (
            <motion.div
              key={rowIndex}
              className="flex items-center gap-6 min-w-max"
              animate={{
                x: rowIndex % 2 === 0 ? ["0%", "-25%"] : ["-25%", "0%"],
              }}
              transition={{
                duration: 40,
                repeat: Infinity,
                ease: "linear",
              }}
            >
              {[...row, ...row, ...row, ...row].map((testimonial, i) => (
                <Capsule
                  key={`${testimonial.id}-${i}`}
                  testimonial={testimonial}
                  onClick={() => setSelected(testimonial)}
                />
              ))}
            </motion.div>
          ))}
        </div>
      </div>

      {/* Modal */}
      <AnimatePresence>
        {selected && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelected(null)}
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            />

            {/* Modal Card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{
                opacity: 0,
                scale: 0.95,
                y: 10,
                transition: { duration: 0.15 },
              }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="relative w-full max-w-lg rounded-2xl bg-[linear-gradient(135deg,var(--color-primary)_0%,white_65%)] p-[2px] shadow-2xl z-50 dark:bg-[linear-gradient(135deg,var(--color-primary)_0%,rgba(255,255,255,0.15)_65%)]"
            >
              <div className="relative rounded-[14px] bg-surface text-heading p-8 md:p-12">
                <button
                  onClick={() => setSelected(null)}
                  className="absolute top-4 right-4 p-2 text-subtle hover:text-heading transition-colors"
                >
                  <X size={20} />
                </button>

                <div className="flex flex-col items-center text-center">
                  <p className="text-xl md:text-2xl font-medium leading-relaxed mb-8">&ldquo;{selected.quote}&rdquo;</p>

                  <div className="flex items-center gap-4">
                    <div className="relative w-12 h-12 rounded-full overflow-hidden border-2 border-(--color-primary)">
                      <Image src={selected.image} alt={selected.name} fill sizes="48px" className="object-cover object-top" />
                    </div>
                    <div className="text-left">
                      <h4 className="font-bold text-base text-heading">{selected.name}</h4>
                      <p className="text-sm text-subtle">{selected.role}</p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Capsule({ testimonial, onClick }: { testimonial: Testimonial; onClick: () => void }) {
  return (
    <motion.div
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className="group flex items-center gap-4 p-2 pr-8 rounded-full bg-white dark:bg-black/90 border border-neutral-300 hover:border-(--color-primary) hover:border-dashed dark:hover:border-(--color-primary) dark:border-neutral-800 cursor-pointer transition-all shadow-sm hover:shadow-md"
    >
      <div className="relative w-14 h-14 rounded-full overflow-hidden border border-black group-hover:border-(--color-primary) dark:group-hover:border-(--color-primary) dark:border-white transition-colors">
        <Image src={testimonial.image} alt={testimonial.name} fill sizes="56px" className="object-cover object-top" />
      </div>
      <div className="flex flex-col items-start leading-tight">
        <span className="text-sm font-bold text-neutral-900 dark:text-white">{testimonial.name}</span>
        <span className="text-xs text-neutral-500 dark:text-neutral-400">{testimonial.role}</span>
      </div>
    </motion.div>
  );
}
