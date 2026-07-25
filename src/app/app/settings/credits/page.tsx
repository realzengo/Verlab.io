import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

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

        <div className="flex flex-col sm:flex-row sm:items-center justify-between py-4 border-b border-hairline last:border-0">
          <div>
            <p className="font-medium text-heading text-sm sm:text-base">Available credits</p>
            <p className="text-body text-xs sm:text-sm mt-0.5">Your remaining AI credit balance.</p>
            <p className="mt-2 text-heading text-sm font-semibold">{credits.toLocaleString()}</p>
          </div>
          <Link
            href="/app/settings/subscription"
            className="mt-3 sm:mt-0 self-start px-4 py-1.5 bg-heading text-app rounded-md text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Top up
          </Link>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between py-4 border-b border-hairline last:border-0">
          <div>
            <p className="font-medium text-heading text-sm sm:text-base">Current plan</p>
            <p className="text-body text-xs sm:text-sm mt-0.5">Your active subscription plan.</p>
            <p className="mt-2 text-heading text-sm font-semibold">{PLAN_LABELS[plan] ?? plan}</p>
          </div>
          <Link
            href="/app/settings/subscription"
            className="mt-3 sm:mt-0 self-start px-4 py-1.5 border border-hairline rounded-md text-sm font-medium hover:bg-surface transition-colors"
          >
            Manage plan
          </Link>
        </div>
      </div>

      {/* History section */}
      <div>
        <h2 className="font-bold text-lg mb-6 mt-10 text-heading">History</h2>

        {history.length === 0 ? (
          <p className="py-4 text-sm text-body">Your credit usage will appear here.</p>
        ) : (
          <div>
            {history.map((tx) => (
              <div
                key={tx.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between py-4 border-b border-hairline last:border-0"
              >
                <div>
                  <p className="font-medium text-heading text-sm sm:text-base">{tx.feature}</p>
                  <p className="text-body text-xs sm:text-sm mt-0.5">{formatTransactionDate(tx.created_at)}</p>
                </div>
                <p
                  className={`mt-2 sm:mt-0 text-sm font-semibold ${
                    tx.amount < 0 ? "text-danger" : "text-success"
                  }`}
                >
                  {tx.amount < 0 ? "-" : "+"}
                  {Math.abs(tx.amount)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
