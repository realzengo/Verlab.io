"use client";

import { useEffect, useState } from "react";
import { ArrowRight, ChevronDown, History, Sparkles, X } from "lucide-react";
import { deleteBendHistoryItem, fetchBendHistory } from "@/lib/api/niche-bend";
import type { NicheBendHistoryItem, NicheBendJobStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ChannelAvatar } from "./ChannelAvatar";
import { SopPreviewModal } from "./SopPreviewModal";

const STATUS_META: Record<NicheBendJobStatus, { label: string; dot: string; badge: string }> = {
  opening_channel: {
    label: "In progress",
    dot: "bg-primary animate-pulse",
    badge: "border-accent-line bg-accent text-primary",
  },
  reading_videos: {
    label: "In progress",
    dot: "bg-primary animate-pulse",
    badge: "border-accent-line bg-accent text-primary",
  },
  identifying_format: {
    label: "In progress",
    dot: "bg-primary animate-pulse",
    badge: "border-accent-line bg-accent text-primary",
  },
  generating_bends: {
    label: "In progress",
    dot: "bg-primary animate-pulse",
    badge: "border-accent-line bg-accent text-primary",
  },
  ready: { label: "Bends ready", dot: "bg-warning", badge: "border-warning/25 bg-warning-tint text-warning" },
  generating_sop: {
    label: "Writing SOP",
    dot: "bg-primary animate-pulse",
    badge: "border-accent-line bg-accent text-primary",
  },
  sop_ready: { label: "SOP ready", dot: "bg-success", badge: "border-success/25 bg-success-tint text-success" },
  failed: { label: "Failed", dot: "bg-danger", badge: "border-danger/25 bg-danger-tint text-danger" },
};

// Divisible by both 2 and 3 so the grid never ends on a lone dangling card,
// regardless of whether the viewport is showing 2 or 3 columns.
const COLLAPSED_COUNT = 6;

function formatTimeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

function StatusBadge({ status }: { status: NicheBendJobStatus }) {
  const meta = STATUS_META[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-medium",
        meta.badge
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} />
      {meta.label}
    </span>
  );
}

