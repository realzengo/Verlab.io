"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { hasActiveSubscription } from "@/lib/server/subscription";
import { cn } from "@/lib/utils";

interface NavEntry {
  label: string;
  href: string;
}

const ALL_TABS: NavEntry[] = [
  { label: "Account", href: "/settings" },
  { label: "Subscription", href: "/settings/subscription" },
  { label: "Credit History", href: "/settings/credits" },
  { label: "Password & Security", href: "/settings/security" },
  { label: "MCP", href: "/settings/mcp" },
];

// A paywalled account (no active subscription and no spendable credits) has
// nothing to manage on Subscription/Credits/MCP -- those all assume a plan
// or balance that doesn't exist yet. Account and Password & Security stay
// reachable regardless. Tabs start restricted (fail closed) so a paywalled
// account never gets a flash of tabs it shouldn't see while the profile loads.
const RESTRICTED_TABS: NavEntry[] = [
  { label: "Account", href: "/settings" },
  { label: "Password & Security", href: "/settings/security" },
];
const RESTRICTED_PATHS = new Set(RESTRICTED_TABS.map((tab) => tab.href));

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [hasAccess, setHasAccess] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || cancelled) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("subscription_status, subscription_current_period_end, credits")
        .eq("id", user.id)
        .single();

      if (cancelled) return;
      setHasAccess(hasActiveSubscription(profile) || (profile?.credits ?? 0) > 0);
      setChecked(true);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (checked && !hasAccess && !RESTRICTED_PATHS.has(pathname)) {
      router.replace("/settings");
    }
  }, [checked, hasAccess, pathname, router]);

  const tabs = checked && hasAccess ? ALL_TABS : RESTRICTED_TABS;

  return (
    <div className="bg-white text-heading dark:bg-[#000000]">
      <div className="w-full pt-6 px-4 pb-12 sm:pt-10 sm:px-6 sm:pb-16 md:px-8">
        <Link href="/" className="text-xl font-medium flex items-center gap-2 mb-4 sm:text-2xl sm:mb-6">
          <ArrowLeft className="h-5 w-5" />
          Settings
        </Link>

        <nav className="border-b border-hairline mb-6 flex gap-4 overflow-x-auto sm:mb-8 sm:gap-6">
          {tabs.map((tab) => {
            const active = pathname === tab.href;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "whitespace-nowrap text-sm pb-2 px-1 transition-colors",
                  active
                    ? "border-b-2 border-primary text-heading font-medium"
                    : "text-subtle hover:text-heading"
                )}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>

        {children}
      </div>
    </div>
  );
}
