import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { serverError } from "@/lib/server/api-error";

export async function GET(): Promise<NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const [{ data: profile, error: profileError }, { data: transactions, error: txError }, counts] =
    await Promise.all([
      supabase.from("profiles").select("credits").eq("id", user.id).single(),
      supabase.from("credit_transactions").select("amount").eq("user_id", user.id),
      Promise.all([
        supabase.from("image_generations").select("id", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("niche_bend_jobs").select("id", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("downloads").select("id", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("transcripts").select("id", { count: "exact", head: true }).eq("user_id", user.id),
      ]),
    ]);

  if (profileError || !profile || txError) {
    return serverError("credits/summary GET", profileError ?? txError, "Could not load credits");
  }

  const balance = profile.credits;
  const allocated = (transactions ?? []).filter((tx) => tx.amount > 0).reduce((sum, tx) => sum + tx.amount, 0);
  const used = (transactions ?? []).filter((tx) => tx.amount < 0).reduce((sum, tx) => sum + Math.abs(tx.amount), 0);

  const [images, bends, downloads, transcripts] = counts;

  return NextResponse.json({
    allocated,
    used,
    balance,
    images: images.count ?? 0,
    bends: bends.count ?? 0,
    downloads: downloads.count ?? 0,
    transcripts: transcripts.count ?? 0,
  });
}
