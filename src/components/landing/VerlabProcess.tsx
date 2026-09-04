"use client";

import { type ReactNode } from "react";
import Image from "next/image";
import { Reveal } from "@/components/ui/Reveal";
import { APP_URL } from "@/lib/constants";

const TRUST_AVATARS = [
  "/reviewers/reviewer-01.jpeg",
  "/reviewers/reviewer-04.jpeg",
  "/reviewers/reviewer-03.jpeg",
  "/reviewers/reviewer-06.jpeg",
  "/reviewers/reviewer-08.jpeg",
];

const PANEL_HEIGHT = 340;

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

/** Full-bleed tinted panel (flush to the card's top corners, no inset
 * border) that fades to white toward the bottom, holding a fixed-height
 * mockup slot so every card in the row matches height regardless of its
 * illustration's native size. */
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
          className="relative shrink-0 overflow-hidden bg-gradient-to-b from-[#4f7cf7] via-[#a6c2ff] to-white"
          style={{ height: PANEL_HEIGHT }}
        >
          <div
            aria-hidden
            className="absolute inset-0 opacity-50"
            style={{
              backgroundImage: "radial-gradient(rgba(15,23,42,0.45) 0.7px, transparent 1px)",
              backgroundSize: "6px 6px",
              WebkitMaskImage: "linear-gradient(to bottom, black 0%, black 55%, transparent 92%)",
              maskImage: "linear-gradient(to bottom, black 0%, black 55%, transparent 92%)",
            }}
          />

          <div
            className="relative z-10 flex h-full flex-col items-center justify-center overflow-hidden px-8"
            style={{
              WebkitMaskImage:
                "linear-gradient(to bottom, black 0%, black 45%, rgba(0,0,0,0.92) 55%, rgba(0,0,0,0.78) 65%, rgba(0,0,0,0.55) 75%, rgba(0,0,0,0.28) 87%, transparent 100%)",
              maskImage:
                "linear-gradient(to bottom, black 0%, black 45%, rgba(0,0,0,0.92) 55%, rgba(0,0,0,0.78) 65%, rgba(0,0,0,0.55) 75%, rgba(0,0,0,0.28) 87%, transparent 100%)",
            }}
          >
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

function HookMockup() {
  return (
    <div className="relative -mx-8 h-full w-[calc(100%+4rem)] scale-90" aria-hidden>
      <Image src="/hook-card-1.webp" alt="" fill sizes="480px" quality={90} className="object-contain" />
    </div>
  );
}

function FormulaMockup() {
  return (
    <div className="relative -mx-8 h-full w-[calc(100%+4rem)] scale-90" aria-hidden>
      <Image src="/formula-mockup.png" alt="" fill sizes="480px" quality={90} className="object-contain" />
    </div>
  );
}

function BendMockup() {
  return (
    <div className="relative -mx-8 h-full w-[calc(100%+4rem)]" aria-hidden>
      <Image src="/bend-mockup.png" alt="" fill sizes="520px" quality={90} className="object-contain" />
    </div>
  );
}

function StepOneCard() {
  return (
    <CardShell step={1} title="Find a Viral Niche" description="Start with a proven video that already has millions of views.">
      <HookMockup />
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
      <FormulaMockup />
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
      <BendMockup />
    </CardShell>
  );
}

export function VerlabProcess() {
  return (
    <section className="w-full pb-14 pt-44 sm:pb-24 sm:pt-16">
      <div className="mx-auto max-w-[96rem] px-5 sm:px-6">
        <Reveal className="text-center" instantOnMobile>
          <h2 className="font-display text-[28px] font-bold leading-[1.15] tracking-[-0.015em] text-heading sm:text-3xl sm:leading-normal sm:tracking-tight md:text-5xl">
            Go Viral in 3 Simple Steps
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-[15px] font-normal leading-relaxed text-subtle sm:mt-4 sm:text-sm sm:leading-normal md:text-base">
            Discover viral ideas, extract what makes them work, and transform them into unique scripts tailored to your niche.
          </p>
        </Reveal>

        <div className="mt-8 grid grid-cols-1 items-stretch gap-10 sm:mt-10 sm:gap-12 md:grid-cols-3 md:gap-10 lg:gap-16">
          <Reveal className="h-full" delay={0}>
            <StepOneCard />
          </Reveal>
          <Reveal className="h-full" delay={120}>
            <StepTwoCard />
          </Reveal>
          <Reveal className="h-full" delay={240}>
            <StepThreeCard />
          </Reveal>
        </div>

        <Reveal className="mt-8 flex flex-col items-center text-center sm:mt-10" delay={360}>
          <a
            href={APP_URL}
            className="group relative isolate inline-flex items-center justify-center overflow-hidden rounded-2xl bg-[radial-gradient(220%_220%_at_28%_18%,#6d9bff_0%,#335cff_65%,#1c3fd6_100%)] px-11 py-3.5 text-lg font-bold text-white shadow-[0_4px_0_0_#1a37c4,0_10px_24px_-8px_rgba(28,63,214,0.5),inset_0_1px_0_0_rgba(255,255,255,0.5),inset_0_-1px_0_0_rgba(0,0,0,0.25)] transition-[transform,box-shadow] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] hover:shadow-[0_4px_0_0_#1a37c4,0_12px_28px_-8px_rgba(28,63,214,0.55),inset_0_1px_0_0_rgba(255,255,255,0.6),inset_0_-1px_0_0_rgba(0,0,0,0.3)] active:translate-y-1 active:shadow-[0_0_0_0_#1a37c4,0_4px_10px_-6px_rgba(28,63,214,0.5),inset_0_1px_0_0_rgba(255,255,255,0.5),inset_0_-1px_0_0_rgba(0,0,0,0.25)] active:duration-100 sm:px-14 sm:py-4"
          >
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(140%_140%_at_50%_50%,#6d9bff_0%,#335cff_65%,#1c3fd6_100%)] opacity-0 transition-opacity duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:opacity-100"
            />
            <span className="relative">Try Verlab Now</span>
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
        </Reveal>
      </div>
    </section>
  );
}
