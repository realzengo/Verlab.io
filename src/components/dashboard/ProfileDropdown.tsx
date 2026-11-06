"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import {
  ArrowUpCircle,
  ArrowUpRight,
  ChevronDown,
  CircleDollarSign,
  LifeBuoy,
  LogOut,
  Monitor,
  Moon,
  Settings,
  Sun,
  SunMoon,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { CREDITS_CHANGED_EVENT } from "@/lib/client/credits-bus";
import { Avatar } from "@/components/ui/Avatar";
import { Skeleton } from "@/components/ui/Skeleton";
import { useTheme } from "@/components/theme/ThemeProvider";
import { UpgradeModal } from "@/components/pricing/UpgradeModal";
import { cn } from "@/lib/utils";

interface CreditsSummary {
  allocated: number;
  used: number;
  balance: number;
}

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

const THEME_OPTIONS = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
] as const;

// The sidebar's row recipe at menu density: neutral rows, a quiet fill on
// hover, icons in the muted text role. The only accent is Upgrade's icon
// and the credits meter.
const ITEM =
  "font-ui group flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-[14px] font-medium text-body outline-none transition-colors hover:bg-(--app-fill) hover:text-heading focus-visible:bg-(--app-fill) focus-visible:text-heading";
const ITEM_ICON = "h-4 w-4 shrink-0 text-subtle transition-colors group-hover:text-body group-focus-visible:text-body";

function Separator() {
  return <div role="separator" className="-mx-1.5 my-1.5 h-px bg-hairline" />;
}

