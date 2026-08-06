"use client";

import { useRef } from "react";
import type { Variants } from "framer-motion";
import type { ComparisonRow, PricingPlan } from "@/lib/types";
import { TimelineContent } from "@/components/ui/timeline-animation";
import { PricingTable } from "@/components/pricing/PricingTable";
import { PricingComparisonTable } from "@/components/pricing/PricingComparisonTable";

const revealVariants: Variants = {
  visible: (i: number) => ({
    y: 0,
    opacity: 1,
    filter: "blur(0px)",
    transition: { delay: i * 0.15, duration: 0.5 },
  }),
  hidden: { filter: "blur(10px)", y: -20, opacity: 0 },
};

export function PricingSectionClient({
  plans,
  comparisonRows,
  authenticated,
}: {
  plans: PricingPlan[];
  comparisonRows: ComparisonRow[];
  authenticated: boolean;
}) {
  const sectionRef = useRef<HTMLDivElement>(null);

  return (
    <div ref={sectionRef} className="relative">
      <div
        className="absolute left-[10%] right-[10%] top-0 -z-10 h-full w-[80%]"
        style={{
          backgroundImage: "radial-gradient(circle at center, #335cff 0%, transparent 70%)",
          opacity: 0.15,
        }}
        aria-hidden
      />

      <div className="mx-auto max-w-xl text-center">
        <TimelineContent
          as="span"
          animationNum={0}
          timelineRef={sectionRef}
          customVariants={revealVariants}
          className="text-[13px] font-bold uppercase tracking-[1.4px] text-primary"
        >
          Pricing
        </TimelineContent>
        <TimelineContent
          as="h2"
          animationNum={1}
          timelineRef={sectionRef}
          customVariants={revealVariants}
          className="mt-3.5 text-[28px] font-semibold leading-[1.1] tracking-[-1px] text-slate sm:text-[45px]"
        >
          Pricing that pays for
          <br />
          <span className="text-primary">itself in 24 hours.</span>
        </TimelineContent>
        <TimelineContent
          as="p"
          animationNum={2}
          timelineRef={sectionRef}
          customVariants={revealVariants}
          className="mt-3 text-base text-body sm:mt-3.5 sm:text-[17px]"
        >
          Reverse-engineer viral videos into your own scripts.
        </TimelineContent>
      </div>

      <TimelineContent as="div" animationNum={3} timelineRef={sectionRef} customVariants={revealVariants} className="mt-8 sm:mt-10">
        <PricingTable plans={plans} ctaHref="/app" authenticated={authenticated} />
      </TimelineContent>

      <div className="mt-8 overflow-x-auto sm:mt-12">
        <PricingComparisonTable plans={plans} rows={comparisonRows} />
      </div>
    </div>
  );
}
