"use client";

import { useEffect, useState } from "react";

interface FakeStepProgressOptions {
  minDelayMs?: number;
  maxDelayMs?: number;
}

// Steps through a fixed number of phases on its own clock rather than waiting
// on real backend timing: each phase holds for a random delay so it reads as
// genuine work being done, then it settles onto the final phase and holds
// there — however long the job actually takes — so it never lies about being
// done before the real result arrives.
export function useFakeStepProgress(
  active: boolean,
  stepCount: number,
  { minDelayMs = 7000, maxDelayMs = 10000 }: FakeStepProgressOptions = {}
): number {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!active) return;

    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const randomDelay = () => minDelayMs + Math.random() * (maxDelayMs - minDelayMs);

    // Scheduling the first step (i=0) through a zero-delay timeout, rather
    // than calling setIndex directly here, keeps the reset out of the effect
    // body itself so it can't trigger a synchronous cascading render.
    const scheduleStep = (i: number, delay: number) => {
      timeoutId = setTimeout(() => {
        if (cancelled) return;
        setIndex(i);
        if (i < stepCount - 1) {
          scheduleStep(i + 1, randomDelay());
        }
      }, delay);
    };
    scheduleStep(0, 0);

    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [active, stepCount, minDelayMs, maxDelayMs]);

  return active ? index : 0;
}