function HistorySkeleton() {
  return (
    <div className="w-full">
      <div className="mb-4 flex items-center gap-2">
        <span className="h-3.5 w-3.5 animate-pulse rounded-full bg-accent" />
        <span className="h-3 w-28 animate-pulse rounded-full bg-accent" />
      </div>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-card-lg border border-hairline bg-surface p-5 shadow-card">
            <div className="flex items-start gap-3.5">
              <span className="h-[52px] w-[52px] shrink-0 animate-pulse rounded-full bg-accent" />
              <div className="min-w-0 flex-1 space-y-2 pt-1.5">
                <span className="block h-3.5 w-2/3 animate-pulse rounded-full bg-accent" />
                <span className="block h-2.5 w-1/2 animate-pulse rounded-full bg-accent" />
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-hairline pt-4">
              <span className="h-4 w-20 animate-pulse rounded-full bg-accent" />
              <span className="h-7 w-16 animate-pulse rounded-full bg-accent" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function BendHistory({ onResume }: { onResume: (item: NicheBendHistoryItem) => void }) {
  const [items, setItems] = useState<NicheBendHistoryItem[] | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [previewJobId, setPreviewJobId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchBendHistory()
      .then((data) => {
        if (!cancelled) setItems(data);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (items === null) return <HistorySkeleton />;
  if (items.length === 0) return null;

  const visible = expanded ? items : items.slice(0, COLLAPSED_COUNT);

  const confirmDelete = async (jobId: string) => {
    setDeleteError(null);
    try {
      await deleteBendHistoryItem(jobId);
      setItems((prev) => (prev ? prev.filter((entry) => entry.jobId !== jobId) : prev));
    } catch {
      setDeleteError("Couldn't delete. Try again.");
    }
  };

  const pendingDeleteItem = items.find((entry) => entry.jobId === pendingDeleteId) ?? null;

  return (
    <div className="w-full text-left">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-subtle" />
          <h2 className="text-[15px] font-semibold tracking-tight text-heading">Recent bends</h2>
        </div>
        <span className="rounded-full border border-hairline px-2.5 py-0.5 text-[11px] font-medium text-subtle">
          {items.length} {items.length === 1 ? "bend" : "bends"}
        </span>
      </div>

      {deleteError && <p className="mb-3 text-[11px] font-medium text-danger">{deleteError}</p>}

      <ol className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {visible.map((item) => {
          const finalNiche = item.chosenBend?.nicheName;
          const nicheLabel = finalNiche ?? item.detectedNiche ?? "Analyzing channel…";
          const openItem = () => (item.status === "sop_ready" ? setPreviewJobId(item.jobId) : onResume(item));

          return (
            <li
              key={item.jobId}
              role="button"
              tabIndex={0}
              onClick={openItem}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  openItem();
                }
              }}
              className="group relative flex cursor-pointer flex-col gap-5 overflow-hidden rounded-card-lg border border-hairline bg-surface p-5 shadow-card outline-none"
            >
              {/* Corner action -- revealed on hover so the identity block below
                  is the only thing competing for attention at rest, instead of
                  a permanent row of chrome above it. */}
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setPendingDeleteId(item.jobId);
                }}
                aria-label="Delete this bend"
                className="absolute right-3 top-3 z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface/80 text-subtle opacity-0 backdrop-blur-sm transition-colors duration-200 ease-out hover:bg-danger/10 hover:text-danger group-hover:opacity-100 focus-visible:opacity-100"
              >
                <X className="h-3.5 w-3.5" />
              </button>

              {/* Identity block leads the card -- the avatar's own platform
                  badge (see ChannelAvatar) already says TikTok/YouTube, so a
                  second "TIKTOK" label up top would just repeat it. */}
              <div className="relative flex min-w-0 items-start gap-3.5 pr-7">
                <div className="shrink-0 rounded-full ring-2 ring-app">
                  <ChannelAvatar
                    name={item.channelName ?? item.sourceUrl ?? "?"}
                    avatarUrl={item.avatarUrl ?? undefined}
                    platform={item.platform}
                    size={52}
                  />
                </div>
                <div className="min-w-0 flex-1 pt-0.5">
                  <p className="truncate text-base font-semibold tracking-tight text-heading">
                    {item.channelName ?? item.sourceUrl ?? "Untitled channel"}
                  </p>
                  <div className="mt-1 flex min-w-0 items-center gap-1.5 text-[13px] text-subtle">
                    {finalNiche && <Sparkles className="h-3 w-3 shrink-0 text-primary/70" />}
                    <span className="truncate">{nicheLabel}</span>
                  </div>
                </div>
              </div>

              <div className="relative flex items-center justify-between gap-3 border-t border-hairline pt-4">
                <div className="flex min-w-0 items-center gap-2">
                  <StatusBadge status={item.status} />
                  <span className="h-0.5 w-0.5 shrink-0 rounded-full bg-subtle/40" aria-hidden="true" />
                  <span className="shrink-0 text-[11px] tabular-nums text-subtle">{formatTimeAgo(item.updatedAt)}</span>
                </div>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    openItem();
                  }}
                  aria-label={
                    item.status === "sop_ready"
                      ? `View SOP for ${item.channelName ?? item.sourceUrl ?? "channel"}`
                      : `Resume bend for ${item.channelName ?? item.sourceUrl ?? "channel"}`
                  }
                  className="group/btn inline-flex shrink-0 items-center gap-1 rounded-full bg-primary px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm shadow-primary/25 transition-[transform,background-color,box-shadow] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-primary-hover hover:shadow-md hover:shadow-primary/30 active:scale-[0.96] active:duration-100"
                >
                  View
                  <ArrowRight className="h-3 w-3 transition-transform duration-200 ease-out group-hover/btn:translate-x-0.5" />
                </button>
              </div>
            </li>
          );
        })}
      </ol>

      {items.length > COLLAPSED_COUNT && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-card-lg border border-hairline bg-surface px-4 py-2.5 text-xs font-semibold text-subtle shadow-card transition-[transform,border-color,box-shadow,color] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-0.5 hover:border-primary/20 hover:text-heading hover:shadow-card-hover sm:px-5"
        >
          {expanded ? "Show less" : `Show ${items.length - COLLAPSED_COUNT} more`}
          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]", expanded && "rotate-180")} />
        </button>
      )}

      <SopPreviewModal jobId={previewJobId} onClose={() => setPreviewJobId(null)} />

      <ConfirmDialog
        isOpen={pendingDeleteId !== null}
        onClose={() => setPendingDeleteId(null)}
        onConfirm={() => {
          if (pendingDeleteId) void confirmDelete(pendingDeleteId);
        }}
        title={`Delete "${pendingDeleteItem?.channelName ?? pendingDeleteItem?.sourceUrl ?? "this bend"}"?`}
        description="This permanently deletes the bend and can't be undone."
        confirmLabel="Delete"
        danger
      />
    </div>
  );
}
