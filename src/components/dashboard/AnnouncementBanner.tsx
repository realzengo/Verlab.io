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

// Verlab's announcement bar: white, with ribbons of Verlab-blue light flowing
// diagonally across it (the flowing-banner technique: a repeating 70deg
// gradient twice the bar's width, slid along over 20s, masked to glow from
// the top centre and fade downwards). The label, message and link resolve in
// one after another like a motion-graphics title; a light sweep runs through
// the label and along the blue hairline at the bottom. Animations live in
// globals.css (.announce-*) and stop for prefers-reduced-motion. White in
// light and dark mode alike.
const LIGHT_COLORS = [
  "rgba(51, 92, 255, 0.7)", // Verlab blue
  "rgba(182, 202, 255, 0.9)", // pale blue
  "rgba(0, 149, 255, 0.55)", // sky
  "rgba(115, 154, 255, 0.75)", // light Verlab blue
];
const FLOW = `repeating-linear-gradient(70deg, ${[...LIGHT_COLORS, LIGHT_COLORS[0]]
  .map((color, i) => `${color} ${(i * 50) / LIGHT_COLORS.length}%`)
  .join(", ")})`;
const FLOW_MASK = "linear-gradient(to bottom, #fff, transparent), radial-gradient(circle at top center, #fff, transparent)";
const LABEL_SWEEP = "linear-gradient(90deg, #335cff 0%, #335cff 35%, #8fb0ff 50%, #335cff 65%, #335cff 100%)";
const HAIRLINE =
  "linear-gradient(90deg, rgba(51, 92, 255, 0) 0%, rgba(51, 92, 255, 0.45) 30%, #9db8ff 50%, rgba(51, 92, 255, 0.45) 70%, rgba(51, 92, 255, 0) 100%)";

/** Delay for the nth piece of the entrance, so they arrive one after another. */
const stagger = (index: number) => ({ animationDelay: `${120 + index * 110}ms` });

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
      className="relative isolate w-full overflow-hidden bg-white text-[#0b1020]"
    >
      {/* Flowing blue light, glowing from the top centre. */}
      <div
        aria-hidden="true"
        className="announce-flow pointer-events-none absolute inset-0 -z-10"
        style={{
          backgroundImage: FLOW,
          backgroundSize: "200% 100%",
          filter: "saturate(2)",
          maskImage: FLOW_MASK,
          maskComposite: "intersect",
          WebkitMaskImage: FLOW_MASK,
          WebkitMaskComposite: "source-in",
        }}
      />

      <div className="flex min-h-12 flex-wrap items-center justify-center gap-x-3 gap-y-0.5 px-10 py-2.5 text-center sm:gap-x-4 sm:px-14">
        <span
          className="announce-in announce-shimmer text-[10.5px] font-bold uppercase tracking-[0.32em] text-transparent sm:text-[11.5px]"
          style={{ ...stagger(0), backgroundImage: LABEL_SWEEP, backgroundSize: "200% 100%", WebkitBackgroundClip: "text", backgroundClip: "text" }}
        >
          {isPromo ? "Special offer" : "Product update"}
        </span>
        <span className="announce-in text-[13px] font-semibold leading-5 tracking-[-0.01em] text-[#0b1020] sm:text-[14px]" style={stagger(1)}>
          {announcement.message}
        </span>
        {countdown && (
          <span
            className="announce-in rounded-md bg-[#335cff] px-1.5 py-0.5 font-mono text-[12.5px] font-bold tabular-nums tracking-tight text-white shadow-[0_1px_0_#1a35b8,0_4px_12px_-4px_rgba(51,92,255,0.6)] sm:text-[13.5px]"
            style={stagger(2)}
            aria-label={`Ends in ${countdown}`}
          >
            {countdown}
          </span>
        )}
        {href && (
          <span className="announce-in" style={stagger(countdown ? 3 : 2)}>
            <CtaLink
              href={href}
              className="group inline-flex items-center gap-1 whitespace-nowrap text-[13px] font-semibold text-[#335cff] transition-colors hover:text-[#1f45e6] sm:text-[14px]"
            >
              {label}
              <ArrowRight
                className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none"
                aria-hidden="true"
              />
            </CtaLink>
          </span>
        )}
      </div>

      {/* Blue hairline along the bottom, with light travelling through it. */}
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
          className="absolute right-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-[#0b1020]/45 transition-colors hover:bg-[#335cff]/10 hover:text-[#0b1020] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#335cff]/40 sm:right-3"
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
