"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { VerifiedBadge } from "@/components/landing/VerifiedBadge";
import { FAQ_ITEMS } from "@/lib/mock/faq";
import type { FaqItem } from "@/lib/types";
import { cn } from "@/lib/utils";

export function Faq({
  items = FAQ_ITEMS,
  heading = "Frequently asked questions",
  subheading = "Everything you need to know to understand how the platform works, all in one place.",
  backgroundClassName = "bg-white",
}: {
  items?: FaqItem[];
  heading?: string;
  subheading?: string;
  backgroundClassName?: string;
} = {}) {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <section id="faq" className={cn("w-full", backgroundClassName)}>
      <div className="mx-auto w-full max-w-[88rem] px-4 py-14 sm:px-6 sm:py-[90px]">
        <div className="text-center">
          <VerifiedBadge label="FAQ" className="mb-5 sm:mb-6" />
          <h2 className="font-display text-[32px] font-bold leading-[1.1] tracking-tight text-heading sm:text-3xl sm:leading-normal md:text-5xl">
            {heading === "Frequently asked questions" ? (
              <>
                <span className="sm:hidden">
                  Frequently
                  <br />
                  asked questions
                </span>
                <span className="hidden sm:inline">Frequently asked questions</span>
              </>
            ) : (
              heading
            )}
          </h2>
          {subheading ? (
            <p className="mx-auto mt-3 max-w-sm text-balance text-sm font-normal text-subtle sm:mt-4 sm:text-base">{subheading}</p>
          ) : null}
        </div>

        <div className="mx-auto mt-8 grid w-full max-w-[88rem] grid-cols-1 gap-3.5 sm:mt-12 sm:grid-cols-2 sm:gap-4">
          {items.map((item) => {
            const isOpen = openId === item.id;
            return (
              <div
                key={item.id}
                className="h-fit overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition-colors duration-200 dark:border-white/10 dark:bg-white/[0.03]"
              >
                <button
                  type="button"
                  onClick={() => setOpenId(isOpen ? null : item.id)}
                  aria-expanded={isOpen}
                  className="flex w-full items-center justify-between gap-3 py-4 pl-5 pr-4 text-left focus:outline-none sm:py-5 sm:pl-6 sm:pr-5"
                >
                  <span className="font-ui text-base font-bold text-heading sm:text-lg">{item.question}</span>
                  <span
                    className={cn(
                      "flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#525866] text-white transition-transform duration-300 ease-out dark:bg-white/15 sm:h-5 sm:w-5",
                      isOpen && "rotate-45"
                    )}
                  >
                    <Plus className="h-2 w-2 sm:h-2.5 sm:w-2.5" strokeWidth={3.5} />
                  </span>
                </button>
                <div
                  className={cn(
                    "grid transition-all duration-300 ease-in-out",
                    isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                  )}
                >
                  <div className="overflow-hidden">
                    <div className="px-5 pb-4 text-sm leading-[1.65] text-body sm:px-6 sm:pb-5 sm:text-[15px]">{item.answer}</div>
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
