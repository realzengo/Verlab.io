"use client";

import { type ReactNode } from "react";
import Image from "next/image";
import { Reveal } from "@/components/ui/Reveal";

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
    <div className="rounded-[20px] bg-gradient-to-b from-[#bfdcff] via-[#dceafe] to-white/60 p-[2px] shadow-[0_0_50px_-12px_rgba(96,165,250,0.55)]">
      <div className="rounded-[18px] border border-black/[0.06] bg-white p-3 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_20px_45px_-28px_rgba(15,23,42,0.18)]">
        <div className="relative h-[340px] overflow-hidden rounded-xl bg-white">
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              backgroundImage: "radial-gradient(circle at 1px 1px, rgba(15,23,42,0.10) 1px, transparent 0)",
              backgroundSize: "16px 16px",
              WebkitMaskImage: "radial-gradient(120% 90% at 15% 15%, black 30%, transparent 75%)",
              maskImage: "radial-gradient(120% 90% at 15% 15%, black 30%, transparent 75%)",
            }}
          />
          <div aria-hidden className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-[#bfe0ff] opacity-60 blur-[70px]" />

          <div className="relative z-10 flex h-full flex-col items-center justify-center overflow-hidden px-8">
            {children}
          </div>
        </div>

        <div className="px-3 pb-2 pt-6">
          <span className="text-xs font-semibold uppercase tracking-wider text-primary">Step {step}</span>
          <h3 className="mt-1.5 font-ui text-xl font-semibold tracking-tight text-heading">{title}</h3>
          <p className="mt-2 text-sm leading-relaxed text-subtle">{description}</p>
        </div>
      </div>
    </div>
  );
}

function HookMockup() {
  return (
    <div className="relative -mx-8 flex h-[310px] w-[calc(100%+4rem)] items-center justify-center" aria-hidden>
      <div
        className="relative h-full w-full"
        style={{
          WebkitMaskImage: "linear-gradient(to bottom, black 65%, transparent 100%)",
          maskImage: "linear-gradient(to bottom, black 65%, transparent 100%)",
        }}
      >
        <Image src="/hook-card-1.webp" alt="" fill sizes="480px" quality={90} className="object-contain" />
      </div>
    </div>
  );
}

function FormulaMockup() {
  return (
    <div className="relative -mx-8 flex h-[310px] w-[calc(100%+4rem)] items-center justify-center" aria-hidden>
      <div
        className="relative h-full w-full"
        style={{
          WebkitMaskImage: "linear-gradient(to bottom, black 65%, transparent 100%)",
          maskImage: "linear-gradient(to bottom, black 65%, transparent 100%)",
        }}
      >
        <Image src="/formula-mockup.png" alt="" fill sizes="480px" quality={90} className="object-contain" />
      </div>
    </div>
  );
}

function BendMockup() {
  return (
    <div className="relative -mx-8 flex h-[350px] w-[calc(100%+4rem)] items-center justify-center" aria-hidden>
      <div
        className="relative -mt-6 h-full w-full"
        style={{
          WebkitMaskImage: "linear-gradient(to bottom, black 65%, transparent 100%)",
          maskImage: "linear-gradient(to bottom, black 65%, transparent 100%)",
        }}
      >
        <Image src="/bend-mockup.png" alt="" fill sizes="520px" quality={90} className="object-contain" />
      </div>
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
      description="Our AI extracts the template — hook and pattern kept, topic stripped out."
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
    <section className="w-full pb-14 pt-10 sm:pb-24 sm:pt-16">
      <div className="mx-auto max-w-[88rem] px-5 sm:px-6">
        <Reveal className="text-center">
          <h2 className="font-display text-2xl font-bold tracking-tight text-heading sm:text-3xl md:text-5xl">
            Go Viral in 3 Simple Steps
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm font-normal text-subtle sm:mt-4 md:text-base">
            Discover viral ideas, extract what makes them work, and transform them into unique scripts tailored to your niche.
          </p>
        </Reveal>

        <div className="mt-8 grid grid-cols-1 gap-10 sm:mt-10 sm:gap-12 md:grid-cols-3 md:gap-8 lg:gap-12">
          <Reveal delay={0}>
            <StepOneCard />
          </Reveal>
          <Reveal delay={120}>
            <StepTwoCard />
          </Reveal>
          <Reveal delay={240}>
            <StepThreeCard />
          </Reveal>
        </div>
      </div>
    </section>
  );
}
