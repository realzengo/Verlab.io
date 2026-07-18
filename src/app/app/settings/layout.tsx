"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { CreditCard, KeyRound, Loader2, Lock, LogOut, Trash2, User, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

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
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleLogout() {
    setIsLoggingOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  async function handleDeleteAccount() {
    const confirmed = window.confirm(
      "This permanently deletes your account and all associated data. This cannot be undone. Continue?"
    );
    if (!confirmed) return;

    setDeleteError(null);
    setIsDeleting(true);

    const response = await fetch("/api/account", { method: "DELETE" });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setDeleteError(body.error ?? "Failed to delete account");
      setIsDeleting(false);
      return;
    }

    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-8 pt-2">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-heading">Settings</h2>
        <p className="mt-1 text-sm text-body">Manage your account, billing, and security preferences.</p>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row lg:gap-8">
        <aside className="flex w-full shrink-0 flex-col gap-4 lg:w-64">
          <nav className="flex flex-col gap-1 rounded-card-sm border border-hairline bg-surface p-2 shadow-card">
            {TOP_NAV.map((entry) => {
              const active = pathname === entry.href;
              return (
                <Link
                  key={entry.href}
                  href={entry.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "group flex items-center gap-3 rounded-xl px-2.5 py-2.5 text-sm font-medium transition-all",
                    active
                      ? "bg-gradient-to-r from-primary to-primary-hover text-white"
                      : "text-body hover:bg-app hover:text-heading"
                  )}
                >
                  <span
                    className={cn(
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors",
                      active ? "bg-white/15 text-white" : "bg-app text-subtle group-hover:text-heading"
                    )}
                  >
                    <entry.icon className="h-4 w-4" />
                  </span>
                  {entry.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex flex-col gap-1 rounded-card-sm border border-hairline bg-surface p-2 shadow-card">
            <button
              type="button"
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="flex items-center gap-3 rounded-xl px-2.5 py-2.5 text-left text-sm font-medium text-body transition-colors hover:bg-app hover:text-heading disabled:opacity-50"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-app text-subtle">
                {isLoggingOut ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <LogOut className="h-4 w-4" />
                )}
              </span>
              Log out
            </button>
            <button
              type="button"
              onClick={handleDeleteAccount}
              disabled={isDeleting}
              className="flex items-center gap-3 rounded-xl px-2.5 py-2.5 text-left text-sm font-medium text-danger transition-colors hover:bg-danger-tint disabled:opacity-50"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-danger-tint text-danger">
                {isDeleting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
              </span>
              Delete account
            </button>
            {deleteError && <p className="px-3 pb-1 text-xs text-danger">{deleteError}</p>}
          </div>
        </aside>

        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
