"use client";

import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { ChevronDown, CircleAlert, CreditCard, Minus, RotateCw, TrendingDown, TrendingUp, TriangleAlert } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/utils";
import type { AdminPulse, PulseItem } from "@/lib/types";

/** How often the card re-checks while the tab is in view. */
const REFRESH_MS = 5 * 60 * 1000;
/** Coming back to the tab re-checks if the last answer is older than this. */
const STALE_ON_RETURN_MS = 60 * 1000;

async function fetchPulse(): Promise<AdminPulse | null> {
  try {
    const res = await fetch("/api/admin/pulse", { cache: "no-store" });
    return res.ok ? ((await res.json()) as AdminPulse) : null;
  } catch {
    return null;
  }
}

export interface PulseState {
  pulse: AdminPulse | null;
  failed: boolean;
  loading: boolean;
  /** Last time the relative "checked" label was worked out. */
  now: number;
  reload: () => void;
}

/**
 * The sidebar's status feed: fetched on mount, every few minutes while the
 * tab is visible, and on return to a tab left long enough to go stale.
 */
export function useAdminPulse(): PulseState {
  const [pulse, setPulse] = useState<AdminPulse | null>(null);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(0);
  const lastFetch = useRef(0);

  // A failed refresh keeps the last answer on screen and says so.
  const apply = useCallback((next: AdminPulse | null) => {
    if (next) setPulse(next);
    setFailed(next === null);
    setLoading(false);
    setNow(Date.now());
  }, []);

  const load = useCallback(() => {
    lastFetch.current = Date.now();
    return fetchPulse().then(apply);
  }, [apply]);

  const reload = useCallback(() => {
    setLoading(true);
    void load();
  }, [load]);

  useEffect(() => {
    void load();
    const visible = () => document.visibilityState === "visible";
    // The tick also moves the "checked 3m ago" label along.
    const interval = setInterval(() => {
      setNow(Date.now());
      if (visible() && Date.now() - lastFetch.current >= REFRESH_MS) void load();
    }, 30_000);
    const onVisibility = () => {
      if (visible() && Date.now() - lastFetch.current >= STALE_ON_RETURN_MS) void load();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [load]);

  return { pulse, failed, loading, now, reload };
}

function updatedLabel(checkedAt: string, now: number): string {
  const minutes = Math.floor(Math.max(now - new Date(checkedAt).getTime(), 0) / 60_000);
  if (minutes < 1) return "Updated just now";
  if (minutes < 60) return `Updated ${minutes}m ago`;
  return `Updated ${Math.floor(minutes / 60)}h ago`;
}

// Folded or open, remembered per browser. A store rather than state read in
// an effect, so the server render (open) and the saved choice never clash.
const FOLD_KEY = "verlab-admin-status-folded";
const foldListeners = new Set<() => void>();
let foldMemory = false; // fallback when storage is blocked

function readFolded(): boolean {
  try {
    const saved = window.localStorage.getItem(FOLD_KEY);
    return saved === null ? foldMemory : saved === "1";
  } catch {
    return foldMemory;
  }
}

function writeFolded(folded: boolean) {
  foldMemory = folded;
  try {
    window.localStorage.setItem(FOLD_KEY, folded ? "1" : "0");
  } catch {
    // Private mode or blocked storage: the in-memory value still works.
  }
  foldListeners.forEach((notify) => notify());
}

function subscribeFolded(notify: () => void) {
  foldListeners.add(notify);
  window.addEventListener("storage", notify);
  return () => {
    foldListeners.delete(notify);
    window.removeEventListener("storage", notify);
  };
}

const DOT: Record<AdminPulse["status"] | "unknown", string> = {
  good: "bg-success shadow-[0_0_0_2.5px_var(--color-success-tint)]",
  warning: "bg-warning shadow-[0_0_0_2.5px_var(--color-warning-tint)]",
  critical: "bg-danger shadow-[0_0_0_2.5px_var(--color-danger-tint)]",
  unknown: "bg-(--viz-neutral) shadow-[0_0_0_2.5px_var(--admin-fill-strong)]",
};

/** Problems wear their severity; growth goes green when it's up, else stays ink. */
function ItemIcon({ item }: { item: PulseItem }) {
  const Icon =
    item.icon === "card"
      ? CreditCard
      : item.trend === "up"
        ? TrendingUp
        : item.trend === "down"
          ? TrendingDown
          : item.trend === "flat"
            ? Minus
            : item.tone === "critical"
              ? CircleAlert
              : TriangleAlert;
  const color =
    item.tone === "critical"
      ? "text-danger"
      : item.tone === "warning"
        ? "text-warning"
        : item.tone === "good"
          ? "text-success"
          : "text-subtle";
  return <Icon aria-hidden="true" className={cn("mt-px h-[15px] w-[15px] shrink-0", color)} strokeWidth={2} />;
}

/** A status dot alone, for the collapsed sidebar. */
export function AdminPulseDot({ state, className }: { state: PulseState; className?: string }) {
  const { pulse, failed } = state;
  const status = pulse ? pulse.status : "unknown";
  const label = pulse ? pulse.headline : failed ? "Status unavailable" : "Checking status";
  return (
    <Link
      href={pulse?.items.find((i) => i.tone === "critical" || i.tone === "warning")?.href ?? "/admin/system"}
      aria-label={label}
      title={label}
      className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-(--admin-fill-strong)",
        className
      )}
    >
      <span className={cn("h-[7px] w-[7px] rounded-full", DOT[status])} />
    </Link>
  );
}

