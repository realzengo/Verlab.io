"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { FAQ_ITEMS } from "@/lib/mock/faq";
import { cn } from "@/lib/utils";

export function Faq() {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <section id="faq" className="mx-auto w-full max-w-7xl px-4 py-14 sm:px-6 sm:py-[90px] lg:px-8">
      <div className="text-center">
        <h2 className="font-display text-2xl font-bold tracking-tight text-heading sm:text-3xl md:text-5xl">
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
                  <span className="font-ui text-base font-semibold text-heading">{item.question}</span>
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
