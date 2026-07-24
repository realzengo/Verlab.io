"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { ArrowUpCircle, ChevronDown, CircleDollarSign, LogOut, Settings, Zap } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { CREDITS_CHANGED_EVENT } from "@/lib/client/credits-bus";
import { Avatar } from "@/components/ui/Avatar";
import { cn } from "@/lib/utils";

// Below this remaining share, the credits bar switches to a danger color so
// the user notices they're about to run out.
const LOW_CREDITS_THRESHOLD_PERCENT = 20;

// Fallback for actions that don't (yet) call notifyCreditsChanged() directly
// (e.g. transcripts, downloads) -- keeps the balance from ever drifting too
// far out of date even without an explicit signal.
const POLL_INTERVAL_MS = 20_000;

// Every account starts with 50 credits (see credits_system migration) — plans
// don't yet carry their own allotment, so this is the reference total the
// usage bar fills against.
const DEFAULT_CREDIT_ALLOTMENT = 50;

function displayName(user: User | null): string {
  const meta = user?.user_metadata as { full_name?: string; name?: string } | undefined;
  return meta?.full_name ?? meta?.name ?? user?.email?.split("@")[0] ?? "";
}

function avatarUrl(user: User | null): string | null {
  const meta = user?.user_metadata as { avatar_url?: string; picture?: string } | undefined;
  return meta?.avatar_url ?? meta?.picture ?? null;
}

const NAV_LINKS = [
  { label: "Upgrade", href: "/app/settings/subscription", icon: ArrowUpCircle },
  { label: "Settings", href: "/app/settings", icon: Settings },
  { label: "Earn with clippie", href: "/affiliates", icon: CircleDollarSign },
];

export function ProfileDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [credits, setCredits] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const name = displayName(user);
  const email = user?.email ?? "";
  const spentPercent = Math.min(
    100,
    Math.max(0, ((DEFAULT_CREDIT_ALLOTMENT - credits) / DEFAULT_CREDIT_ALLOTMENT) * 100)
  );
  const isLowCredits = 100 - spentPercent <= LOW_CREDITS_THRESHOLD_PERCENT;

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setUser(data.user));

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.subscription.unsubscribe();
  }, []);

  const refreshCredits = useCallback(() => {
    fetch("/api/credits")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setCredits(data.credits);
      })
      .catch(() => {
        // Keep showing the last known balance rather than blanking it.
      });
  }, []);

  useEffect(() => {
    refreshCredits();

    // Refetch whenever another part of the app knows a charge/grant just
    // happened (image generation completing, a script finishing, a niche
    // bend job settling, an admin grant, etc. -- see notifyCreditsChanged()
    // call sites), on tab focus (in case a background tab's async job
    // finished while this one was inactive), and on a slow poll as a
    // catch-all for anything not explicitly wired to the event yet.
    window.addEventListener(CREDITS_CHANGED_EVENT, refreshCredits);
    window.addEventListener("focus", refreshCredits);
    const intervalId = setInterval(refreshCredits, POLL_INTERVAL_MS);

    return () => {
      window.removeEventListener(CREDITS_CHANGED_EVENT, refreshCredits);
      window.removeEventListener("focus", refreshCredits);
      clearInterval(intervalId);
    };
  }, [refreshCredits]);

  useEffect(() => {
    if (!isOpen) return;

    // Also refresh the instant the menu opens -- the user is about to look
    // directly at this number, so it should never show a stale value from
    // before the last poll tick.
    refreshCredits();

    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, refreshCredits]);

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
        className="flex items-center gap-2 rounded-full border border-hairline bg-surface p-1 pl-1 pr-1 sm:pr-3"
      >
        <Avatar name={name} src={avatarUrl(user)} size="sm" className="h-6 w-6 sm:h-7 sm:w-7" />
        <span className="hidden max-w-[10rem] truncate text-sm font-medium text-heading sm:inline-block">
          {name}
        </span>
        <ChevronDown className="h-3.5 w-3.5 text-body" />
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-64 rounded-2xl border border-hairline bg-surface shadow-card-hover overflow-hidden z-50">
          <div className="p-4">
            <div className="flex items-center gap-3">
              <Avatar name={name} src={avatarUrl(user)} size="md" />
              <div className="min-w-0">
                <p className="text-heading font-semibold text-sm">{name}</p>
                <p className="text-subtle text-xs truncate">{email}</p>
              </div>
            </div>

            <div className="border-t border-hairline mt-3 pt-3">
              <div className="flex justify-between items-center mb-3">
                <div className="flex items-center gap-2">
                  <Zap className={cn("w-4 h-4", isLowCredits ? "text-danger fill-danger" : "text-primary fill-primary")} />
                  <span className="text-body text-sm font-medium">AI Credits</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className={cn("font-bold", isLowCredits ? "text-danger" : "text-heading")}>{credits}</span>
                  <span className="text-subtle text-xs">left</span>
                </div>
              </div>
              <div
                className="w-full h-1 rounded-full bg-accent overflow-hidden mb-3"
                role="progressbar"
                aria-label="AI credits used"
                aria-valuenow={Math.round(spentPercent)}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div
                  className={cn("h-full rounded-full transition-all", isLowCredits ? "bg-danger" : "bg-primary")}
                  style={{ width: `${spentPercent}%` }}
                />
              </div>
              <Link
                href="/app/settings/subscription"
                className="w-full block text-center border border-hairline hover:bg-accent text-body text-xs font-medium py-2 rounded-lg transition-colors"
              >
                Details
              </Link>
            </div>
          </div>

          <div className="border-t border-hairline mt-2">
            {NAV_LINKS.map(({ label, href, icon: Icon }) => (
              <Link
                key={label}
                href={href}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-accent transition-colors text-heading text-sm font-medium"
              >
                <Icon className="w-4 h-4" />
                {label}
              </Link>
            ))}
          </div>

          <div className="border-t border-hairline">
            <button
              type="button"
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-accent transition-colors text-heading text-sm font-medium"
            >
              <LogOut className="w-4 h-4 text-danger" />
              Logout
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
