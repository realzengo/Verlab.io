import { forwardRef } from "react";
import type { LucideProps } from "lucide-react";

// The Model Context Protocol mark, drawn as strokes so it sits with the
// lucide icons around it (same 24 grid, honours size/strokeWidth/color).
const MCP_SCALE = 1.18;
export const McpIcon = forwardRef<SVGSVGElement, LucideProps>(
  ({ size = 24, strokeWidth = 2, className, ...props }, ref) => (
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
      {/* Scaled up to fill the grid like the other rail icons; the stroke is
          divided by the same factor so the line weight still matches. */}
      <g transform={`translate(11.7 12) scale(${MCP_SCALE}) translate(-12.2 -12.4)`} strokeWidth={Number(strokeWidth) / MCP_SCALE}>
        <path d="M3.5 11.75 11.67 3.58a2.83 2.83 0 0 1 4 4L9.5 13.75" />
        <path d="m9.59 13.66 6.08-6.08a2.83 2.83 0 0 1 4 0l.04.04a2.83 2.83 0 0 1 0 4l-7.39 7.39a1 1 0 0 0 0 1.42l1.51 1.51" />
        <path d="m13.67 5.58-6.04 6.04a2.83 2.83 0 0 0 4 4l6.04-6.04" />
      </g>
    </svg>
  )
);
McpIcon.displayName = "McpIcon";
