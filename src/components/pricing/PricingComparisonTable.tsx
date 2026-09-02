import { Check, X } from "lucide-react";
import type { ComparisonRow, PricingPlan } from "@/lib/types";
import { cn } from "@/lib/utils";

const COLUMN_KEYS = ["core", "pro", "scale"] as const;

function Cell({ value, highlighted }: { value: boolean | string; highlighted: boolean }) {
  return (
    <td className={cn("px-4 py-4 text-center sm:px-6", highlighted && "bg-primary/[0.04]")}>
      {typeof value === "string" ? (
        <span className={cn("text-[13.5px]", highlighted ? "font-bold text-heading" : "font-medium text-body")}>{value}</span>
      ) : value ? (
        <Check
          className={cn("mx-auto h-5 w-5", highlighted ? "text-primary" : "text-success")}
          strokeWidth={2.75}
        />
      ) : (
        <X className="mx-auto h-4 w-4 text-subtle/40" strokeWidth={2.5} />
      )}
    </td>
  );
}

export function PricingComparisonTable({ plans, rows }: { plans: PricingPlan[]; rows: ComparisonRow[] }) {
  return (
    <div className="mx-auto max-w-5xl overflow-hidden rounded-[28px] border border-hairline bg-surface shadow-card">
      <table className="w-full min-w-[640px] border-collapse text-left">
        <thead>
          <tr className="border-b border-hairline">
            <th className="w-[38%] bg-app px-5 py-5 align-bottom text-[11px] font-bold uppercase tracking-[0.08em] text-subtle sm:px-8">
              Feature
            </th>
            {plans.map((plan) => (
              <th
                key={plan.id}
                className={cn(
                  "relative bg-app px-4 py-5 text-center align-bottom sm:px-6",
                  plan.recommended && "bg-primary/[0.04]",
                )}
              >
                {plan.recommended && (
                  <span aria-hidden className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-primary/40 via-primary to-primary/40" />
                )}
                <div className="flex flex-col items-center gap-1">
                  {plan.recommended && (
                    <span className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-primary">Most popular</span>
                  )}
                  <span className={cn("text-[15px] font-bold", plan.recommended ? "text-primary" : "text-heading")}>
                    {plan.name}
                  </span>
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.feature} className="border-b border-hairline last:border-0">
              <td className="px-5 py-4 text-[13.5px] font-semibold text-heading sm:px-8">{row.feature}</td>
              {COLUMN_KEYS.map((key, colIndex) => (
                <Cell key={key} value={row[key]} highlighted={plans[colIndex]?.recommended ?? false} />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
