import { Check, X } from "lucide-react";
import type { NicheBendSOP } from "@/lib/types";
import { Card } from "@/components/ui/Card";

interface SopViewProps {
  sop: NicheBendSOP;
  title?: string;
  variant?: "full" | "compact";
}

export function SopView({ sop, title, variant = "full" }: SopViewProps) {
  const compact = variant === "compact";

  return (
    <Card padded={!compact} className={compact ? "flex flex-col gap-4 p-4" : "flex flex-col gap-6"}>
      {title && <h3 className="text-base font-semibold text-heading">{title}</h3>}

      <div>
        <span className="text-[11px] font-semibold uppercase tracking-wide text-body">Hook formula</span>
        <p className="mt-1.5 text-sm font-medium text-primary">{sop.hookFormula}</p>
      </div>

      <div>
        <span className="text-[11px] font-semibold uppercase tracking-wide text-body">Structure</span>
        <ol className="mt-1.5 flex flex-col gap-1.5">
          {sop.structure.map((step, i) => (
            <li key={i} className="flex gap-2 text-sm leading-snug text-heading">
              <span className="shrink-0 text-body">{i + 1}.</span>
              {step}
            </li>
          ))}
        </ol>
      </div>

      <div>
        <span className="text-[11px] font-semibold uppercase tracking-wide text-body">Pacing</span>
        <p className="mt-1.5 text-sm text-heading">{sop.pacing}</p>
      </div>

      {!compact && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wide text-body">Do</span>
            <ul className="mt-1.5 flex flex-col gap-1.5">
              {sop.dos.map((item, i) => (
                <li key={i} className="flex gap-2 text-sm leading-snug text-heading">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wide text-body">Don&rsquo;t</span>
            <ul className="mt-1.5 flex flex-col gap-1.5">
              {sop.donts.map((item, i) => (
                <li key={i} className="flex gap-2 text-sm leading-snug text-heading">
                  <X className="mt-0.5 h-3.5 w-3.5 shrink-0 text-danger" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </Card>
  );
}
