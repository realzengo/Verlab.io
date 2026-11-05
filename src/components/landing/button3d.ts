import type { CSSProperties } from "react";

/**
 * Verlab's 3D blue button face, shared by every landing-page CTA: lighter at
 * the bottom centre, a thin bright rim along the top, and a solid darker lip
 * underneath. Spread onto `style` and set the shape (radius, height, padding)
 * with classes. `lip` is the lip's depth in px; ~7% of the button's height
 * reads right (3 for ~42px buttons, 4 for ~56px, 5 for ~68px).
 */
export function button3d(lip = 3): CSSProperties {
  return {
    backgroundColor: "#2f56f5",
    backgroundImage: "radial-gradient(65% 130% at 50% 100%, #739aff 0%, #4d76ff 45%, #2f56f5 100%)",
    boxShadow: `inset 0 ${lip > 3 ? 2 : 1.5}px 0 #b6caff, 0 ${lip}px 0 #1a35b8`,
  };
}

/** Lift on hover, settle on press. */
export const BUTTON_3D_MOTION = "transition-transform duration-200 ease-out hover:-translate-y-0.5 active:translate-y-px";
