import { forwardRef, type ReactNode } from "react";
import type { LucideProps } from "lucide-react";

// Sidebar icons drawn to match the reference rail's set (24 grid, round
// caps/joins, currentColor), for the slots lucide has no close match for.
// They take the same props as lucide icons, so NavItem.icon accepts them.
function railIcon(name: string, children: ReactNode) {
  const Icon = forwardRef<SVGSVGElement, LucideProps>(
    // `absoluteStrokeWidth` is a lucide-only prop; pulled out so it never
    // reaches the DOM.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    ({ size = 24, strokeWidth = 2, absoluteStrokeWidth, className, ...props }, ref) => (
      <svg
        ref={ref}
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        width={size}
        height={size}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-hidden="true"
        {...props}
      >
        {children}
      </svg>
    )
  );
  Icon.displayName = name;
  return Icon;
}

// House with overhanging eaves and a round-topped door.
export const RailHomeIcon = railIcon(
  "RailHomeIcon",
  <>
    <path d="M2 10.25 12 2.5l10 7.75" />
    <path d="M4.25 8.6v10.9a2 2 0 0 0 2 2h11.5a2 2 0 0 0 2-2V8.6" />
    <path d="M8.75 21.5v-8a1 1 0 0 1 1-1h4.5a1 1 0 0 1 1 1v8" />
  </>
);

// Frame with a slatted clapper band on top and a solid play mark.
export const RailVideoIcon = railIcon(
  "RailVideoIcon",
  <>
    <rect x="3" y="3" width="18" height="18" rx="2.5" />
    <path d="M3 7h18" />
    <path d="M8.25 7 10.5 3" />
    <path d="M13.75 7 16 3" />
    <path d="M10.25 11.5v5.5l4.75-2.75z" fill="currentColor" />
  </>
);

// Open-end wrench (head top right) crossed by a screwdriver (tip top left),
// the screwdriver broken where it passes under the wrench's handle.
export const RailToolsIcon = railIcon(
  "RailToolsIcon",
  <>
    <path d="M13.47 7.84A4.25 4.25 0 0 1 19.25 2.63L17.15 4.73A1.5 1.5 0 0 0 19.27 6.85L21.37 4.75A4.25 4.25 0 0 1 16.16 10.53L5.59 21.09A1.9 1.9 0 0 1 2.91 18.41Z" />
    <circle cx="4.5" cy="4.5" r="1.6" />
    <path d="m5.65 5.65 3.45 3.45" />
    <path d="M16.09 13.41 21.09 18.41A1.9 1.9 0 0 1 18.41 21.09L13.41 16.09Z" />
  </>
);

// Solid wizard hat: a cone with a drooping tip over a wide, tilted brim,
// split by a thin band.
export const RailWizardIcon = railIcon(
  "RailWizardIcon",
  <g fill="currentColor" stroke="none" transform="translate(11.7 21.9) scale(1.06) translate(-11.7 -21.9)">
    <path d="M6.5 15 6.5 6.3 5.3 6.1C5 7.2 4.9 8.4 4.6 8.7 4.1 8.9 3.9 8.2 3.9 7.4 3.6 5.8 3.4 4.8 3.5 4.3 5.5 3.4 8.5 2.9 11 3.6 14.2 4.6 15.9 8 15.9 11 15.9 12.5 15.6 13.8 15.2 14.8 12.5 15.6 9.2 15.6 6.5 15Z" />
    <path d="M1 20.2C.2 18.3 1.4 15.6 4.6 15.4 5.6 15.35 6.4 15.6 7 16.4 9.5 17.6 12.5 17.7 15.3 16.5 17.5 15 20.2 13 22.3 12.9 23.4 12.9 23.6 14.3 22.8 15.2 21.2 17.2 17.6 18.8 13.5 20.8 10.5 22.2 6.2 22.6 3.4 21.9 2.3 21.6 1.5 21.1 1 20.2Z" />
  </g>
);

// Clapperboard with the clapper raised over a closed body.
export const RailClipIcon = railIcon(
  "RailClipIcon",
  <>
    <path d="M20.2 6 3 11l-.9-2.4c-.3-1.1.3-2.2 1.3-2.5l13.5-4c1.1-.3 2.2.3 2.5 1.3Z" />
    <path d="m6.2 5.3 3.1 3.9" />
    <path d="m12.4 3.4 3.1 4" />
    <path d="M3 11h18v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
  </>
);
