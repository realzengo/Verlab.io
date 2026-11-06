import type { ReactNode } from "react";
import { caveat } from "@/lib/fonts";
import { cn } from "@/lib/utils";

// A handwritten margin note with a drawn arrow into the link field. Purely
// decorative (aria-hidden): the subtitle already says what the page does.
// It sits in the free space left of the field, so it only shows when the
// page is wide enough to hold it (an @container query on the page root).
// The arrow lands 6px short of the field's edge rather than touching it.
// Two short lines fit the 150px note; longer copy runs into the arrow.
export function LinkFieldNote({
  children = (
    <>
      Turn any video
      <br />
      into a script
    </>
  ),
}: {
  children?: ReactNode;
}) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute right-full top-[-56px] mr-1.5 hidden h-[104px] w-[160px] select-none @min-[1040px]:block motion-safe:animate-[note-fade_500ms_ease-out_200ms_both]"
    >
      <p
        className={cn(
          caveat.className,
          "absolute left-0 top-0 w-[150px] -rotate-[8deg] text-center text-[23px] leading-[1.05] text-body"
        )}
      >
        {children}
      </p>
      <svg
        viewBox="0 0 160 104"
        className="absolute inset-0 h-full w-full overflow-visible text-subtle"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path
          d="M68 60C70 82 100 97 152 96"
          pathLength={1}
          className="[stroke-dasharray:1] motion-safe:[stroke-dashoffset:1] motion-safe:animate-[note-draw_500ms_ease-out_500ms_forwards]"
        />
        <path d="M145.4 91.6L152 96L145.7 100.9" className="motion-safe:animate-[note-fade_200ms_ease-out_900ms_both]" />
      </svg>
    </div>
  );
}
