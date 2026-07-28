import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CheckoutSyncScreen } from "./CheckoutSyncScreen";

export const dynamic = "force-dynamic";

export default async function CheckoutSuccessPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("credits, plan, subscription_status")
    .eq("id", user.id)
    .single();

  return (
    <CheckoutSyncScreen
      initial={{
        credits: profile?.credits ?? 0,
        plan: profile?.plan ?? "core",
        subscription_status: profile?.subscription_status ?? null,
      }}
    />
  );
}
