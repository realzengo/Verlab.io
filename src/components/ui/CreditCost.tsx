import { Zap } from "lucide-react";
import { cn } from "@/lib/utils";

interface CreditCostProps {
  amount: number;
  /** Use when the actual charge depends on server-side state (e.g. cache hits) and this is the worst case. */
  approx?: boolean;
  /** Leading middot separator -- omit when this stands alone (e.g. on its own line) rather than trailing label text. */
  bullet?: boolean;
  className?: string;
}

export function CreditCost({ amount, approx = false, bullet = true, className }: CreditCostProps) {
  return (
    <span className={cn("inline-flex items-center gap-1 whitespace-nowrap", className)}>
      {bullet && <span aria-hidden="true">&middot;</span>}
      <Zap className="h-3.5 w-3.5" />
      {approx ? `up to ${amount}` : amount}
    </span>
  );
}
