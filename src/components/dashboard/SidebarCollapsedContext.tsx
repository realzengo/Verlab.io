"use client";

import { createContext, useContext, useState, type Dispatch, type SetStateAction } from "react";

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

export function useSidebarCollapsed() {
  const ctx = useContext(SidebarCollapsedContext);
  if (!ctx) throw new Error("useSidebarCollapsed must be used within a SidebarCollapsedProvider");
  return ctx;
}
