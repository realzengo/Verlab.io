import type { NicheBendPlatform } from "@/lib/types";

export function detectPlatform(rawUrl: string): NicheBendPlatform | null {
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  try {
    const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const { hostname } = new URL(withProtocol);
    if (/(^|\.)youtube\.com$/i.test(hostname) || /(^|\.)youtu\.be$/i.test(hostname)) {
      return "youtube";
    }
    if (/(^|\.)tiktok\.com$/i.test(hostname)) {
      return "tiktok";
    }
  } catch {
    // fall through to loose keyword sniff below
  }

  if (/youtube|youtu\.be/i.test(trimmed)) return "youtube";
  if (/tiktok/i.test(trimmed)) return "tiktok";

  return null;
}

export function deriveChannelName(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "This creator";

  let value = trimmed.replace(/^https?:\/\//i, "").replace(/^www\./i, "");
  const handleMatch = value.match(/@([a-zA-Z0-9._-]+)/);

  if (handleMatch) {
    value = handleMatch[1];
  } else {
    const segments = value.split("/").filter(Boolean);
    value = segments.length > 1 ? segments[1] : (segments[0] ?? value);
  }

  value = value.replace(/^@/, "");

  const words = value
    .split(/[-_.]/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1));

  return words.join(" ") || "This creator";
}
