"use client";

import { cn } from "@/lib/utils";
import React, { ReactNode } from "react";

interface AuroraBackgroundProps extends React.HTMLProps<HTMLDivElement> {
  children: ReactNode;
}

export function AuroraBackground({ className, children, ...props }: AuroraBackgroundProps) {
  return (
    // No z-index here: this must not become a stacking context of its own,
    // or any non-portaled fixed-position modal rendered inside `children`
    // gets trapped below it -- which sits below the sidebar's `fixed z-50`
    // in the root stacking context, so the sidebar would render on top of
    // (un-dimmed by) the modal's backdrop instead of being covered by it.
    //
    // No overflow clipping here either: `html`/`body` already clip the
    // x-axis globally via `overflow-x: clip` (see globals.css), which is
    // the correct choice because -- unlike `hidden`, and unlike `auto` --
    // `clip` never turns an element into a "scroll container". Any ancestor
    // that IS a scroll container (any overflow value other than `visible`
    // or `clip`, even on just one axis -- setting only `overflow-x` forces
    // the other axis to compute as `auto`, not `visible`) becomes the
    // reference frame for every `position: sticky` descendant. This box has
    // no bounded height (only `min-h-screen`) and never scrolls internally,
    // so registering as that reference frame anyway just breaks sticky
    // app-wide (e.g. StepSop's "On this page" nav scrolled away instead of
    // pinning in the viewport) without clipping anything itself.
    <div className={cn("relative min-h-screen bg-white dark:bg-black", className)} {...props}>
      {children}
    </div>
  );
}
