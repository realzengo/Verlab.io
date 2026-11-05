import Link from "next/link";
import { cn } from "@/lib/utils";
import { SettingsRow, SettingsSection, settingsButton } from "@/components/settings/SettingsSection";
import { RefreshHistoryButton } from "./RefreshHistoryButton";
import { TopUpButton } from "./TopUpButton";

export interface CreditTransaction {
  id: string;
  amount: number;
  feature: string;
  created_at: string;
}

const PLAN_LABELS: Record<string, string> = { core: "Core", pro: "Pro", scale: "Scale", free: "Free" };

function formatTransactionDate(iso: string): string {
  const date = new Date(iso);
  const datePart = date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const timePart = date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${datePart}, ${timePart}`;
}

/** "+500" for credits granted, "−120" (a true minus sign) for credits spent. */
function formatAmount(amount: number): string {
  return `${amount < 0 ? "−" : "+"}${Math.abs(amount).toLocaleString()}`;
}

export function CreditsView({
  credits,
  plan,
  canTopUp,
  history,
}: {
  credits: number;
  plan: string;
  /** Topping up only works on top of a plan that's actually being paid for. */
  canTopUp: boolean;
  history: CreditTransaction[];
}) {
  return (
    <div className="flex flex-col gap-10">
      <SettingsSection title="Balance">
        <div className="flex items-end justify-between gap-6 px-5 py-5">
          <div>
            <p className="text-sm leading-5 text-subtle">Available credits</p>
            <p className="mt-1 text-[32px] font-semibold leading-10 tracking-[-0.02em] tabular-nums text-heading">
              {credits.toLocaleString()}
            </p>
          </div>
          {/* /api/checkout/credits 403s without an active plan, so a
              non-subscriber gets no button to bounce off instead of one. */}
          {canTopUp && <TopUpButton />}
        </div>
        <SettingsRow
          label="Current plan"
          description={PLAN_LABELS[plan] ?? plan}
          control={
            <Link href="/settings/subscription" className={settingsButton()}>
              Manage plan
            </Link>
          }
        />
      </SettingsSection>

      <SettingsSection
        title="Usage history"
        description="Your 50 most recent credit transactions"
        action={<RefreshHistoryButton />}
      >
        {history.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <p className="text-sm font-medium text-heading">No credit activity yet</p>
            <p className="mt-0.5 text-sm text-subtle">Credits you spend or receive will show up here</p>
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-hairline">
                <th scope="col" className="h-10 px-5 text-xs font-medium text-subtle">
                  Activity
                </th>
                <th scope="col" className="hidden h-10 px-5 text-xs font-medium text-subtle sm:table-cell">
                  Date
                </th>
                <th scope="col" className="h-10 px-5 text-right text-xs font-medium text-subtle">
                  Credits
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {history.map((tx) => (
                <tr key={tx.id}>
                  <td className="px-5 py-3">
                    <span className="text-heading">{tx.feature}</span>
                    <span className="mt-0.5 block text-xs tabular-nums text-subtle sm:hidden">
                      {formatTransactionDate(tx.created_at)}
                    </span>
                  </td>
                  <td className="hidden whitespace-nowrap px-5 py-3 tabular-nums text-subtle sm:table-cell">
                    {formatTransactionDate(tx.created_at)}
                  </td>
                  <td
                    className={cn(
                      "whitespace-nowrap px-5 py-3 text-right font-medium tabular-nums",
                      tx.amount < 0 ? "text-heading" : "text-success"
                    )}
                  >
                    {formatAmount(tx.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </SettingsSection>
    </div>
  );
}
