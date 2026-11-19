"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { hasActiveSubscription } from "@/lib/subscription-status";
import { cn } from "@/lib/utils";

interface NavEntry {
  label: string;
  href: string;
}

const ALL_TABS: NavEntry[] = [
  { label: "Account", href: "/settings" },
  { label: "Subscription", href: "/settings/subscription" },
  { label: "Credits", href: "/settings/credits" },
  { label: "Security", href: "/settings/security" },
  { label: "Connected apps", href: "/settings/mcp" },
];

// A paywalled account (no active subscription and no spendable credits) has
// nothing to manage on Subscription/Credits/MCP -- those all assume a plan
// or balance that doesn't exist yet. Account and Password & Security stay
// reachable regardless. Tabs start restricted (fail closed) so a paywalled
// account never gets a flash of tabs it shouldn't see while the profile loads.
const RESTRICTED_TABS: NavEntry[] = [
  { label: "Account", href: "/settings" },
  { label: "Security", href: "/settings/security" },
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
      <div className="mx-auto w-full max-w-3xl px-4 pb-16 pt-6 sm:px-6 sm:pt-10">
        <h1 className="text-2xl font-semibold tracking-[-0.02em] text-heading sm:text-[28px]">Settings</h1>

        <nav
          aria-label="Settings"
          className="-mx-4 mt-5 flex gap-6 overflow-x-auto border-b border-hairline px-4 [scrollbar-width:none] sm:mx-0 sm:px-0"
        >
          {tabs.map((tab) => {
            const active = pathname === tab.href;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "-mb-px flex h-10 shrink-0 items-center whitespace-nowrap border-b-2 text-sm transition-colors duration-150",
                  active
                    ? "border-primary font-medium text-heading"
                    : "border-transparent text-subtle hover:text-heading"
                )}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-8">{children}</div>
      </div>
    </div>
  );
}
