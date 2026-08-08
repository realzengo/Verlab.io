// Lets a "Recent Generations" list paint immediately from the last known
// state on mount instead of rendering empty until the network round trip to
// /api/generate-video or /api/generate-image resolves -- callers still kick
// off a real fetch right after hydrating, this just removes the empty-grid
// flash on every navigation/refresh. Pure UX nicety: never throw, never
// block on a missing/corrupt/quota-full localStorage.
const PREFIX = "clypa:history-cache:";

export function readHistoryCache<T>(key: string): T[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : null;
  } catch {
    return null;
  }
}

export function writeHistoryCache<T>(key: string, items: T[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(items));
  } catch {
    // Quota exceeded / private browsing / disabled storage -- skip silently.
  }
}
