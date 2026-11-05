"use client";

import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import { APP_URL } from "@/lib/constants";
import { cn } from "@/lib/utils";

// Dotted world-map fragments flanking the heading. One character per grid cell,
// "o" = dot; each cluster renders at a fixed CSS pitch (see DotCluster).
const LEFT_MAP = [
  ".....oo......oooo.",
  ".....ooo.....oooo.",
  ".....oooooo....oo.",
  "....oooo.o..oo....",
  "....ooo..o..o.....",
  ".....oo.oooo..oo..",
  "...oooo..o....oo..",
  ".....o...ooooooo..",
  "....oo....oooooo..",
  ".....oo...oooooo..",
  "..........oooooo..",
  ".........ooooooo..",
  ".oo.....ooo...oooo",
  ".o..oo..oooo..ooo.",
  ".ooooo...oo...oo..",
  "oooooo...oo...oo..",
  ".ooo..........oo..",
  "...o..............",
  "...oooo...........",
  "....ooooo.........",
  ".....oo...........",
  "......oo..........",
  "......oo..........",
];

const RIGHT_MAP = [
  "...............o......",
  "............ooooo.....",
  "............o.ooo.....",
  "......o.......ooooo...",
  "...oo.o.o....ooo..oo..",
  "oooooooooo...ooo..ooo.",
  "ooooooo..o........oooo",
  ".ooo...............o.o",
  "..o..o......oo.....o..",
  "..oooooo...ooooo......",
  "..o..o.ooooooooo......",
  ".....o.ooooo.o........",
  "...oo..ooooo..........",
  "oo.o...ooooo..........",
  "oo...oooooooooooo.....",
  "ooo..oooooooooooo.....",
  "o.o.........oo........",
  "............o.........",
];

function DotCluster({ rows, pitch, className }: { rows: string[]; pitch: number; className?: string }) {
  const cols = rows[0].length;
  return (
    <svg
      aria-hidden
      viewBox={`0 0 ${cols} ${rows.length}`}
      width={cols * pitch}
      height={rows.length * pitch}
      className={className}
    >
      {rows.flatMap((row, r) =>
        [...row].map((cell, c) =>
          cell === "o" ? <circle key={`${r}-${c}`} cx={c + 0.5} cy={r + 0.5} r={0.25} fill="#e1e2ec" /> : null,
        ),
      )}
    </svg>
  );
}

function Star() {
  return (
    <svg aria-hidden viewBox="0.49 0 19.02 18.09" className="h-[13.8px] w-[14.5px]">
      <polygon
        points="10,0 12.25,6.91 19.51,6.91 13.63,11.18 15.88,18.09 10,13.82 4.12,18.09 6.37,11.18 0.49,6.91 7.75,6.91"
        fill="#eab308"
      />
    </svg>
  );
}

