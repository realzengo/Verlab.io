"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { CreditCard, KeyRound, Lock, LogOut, Trash2, User, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

interface NavEntry {
  label: string;
  href: string;
  icon: LucideIcon;
}

const TOP_NAV: NavEntry[] = [
  { label: "Account", href: "/app/settings", icon: User },
  { label: "Subscription", href: "/app/settings/subscription", icon: CreditCard },
  { label: "Payment Method", href: "/app/settings/payment-method", icon: Wallet },
  { label: "API Keys", href: "/app/settings/api", icon: KeyRound },
  { label: "Password & Security", href: "/app/settings/security", icon: Lock },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex flex-col gap-6 pt-2">
      <h2 className="text-lg font-semibold text-heading">Settings</h2>

      <div className="flex flex-col gap-8 lg:flex-row">
        <aside className="flex w-full shrink-0 flex-col gap-1 lg:w-56">
          <nav className="flex flex-col gap-1">
            {TOP_NAV.map((entry) => {
              const active = pathname === entry.href;
              return (
                <Link
                  key={entry.href}
                  href={entry.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                    active ? "bg-accent text-primary" : "text-body hover:bg-app hover:text-heading"
                  )}
                >
                  <entry.icon className="h-4.5 w-4.5 shrink-0" />
                  {entry.label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-6 flex flex-col gap-1 border-t border-hairline pt-4">
            <button
              type="button"
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-body transition-colors hover:bg-app hover:text-heading"
            >
              <LogOut className="h-4.5 w-4.5 shrink-0" />
              Log out
            </button>
            <button
              type="button"
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-danger transition-colors hover:bg-danger-tint"
            >
              <Trash2 className="h-4.5 w-4.5 shrink-0" />
              Delete account
            </button>
          </div>
        </aside>

        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
