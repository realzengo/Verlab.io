"use client";

import { useState } from "react";
import type { NicheBendPlatform } from "@/lib/types";
import { cn } from "@/lib/utils";

// Deterministic hash-to-gradient so the same channel always lands on the
// same color. Kept within a muted slate/blue family for a calmer, more
// professional palette than a full rainbow spread.
const AVATAR_GRADIENTS = [
  "from-slate-500 to-slate-700",
  "from-blue-500 to-blue-700",
  "from-indigo-500 to-indigo-700",
  "from-slate-600 to-blue-800",
];

function gradientFor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_GRADIENTS[hash % AVATAR_GRADIENTS.length];
}

function initialsFor(name: string): string {
  const cleaned = name.replace(/^@/, "").trim();
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return cleaned.slice(0, 2).toUpperCase() || "?";
}

function YoutubeMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-2.5 w-2.5" fill="currentColor" aria-hidden="true">
      <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8ZM9.6 15.5V8.5L15.8 12l-6.2 3.5Z" />
    </svg>
  );
}

function TiktokMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-2.5 w-2.5" fill="currentColor" aria-hidden="true">
      <path d="M16.6 3c.4 2.3 2 4 4.4 4.2v3.1c-1.6.1-3-.4-4.4-1.4v6.6a5.7 5.7 0 1 1-5.7-5.7c.3 0 .6 0 .9.1v3.2a2.6 2.6 0 1 0 1.8 2.5V3h2.9Z" />
    </svg>
  );
}

export function ChannelAvatar({
  name,
  avatarUrl,
  platform,
  size = 44,
}: {
  name: string;
  avatarUrl?: string;
  platform: NicheBendPlatform;
  size?: number;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const showImage = Boolean(avatarUrl) && !imgFailed;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <div
        className={cn(
          "flex h-full w-full items-center justify-center overflow-hidden rounded-full text-white shadow-card",
          !showImage && cn("bg-gradient-to-br", gradientFor(name))
        )}
      >
        {showImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt=""
            referrerPolicy="no-referrer"
            onError={() => setImgFailed(true)}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="font-bold" style={{ fontSize: size * 0.36 }}>
            {initialsFor(name)}
          </span>
        )}
      </div>
      <span
        className={cn(
          "absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full text-white ring-2 ring-surface",
          platform === "youtube" ? "bg-red-600" : "bg-ink"
        )}
      >
        {platform === "youtube" ? <YoutubeMark /> : <TiktokMark />}
      </span>
    </div>
  );
}