export function ProfileDropdown({ isPaywalled = false }: { isPaywalled?: boolean }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isUpgradeOpen, setIsUpgradeOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [summary, setSummary] = useState<CreditsSummary | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const router = useRouter();
  const { theme, setTheme } = useTheme();

  const name = displayName(user);
  const email = user?.email ?? "";
  // The bar is a fuel gauge: it shows what's left, the same figure printed
  // above it, and turns amber then red as the balance runs low.
  const remainingRatio =
    summary && summary.allocated > 0 ? Math.max(0, Math.min(1, summary.balance / summary.allocated)) : null;

  const refreshSummary = useCallback(() => {
    fetch("/api/credits/summary")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setSummary(data);
      })
      .catch(() => {
        // Keep showing the last known summary rather than blanking it.
      });
  }, []);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setUser(data.user));

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (isPaywalled) return;
    refreshSummary();
    window.addEventListener(CREDITS_CHANGED_EVENT, refreshSummary);
    return () => window.removeEventListener(CREDITS_CHANGED_EVENT, refreshSummary);
  }, [isPaywalled, refreshSummary]);

  useEffect(() => {
    if (!isOpen) return;
    if (!isPaywalled) refreshSummary();

    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setIsOpen(false);
      triggerRef.current?.focus();
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, isPaywalled, refreshSummary]);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        aria-label="Account menu"
        aria-haspopup="true"
        aria-expanded={isOpen}
        className={cn(
          "flex h-9 items-center gap-2 rounded-full border border-hairline bg-surface py-1 pl-1 pr-1 outline-none transition-colors hover:bg-(--app-fill) focus-visible:ring-2 focus-visible:ring-primary/40 sm:pr-3",
          isOpen && "bg-(--app-fill)"
        )}
      >
        <Avatar name={name} src={avatarUrl(user)} size="sm" className="h-7 w-7 shrink-0" />
        {name && (
          <span className="hidden max-w-[10rem] truncate text-sm font-medium text-heading sm:inline">{name}</span>
        )}
        <ChevronDown className={cn("hidden h-4 w-4 shrink-0 text-subtle transition-transform sm:block", isOpen && "rotate-180")} />
      </button>

      {isOpen && (
        <div className="animate-menu-pop absolute top-full right-0 z-50 mt-2 w-68 rounded-[14px] border border-hairline bg-surface p-1.5 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_12px_32px_-12px_rgba(16,24,40,0.2)] dark:shadow-[0_16px_40px_-12px_rgba(0,0,0,0.7)]">
          <div className="flex items-center gap-3 px-2.5 py-2">
            <Avatar name={name} src={avatarUrl(user)} size="md" className="shrink-0" />
            <div className="min-w-0">
              <p className="truncate text-[14px] font-medium leading-5 text-heading">{name}</p>
              <p className="truncate text-[13px] leading-5 text-subtle">{email}</p>
            </div>
          </div>

          {!isPaywalled && (
            <div className="mt-1 rounded-lg bg-(--app-fill) px-2.5 pb-3 pt-2.5">
              <p className="text-[12px] leading-4 text-subtle">Credits</p>
              {summary == null ? (
                <Skeleton className="mt-1 h-6 w-36 rounded" />
              ) : (
                <p className="mt-1 truncate leading-6 tabular-nums">
                  <span className="text-[18px] font-semibold tracking-tight text-heading">
                    {summary.balance.toLocaleString()}
                  </span>
                  <span className="text-[13px] text-subtle"> / {summary.allocated.toLocaleString()}</span>
                </p>
              )}
              <div className="mt-2.5 h-1 w-full overflow-hidden rounded-full bg-(--app-fill-strong)">
                <div
                  className={cn(
                    "h-full rounded-full transition-[width] duration-500 ease-out",
                    remainingRatio == null || remainingRatio > 0.2
                      ? "bg-primary"
                      : remainingRatio > 0.05
                        ? "bg-warning"
                        : "bg-danger"
                  )}
                  style={{ width: `${(remainingRatio ?? 0) * 100}%` }}
                />
              </div>
            </div>
          )}

          <Separator />

          {!isPaywalled && (
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                setIsUpgradeOpen(true);
              }}
              className={ITEM}
            >
              <ArrowUpCircle className="h-4 w-4 shrink-0 text-primary" />
              Upgrade
            </button>
          )}
          {NAV_LINKS.filter(({ href }) => !isPaywalled || href !== "/affiliates").map(({ label, href, icon: Icon }) => (
            <Link key={label} href={href} onClick={() => setIsOpen(false)} className={ITEM}>
              <Icon className={ITEM_ICON} />
              {label}
            </Link>
          ))}
          <a href={SUPPORT_URL} target="_blank" rel="noopener noreferrer" className={ITEM}>
            <LifeBuoy className={ITEM_ICON} />
            <span className="flex-1 text-left">Support</span>
            <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-subtle" aria-hidden="true" />
          </a>

          <Separator />

          <div className="font-ui flex h-9 items-center justify-between gap-3 px-2.5 text-[14px] font-medium text-body">
            <span className="flex items-center gap-2.5">
              <SunMoon className="h-4 w-4 shrink-0 text-subtle" />
              Theme
            </span>
            <div role="radiogroup" aria-label="Theme" className="flex rounded-md bg-(--app-fill-strong) p-0.5">
              {THEME_OPTIONS.map(({ value, label, icon: Icon }) => {
                const active = theme === value;
                return (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    aria-label={label}
                    title={label}
                    onClick={() => setTheme(value)}
                    className={cn(
                      "flex h-6 w-7 items-center justify-center rounded outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/40",
                      active
                        ? "bg-surface text-heading shadow-[0_1px_2px_rgba(16,24,40,0.08),0_0_0_0.5px_rgba(16,24,40,0.08)] dark:bg-white/[0.12] dark:shadow-none"
                        : "text-subtle hover:text-heading"
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </button>
                );
              })}
            </div>
          </div>

          <Separator />

          <button type="button" onClick={handleLogout} className={ITEM}>
            <LogOut className={ITEM_ICON} />
            Log out
          </button>
        </div>
      )}

      {!isPaywalled && <UpgradeModal isOpen={isUpgradeOpen} onClose={() => setIsUpgradeOpen(false)} />}
    </div>
  );
}
