import { forwardRef } from "react";
import type { SVGProps } from "react";

export const StarIcon = forwardRef<SVGSVGElement, SVGProps<SVGSVGElement>>((props, ref) => (
  <svg ref={ref} viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M12 0 L14.94 9.06 L24 12 L14.94 14.94 L12 24 L9.06 14.94 L0 12 L9.06 9.06 Z" />
  </svg>
));
StarIcon.displayName = "StarIcon";
