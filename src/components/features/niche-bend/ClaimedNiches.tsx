"use client";

import { useEffect, useState } from "react";
import { Crown, Lock } from "lucide-react";
import { fetchClaimedNiches } from "@/lib/api/niche-bend";
import type { NicheClaim } from "@/lib/types";
import { ChannelAvatar } from "./ChannelAvatar";

function ClaimedNicheSkeleton() {
  return <div className="h-[196px] animate-pulse rounded-card-sm border border-hairline bg-surface" />;
}

export function ClaimedNiches() {
  const [items, setItems] = useState<NicheClaim[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchClaimedNiches()
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

  // Nothing claimed by this creator yet — skip rendering the section entirely.
  if (items !== null && items.length === 0) return null;

  return (
    <div className="w-full text-left">
      <div className="mb-1 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-warning-tint">
            <Crown className="h-3.5 w-3.5 text-warning" />
          </span>
          <h2 className="text-sm font-semibold text-heading">Claimed niches</h2>
        </div>
        {items && items.length > 0 && (
          <span className="text-xs font-medium text-subtle">
            {items.length} locked
          </span>
        )}
      </div>
      <p className="mb-4 text-xs text-subtle">
        Once you finalize a bend it&rsquo;s locked to you — no one else can ever generate it.
      </p>

      {items === null ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <ClaimedNicheSkeleton />
          <ClaimedNicheSkeleton />
          <ClaimedNicheSkeleton />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <div
              key={item.id}
              className="relative flex flex-col gap-3 rounded-card-sm border border-dashed border-warning/30 bg-warning-tint/40 p-4"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <ChannelAvatar
                    name={item.channelName ?? "?"}
                    avatarUrl={item.avatarUrl ?? undefined}
                    platform={item.platform}
                    size={28}
                  />
                  <span className="truncate text-sm font-semibold text-warning">
                    {item.channelName ?? "A creator"}
                  </span>
                </div>
                <Lock className="h-3.5 w-3.5 shrink-0 text-warning/70" />
              </div>

              <div>
                <span className="text-[10px] font-semibold uppercase tracking-wide text-warning/80">Bent to</span>
                <p className="text-sm font-bold leading-snug text-heading">{item.nicheName}</p>
              </div>

              <ul className="flex flex-col gap-1.5 border-t border-warning/20 pt-2.5">
                {item.exampleTitles.slice(0, 3).map((title, i) => (
                  <li key={i} className="flex gap-1.5 text-xs leading-snug text-body">
                    <span className="shrink-0 font-semibold text-primary">→</span>
                    <span className="line-clamp-2">{title}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
