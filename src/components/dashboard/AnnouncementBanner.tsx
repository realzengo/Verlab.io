"use client";

import { Suspense, useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ArrowRight, X } from "lucide-react";
import { DEFAULT_CTA_LABEL, isExternalHref, safeCtaHref, type Announcement } from "@/lib/announcements";
import { cn } from "@/lib/utils";

// Ids the user closed, newest last. Per browser: a new announcement gets a new
// id, so closing one never hides the next.
const DISMISSED_KEY = "verlab-dismissed-announcements";
const DISMISSED_MAX = 50;
// Past this (~24.8 days) setTimeout fires at once, so later expiries wait for a reload.
const MAX_TIMER_MS = 2_147_483_647;

const dismissListeners = new Set<() => void>();

function subscribeDismissed(listener: () => void) {
  dismissListeners.add(listener);
  // Closed in another tab.
  const onStorage = (event: StorageEvent) => {
    if (event.key === DISMISSED_KEY || event.key === null) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    dismissListeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function readDismissed(): string {
  try {
    return window.localStorage.getItem(DISMISSED_KEY) ?? "";
  } catch {
    return "";
  }
}

// null while rendering on the server and hydrating: nothing is known about
// this browser yet, so the bar stays folded instead of flashing a closed one.
function readDismissedOnServer(): null {
  return null;
}

function parseIds(raw: string): string[] {
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

function rememberDismissed(id: string) {
  const ids = parseIds(readDismissed()).filter((existing) => existing !== id);
  ids.push(id);
  try {
    window.localStorage.setItem(DISMISSED_KEY, JSON.stringify(ids.slice(-DISMISSED_MAX)));
  } catch {
    // Private mode or full storage: the banner still hides it for this session.
  }
  dismissListeners.forEach((listener) => listener());
}

// Screens sized to the viewport, where a bar above would push their bottom
// edge off screen: a clip project (processing, then the editor).
function isFullHeightScreen(pathname: string, searchParams: { has(name: string): boolean }): boolean {
  const path = pathname.replace(/^\/app(?=\/|$)/, "") || "/";
  return path.startsWith("/clipping") && searchParams.has("project");
}

/**
 * The bar at the top of the app: the newest live announcement this browser
 * hasn't closed. It folds open after hydration (closed ids only exist in
 * localStorage) and folds shut on close, on expiry, and on full-height screens.
 */
export function AnnouncementBanner({ announcements }: { announcements: Announcement[] }) {
  if (announcements.length === 0) return null;
  // useSearchParams wants a Suspense boundary of its own on static routes.
  return (
    <Suspense fallback={null}>
      <AnnouncementSlot announcements={announcements} />
    </Suspense>
  );
}

function AnnouncementSlot({ announcements }: { announcements: Announcement[] }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const stored = useSyncExternalStore(subscribeDismissed, readDismissed, readDismissedOnServer);
  // Also kept here, so a close holds even when storage can't be written.
  const [closedIds, setClosedIds] = useState<string[]>([]);
  const [expiredIds, setExpiredIds] = useState<string[]>([]);

  // A session can outlive an offer: fold each one away when it ends.
  useEffect(() => {
    const timers = announcements.flatMap((announcement) => {
      if (!announcement.expiresAt) return [];
      const delay = Date.parse(announcement.expiresAt) - Date.now();
      if (Number.isNaN(delay) || delay > MAX_TIMER_MS) return [];
      return [setTimeout(() => setExpiredIds((ids) => [...ids, announcement.id]), Math.max(0, delay))];
    });
    return () => timers.forEach(clearTimeout);
  }, [announcements]);

  let current: Announcement | null = null;
  if (stored !== null && !isFullHeightScreen(pathname, searchParams)) {
    const hidden = new Set([...parseIds(stored), ...closedIds, ...expiredIds]);
    current = announcements.find((announcement) => !hidden.has(announcement.id)) ?? null;
  }

  // The last one stays rendered while the bar folds shut.
  const [shown, setShown] = useState<Announcement | null>(null);
  if (current && current !== shown) setShown(current);

  const open = current !== null;
  const announcement = current ?? shown;

  function dismiss(id: string) {
    setClosedIds((ids) => [...ids, id]);
    rememberDismissed(id);
  }

  return (
    <div
      className={cn(
        "grid transition-[grid-template-rows] duration-[240ms] ease-[cubic-bezier(0.2,0,0,1)] motion-reduce:transition-none",
        open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
      )}
    >
      <div className="min-h-0 overflow-hidden" inert={!open}>
        {announcement && <AnnouncementBar announcement={announcement} onDismiss={() => dismiss(announcement.id)} />}
      </div>
    </div>
  );
}

// Verlab's announcement bar: solid brand blue, white text, nothing else.
// Follows unslop's interface rules (github.com/heydamir/unslop, by Damir
// Sokolovsky, CC BY 4.0): no gradients, glows or shimmer; weights 400/500;
// sentence-case labels; tabular numbers; one short fade-and-rise entrance;
// visible focus rings. White on #335cff is about 5.1:1. Same in light and
// dark mode.
const FOCUS_RING = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70";

/** "4d 04:51:46" / "04:51:46" until `expiresAt`; null with no end date or once it has passed. */
export function formatCountdown(msLeft: number): string | null {
  if (!(msLeft > 0)) return null;
  const total = Math.floor(msLeft / 1000);
  const days = Math.floor(total / 86_400);
  const pad = (n: number) => String(n).padStart(2, "0");
  const clock = `${pad(Math.floor((total % 86_400) / 3600))}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`;
  return days > 0 ? `${days}d ${clock}` : clock;
}

/** Ticks once a second while there's an end date. Starts empty, so server and first client render agree. */
function useCountdown(expiresAt: string | null): string | null {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    if (!expiresAt) return;
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const timer = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [expiresAt]);
  if (!expiresAt || now === null) return null;
  return formatCountdown(Date.parse(expiresAt) - now);
}

/** The bar itself, without any state. Also the admin page's preview. */
export function AnnouncementBar({ announcement, onDismiss }: { announcement: Announcement; onDismiss?: () => void }) {
  const isPromo = announcement.kind === "promo";
  const href = safeCtaHref(announcement.ctaHref);
  const label = announcement.ctaLabel?.trim() || DEFAULT_CTA_LABEL;
  const countdown = useCountdown(announcement.expiresAt);

  return (
    <aside
      aria-label={isPromo ? "Offer" : "Product update"}
      className="relative w-full border-b border-[#2b52f0] bg-[#335cff] text-white"
    >
      <div className="announce-in flex min-h-10 flex-wrap items-center justify-center gap-x-3 gap-y-1 px-12 py-2 text-center text-[13px] leading-5 sm:text-sm">
        {/* The tag is extra context; on phones the message alone keeps the bar to two lines. */}
        <span className="hidden rounded-full bg-white/15 px-2 py-0.5 text-xs font-medium leading-4 sm:inline">{isPromo ? "Offer" : "Update"}</span>
        <span className="font-medium">{announcement.message}</span>
        {countdown && (
          <span className="rounded-md bg-white/15 px-1.5 py-0.5 text-xs font-medium leading-4 tabular-nums" aria-label={`Ends in ${countdown}`}>
            {countdown}
          </span>
        )}
        {href && (
          <CtaLink
            href={href}
            className={cn(
              "inline-flex items-center gap-1 whitespace-nowrap rounded-sm font-medium text-white underline decoration-white/40 underline-offset-4 transition-colors duration-150 hover:decoration-white",
              FOCUS_RING
            )}
          >
            {label}
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </CtaLink>
        )}
      </div>

      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss announcement"
          className={cn(
            "absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-white/70 transition-colors duration-150 hover:bg-white/10 hover:text-white",
            FOCUS_RING
          )}
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      )}
    </aside>
  );
}

function CtaLink({ href, className, children }: { href: string; className: string; children: ReactNode }) {
  if (isExternalHref(href)) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}
