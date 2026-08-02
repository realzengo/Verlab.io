"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight, History, Sparkles, Trash2 } from "lucide-react";
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

const COLLAPSED_COUNT = 4;

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
      <div className="overflow-hidden rounded-card-lg border border-hairline bg-surface shadow-card">
        <div className="divide-y divide-hairline">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3.5 px-5 py-3.5">
              <span className="h-9 w-9 shrink-0 animate-pulse rounded-full bg-accent" />
              <div className="flex-1 space-y-2">
                <span className="block h-3 w-1/3 animate-pulse rounded-full bg-accent" />
                <span className="block h-2.5 w-1/2 animate-pulse rounded-full bg-accent" />
              </div>
              <span className="h-5 w-20 shrink-0 animate-pulse rounded-full bg-accent" />
            </div>
          ))}
        </div>
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

      <div className="overflow-hidden rounded-card-lg border border-hairline bg-surface shadow-card">
        <ol className="divide-y divide-hairline">
          {visible.map((item) => {
            const finalNiche = item.chosenBend?.nicheName;

            return (
              <li key={item.jobId} className="group relative">
                <button
                  type="button"
                  onClick={() => (item.status === "sop_ready" ? setPreviewJobId(item.jobId) : onResume(item))}
                  aria-label={
                    item.status === "sop_ready"
                      ? `View SOP for ${item.channelName ?? item.sourceUrl ?? "channel"}`
                      : `Resume bend for ${item.channelName ?? item.sourceUrl ?? "channel"}`
                  }
                  className="absolute inset-0 z-0 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
                />

                <div className="pointer-events-none relative z-[1] flex items-center gap-3 px-4 py-3 transition-colors group-hover:bg-app sm:gap-3.5 sm:px-5 sm:py-3.5">
                  <ChannelAvatar
                    name={item.channelName ?? item.sourceUrl ?? "?"}
                    avatarUrl={item.avatarUrl ?? undefined}
                    platform={item.platform}
                    size={36}
                  />

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="min-w-0 flex-1 truncate text-[13.5px] font-semibold text-heading">
                        {item.channelName ?? item.sourceUrl ?? "Untitled channel"}
                      </p>
                      <StatusBadge status={item.status} />
                      <span className="shrink-0 text-[11px] tabular-nums text-subtle">
                        {formatTimeAgo(item.updatedAt)}
                      </span>
                    </div>

                    <div className="mt-1 flex items-center gap-1.5">
                      {finalNiche ? (
                        <div className="flex min-w-0 flex-1 items-center gap-1.5 text-xs text-subtle">
                          <span className="truncate">{item.detectedNiche}</span>
                          <Sparkles className="h-3 w-3 shrink-0 text-primary/70" />
                          <span className="truncate font-medium text-body">{finalNiche}</span>
                        </div>
                      ) : (
                        <p className="min-w-0 flex-1 truncate text-xs text-subtle">
                          {item.detectedNiche ?? "Analyzing channel…"}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center">
                    <button
                      type="button"
                      onClick={() => setPendingDeleteId(item.jobId)}
                      aria-label="Delete this bend"
                      className="pointer-events-auto flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-subtle opacity-100 transition-colors hover:bg-danger/10 hover:text-danger sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                    <ChevronRight className="hidden h-4 w-4 shrink-0 text-subtle opacity-0 transition-all group-hover:translate-x-0.5 group-hover:text-primary group-hover:opacity-100 sm:block" />
                  </div>
                </div>
              </li>
            );
          })}
        </ol>

        {items.length > COLLAPSED_COUNT && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="flex w-full items-center justify-center gap-1.5 border-t border-hairline px-4 py-2.5 text-xs font-semibold text-subtle transition-colors hover:bg-app hover:text-heading sm:px-5"
          >
            {expanded ? "Show less" : `Show ${items.length - COLLAPSED_COUNT} more`}
            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", expanded && "rotate-180")} />
          </button>
        )}
      </div>

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
