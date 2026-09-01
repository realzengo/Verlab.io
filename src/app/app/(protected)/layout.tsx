import { headers } from "next/headers";
import { PaywallPricing } from "@/components/dashboard/PaywallPricing";

// This is a separate route-group layout from `/app/settings` specifically
// so the two never share a cached layout boundary. Next.js reuses an
// already-rendered layout's output across sibling-page navigations without
// re-requesting it from the server (see the "Client Cache" behavior in the
// Next.js docs) -- if this gate lived in the single outer `/app/layout.tsx`
// that both settings and every tool page shared, then visiting
// /app/settings (which proxy.ts deliberately never paywalls, so a lapsed
// subscriber can still fix billing) would cache that layout's "not
// paywalled" render, and navigating back to Home/Library/etc. afterward
// would reuse that stale decision instead of re-checking -- silently
// unlocking the whole dashboard. Because this layout only wraps the gated
// routes, crossing the boundary from settings back into any of them always
// requires Next.js to render this file fresh off the current request's
// headers (set by proxy.ts from the live subscription/credits state in the
// database), so there is nothing cached client-side for a bypass to reuse.
export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const headersList = await headers();
  const isPaywalled = headersList.get("x-paywalled") === "1";
  const hasNeverPaid = headersList.get("x-never-paid") === "1";

  if (isPaywalled) {
    return <PaywallPricing hasNeverPaid={hasNeverPaid} />;
  }

  return <>{children}</>;
}
