"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
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
          <div key={item.id} className="rounded-card-sm border border-hairline bg-white">
            <button
              type="button"
              onClick={() => setOpenId(isOpen ? null : item.id)}
              aria-expanded={isOpen}
              className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
            >
              <span className="text-sm font-semibold text-heading">{item.trigger}</span>
              <ChevronDown
                className={cn("h-4 w-4 shrink-0 text-body transition-transform", isOpen && "rotate-180")}
              />
            </button>
            {isOpen && <div className="px-5 pb-4 text-sm leading-relaxed text-body">{item.content}</div>}
          </div>
        );
      })}
    </div>
  );
}
