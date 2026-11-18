"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Mail } from "lucide-react";
import type { AdminUser } from "@/lib/types";
import { UserAvatar, UserBoard } from "@/components/admin/UserAvatar";
import { cn, formatCurrency, formatDate, formatNumber } from "@/lib/utils";

const CARD_W = 320;
const CARD_H = 300; // close enough to decide whether it fits below the row
const OPEN_DELAY = 280;
const CLOSE_DELAY = 140;

const PLAN_LABEL: Record<AdminUser["plan"], string> = { free: "Free", core: "Core", pro: "Pro", scale: "Scale" };

/**
 * A user's name cell that opens their profile card: hover with a mouse
 * (after a short beat, so sweeping down the table doesn't flash cards), or
 * click/Enter on the name. The banner is a run of board squares on the
 * user's side (ivory or ebony), with their piece standing on it.
 */
export function UserIdentity({
  user,
  status,
  lastActive,
}: {
  user: AdminUser;
  /** The row's status badge, reused in the card. */
  status: ReactNode;
  lastActive: string;
}) {
  const cardId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pos, setPos] = useState<{ left: number; top?: number; bottom?: number } | null>(null);
  const open = pos !== null;

  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };

  const show = () => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const left = Math.max(16, Math.min(r.left - 4, window.innerWidth - CARD_W - 16));
    const below = r.bottom + 8 + CARD_H < window.innerHeight - 16;
    setPos(below ? { left, top: r.bottom + 8 } : { left, bottom: window.innerHeight - r.top + 8 });
  };
  const hide = () => setPos(null);
  const later = (fn: () => void, ms: number) => {
    clear();
    timer.current = setTimeout(fn, ms);
  };

  // A fixed card would drift from its row on scroll, so scrolling closes it.
  useEffect(() => {
    if (!open) return;
    const close = () => hide();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        hide();
        triggerRef.current?.focus();
      }
    };
    window.addEventListener("scroll", close, { capture: true, passive: true });
    window.addEventListener("resize", close);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("scroll", close, { capture: true });
      window.removeEventListener("resize", close);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => clear, []);

  const root = typeof document !== "undefined" ? document.querySelector(".admin-theme") : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-controls={open ? cardId : undefined}
        onClick={() => (open ? hide() : show())}
        onPointerEnter={(e) => e.pointerType === "mouse" && later(show, OPEN_DELAY)}
        onPointerLeave={(e) => e.pointerType === "mouse" && later(hide, CLOSE_DELAY)}
        className="group/identity -m-1 flex min-w-0 items-center gap-2.5 rounded-lg p-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        <UserAvatar name={user.name} size="sm" />
        <span className="min-w-0">
          <span className="block truncate font-medium text-heading underline-offset-2 group-hover/identity:underline decoration-hairline">
            {user.name}
          </span>
          <span className="block truncate text-xs text-subtle">{user.email}</span>
        </span>
      </button>

      {open &&
        root &&
        createPortal(
          <div
            id={cardId}
            role="dialog"
            aria-label={`${user.name}'s profile`}
            onPointerEnter={clear}
            onPointerLeave={(e) => e.pointerType === "mouse" && later(hide, CLOSE_DELAY)}
            className="admin-float admin-pop-in fixed z-[60] rounded-[18px] shadow-(--admin-float-shadow)"
            style={{ width: CARD_W, left: pos.left, top: pos.top, bottom: pos.bottom }}
          >
            <UserBoard name={user.name} className="h-[76px] rounded-t-[18px]" />

            <div className="px-4 pb-4">
              <div className="-mt-8 flex items-end justify-between gap-3">
                <span className="rounded-full bg-(--admin-float) p-[3px]">
                  <UserAvatar name={user.name} size="xl" className="h-14 w-14" />
                </span>
                <span className="flex items-center gap-1.5 pb-0.5">
                  {/* A free account's status already says "Free". */}
                  {user.status !== "free" && (
                    <span className="rounded-md bg-(--admin-fill-strong) px-1.5 py-0.5 text-[12px] font-medium text-body">
                      {PLAN_LABEL[user.plan]}
                    </span>
                  )}
                  {status}
                </span>
              </div>

              <p className="mt-3 truncate text-[15px] font-semibold tracking-[-0.01em] text-heading">{user.name}</p>
              <p className="truncate text-[13px] text-subtle">{user.email}</p>

              <dl className="mt-4 grid grid-cols-3 overflow-hidden rounded-xl bg-(--admin-fill)">
                <Stat label="MRR" value={formatCurrency(user.mrr)} muted={user.mrr === 0} />
                <Stat label="Bends" value={formatNumber(user.usage.bends)} divider />
                <Stat label="Transcripts" value={formatNumber(user.usage.transcripts)} divider />
              </dl>

              <div className="mt-3 flex items-center justify-between gap-3 text-[12px] text-subtle">
                <span>Joined {formatDate(user.signupDate)}</span>
                <span>Active {lastActive}</span>
              </div>

              <a
                href={`mailto:${user.email}`}
                className="mt-4 flex h-9 items-center justify-center gap-1.5 rounded-lg bg-surface text-[13px] font-medium text-heading shadow-[0_0_0_1px_var(--color-hairline),0_1px_2px_rgba(10,10,30,0.05)] transition-colors hover:bg-(--admin-fill-strong) dark:bg-white/[0.05]"
              >
                <Mail className="h-3.5 w-3.5 text-subtle" aria-hidden="true" />
                Email {user.name.split(" ")[0]}
              </a>
            </div>
          </div>,
          root
        )}
    </>
  );
}

function Stat({ label, value, divider, muted }: { label: string; value: string; divider?: boolean; muted?: boolean }) {
  return (
    <div className={cn("min-w-0 px-3 py-2.5", divider && "border-l border-hairline")}>
      <dt className="truncate text-[11.5px] text-subtle">{label}</dt>
      <dd className={cn("mt-0.5 truncate text-[14px] font-semibold tabular-nums", muted ? "text-subtle" : "text-heading")}>{value}</dd>
    </div>
  );
}
