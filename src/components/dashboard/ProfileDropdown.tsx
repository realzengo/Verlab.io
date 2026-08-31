"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { ArrowUpCircle, ChevronDown, CircleDollarSign, LifeBuoy, LogOut, Moon, Settings } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Avatar } from "@/components/ui/Avatar";
import { Switch } from "@/components/ui/Switch";
import { useTheme } from "@/components/theme/ThemeProvider";
import { UpgradeModal } from "@/components/pricing/UpgradeModal";
import { cn } from "@/lib/utils";

function displayName(user: User | null): string {
  const meta = user?.user_metadata as { full_name?: string; name?: string } | undefined;
  return meta?.full_name ?? meta?.name ?? user?.email?.split("@")[0] ?? "";
}

function avatarUrl(user: User | null): string | null {
  const meta = user?.user_metadata as { avatar_url?: string; picture?: string } | undefined;
  return meta?.avatar_url ?? meta?.picture ?? null;
}

const SUPPORT_URL = "https://discord.gg/pG9uFUhJb4";

const NAV_LINKS = [
  { label: "Settings", href: "/settings", icon: Settings },
  { label: "Earn with Verlab", href: "/affiliates", icon: CircleDollarSign },
];

export function ProfileDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const [isUpgradeOpen, setIsUpgradeOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const name = displayName(user);
  const email = user?.email ?? "";

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setUser(data.user));

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        aria-label="Account menu"
        className="flex h-9 items-center gap-2 rounded-full border border-hairline bg-surface py-1 pl-1 pr-1 transition-colors hover:bg-accent sm:pr-3"
      >
        <Avatar name={name} src={avatarUrl(user)} size="sm" className="h-7 w-7 shrink-0" />
        {name && (
          <span className="hidden max-w-[10rem] truncate text-sm font-medium text-heading sm:inline">{name}</span>
        )}
        <ChevronDown className={cn("hidden h-4 w-4 shrink-0 text-subtle transition-transform sm:block", isOpen && "rotate-180")} />
      </button>

      {isOpen && (
        <div className="animate-menu-pop absolute top-full right-0 z-50 mt-2 w-64 overflow-hidden rounded-lg border border-hairline bg-surface shadow-card-hover">
          <div className="relative overflow-hidden border-b border-hairline bg-gradient-to-br from-accent to-transparent p-4">
            <div className="flex items-center gap-3">
              <Avatar name={name} src={avatarUrl(user)} size="md" className="ring-2 ring-surface" />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-heading">{name}</p>
                <p className="truncate text-xs text-subtle">{email}</p>
              </div>
            </div>
          </div>

          <div className="p-1.5">
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                setIsUpgradeOpen(true);
              }}
              className="group flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium text-heading transition-colors hover:bg-accent"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-accent text-primary transition-colors group-hover:bg-accent-line">
                <ArrowUpCircle className="h-4 w-4" />
              </span>
              Upgrade
            </button>
            {NAV_LINKS.map(({ label, href, icon: Icon }) => (
              <Link
                key={label}
                href={href}
                onClick={() => setIsOpen(false)}
                className="group flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium text-heading transition-colors hover:bg-accent"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-accent text-subtle transition-colors group-hover:bg-accent-line group-hover:text-heading">
                  <Icon className="h-4 w-4" />
                </span>
                {label}
              </Link>
            ))}
            <a
              href={SUPPORT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium text-heading transition-colors hover:bg-accent"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-accent text-subtle transition-colors group-hover:bg-accent-line group-hover:text-heading">
                <LifeBuoy className="h-4 w-4" />
              </span>
              24/7 Support
            </a>
          </div>

          <div className="border-t border-hairline p-1.5">
            <div className="flex w-full items-center justify-between gap-3 rounded-md px-2.5 py-2 text-sm font-medium text-heading">
              <span className="flex items-center gap-2.5">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-accent text-subtle">
                  <Moon className="h-4 w-4" />
                </span>
                Dark mode
              </span>
              <Switch
                checked={isDark}
                onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
                label={isDark ? "Switch to light mode" : "Switch to dark mode"}
                size="sm"
              />
            </div>
          </div>

          <div className="border-t border-hairline p-1.5">
            <button
              type="button"
              onClick={handleLogout}
              className="group flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium text-danger transition-colors hover:bg-danger-tint"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-danger-tint text-danger transition-colors group-hover:bg-danger/15">
                <LogOut className="h-4 w-4" />
              </span>
              Logout
            </button>
          </div>
        </div>
      )}

      <UpgradeModal isOpen={isUpgradeOpen} onClose={() => setIsUpgradeOpen(false)} />
    </div>
  );
}
