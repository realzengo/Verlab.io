"use client";

import { useEffect, useState } from "react";
import { ChevronRight, History, Loader2, Sparkles, Trash2 } from "lucide-react";
import { deleteBendHistoryItem, fetchBendHistory } from "@/lib/api/niche-bend";
import type { NicheBendHistoryItem, NicheBendJobStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ChannelAvatar } from "./ChannelAvatar";
import { SopPreviewModal } from "./SopPreviewModal";

const STATUS_META: Record<NicheBendJobStatus, { label: string; dot: string }> = {
  opening_channel: { label: "In progress", dot: "bg-primary animate-pulse" },
  reading_videos: { label: "In progress", dot: "bg-primary animate-pulse" },
  identifying_format: { label: "In progress", dot: "bg-primary animate-pulse" },
  generating_bends: { label: "In progress", dot: "bg-primary animate-pulse" },
  ready: { label: "Bends ready", dot: "bg-warning" },
  generating_sop: { label: "Writing SOP", dot: "bg-primary animate-pulse" },
  sop_ready: { label: "SOP ready", dot: "bg-success" },
  failed: { label: "Failed", dot: "bg-danger" },
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

function HistorySkeleton() {
  return (
    <div className="w-full">
      <div className="mb-4 flex items-center gap-2">
        <span className="h-7 w-7 animate-pulse rounded-full bg-accent" />
        <span className="h-3 w-28 animate-pulse rounded-full bg-accent" />
      </div>
      <div className="flex flex-col gap-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-[68px] animate-pulse rounded-card-sm border border-hairline bg-surface" />
        ))}
      </div>
    </div>
  );
}

export function BendHistory({ onResume }: { onResume: (item: NicheBendHistoryItem) => void }) {
  const [items, setItems] = useState<NicheBendHistoryItem[] | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteErrorId, setDeleteErrorId] = useState<string | null>(null);
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

  const cancelDelete = () => {
    setPendingDeleteId(null);
    setDeleteErrorId(null);
  };

  const confirmDelete = async (jobId: string) => {
    setDeletingId(jobId);
    setDeleteErrorId(null);
    try {
      await deleteBendHistoryItem(jobId);
      setItems((prev) => (prev ? prev.filter((entry) => entry.jobId !== jobId) : prev));
      setPendingDeleteId(null);
    } catch {
      setDeleteErrorId(jobId);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="w-full text-left">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent">
            <History className="h-3.5 w-3.5 text-primary" />
          </span>
          <h2 className="text-sm font-semibold text-heading">Recent bends</h2>
        </div>
        <span className="text-xs font-medium text-subtle">
          {items.length} {items.length === 1 ? "bend" : "bends"}
        </span>
      </div>

      <ol className="flex flex-col gap-2">
        {visible.map((item) => {
          const meta = STATUS_META[item.status];
          const finalNiche = item.chosenBend?.nicheName;
          const isPendingDelete = pendingDeleteId === item.jobId;
          const isDeleting = deletingId === item.jobId;
          const hasDeleteError = deleteErrorId === item.jobId;

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
                className="absolute inset-0 z-0 rounded-card-sm transition-[transform,box-shadow,border-color] focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
              />

              <div
                className={cn(
                  "pointer-events-none relative z-[1] flex items-center gap-3 rounded-card-sm border border-hairline bg-surface px-4 py-3 shadow-card transition-[transform,box-shadow,border-color] group-hover:-translate-y-px group-hover:border-accent-line group-hover:shadow-card-hover",
                  (isPendingDelete || hasDeleteError) && "border-danger/30 group-hover:border-danger/40"
                )}
              >
                <ChannelAvatar
                  name={item.channelName ?? item.sourceUrl ?? "?"}
                  avatarUrl={item.avatarUrl ?? undefined}
                  platform={item.platform}
                  size={38}
                />

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-heading">
                    {item.channelName ?? item.sourceUrl ?? "Untitled channel"}
                  </p>
                  {finalNiche ? (
                    <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-subtle">
                      <span className="truncate">{item.detectedNiche}</span>
                      <Sparkles className="h-3 w-3 shrink-0 text-primary" />
                      <span className="truncate font-medium text-heading">{finalNiche}</span>
                    </div>
                  ) : (
                    <p className="mt-0.5 truncate text-xs text-subtle">{item.detectedNiche ?? "Analyzing channel…"}</p>
                  )}
                </div>

                {!isPendingDelete && (
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="flex items-center gap-1.5 text-[11px] font-semibold text-subtle">
                      <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} />
                      {meta.label}
                    </span>
                    <span className="text-[11px] text-subtle">{formatTimeAgo(item.updatedAt)}</span>
                  </div>
                )}

                {isPendingDelete ? (
                  <div className="pointer-events-auto ml-auto flex shrink-0 items-center gap-2">
                    {hasDeleteError && <span className="text-[11px] font-medium text-danger">Couldn&rsquo;t delete</span>}
                    <button
                      type="button"
                      onClick={cancelDelete}
                      disabled={isDeleting}
                      className="rounded-full border border-hairline px-3 py-1 text-[11px] font-semibold text-body transition-colors hover:bg-app disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => confirmDelete(item.jobId)}
                      disabled={isDeleting}
                      className="flex items-center gap-1.5 rounded-full bg-danger px-3 py-1 text-[11px] font-semibold text-white transition-colors hover:bg-danger/90 disabled:opacity-60"
                    >
                      {isDeleting && <Loader2 className="h-3 w-3 animate-spin" />}
                      {isDeleting ? "Deleting…" : "Delete"}
                    </button>
                  </div>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => setPendingDeleteId(item.jobId)}
                      aria-label="Delete this bend"
                      className="pointer-events-auto flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-subtle opacity-0 transition-colors hover:bg-danger/10 hover:text-danger focus-visible:opacity-100 group-hover:opacity-100"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                    <ChevronRight className="h-4 w-4 shrink-0 text-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {items.length > COLLAPSED_COUNT && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-3 text-xs font-semibold text-primary underline-offset-4 hover:underline"
        >
          {expanded ? "Show less" : `Show ${items.length - COLLAPSED_COUNT} more`}
        </button>
      )}

      <SopPreviewModal jobId={previewJobId} onClose={() => setPreviewJobId(null)} />
    </div>
  );
}
