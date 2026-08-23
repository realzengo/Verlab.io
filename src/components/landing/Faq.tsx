"use client";

import { useState } from "react";
import { ChevronDown, CircleDot } from "lucide-react";
import { FAQ_ITEMS } from "@/lib/mock/faq";
import { cn } from "@/lib/utils";

export function Faq() {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <section id="faq" className="mx-auto w-full max-w-[68rem] px-4 py-14 sm:px-6 sm:py-[90px] lg:px-8">
      <div className="text-center">
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
          FAQ
          <CircleDot className="h-3.5 w-3.5 text-slate-300" />
        </span>
        <h2 className="font-display text-2xl font-bold leading-[1.1] tracking-[-1px] text-slate sm:text-[45px]">
          Frequently asked questions
        </h2>
      </div>

      <div className="mt-8 rounded-[32px] bg-surface p-3 sm:mt-12 sm:p-4">
        <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-2 sm:gap-4">
          {FAQ_ITEMS.map((item) => {
            const isOpen = openId === item.id;
            return (
              <div key={item.id} className="overflow-hidden rounded-2xl bg-zinc-200/70 transition-colors duration-300 dark:bg-white/[0.06]">
                <button
                  type="button"
                  onClick={() => setOpenId(isOpen ? null : item.id)}
                  aria-expanded={isOpen}
                  className="flex w-full items-center justify-between gap-3 rounded-2xl px-5 py-4 text-left transition-colors duration-200 focus:outline-none sm:gap-4 sm:px-8 sm:py-6"
                >
                  <span className="text-base font-bold text-heading sm:text-lg">{item.question}</span>
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 shrink-0 text-primary transition-transform duration-300 ease-out sm:h-5 sm:w-5",
                      isOpen && "rotate-180"
                    )}
                    strokeWidth={2.5}
                  />
                </button>
                <div
                  className={cn(
                    "grid transition-all duration-300 ease-in-out",
                    isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                  )}
                >
                  <div className="overflow-hidden">
                    <div className="px-4 pb-4 text-sm leading-[1.65] text-body sm:px-7 sm:pb-5 sm:text-[15px]">{item.answer}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
