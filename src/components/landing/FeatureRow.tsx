import type { ReactNode } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

interface FeatureRowProps {
  reverse?: boolean;
  eyebrow: string;
  title: string;
  description: string;
  bullets?: string[];
  preview: ReactNode;
  ctaLabel: string;
  ctaHref: string;
}

export function FeatureRow({
  reverse,
  eyebrow,
  title,
  description,
  bullets,
  preview,
  ctaLabel,
  ctaHref,
}: FeatureRowProps) {
  return (
    <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      <div
        className={cn(
          "grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-16",
          reverse && "lg:[&>*:first-child]:order-2"
        )}
      >
        <div>
          <span className="text-[13px] font-bold uppercase tracking-[1.4px] text-primary">{eyebrow}</span>
          <h2 className="mt-3 text-[26px] font-bold leading-[1.1] tracking-[-0.5px] text-slate sm:text-[32px]">
            {title}
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-body sm:text-base">{description}</p>

          {bullets && (
            <ul className="mt-5 flex flex-col gap-2.5">
              {bullets.map((bullet, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-heading">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  {bullet}
                </li>
              ))}
            </ul>
          )}

          <Button href={ctaHref} variant="secondary" className="mt-6">
            {ctaLabel}
          </Button>
        </div>

        <div>{preview}</div>
      </div>
    </section>
  );
}
