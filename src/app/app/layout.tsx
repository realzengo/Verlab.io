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
  const isPaywalled = headersList.get("x-paywalled") === "1";
  const hasNeverPaid = headersList.get("x-never-paid") === "1";
  const isAdmin = headersList.get("x-is-admin") === "1";

  return (
    <AppShell isPaywalled={isPaywalled} hasNeverPaid={hasNeverPaid} isAdmin={isAdmin}>
      {children}
    </AppShell>
  );
}
