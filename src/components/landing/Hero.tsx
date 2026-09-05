"use client";

import { useRef } from "react";
import { useScroll, useTransform } from "framer-motion";
import { Sparkle } from "lucide-react";
import { GlassCtaButton } from "@/components/landing/GlassCtaButton";
import { PayPalNotification } from "@/components/landing/PayPalNotification";
import { APP_URL } from "@/lib/constants";
import { cn } from "@/lib/utils";

export function Hero() {
  const heroRef = useRef<HTMLDivElement>(null);
  // Tracks scroll from the hero's top hitting the viewport top (progress 0,
  // i.e. page load) to its bottom hitting the viewport top (progress 1, i.e.
  // fully scrolled past) -- so the floating notifications drift and fade as
  // a direct function of scroll position rather than a one-shot reveal.
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const leftY = useTransform(scrollYProgress, [0, 1], [0, -140]);
  const leftOpacity = useTransform(scrollYProgress, [0, 0.7, 1], [1, 1, 0]);
  const rightY = useTransform(scrollYProgress, [0, 1], [0, -220]);
  const rightOpacity = useTransform(scrollYProgress, [0, 0.6, 1], [1, 1, 0]);

  return (
    <>
    {/* The White Frame: outermost layer matches the page background and gives the sky
        canvas below a uniform margin on every side. */}
    <div ref={heroRef} className="bg-white px-0 py-3 sm:p-3">
      <section
        className="relative isolate flex flex-col overflow-hidden rounded-none sm:rounded-2xl sm:min-h-[calc(100vh-1.5rem)]"
        style={{
          backgroundImage:
            "linear-gradient(to bottom, #ffffff 0%, #ffffff 32%, #eaf2ff 50%, #6fa3f2 74%, #335cff 100%)",
        }}
      >
        {/* Halftone dot texture, matching the reference's grain over the gradient. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-20 opacity-[0.5]"
          style={{
            backgroundImage:
              "radial-gradient(rgba(15,23,42,0.45) 0.7px, transparent 1px)",
            backgroundSize: "6px 6px",
            maskImage: "linear-gradient(to bottom, transparent 0%, transparent 25%, black 85%)",
            WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, transparent 25%, black 85%)",
          }}
        />

        {/* Fades the blue gradient into the page background at the bottom edge on
            mobile, where the section's height is content-driven instead of viewport-filled
            so a solid band of blue would otherwise hard-cut into the next section. Uses an
            eased (non-linear) set of stops rather than a flat alpha ramp -- a plain
            transparent-to-opaque gradient reads as a hard edge partway through because
            alpha blends perceptually faster in the middle; easing it out front-loads the
            transparency for a softer, slower-dissolving look. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-48 sm:hidden"
          style={{
            backgroundImage:
              "linear-gradient(to bottom, rgba(255,255,255,0) 0%, rgba(255,255,255,0.013) 8.1%, rgba(255,255,255,0.049) 15.5%, rgba(255,255,255,0.104) 22.5%, rgba(255,255,255,0.175) 29%, rgba(255,255,255,0.259) 35.3%, rgba(255,255,255,0.352) 41.2%, rgba(255,255,255,0.45) 47.1%, rgba(255,255,255,0.55) 52.9%, rgba(255,255,255,0.648) 58.8%, rgba(255,255,255,0.741) 64.7%, rgba(255,255,255,0.825) 71%, rgba(255,255,255,0.896) 77.5%, rgba(255,255,255,0.951) 84.5%, rgba(255,255,255,0.987) 91.9%, rgba(255,255,255,1) 100%)",
          }}
        />

        {/* Content layer: sits above the gradient and cloud edges. */}
        <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col items-center px-4 pb-88 pt-40 text-center sm:px-6 sm:pb-28 sm:pt-32 lg:px-8 lg:pb-32 md:pt-44">
          <div className="relative flex w-full justify-center">
            <h1 className="relative max-w-6xl font-display text-[clamp(24px,8vw,30px)] font-bold leading-[1.1] tracking-[-0.5px] text-heading sm:text-[62px] sm:leading-[1.05] sm:tracking-[-2px] lg:text-[72px]">
              <span className="whitespace-nowrap">
                Build a Non-Competitive
              </span>
              <br />
              Faceless Page
            </h1>
          </div>

          <p className="mt-5 max-w-xl text-sm font-bold leading-relaxed text-subtle sm:hidden">
            Everything you need to grow and profit.
          </p>
          <p className="mt-7 hidden max-w-2xl text-lg font-bold leading-relaxed text-subtle sm:block">
            Everything you need to make money with social media, all in one place.
          </p>

          <div className="relative z-20 mt-8 flex justify-center sm:mt-14">
            <GlassCtaButton
              href={APP_URL}
              radius={999}
              icon={<Sparkle size={20} className="fill-current sm:h-5 sm:w-5" />}
              className="px-8 py-4.5 text-lg font-bold! sm:px-10 sm:py-5 sm:text-lg"
            >
              Try Verlab Now
            </GlassCtaButton>
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
    <div className="relative z-20 mx-auto -mt-72 w-full max-w-6xl px-3 sm:mt-[clamp(-30rem,-40vh,-10rem)] sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute left-0 top-[16%] z-30 hidden -translate-x-[10%] xl:block 2xl:-translate-x-[32%]">
        <PayPalNotification amount="577.94" style={{ y: leftY, opacity: leftOpacity }} />
      </div>
      <div className="pointer-events-none absolute right-0 top-[40%] z-30 hidden translate-x-[10%] xl:block 2xl:translate-x-[32%]">
        <PayPalNotification amount="1,284.50" style={{ y: rightY, opacity: rightOpacity }} />
      </div>
      <div className="relative rounded-xl p-2.5 sm:rounded-[32px] sm:p-4">
        {/* Glass frame: border + blur only -- masked to fade out toward the bottom.
            The video below carries its own (smaller) fade so the footage dissolves
            into the white page background instead of hard-cutting at the corner. */}
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-0 -z-10 rounded-xl border border-hairline bg-surface/30 backdrop-blur-xl sm:rounded-[32px]",
            "[mask-image:none] sm:[mask-image:linear-gradient(to_bottom,black_0%,black_70%,transparent_100%)]",
            "[-webkit-mask-image:none] sm:[-webkit-mask-image:linear-gradient(to_bottom,black_0%,black_70%,transparent_100%)]",
          )}
        />
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
