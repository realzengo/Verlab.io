"use client";

import { useState, type ReactNode } from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export interface AccordionItem {
  id: string;
  trigger: ReactNode;
  content: ReactNode;
}

export function Accordion({ items }: { items: AccordionItem[] }) {
  const [openId, setOpenId] = useState<string | null>(items[0]?.id ?? null);

  return (
    <div className="flex flex-col gap-3">
      {items.map((item) => {
        const isOpen = openId === item.id;
        return (
          <div key={item.id} className="overflow-hidden rounded-2xl border border-hairline bg-surface">
            <button
              type="button"
              onClick={() => setOpenId(isOpen ? null : item.id)}
              aria-expanded={isOpen}
              className="flex w-full items-center justify-between gap-4 px-[22px] py-[18px] text-left"
            >
              <span className="text-base font-semibold text-heading">{item.trigger}</span>
              <span
                className={cn(
                  "flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-accent text-primary transition-transform duration-200",
                  isOpen && "rotate-45"
                )}
              >
                <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
              </span>
            </button>
            {isOpen && (
              <div className="px-[22px] pb-[18px] text-[15px] leading-[1.65] text-body">{item.content}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}
