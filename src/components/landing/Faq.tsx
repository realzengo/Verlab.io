"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { FAQ_ITEMS } from "@/lib/mock/faq";
import { Reveal } from "@/components/ui/Reveal";
import { cn } from "@/lib/utils";

export function Faq() {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <section id="faq" className="mx-auto w-full max-w-[88rem] px-4 py-14 sm:px-6 sm:py-[90px]">
      <Reveal className="text-center">
        <h2 className="font-display text-2xl font-bold tracking-tight text-heading sm:text-3xl md:text-5xl">
          Frequently asked questions
        </h2>
      </Reveal>

      <Reveal delay={100} className="relative mt-8 sm:mt-12">
        <div className="relative rounded-[36px] bg-gradient-to-b from-blue-100 to-blue-200/80 p-3 shadow-[0_30px_70px_-24px_rgba(37,99,235,0.4),0_0_0_1px_rgba(255,255,255,0.6)_inset] sm:p-3.5">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-[1px] rounded-[33px] bg-gradient-to-b from-white/70 to-transparent"
            style={{ height: "50%" }}
          />

          <div className="relative overflow-hidden rounded-[28px] bg-white p-4 shadow-[0_2px_8px_rgba(15,23,42,0.06),0_0_0_1px_rgba(15,23,42,0.04)] sm:p-6">
            <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-2 sm:gap-4">
              {FAQ_ITEMS.map((item) => {
                const isOpen = openId === item.id;
                return (
                  <div key={item.id} className="overflow-hidden rounded-2xl bg-zinc-100 transition-colors duration-300 dark:bg-white/[0.06]">
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
        </div>
      </Reveal>
    </section>
  );
}
