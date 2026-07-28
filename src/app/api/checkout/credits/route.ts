import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCreditPacks, getPolarClient, type CreditPackId } from "@/lib/config/polar";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: { packId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const packs = getCreditPacks();
  const packId = body.packId as CreditPackId | undefined;
  if (!packId || !(packId in packs)) {
    return NextResponse.json({ error: "Invalid packId" }, { status: 400 });
  }

  const successUrl = process.env.POLAR_CHECKOUT_SUCCESS_URL;
  if (!successUrl) {
    return NextResponse.json({ error: "Checkout not configured" }, { status: 500 });
  }

  try {
    const checkout = await getPolarClient().checkouts.create({
      products: [packs[packId].polarProductId],
      externalCustomerId: user.id,
      customerEmail: user.email ?? undefined,
      successUrl,
    });
    return NextResponse.json({ url: checkout.url });
  } catch (error) {
    console.error("[checkout/credits] Polar checkout creation failed:", error);
    return NextResponse.json({ error: "Could not start checkout" }, { status: 500 });
  }
}
