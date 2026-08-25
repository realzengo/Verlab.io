"use client";

import type { AnchorHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * The blue glass pill button, rebuilt from its computed styles.
 *
 * Four layers make the glass:
 *
 * 1. Two stacked radial gradients — a wash of white low and right, over a blue
 *    that runs from sky to ink — blended with `overlay`, which is what stops it
 *    reading as flat paint.
 * 2. A hairline that is bright at the top and gone by the bottom. It is drawn
 *    as a padded box masked down to its own edge, because a plain border cannot
 *    take a gradient.
 * 3. Two inset shadows: cold light on the top-left lip, deep blue in the
 *    bottom-right well.
 * 4. A narrow band of light that crosses the face once per hover, over a wash
 *    that lifts the whole face while the pointer is on it.
 */
const BUTTON_STYLES = `
@keyframes glass-cta-sheen {
  from { transform: translateX(-140%) skewX(-16deg); }
  to   { transform: translateX(320%)  skewX(-16deg); }
}
.glass-cta-sheen { transform: translateX(-140%) skewX(-16deg); }
.glass-cta-btn:hover .glass-cta-sheen {
  animation: glass-cta-sheen 0.85s cubic-bezier(0.32, 0, 0.24, 1);
}
.glass-cta-btn::after {
  content: "";
  position: absolute;
  inset: 1px;
  z-index: 1;
  border-radius: inherit;
  opacity: 0;
  mix-blend-mode: overlay;
  background: radial-gradient(101.79% 101.79% at 65.61% 81.79%, rgba(255,255,255,0.6) 0%, rgba(255,255,255,0) 100%);
  transition: opacity 0.3s ease-in-out;
}
.glass-cta-btn:hover::after { opacity: 1; }
@media (prefers-reduced-motion: reduce) {
  .glass-cta-btn:hover .glass-cta-sheen { animation: none; }
}
`;

export interface GlassCtaButtonProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  icon?: ReactNode;
  children?: ReactNode;
  /** Corner radius in px. Pass a large value (e.g. 999) for a full pill. */
  radius?: number;
}

export function GlassCtaButton({ icon, children, className, style, radius = 10, ...rest }: GlassCtaButtonProps) {
  return (
    <a
      {...rest}
      className={cn(
        "glass-cta-btn relative isolate inline-flex w-fit items-center gap-[6px] overflow-hidden",
        "px-5 py-[10px] text-[16px] font-medium tracking-[-0.13px] text-white",
        "transition-transform duration-150 ease-out active:scale-[0.97]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent",
        className,
      )}
      style={{
        borderRadius: radius,
        backgroundImage:
          "radial-gradient(101.79% 101.79% at 65.61% 81.79%, rgba(255,255,255,0.6) 0%, rgba(255,255,255,0) 100%), radial-gradient(114.65% 114.65% at 9.73% 17.27%, #1e82e0 0%, #1c38ea 100%)",
        backgroundBlendMode: "overlay, normal",
        boxShadow:
          "inset -3px -3px 4px rgba(191,229,251,0.4), inset 4px 4px 4px rgba(19,26,228,0.1)",
        ...style,
      }}
    >
      <style>{BUTTON_STYLES}</style>

      {/* The lit edge. Blurred by a hair so it reads as glass, not as a stroke. */}
      <span aria-hidden className="pointer-events-none absolute inset-0 z-20 blur-[1px]">
        <span
          className="absolute -left-px -top-px z-20 h-full w-full"
          style={{
            opacity: 0.45,
            padding: 3,
            borderRadius: radius,
            background:
              "linear-gradient(176.87deg, rgba(255,255,255,0.5) 8.56%, rgba(255,255,255,0) 85.04%)",
            WebkitMask:
              "linear-gradient(#fff, #fff) content-box, linear-gradient(#fff, #fff)",
            WebkitMaskComposite: "xor",
            mask: "linear-gradient(#fff, #fff) content-box, linear-gradient(#fff, #fff)",
            maskComposite: "exclude",
          }}
        />
      </span>

      {/* The sweep. It waits off the left edge and crosses once per hover. */}
      <span
        aria-hidden
        className="glass-cta-sheen pointer-events-none absolute inset-y-0 left-0 z-10 w-1/3 blur-[5px]"
        style={{
          background:
            "linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.55) 50%, rgba(255,255,255,0) 100%)",
        }}
      />

      {icon ? <span className="relative z-30 -mb-px">{icon}</span> : null}
      <span className="relative z-30">{children}</span>
    </a>
  );
}

export default GlassCtaButton;
