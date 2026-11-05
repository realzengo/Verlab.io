import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hasActiveSubscription } from "@/lib/subscription-status";
import { CreditsView, type CreditTransaction } from "./CreditsView";

export const dynamic = "force-dynamic";

export default async function CreditHistorySettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const [{ data: profile }, { data: transactions }] = await Promise.all([
    supabase
      .from("profiles")
      .select("credits, plan, subscription_status, subscription_current_period_end")
      .eq("id", user.id)
      .single(),
    supabase
      .from("credit_transactions")
      .select("id, amount, feature, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const credits = profile?.credits ?? 0;
  // profiles.plan defaults to "core" and keeps its last paid value after a
  // subscription lapses -- it does not mean the account is actually paying
  // (see displayPlan() in admin-queries.ts for the same fix on the admin
  // side). Gate on hasActiveSubscription, the same check the /app paywall
  // and the topup checkout use, so this page never claims a plan the account
  // hasn't actually paid for.
  const userHasActiveSubscription = hasActiveSubscription(profile);
  const plan = userHasActiveSubscription ? profile?.plan ?? "core" : "free";
  const history = (transactions ?? []) as CreditTransaction[];

  return <CreditsView credits={credits} plan={plan} canTopUp={userHasActiveSubscription} history={history} />;
}
