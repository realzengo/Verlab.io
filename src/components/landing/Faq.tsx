"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { FAQ_ITEMS } from "@/lib/mock/faq";
import { cn } from "@/lib/utils";

export function Faq() {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <section id="faq" className="mx-auto max-w-5xl px-4 py-14 sm:px-6 sm:py-[90px] lg:px-8">
      <div className="text-center">
        <span className="text-[28px] font-bold text-primary sm:text-[34px]">FAQs</span>
        <h2 className="mt-2 text-[28px] font-extrabold leading-[1.1] tracking-[-1px] text-slate sm:text-[45px]">
          Frequently asked questions
        </h2>
      </div>

      <div className="mt-8 rounded-[32px] bg-[linear-gradient(135deg,var(--color-primary),white)] p-[6px] dark:bg-[linear-gradient(135deg,var(--color-primary),rgba(255,255,255,0.15))] sm:mt-12">
        <div className="rounded-[30px] bg-surface p-3 sm:p-4">
          <div className="flex flex-col gap-3">
            {FAQ_ITEMS.map((item) => {
              const isOpen = openId === item.id;
              return (
                <div key={item.id} className="overflow-hidden rounded-2xl bg-zinc-200/70 dark:bg-white/[0.06]">
                  <button
                    type="button"
                    onClick={() => setOpenId(isOpen ? null : item.id)}
                    aria-expanded={isOpen}
                    className="flex w-full items-center justify-between gap-4 rounded-2xl px-6 py-5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 sm:px-7"
                  >
                    <span className="text-base font-bold text-heading">{item.question}</span>
                    <ChevronDown
                      className={cn(
                        "h-5 w-5 shrink-0 text-primary transition-transform duration-300 ease-out",
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
                      <div className="px-6 pb-5 text-[15px] leading-[1.65] text-body sm:px-7">{item.answer}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
