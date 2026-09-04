"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { FAQ_ITEMS } from "@/lib/mock/faq";
import { Reveal } from "@/components/ui/Reveal";
import type { FaqItem } from "@/lib/types";
import { cn } from "@/lib/utils";

export function Faq({
  items = FAQ_ITEMS,
  heading = "Frequently asked questions",
  subheading = "Everything you need to know to understand how the platform works, all in one place.",
  backgroundClassName = "bg-[#F8F9FC]",
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
        <Reveal className="text-center">
          <h2 className="font-display text-[28px] font-bold tracking-tight text-heading sm:text-3xl md:text-5xl">
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
        </Reveal>

        <Reveal delay={100} className="relative mx-auto mt-8 w-full max-w-3xl sm:mt-12">
          <div className="rounded-2xl bg-gradient-to-br from-blue-500 to-blue-500/0 p-[5px] sm:rounded-[20px]">
            <div className="rounded-[14px] bg-white p-1.5 sm:rounded-[18px] sm:p-2">
              <div className="flex w-full flex-col gap-2.5">
                {items.map((item) => {
                  const isOpen = openId === item.id;
                  return (
                    <div key={item.id} className="w-full overflow-hidden rounded-xl bg-zinc-100 transition-colors duration-300 dark:bg-white/[0.06]">
                      <button
                        type="button"
                        onClick={() => setOpenId(isOpen ? null : item.id)}
                        aria-expanded={isOpen}
                        className="flex w-full items-center justify-between gap-2 rounded-xl py-4 pl-4 pr-5 text-left transition-colors duration-200 focus:outline-none sm:py-[18px] sm:pl-5 sm:pr-6"
                      >
                        <span className="font-ui text-[15px] font-medium text-heading sm:text-base">{item.question}</span>
                        <ChevronDown
                          className={cn(
                            "h-3.5 w-3.5 shrink-0 text-primary transition-transform duration-300 ease-out sm:h-4 sm:w-4",
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
                          <div className="px-4 pb-4 text-sm leading-[1.65] text-body sm:px-5 sm:pb-4 sm:text-[15px]">{item.answer}</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
