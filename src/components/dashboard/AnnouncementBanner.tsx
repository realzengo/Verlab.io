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

/** The bar itself, without any state. Also the admin page's preview. */
export function AnnouncementBar({ announcement, onDismiss }: { announcement: Announcement; onDismiss?: () => void }) {
  const isPromo = announcement.kind === "promo";
  const href = safeCtaHref(announcement.ctaHref);
  const label = announcement.ctaLabel?.trim() || DEFAULT_CTA_LABEL;

  return (
    <aside
      aria-label={isPromo ? "Offer" : "Product update"}
      className={cn(
        "relative border-b px-10 py-2 text-center text-[13px] leading-5 sm:px-12",
        isPromo ? "border-accent-line bg-accent" : "border-hairline bg-surface"
      )}
    >
      <p className="text-body">
        <span
          className={cn(
            "mr-2 inline-flex h-[18px] -translate-y-px items-center rounded-full px-1.5 align-middle text-[10.5px] font-semibold uppercase tracking-[0.04em]",
            isPromo ? "bg-btn-primary text-white" : "bg-primary/10 text-primary"
          )}
        >
          {isPromo ? "Offer" : "New"}
        </span>
        <span className="font-medium text-heading">{announcement.message}</span>
        {href && (
          <CtaLink
            href={href}
            className="group ml-2 inline-flex items-center gap-0.5 whitespace-nowrap font-semibold text-primary transition-colors hover:text-primary-hover"
          >
            {label}
            <ArrowRight
              className="h-3.5 w-3.5 transition-transform duration-150 group-hover:translate-x-0.5 motion-reduce:transition-none"
              aria-hidden="true"
            />
          </CtaLink>
        )}
      </p>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss announcement"
          className="absolute right-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-subtle transition-colors hover:bg-black/[0.05] hover:text-heading focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 dark:hover:bg-white/[0.08] sm:right-3"
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
