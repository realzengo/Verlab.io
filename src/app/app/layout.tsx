import type { Metadata } from "next";
import { headers } from "next/headers";
import { AppShell } from "@/components/dashboard/AppShell";

// The dashboard is gated behind login and a paid subscription -- nothing
// here should ever appear in search results.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const headersList = await headers();
  // Cosmetic only (Upgrade button, "Pricing" heading, greeting) -- this
  // layout is shared with /app/settings, which proxy.ts never paywalls, so
  // isPaywalled reads false whenever it was last rendered from a settings
  // navigation. That's fine here since nothing security-sensitive depends
  // on it; the actual gate lives in `(protected)/layout.tsx`, which is a
  // separate layout boundary from settings for exactly that reason -- see
  // the comment there.
  const isPaywalled = headersList.get("x-paywalled") === "1";
  const isAdmin = headersList.get("x-is-admin") === "1";

  return (
    <AppShell isPaywalled={isPaywalled} isAdmin={isAdmin}>
      {children}
    </AppShell>
  );
}
