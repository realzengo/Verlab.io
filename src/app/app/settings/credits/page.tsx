import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowUpRight, Coins, CreditCard } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { RefreshHistoryButton } from "./RefreshHistoryButton";
import { TopUpButton } from "./TopUpButton";

export const dynamic = "force-dynamic";

interface CreditTransaction {
  id: string;
  amount: number;
  feature: string;
  created_at: string;
}

const PLAN_LABELS: Record<string, string> = { core: "Core", pro: "Pro", scale: "Scale" };

function formatTransactionDate(iso: string): string {
  const date = new Date(iso);
  const datePart = date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const timePart = date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${datePart} • ${timePart}`;
}

function isLinkAction(action: unknown): action is { href: string; text: string } {
  return typeof action === "object" && action !== null && "href" in action && "text" in action;
}

function StatCard({
  icon,
  label,
  value,
  action,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  action: { href: string; text: string } | React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-hairline bg-surface p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-body">
          {icon}
          <span className="text-sm font-medium">{label}</span>
        </div>
        {isLinkAction(action) ? (
          <Link
            href={action.href}
            className="inline-flex shrink-0 items-center gap-1 rounded-full border border-hairline bg-app py-1.5 pl-3 pr-2.5 text-xs font-semibold text-heading transition-colors hover:border-subtle/40 hover:bg-accent/40"
          >
            {action.text}
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        ) : (
          action
        )}
      </div>
      <p className="mt-3 text-2xl font-bold text-heading">{value}</p>
    </div>
  );
}

export default async function CreditHistorySettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const [{ data: profile }, { data: transactions }] = await Promise.all([
    supabase.from("profiles").select("credits, plan").eq("id", user.id).single(),
    supabase
      .from("credit_transactions")
      .select("id, amount, feature, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const credits = profile?.credits ?? 0;
  const plan = profile?.plan ?? "core";
  const history = (transactions ?? []) as CreditTransaction[];

  return (
    <div>
      {/* Overview section */}
      <div>
        <h2 className="font-bold text-lg mb-6 mt-10 first:mt-0 text-heading">Overview</h2>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <StatCard
            icon={<Coins className="h-4 w-4" />}
            label="Available credits"
            value={credits.toLocaleString()}
            action={<TopUpButton />}
          />
          <StatCard
            icon={<CreditCard className="h-4 w-4" />}
            label="Current plan"
            value={PLAN_LABELS[plan] ?? plan}
            action={{ href: "/settings/subscription", text: "Manage plan" }}
          />
        </div>
      </div>

      {/* History section */}
      <div>
        <div className="flex items-start justify-between gap-4 mt-10 mb-6">
          <div>
            <h2 className="font-bold text-lg text-heading">Credit Usage History</h2>
            <p className="text-body text-xs sm:text-sm mt-0.5">Your most recent credit activity.</p>
          </div>
          <RefreshHistoryButton />
        </div>

        {history.length === 0 ? (
          <p className="py-4 text-sm text-body">Your credit usage will appear here.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-hairline">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="border-b border-hairline">
                  <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-subtle">
                    Usage Category
                  </th>
                  <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-subtle">Amount</th>
                  <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-subtle">Source</th>
                  <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-subtle">Date</th>
                </tr>
              </thead>
              <tbody>
                {history.map((tx) => (
                  <tr key={tx.id} className="border-b border-hairline last:border-0">
                    <td className="px-4 py-3.5 font-medium text-heading">{tx.feature}</td>
                    <td className="px-4 py-3.5 text-body">{Math.abs(tx.amount).toLocaleString()}</td>
                    <td className="px-4 py-3.5">
                      <span className="inline-flex items-center rounded-full border border-hairline px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-heading">
                        {tx.amount < 0 ? "Spent" : "Granted"}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap text-body">{formatTransactionDate(tx.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
