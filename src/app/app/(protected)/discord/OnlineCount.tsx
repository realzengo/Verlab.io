"use client";

import { useEffect, useState } from "react";

export function OnlineCount({ base }: { base: number }) {
  const [count, setCount] = useState(base);

  useEffect(() => {
    const tick = () => {
      setCount((prev) => {
        const delta = Math.floor(Math.random() * 7) - 3;
        const next = prev + delta;
        return Math.min(base + 15, Math.max(base - 15, next));
      });
    };

    const schedule = () => {
      const delay = 4000 + Math.random() * 6000;
      return setTimeout(() => {
        tick();
        timeoutId = schedule();
      }, delay);
    };

    let timeoutId = schedule();
    return () => clearTimeout(timeoutId);
  }, [base]);

  return <>{count.toLocaleString()}</>;
}
