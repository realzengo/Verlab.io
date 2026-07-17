import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface ToolCardProps {
  title: string;
  description: string;
  previewSlot: ReactNode;
  href: string;
  cta?: string;
  beta?: boolean;
  className?: string;
}

export function ToolCard({ title, description, previewSlot, href, cta = "Try now", beta, className }: ToolCardProps) {
  return (
    <Link
      href={href}
      className={cn(
        "group flex flex-col overflow-hidden rounded-xl border border-hairline bg-surface shadow-card transition-all duration-700 hover:-translate-y-1 hover:shadow-card-hover",
        className
      )}
    >
      <div className="flex h-44 items-center justify-center bg-zinc-100 px-6 dark:bg-zinc-800/40">
        {previewSlot}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-5">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-bold text-heading">{title}</h3>
          {beta && (
            <span className="rounded-md bg-primary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
              Beta
            </span>
          )}
        </div>
        <p className="text-sm font-normal leading-snug text-body">{description}</p>
        <span className="btn-bevel mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary py-2.5 text-sm font-semibold text-white transition-colors group-hover:bg-primary-hover">
          {cta}
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </span>
      </div>
    </Link>
  );
}
