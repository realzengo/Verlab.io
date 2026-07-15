"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { PRICING_PLANS } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

export function SidebarFooter({
  collapsed,
  onToggleCollapse,
  onNavigate,
}: {
  collapsed: boolean;
  onToggleCollapse: () => void;
  onNavigate?: () => void;
}) {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setUser(data.user));

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.subscription.unsubscribe();
  }, []);

  const email = user?.email ?? "";
  const initial = email ? email.charAt(0).toUpperCase() : "?";
  const planId = user?.user_metadata?.plan as string | undefined;
  const planName = PRICING_PLANS.find((plan) => plan.id === planId)?.name ?? "Free";

  return (
    <div className="border-t border-hairline p-3">
      <button
        type="button"
        onClick={onToggleCollapse}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        className="hidden md:flex items-center justify-center w-full gap-2 text-sm font-medium text-body hover:text-heading mb-3 cursor-pointer"
      >
        {collapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
        {!collapsed && "Collapse"}
      </button>

      <Link
        href="/app/settings"
        onClick={onNavigate}
        className={cn(
          "flex items-center w-full rounded-xl hover:bg-app transition-colors cursor-pointer text-left px-3 py-3.5 active:bg-accent md:py-2.5",
          collapsed && "md:justify-center md:px-0"
        )}
      >
        <div className="rounded-full bg-green-500 flex items-center justify-center text-white font-semibold shrink-0 w-10 h-10 text-sm md:w-8 md:h-8 md:text-xs">
          {initial}
        </div>

        <div className={cn("flex flex-col ml-3 flex-1 min-w-0", collapsed && "md:hidden")}>
          <span className="text-sm font-semibold text-heading truncate w-full">
            {email}
          </span>
          <span className="text-[10px] md:text-[10px] uppercase tracking-wider text-subtle font-medium truncate w-full">
            {planName}
          </span>
        </div>

        <ChevronRight
          className={cn(
            "text-subtle shrink-0 ml-2 w-5 h-5 md:w-4 md:h-4",
            collapsed && "md:hidden"
          )}
        />
      </Link>
    </div>
  );
}
