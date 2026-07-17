"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

type NicheSidebarData = {
  availableNiches: string[];
  counts: Record<string, number>;
};

const EMPTY_DATA: NicheSidebarData = { availableNiches: [], counts: {} };

type NicheSidebarContextValue = {
  data: NicheSidebarData;
  setData: (data: NicheSidebarData) => void;
  selected: Set<string>;
  toggle: (niche: string) => void;
  clear: () => void;
};

const NicheSidebarContext = createContext<NicheSidebarContextValue | null>(null);

export function NicheSidebarProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<NicheSidebarData>(EMPTY_DATA);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Single-select: picking a niche scopes the whole video feed to it (see
  // /api/niches/[niche]/videos, which caches/paginates one niche at a time),
  // so selecting a second niche swaps to it rather than adding to a set.
  // Clicking the already-active niche clears back to "all niches".
  const toggle = useCallback((niche: string) => {
    setSelected((prev) => (prev.has(niche) ? new Set() : new Set([niche])));
  }, []);

  const clear = useCallback(() => setSelected(new Set()), []);

  const value = useMemo(
    () => ({ data, setData, selected, toggle, clear }),
    [data, selected, toggle, clear]
  );

  return <NicheSidebarContext.Provider value={value}>{children}</NicheSidebarContext.Provider>;
}

export function useNicheSidebar() {
  const ctx = useContext(NicheSidebarContext);
  if (!ctx) throw new Error("useNicheSidebar must be used within NicheSidebarProvider");
  return ctx;
}

// Publishes this page's niche list/counts up to the layout-level sidebar,
// and resets them on unmount so a stale filter panel doesn't linger once
// the user navigates away from the niche finder.
export function useNicheSidebarSync(availableNiches: string[], counts: Record<string, number>) {
  const { setData, clear } = useNicheSidebar();

  useEffect(() => {
    setData({ availableNiches, counts });
  }, [availableNiches, counts, setData]);

  useEffect(() => {
    return () => {
      setData(EMPTY_DATA);
      clear();
    };
  }, [setData, clear]);
}
