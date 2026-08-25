"use client";

import Image from "next/image";
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
    <div ref={heroRef} className="bg-[#F8F9FC] p-3">
      <section
        className="relative isolate flex h-[calc(100vh-1.5rem)] flex-col overflow-hidden rounded-2xl"
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

        {/* Content layer: sits above the gradient and cloud edges. */}
        <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col items-center px-4 pb-20 pt-36 text-center sm:px-6 sm:pb-28 sm:pt-32 lg:px-8 lg:pb-32 md:pt-44">
          <div className="relative flex w-full justify-center">
            <h1 className="relative max-w-6xl font-display text-[clamp(22px,7vw,27px)] font-bold leading-[1.1] tracking-[-0.5px] text-heading sm:text-[62px] sm:leading-[1.05] sm:tracking-[-2px] lg:text-[72px]">
              <span className="whitespace-nowrap">
                Build a Non-Competitive
              </span>
              <br />
              Faceless Page
            </h1>
          </div>

          <p className="mt-4 max-w-xl text-sm font-bold leading-relaxed text-subtle sm:hidden">
            Everything you need to grow and profit.
          </p>
          <p className="mt-7 hidden max-w-2xl text-lg font-bold leading-relaxed text-subtle sm:block">
            Everything you need to make money with social media, all in one place.
          </p>

          <div className="relative z-20 mt-8 flex justify-center sm:mt-14">
            <GlassCtaButton
              href={APP_URL}
              radius={999}
              icon={<Sparkle size={18} className="fill-current sm:h-5 sm:w-5" />}
              className="px-7 py-4 text-base font-bold! sm:px-10 sm:py-5 sm:text-lg"
            >
              Try Verlab Now
            </GlassCtaButton>
          </div>

        </div>
      </section>
    </div>

    {/* Product preview: floats on top of the frame, overlapping its bottom edge. */}
    <div className="relative z-20 mx-auto -mt-[40vh] w-full max-w-6xl px-4 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute left-0 top-[16%] z-30 hidden -translate-x-[10%] xl:block 2xl:-translate-x-[32%]">
        <PayPalNotification amount="577.94" style={{ y: leftY, opacity: leftOpacity }} />
      </div>
      <div className="pointer-events-none absolute right-0 top-[40%] z-30 hidden translate-x-[10%] xl:block 2xl:translate-x-[32%]">
        <PayPalNotification amount="1,284.50" style={{ y: rightY, opacity: rightOpacity }} />
      </div>
      <div
        className={cn(
          "relative rounded-xl border border-hairline bg-surface/30 p-2.5 backdrop-blur-xl sm:rounded-[32px] sm:p-4",
          "[mask-image:linear-gradient(to_bottom,black_0%,black_70%,transparent_100%)]",
          "[-webkit-mask-image:linear-gradient(to_bottom,black_0%,black_70%,transparent_100%)]",
        )}
      >
        <div className="overflow-hidden rounded-lg border border-hairline bg-surface sm:rounded-[22px]">
          <Image
            src="/hero-app-preview-v2.png"
            alt="Verlab's Niche Bending tool — reverse-engineer any viral format"
            width={2116}
            height={1180}
            priority
            className="w-full rounded-lg sm:rounded-[20px]"
          />
        </div>
      </div>
    </div>

    </>
  );
}
