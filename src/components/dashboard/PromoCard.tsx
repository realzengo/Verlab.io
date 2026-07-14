import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface PromoCardProps {
  title: string;
  description: string;
  previewSlot: ReactNode;
  href: string;
  size?: "wide" | "normal";
}

export function PromoCard({ title, description, previewSlot, href, size = "normal" }: PromoCardProps) {
  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden rounded-card border border-hairline bg-white transition-shadow hover:shadow-card-hover",
        size === "wide" && "sm:col-span-2"
      )}
    >
      <div className="flex h-40 items-center justify-center bg-app px-5">{previewSlot}</div>
      <div className="flex flex-col gap-2 p-5">
        <h3 className="text-sm font-semibold text-heading">{title}</h3>
        <p className="text-sm leading-relaxed text-body">{description}</p>
        <Link
          href={href}
          className="mt-1 inline-flex w-fit items-center gap-1 text-sm font-semibold text-primary hover:underline underline-offset-4"
        >
          Try now
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}
