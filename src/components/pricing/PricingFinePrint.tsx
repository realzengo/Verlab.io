import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * The two lines that sit under every set of plan cards (the /pricing page,
 * the in-app "Choose a plan" screen and the upgrade modal), so taxes and the
 * refund terms are visible before anyone picks a plan.
 */
export function PricingFinePrint({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-col items-center gap-1 text-center text-[13px] leading-5 text-subtle", className)}>
      <p>Prices in USD. Taxes may apply depending on your country.</p>
      <p>
        Cancel anytime.{" "}
        <Link
          href="/legal/refunds"
          className="font-medium text-heading underline decoration-heading/25 underline-offset-[3px] transition-colors hover:decoration-heading"
        >
          14-day refund policy
        </Link>
        .
      </p>
    </div>
  );
}
