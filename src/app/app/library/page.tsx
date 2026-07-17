"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BookmarkX, Library as LibraryIcon, Sparkles } from "lucide-react";
import { fetchSavedBends, setBendSaved } from "@/lib/api/niche-bend";
import type { NicheBendHistoryItem } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { ChannelAvatar } from "@/components/features/niche-bend/ChannelAvatar";
import { Button } from "@/components/ui/Button";

function LibrarySkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-[132px] animate-pulse rounded-card-sm border border-hairline bg-surface" />
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-card border border-dashed border-hairline px-6 py-16 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-accent">
        <LibraryIcon className="h-5 w-5 text-primary" />
      </span>
      <div>
        <p className="text-sm font-semibold text-heading">Nothing saved yet</p>
        <p className="mt-1 text-sm text-subtle">
          Finish a niche bend and hit &ldquo;Save to my library&rdquo; on its SOP to keep it here.
        </p>
      </div>
      <Button href="/app/bend" size="sm">
        Bend a channel
      </Button>
    </div>
  );
}

export default function LibraryPage() {
  const [items, setItems] = useState<NicheBendHistoryItem[] | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchSavedBends()
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

  const handleRemove = async (jobId: string) => {
    setRemovingId(jobId);
    try {
      await setBendSaved(jobId, false);
      setItems((prev) => (prev ? prev.filter((item) => item.jobId !== jobId) : prev));
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <div className="flex flex-col gap-6 pt-2">
      <div>
        <h1 className="text-2xl font-bold text-heading">Library</h1>
        <p className="mt-1 text-sm text-body">Every SOP you&rsquo;ve saved from Niche Bending, in one place.</p>
      </div>

      {items === null ? (
        <LibrarySkeleton />
      ) : items.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <div key={item.jobId} className="group relative">
              <Link
                href={`/app/library/${item.jobId}`}
                aria-label={`Open saved SOP for ${item.channelName ?? item.sourceUrl ?? "channel"}`}
                className="absolute inset-0 z-0 rounded-card-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
              />

              <div className="pointer-events-none relative z-[1] flex h-full flex-col gap-3 rounded-card-sm border border-hairline bg-surface p-4 shadow-card transition-[transform,box-shadow,border-color] group-hover:-translate-y-px group-hover:border-accent-line group-hover:shadow-card-hover">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <ChannelAvatar
                      name={item.channelName ?? item.sourceUrl ?? "?"}
                      avatarUrl={item.avatarUrl ?? undefined}
                      platform={item.platform}
                      size={36}
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-heading">
                        {item.channelName ?? item.sourceUrl ?? "Untitled channel"}
                      </p>
                      <p className="truncate text-xs text-subtle">{formatDate(item.updatedAt)}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemove(item.jobId)}
                    disabled={removingId === item.jobId}
                    aria-label="Remove from library"
                    className="pointer-events-auto flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-subtle opacity-0 transition-colors hover:bg-danger/10 hover:text-danger focus-visible:opacity-100 group-hover:opacity-100 disabled:opacity-50"
                  >
                    <BookmarkX className="h-3.5 w-3.5" />
                  </button>
                </div>

                {item.chosenBend?.nicheName && (
                  <div className="flex min-w-0 items-center gap-1.5 text-xs text-subtle">
                    <span className="truncate">{item.detectedNiche}</span>
                    <Sparkles className="h-3 w-3 shrink-0 text-primary" />
                    <span className="truncate font-medium text-heading">{item.chosenBend.nicheName}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
