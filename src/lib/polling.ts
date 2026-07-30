/**
 * Repeatedly calls `fetchFn` until `isSettled` returns true, calling
 * `onUpdate` after every successful fetch. Retries at `intervalMs` on
 * fetch errors too (matches every existing poll loop's behavior). Returns a
 * cancel function -- callers MUST invoke it on unmount (and before starting
 * a new poll) or the loop keeps running and calling `onUpdate` indefinitely.
 */
export function pollUntilSettled<T>(
  fetchFn: () => Promise<T>,
  isSettled: (data: T) => boolean,
  onUpdate: (data: T) => void,
  opts?: { intervalMs?: number; timeoutMs?: number; onTimeout?: () => void }
): () => void {
  const intervalMs = opts?.intervalMs ?? 1500;
  const deadline = opts?.timeoutMs != null ? Date.now() + opts.timeoutMs : null;
  let cancelled = false;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const tick = async () => {
    if (cancelled) return;
    if (deadline != null && Date.now() >= deadline) {
      opts?.onTimeout?.();
      return;
    }
    try {
      const data = await fetchFn();
      if (cancelled) return;
      onUpdate(data);
      if (!isSettled(data)) {
        timeoutId = setTimeout(tick, intervalMs);
      }
    } catch {
      if (!cancelled) {
        timeoutId = setTimeout(tick, intervalMs);
      }
    }
  };

  tick();

  return () => {
    cancelled = true;
    if (timeoutId) clearTimeout(timeoutId);
  };
}
