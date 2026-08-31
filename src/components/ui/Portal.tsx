"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

// Renders children directly under document.body instead of wherever the
// caller sits in the tree. Needed because AuroraBackground (src/components/ui/AuroraBackground.tsx)
// wraps all dashboard page content in a `relative z-0` stacking context that
// is a sibling of Sidebar's `z-50` -- any element nested inside that content,
// no matter its own z-index, can never visually cover the sidebar. Portaling
// out of that subtree is the only reliable fix, so every full-screen modal/
// overlay in the app should render through this.
export function Portal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return createPortal(children, document.body);
}
