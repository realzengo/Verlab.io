import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SubscriptionTab } from "@/components/settings/SubscriptionTab";

export const dynamic = "force-dynamic";

export default async function SubscriptionSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("plan, subscription_status, subscription_period, subscription_current_period_end")
    .eq("id", user.id)
    .single();

  return (
    <SubscriptionTab
      plan={profile?.plan ?? "core"}
      subscriptionStatus={profile?.subscription_status ?? null}
      subscriptionPeriod={profile?.subscription_period ?? null}
      currentPeriodEnd={profile?.subscription_current_period_end ?? null}
    />
  );
}
