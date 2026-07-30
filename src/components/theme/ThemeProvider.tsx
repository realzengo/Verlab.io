"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";

type Theme = "light" | "dark" | "system";
type ResolvedTheme = "light" | "dark";

const STORAGE_KEY = "verlab-theme";

interface ThemeContextValue {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function systemTheme(): ResolvedTheme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

// Dark mode is only available inside the authenticated app/admin shells —
// the marketing site, login, and signup pages must always render light.
function isThemedRoute(pathname: string) {
  return pathname.startsWith("/app") || pathname.startsWith("/admin");
}

function applyDark(dark: boolean) {
  const root = document.documentElement;

  // Toggling `.dark` flips CSS variables consumed by many elements' own
  // hover transitions (transition-all/colors), which otherwise makes the
  // whole page cross-fade through muddy intermediate colors. Suppress all
  // transitions for one frame so the swap is instant, then restore them.
  const blocker = document.createElement("style");
  blocker.textContent = "*,*::before,*::after{transition:none!important;animation-duration:0s!important;}";
  document.head.appendChild(blocker);

  root.classList.toggle("dark", dark);

  // Force style recalculation under the blocker before removing it.
  window.getComputedStyle(blocker).opacity;
  requestAnimationFrame(() => {
    document.head.removeChild(blocker);
  });
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [theme, setThemeState] = useState<Theme>("system");
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>("light");

  useEffect(() => {
    // One-time sync from localStorage (external systems unavailable during
    // SSR) into React state, mirroring the inline no-flash script. Absent an
    // explicit saved choice, the app defaults to light rather than following
    // the OS's prefers-color-scheme.
    const stored = (localStorage.getItem(STORAGE_KEY) as Theme | null) ?? "light";
    const resolved = stored === "system" ? systemTheme() : stored;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setThemeState(stored);
    setResolvedTheme(resolved);
  }, []);

  useEffect(() => {
    applyDark(isThemedRoute(pathname ?? "") && resolvedTheme === "dark");
  }, [pathname, resolvedTheme]);

  useEffect(() => {
    if (theme !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setResolvedTheme(systemTheme());
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [theme]);

  const setTheme = useCallback((next: Theme) => {
    localStorage.setItem(STORAGE_KEY, next);
    setThemeState(next);
    setResolvedTheme(next === "system" ? systemTheme() : next);
  }, []);

  const value = useMemo(() => ({ theme, resolvedTheme, setTheme }), [theme, resolvedTheme, setTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}

export const THEME_STORAGE_KEY = STORAGE_KEY;