export function Hero() {
  return (
    <>
    {/* The White Frame: outermost layer matches the page background and gives the
        hero a uniform margin on every side. */}
    <div className="bg-white px-0 py-3 sm:p-3">
      <section
        className="relative isolate flex flex-col overflow-hidden rounded-none sm:rounded-2xl sm:min-h-[calc(100vh-1.5rem)]"
      >
        {/* Map fragments: desktop only, top edge 3px above the rating pill (the
            content starts at md:pt-44). Scaled down at xl so the right cluster
            keeps clear of the heading's first line on 1280px screens. */}
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-[173px] hidden xl:block">
          <DotCluster
            rows={LEFT_MAP}
            pitch={10.3}
            className="absolute left-16 top-0 origin-top-left scale-[0.8] min-[1440px]:scale-100"
          />
          <DotCluster
            rows={RIGHT_MAP}
            pitch={10}
            className="absolute right-[51px] top-0 origin-top-right scale-[0.8] min-[1440px]:scale-100"
          />
        </div>

        {/* Content layer: sits above the map fragments. Bottom padding
            from sm up mirrors the preview card's pull-up magnitude below (both
            keyed off the same 40vh term) plus a fixed ~2rem buffer, so the card
            can never climb high enough to cover the CTA button -- if it grew to
            match the pull exactly, a tall/short viewport edge case could still
            close the gap to zero. */}
        <div
          className="relative z-10 mx-auto flex w-full max-w-6xl flex-col items-center px-4 pb-88 pt-24 text-center sm:px-6 sm:pb-[clamp(12rem,40vh,32rem)] sm:pt-32 lg:px-8 md:pt-44"
          style={{ fontFamily: '"Inter", -apple-system, system-ui, sans-serif' }}
        >
          <div className="inline-flex h-[29px] items-center gap-3 rounded-full bg-[#f5f6fc] px-2 text-[12px] font-medium text-[#0f172a]">
            <span className="inline-flex gap-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} />
              ))}
            </span>
            100k+ users worldwide
          </div>

          <h1 className="mt-[22px] text-[clamp(24px,7.4vw,34px)] font-semibold leading-[1.1] text-[#0f172a] sm:text-[48px] sm:leading-[0.97] lg:text-[56px]">
            <span className="whitespace-nowrap">
              Build a Non-Competitive
            </span>
            <br />
            Faceless Page
          </h1>

          <p className="mt-[22px] max-w-xs text-[15px] leading-[1.6] text-[#8f97a3] sm:hidden">
            Everything you need to grow and profit.
          </p>
          <p className="mt-[22px] hidden max-w-[420px] text-base leading-[1.6] text-balance text-[#8f97a3] sm:block">
            Everything you need to make money with social media, all in one place.
          </p>

          <div className="relative z-20 mt-8 flex justify-center sm:mt-[29px]">
            {/* Flat blue pill in a pale-blue ring, lit from below by a soft cyan
                glow sitting a little left of center. Proportions are keyed off
                the font size: face height ~2.85em, side padding ~1.45em, ring ~0.2em. */}
            <a
              href={APP_URL}
              className="group inline-flex rounded-full bg-[#dbe5ff] p-1 shadow-[0_2px_5px_rgba(0,0,0,0.05)] transition-transform duration-150 ease-out active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3771ff]/40 focus-visible:ring-offset-2 sm:p-[5px]"
            >
              <span
                className="flex h-[54px] items-center rounded-full bg-[#3771ff] px-7 text-[18px] font-semibold text-white transition-colors duration-200 group-hover:bg-[#3f78ff] sm:h-[68px] sm:px-[35px] sm:text-[24px]"
                style={{
                  backgroundImage:
                    "radial-gradient(ellipse 39% 69% at 39% 100%, #7cd3ff 0%, rgba(124,211,255,0.58) 50%, rgba(124,211,255,0) 100%)",
                }}
              >
                Try Verlab Now
              </span>
            </a>
          </div>

        </div>
      </section>
    </div>

    {/* Product preview: floats on top of the frame, overlapping its bottom edge.
        The pull-up is clamped rather than a bare `-40vh` -- an unbounded vh value
        can overshoot past the hero's own (content-floored) height at extreme zoom
        levels or unusual viewport aspect ratios, dragging this card, and everything
        after it in flow, up into content it shouldn't touch. The clamp keeps the
        normal ~40vh feel at ordinary viewport heights but can never pull further
        than -30rem or less than -10rem. */}
    <div className="relative z-20 mx-auto -mt-80 w-full max-w-6xl px-3 sm:mt-[clamp(-30rem,-40vh,-10rem)] sm:px-6 lg:px-8">
      <div className="relative p-2.5 sm:p-4">
        {/* The video carries a small bottom fade so the footage dissolves into the
            white page background instead of hard-cutting at the corner. */}
        <div
          className={cn(
            "relative overflow-hidden rounded-lg bg-surface sm:rounded-[22px]",
            "[mask-image:none] sm:[mask-image:linear-gradient(to_bottom,black_0%,black_92%,transparent_100%)]",
            "[-webkit-mask-image:none] sm:[-webkit-mask-image:linear-gradient(to_bottom,black_0%,black_92%,transparent_100%)]",
          )}
        >
          <video
            src="/videos/hero-preview.mp4"
            poster="/videos/hero-preview-poster.jpg"
            autoPlay
            loop
            muted
            playsInline
            controlsList="nodownload noremoteplayback"
            disablePictureInPicture
            onContextMenu={(event) => event.preventDefault()}
            className="w-full rounded-lg sm:rounded-[20px]"
          />
        </div>
      </div>
    </div>

    </>
  );
}
