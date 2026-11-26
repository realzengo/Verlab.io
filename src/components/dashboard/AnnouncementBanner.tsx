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
        "grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none",
        open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
      )}
    >
      <div className="min-h-0 overflow-hidden" inert={!open}>
        {announcement && <AnnouncementBar announcement={announcement} onDismiss={() => dismiss(announcement.id)} />}
      </div>
    </div>
  );
}

// Verlab's announcement bar, blue and white: the brand blue (the 3D button
// face, landing/button3d.ts) with a soft light glow drifting across it, a
// spaced uppercase label with a white sweep through it, the message, a live
// countdown in a white chip when the announcement has an end date, and a
// white hairline with light travelling along the bottom. The animations live
// in globals.css (.announce-*) and stop for prefers-reduced-motion. Same in
// light and dark mode.
const BAR = "linear-gradient(90deg, #2448e8 0%, #335cff 50%, #2448e8 100%)";
const GLOW = "radial-gradient(50% 160% at 50% 50%, rgba(182, 202, 255, 0.7) 0%, rgba(115, 154, 255, 0.35) 45%, rgba(115, 154, 255, 0) 78%)";
const LABEL_SWEEP = "linear-gradient(90deg, #c7d6ff 0%, #c7d6ff 35%, #ffffff 50%, #c7d6ff 65%, #c7d6ff 100%)";
const HAIRLINE = "linear-gradient(90deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.45) 30%, #ffffff 50%, rgba(255, 255, 255, 0.45) 70%, rgba(255, 255, 255, 0.1) 100%)";

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
      className="relative isolate w-full overflow-hidden text-white"
      style={{ backgroundColor: "#335cff", backgroundImage: BAR }}
    >
      {/* The drifting glow, wider than the bar so its edges never show. */}
      <div
        aria-hidden="true"
        className="announce-glow pointer-events-none absolute inset-y-0 -left-[10%] -z-10 w-[70%] sm:w-[55%]"
        style={{ backgroundImage: GLOW }}
      />

      <div className="flex min-h-11 flex-wrap items-center justify-center gap-x-3 gap-y-0.5 px-10 py-2 text-center sm:gap-x-4 sm:px-12">
        <span
          className="announce-shimmer text-[10.5px] font-semibold uppercase tracking-[0.32em] text-transparent sm:text-[11.5px]"
          style={{ backgroundImage: LABEL_SWEEP, backgroundSize: "200% 100%", WebkitBackgroundClip: "text", backgroundClip: "text" }}
        >
          {isPromo ? "Special offer" : "Product update"}
        </span>
        <span className="text-[13px] font-medium leading-5 text-white sm:text-[14px]">{announcement.message}</span>
        {countdown && (
          <span
            className="rounded-md bg-white px-1.5 py-0.5 font-mono text-[12.5px] font-bold tabular-nums tracking-tight text-[#2448e8] sm:text-[13.5px]"
            aria-label={`Ends in ${countdown}`}
          >
            {countdown}
          </span>
        )}
        {href && (
          <CtaLink
            href={href}
            className="group inline-flex items-center gap-1 whitespace-nowrap text-[13px] font-semibold text-white underline decoration-white/40 underline-offset-[3px] transition-colors hover:decoration-white sm:text-[14px]"
          >
            {label}
            <ArrowRight
              className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none"
              aria-hidden="true"
            />
          </CtaLink>
        )}
      </div>

      {/* Bright hairline along the bottom, with light travelling through it. */}
      <div
        aria-hidden="true"
        className="announce-line pointer-events-none absolute inset-x-0 bottom-0 h-px"
        style={{ backgroundImage: HAIRLINE, backgroundSize: "200% 100%" }}
      />

      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss announcement"
          className="absolute right-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-white/80 transition-colors hover:bg-white/15 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 sm:right-3"
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
