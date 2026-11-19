"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight, X } from "lucide-react";
import { deleteBendHistoryItem, fetchBendHistory } from "@/lib/api/niche-bend";
import type { NicheBendHistoryItem, NicheBendJobStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { BezelPanel } from "@/components/brand/BrandKit";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ChannelAvatar } from "./ChannelAvatar";
import { SopPreviewModal } from "./SopPreviewModal";

// In-progress states pulse because they really are live; finished ones hold still.
const STATUS_META: Record<NicheBendJobStatus, { label: string; dot: string }> = {
  opening_channel: { label: "Analyzing", dot: "bg-primary animate-pulse" },
  reading_videos: { label: "Analyzing", dot: "bg-primary animate-pulse" },
  identifying_format: { label: "Analyzing", dot: "bg-primary animate-pulse" },
  generating_bends: { label: "Analyzing", dot: "bg-primary animate-pulse" },
  ready: { label: "Bends ready", dot: "bg-warning" },
  generating_sop: { label: "Writing SOP", dot: "bg-primary animate-pulse" },
  sop_ready: { label: "SOP ready", dot: "bg-success" },
  failed: { label: "Failed", dot: "bg-danger" },
};

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

function StatusLabel({ status }: { status: NicheBendJobStatus }) {
  const meta = STATUS_META[status];
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs text-body">
      <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} />
      {meta.label}
    </span>
  );
}

function HistorySkeleton() {
  return (
    <div className="w-full">
      <div className="divide-y divide-hairline rounded-[30px] border border-[#EBEDF0] bg-white p-1.5 dark:border-white/[0.06] dark:bg-[#0E0E10]">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3 sm:px-5">
            <span className="h-10 w-10 shrink-0 animate-pulse rounded-full bg-hairline" />
            <div className="min-w-0 flex-1 space-y-2">
              <span className="block h-3.5 w-40 animate-pulse rounded-full bg-hairline" />
              <span className="block h-3 w-56 max-w-full animate-pulse rounded-full bg-hairline" />
            </div>
            <span className="hidden h-3 w-20 animate-pulse rounded-full bg-hairline sm:block" />
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
      {deleteError && <p className="mb-3 text-sm text-danger">{deleteError}</p>}

      <BezelPanel>
        <div className="flex items-center justify-between gap-4 border-b border-hairline px-5 py-4 sm:px-6">
          <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-heading">Recent bends</h2>
          <span className="font-mono text-[11px] uppercase tracking-wider text-subtle">
            {items.length} {items.length === 1 ? "bend" : "bends"}
          </span>
        </div>
        <ol className="divide-y divide-hairline">
          {visible.map((item) => {
            const name = item.channelName ?? item.sourceUrl ?? "Untitled channel";
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
                aria-label={item.status === "sop_ready" ? `View SOP for ${name}` : `Resume bend for ${name}`}
                className="group flex cursor-pointer items-center gap-4 px-5 py-3.5 outline-none transition-colors duration-150 hover:bg-[#F7F8FA] focus-visible:bg-[#F7F8FA] sm:px-6 dark:hover:bg-white/[0.03] dark:focus-visible:bg-white/[0.03]"
              >
                <ChannelAvatar name={name} avatarUrl={item.avatarUrl ?? undefined} platform={item.platform} size={40} />

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-heading">{name}</p>
                  <p className="truncate text-sm text-subtle">
                    {item.chosenBend ? (
                      <>
                        Bent into <span className="text-body">{item.chosenBend.nicheName}</span>
                      </>
                    ) : item.status === "failed" ? (
                      "Couldn't analyze this channel"
                    ) : (
                      (item.detectedNiche ?? "Analyzing the channel")
                    )}
                  </p>
                </div>

                <div className="hidden shrink-0 flex-col items-end gap-1 sm:flex">
                  <StatusLabel status={item.status} />
                  <span className="text-xs tabular-nums text-subtle">{formatTimeAgo(item.updatedAt)}</span>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      setPendingDeleteId(item.jobId);
                    }}
                    aria-label={`Delete the bend for ${name}`}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-subtle opacity-0 transition-[opacity,color,background-color] duration-150 hover:bg-danger-tint hover:text-danger focus-visible:opacity-100 group-hover:opacity-100 max-sm:opacity-100"
                  >
                    <X className="h-4 w-4" strokeWidth={1.75} />
                  </button>
                  <ChevronRight
                    className="h-4 w-4 text-subtle transition-transform duration-150 group-hover:translate-x-0.5"
                    strokeWidth={1.75}
                  />
                </div>
              </li>
            );
          })}
        </ol>
      </BezelPanel>

      {items.length > COLLAPSED_COUNT && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mx-auto mt-3 flex h-8 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-subtle transition-colors duration-150 hover:bg-btn-secondary hover:text-heading"
        >
          {expanded ? "Show less" : `Show ${items.length - COLLAPSED_COUNT} more`}
          <ChevronDown
            className={cn("h-4 w-4 transition-transform duration-200", expanded && "rotate-180")}
            strokeWidth={1.75}
          />
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
