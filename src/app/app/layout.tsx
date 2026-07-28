import { headers } from "next/headers";
import { AppShell } from "@/components/dashboard/AppShell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const headersList = await headers();
  const isPaywalled = headersList.get("x-paywalled") === "1";

  return <AppShell isPaywalled={isPaywalled}>{children}</AppShell>;
}