/**
 * How the app is doing, at a glance. The header is the summary -- a status
 * dot, a verdict and the issue count -- and doubles as the fold toggle, so
 * the card can shrink to that one line. Open, it lists up to four updates,
 * problems first (stuck or failed jobs, API errors, failed renewals, a
 * webhook switched off), then signups and usage; each opens the page that
 * explains it.
 */
export function AdminPulseCard({ state, onNavigate }: { state: PulseState; onNavigate?: () => void }) {
  const { pulse, failed, loading, now, reload } = state;
  const folded = useSyncExternalStore(subscribeFolded, readFolded, () => false);
  const bodyId = useId();

  const status = pulse ? pulse.status : "unknown";
  const headline = pulse ? pulse.headline : failed ? "Status unavailable" : "Checking status";
  const issues = pulse?.issueCount ?? 0;

  return (
    <section
      aria-label="App status"
      aria-busy={loading}
      className="overflow-hidden rounded-xl border border-hairline bg-surface shadow-[0_1px_2px_rgba(10,10,30,0.04)]"
    >
      <button
        type="button"
        onClick={() => writeFolded(!folded)}
        aria-expanded={!folded}
        aria-controls={bodyId}
        title={folded ? "Show status" : "Hide status"}
        className="flex h-11 w-full items-center gap-2.5 px-3.5 text-left outline-none transition-colors hover:bg-(--admin-fill) focus-visible:bg-(--admin-fill)"
      >
        <span aria-hidden="true" className={cn("h-[7px] w-[7px] shrink-0 rounded-full", DOT[status])} />
        <span className="min-w-0 flex-1 truncate text-[13px] font-semibold tracking-[-0.01em] text-heading">{headline}</span>
        {issues > 0 && (
          <span
            title={`${issues} ${issues === 1 ? "issue" : "issues"}`}
            className="flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-full bg-(--admin-fill-strong) px-1.5 text-[11px] font-semibold leading-none tabular-nums text-body"
          >
            {issues}
            <span className="sr-only"> {issues === 1 ? "issue" : "issues"}</span>
          </span>
        )}
        <ChevronDown
          aria-hidden="true"
          className={cn("h-4 w-4 shrink-0 text-subtle transition-transform duration-200", folded && "-rotate-90")}
        />
      </button>

      {/* Folding animates the row track, so the card closes without a jump. */}
      <div
        id={bodyId}
        className={cn(
          "grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none",
          folded ? "grid-rows-[0fr]" : "grid-rows-[1fr]"
        )}
        inert={folded}
      >
        <div className="min-h-0 overflow-hidden">
          {pulse && pulse.items.length > 0 && (
            <ul className="flex flex-col border-t border-hairline p-1.5">
              {pulse.items.map((item) => (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    title={item.detail ? `${item.title} · ${item.detail}` : item.title}
                    className="flex items-start gap-2.5 rounded-lg px-2 py-[7px] outline-none transition-colors hover:bg-(--admin-fill) focus-visible:ring-2 focus-visible:ring-primary/40"
                  >
                    <ItemIcon item={item} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12.5px] font-medium leading-4 text-heading">{item.title}</span>
                      {item.detail && (
                        <span className="mt-0.5 block truncate text-[11.5px] leading-4 text-subtle">{item.detail}</span>
                      )}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}

          {!pulse && !failed && (
            <div aria-hidden="true" className="flex flex-col gap-3.5 border-t border-hairline px-3.5 py-3.5">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <Skeleton className="h-3.5 w-3.5 rounded-full" />
                  <div className="flex flex-1 flex-col gap-1.5">
                    <Skeleton className="h-3 w-24 rounded-full" />
                    <Skeleton className="h-2.5 w-32 rounded-full" />
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex h-9 items-center justify-between gap-2 border-t border-hairline pl-3.5 pr-1.5 text-[11.5px] text-subtle">
            <span className="truncate" aria-live="polite">
              {failed
                ? pulse
                  ? "Couldn't refresh"
                  : "Couldn't connect"
                : pulse && now > 0
                  ? updatedLabel(pulse.checkedAt, now)
                  : "Checking…"}
            </span>
            <button
              type="button"
              onClick={reload}
              disabled={loading}
              className="flex h-7 shrink-0 items-center gap-1.5 rounded-md px-2 font-medium text-body transition-colors hover:bg-(--admin-fill-strong) hover:text-heading disabled:pointer-events-none disabled:opacity-60"
            >
              <RotateCw className={cn("h-3 w-3", loading && pulse && "animate-spin")} aria-hidden="true" />
              Refresh
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
