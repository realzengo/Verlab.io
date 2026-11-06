"use client";

import { createContext, useContext, useState, type Dispatch, type SetStateAction } from "react";
import { cn } from "@/lib/utils";

const SidebarCollapsedContext = createContext<{
  collapsed: boolean;
  setCollapsed: Dispatch<SetStateAction<boolean>>;
} | null>(null);

export function SidebarCollapsedProvider({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <SidebarCollapsedContext.Provider value={{ collapsed, setCollapsed }}>
      {children}
    </SidebarCollapsedContext.Provider>
  );
}

// Rail text (labels, chevrons, hints) fades instead of resizing, so the icons
// never move: out quickly before the closing edge reaches it, back in only
// once the rail has mostly opened. The row's overflow clips whatever is left.
export function railFade(collapsed: boolean) {
  return cn(
    "whitespace-nowrap transition-opacity ease-out",
    collapsed ? "lg:opacity-0 lg:duration-100" : "lg:opacity-100 lg:delay-150 lg:duration-200"
  );
}

export function useSidebarCollapsed() {
  const ctx = useContext(SidebarCollapsedContext);
  if (!ctx) throw new Error("useSidebarCollapsed must be used within a SidebarCollapsedProvider");
  return ctx;
}
