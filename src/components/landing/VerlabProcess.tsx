"use client";

import { type ReactNode } from "react";
import Image from "next/image";
import { ArrowUpRight } from "lucide-react";
import { VerifiedBadge } from "@/components/landing/VerifiedBadge";
import { BendIllustration, FormulaIllustration, NicheIllustration } from "@/components/landing/ProcessIllustrations";
import { BUTTON_3D_MOTION, button3d } from "@/components/landing/button3d";
import { APP_URL } from "@/lib/constants";
import { cn } from "@/lib/utils";

const TRUST_AVATARS = [
  "/reviewers/reviewer-01.jpeg",
  "/reviewers/reviewer-04.jpeg",
  "/reviewers/reviewer-03.jpeg",
  "/reviewers/reviewer-06.jpeg",
  "/reviewers/reviewer-08.jpeg",
];

// The stage slot keeps the illustration canvas's proportions (400 wide,
// ~320 of drawn height), so it never leaves an empty band at any width.
const STAGE_ASPECT = "400 / 320";

const STAGE_FADE =
  "linear-gradient(to bottom, black 0%, black 80%, rgba(0,0,0,0.55) 92%, transparent 100%)";

function StepBadge({ step }: { step: number }) {
  return (
    <div className="flex items-center justify-center gap-2.5" aria-hidden>
      <span className="h-px w-8 bg-gradient-to-r from-transparent to-slate-200 sm:w-12" />
      <span className="flex items-center gap-1">
        <span className="h-2 w-1 bg-slate-300" />
        <span className="h-3 w-1 bg-slate-300" />
        <span className="h-[18px] w-1 bg-slate-300" />
      </span>
      <span className="rounded-lg border-2 border-[#8fa8ff] bg-[linear-gradient(155deg,#6d8dff_0%,#335cff_55%,#1c3fd6_100%)] px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-white shadow-[0_4px_10px_-2px_rgba(15,23,42,0.3),0_1px_2px_rgba(15,23,42,0.15)]">
        Step {step}
      </span>
      <span className="flex items-center gap-1">
        <span className="h-[18px] w-1 bg-slate-300" />
        <span className="h-3 w-1 bg-slate-300" />
        <span className="h-2 w-1 bg-slate-300" />
      </span>
      <span className="h-px w-8 bg-gradient-to-l from-transparent to-slate-200 sm:w-12" />
    </div>
  );
}

/** White double-shell card around a full-bleed light stage: a cool wash
 * with a faint dot grid and a soft brand-blue glow behind the illustration,
 * fading to white above the copy. The stage keeps the canvas's proportions
 * so it never leaves an empty band at any width. */
function CardShell({
  step,
  title,
  description,
  children,
}: {
  step: number;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="flex h-full flex-col rounded-[24px] border-[3px] border-[#EEF0F3] bg-white p-1 shadow-[0_1px_2px_rgba(15,23,42,0.03),0_14px_28px_-20px_rgba(15,23,42,0.14)] sm:rounded-[28px] sm:border-[4px]">
      <div className="flex flex-1 flex-col overflow-hidden rounded-[20px]">
        <div
          className="relative shrink-0 overflow-hidden bg-[linear-gradient(180deg,#eaedf3_0%,#f3f5f9_58%,#ffffff_100%)]"
          style={{ aspectRatio: STAGE_ASPECT }}
        >
          <div
            aria-hidden
            className="absolute inset-0 opacity-45"
            style={{
              backgroundImage: "radial-gradient(rgba(15,23,42,0.4) 0.7px, transparent 1px)",
              backgroundSize: "6px 6px",
              WebkitMaskImage: "linear-gradient(to bottom, black 0%, black 50%, transparent 92%)",
              maskImage: "linear-gradient(to bottom, black 0%, black 50%, transparent 92%)",
            }}
          />
          <div className="absolute inset-0 overflow-hidden" style={{ WebkitMaskImage: STAGE_FADE, maskImage: STAGE_FADE }}>
            {children}
          </div>
        </div>

        <div className="mx-6 mt-1 h-px bg-slate-100" aria-hidden />

        <div className="flex flex-1 flex-col px-4 pb-8 pt-6 text-center">
          <StepBadge step={step} />
          <h3 className="mt-4 font-ui text-xl font-semibold tracking-tight text-heading">{title}</h3>
          <p className="mx-auto mt-2 max-w-[34ch] text-sm leading-relaxed text-subtle">{description}</p>
        </div>
      </div>
    </div>
  );
}

function StepOneCard() {
  return (
    <CardShell step={1} title="Find a Viral Niche" description="Start with a proven video that already has millions of views.">
      <NicheIllustration />
    </CardShell>
  );
}

function StepTwoCard() {
  return (
    <CardShell
      step={2}
      title="Extract the Formula"
      description="Our AI extracts the template, hook and pattern kept, topic stripped out."
    >
      <FormulaIllustration />
    </CardShell>
  );
}

function StepThreeCard() {
  return (
    <CardShell
      step={3}
      title="Bend & Dominate"
      description="Keep the psychology, swap the topic, and generate your non-competitive script."
    >
      <BendIllustration />
    </CardShell>
  );
}

export function VerlabProcess() {
  return (
    <section className="w-full pb-14 pt-16 sm:pb-24 sm:pt-16">
      <div className="mx-auto max-w-[96rem] px-5 sm:px-6">
        <div className="text-center">
          <VerifiedBadge label="How It Works" className="mb-5 sm:mb-6" />
          <h2 className="font-display text-[28px] font-bold leading-[1.15] tracking-[-0.015em] text-heading sm:text-3xl sm:leading-normal sm:tracking-tight md:text-5xl">
            Go Viral in 3 Simple Steps
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-[15px] font-normal leading-relaxed text-subtle sm:mt-4 sm:text-sm sm:leading-normal md:text-base">
            Discover viral ideas, extract what makes them work, and transform them into unique scripts tailored to your niche.
          </p>
        </div>

        <div className="mt-8 grid grid-cols-1 items-stretch gap-10 sm:mt-10 sm:gap-12 md:grid-cols-3 md:gap-10 lg:gap-16">
          <div className="h-full">
            <StepOneCard />
          </div>
          <div className="h-full">
            <StepTwoCard />
          </div>
          <div className="h-full">
            <StepThreeCard />
          </div>
        </div>

        <div className="mt-8 flex flex-col items-center text-center sm:mt-10">
          <a
            href={APP_URL}
            className={cn("inline-flex items-center justify-center gap-2 rounded-2xl px-11 py-3.5 text-lg font-bold text-white sm:px-14 sm:py-4", BUTTON_3D_MOTION)}
            style={button3d(4)}
          >
            Try Verlab Now
            <ArrowUpRight className="h-[18px] w-[18px]" strokeWidth={2.25} />
          </a>

          <div className="mt-5 flex items-center -space-x-3">
            {TRUST_AVATARS.map((src, i) => (
              <Image
                key={src}
                src={src}
                alt=""
                width={40}
                height={40}
                className="h-9 w-9 rounded-full object-cover ring-2 ring-white sm:h-10 sm:w-10"
                style={{ zIndex: TRUST_AVATARS.length - i }}
              />
            ))}
          </div>
          <p className="mt-3 text-sm font-medium text-subtle">Trusted by 50k+ Creators</p>
        </div>
      </div>
    </section>
  );
}
