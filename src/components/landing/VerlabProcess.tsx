"use client";

import { type ReactNode } from "react";
import Image from "next/image";
import { CircleDot } from "lucide-react";

function SoundWave({ flip = false }: { flip?: boolean }) {
  const line = <span className="h-px flex-1 bg-hairline" />;
  const bars = (
    <span className="flex shrink-0 items-end gap-0.5">
      <span className="h-1.5 w-0.5 rounded-full bg-subtle/40" />
      <span className="h-2.5 w-0.5 rounded-full bg-subtle/40" />
      <span className="h-1.5 w-0.5 rounded-full bg-subtle/40" />
    </span>
  );
  return (
    <span aria-hidden className="flex flex-1 items-center gap-2">
      {flip ? (
        <>
          {bars}
          {line}
        </>
      ) : (
        <>
          {line}
          {bars}
        </>
      )}
    </span>
  );
}

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
    <div className="rounded-[1.75rem] bg-surface/40 p-2 shadow-[0_4px_16px_rgba(15,23,42,0.06),0_28px_56px_-16px_rgba(15,23,42,0.2)] backdrop-blur-md">
      <div className="relative flex h-[430px] flex-col overflow-hidden rounded-[1.4rem] bg-surface">
        <div className="relative z-10 flex min-h-0 flex-1 items-center justify-center overflow-hidden px-8 pb-2 pt-6">
          {children}
        </div>

        <div className="relative z-10 flex items-center gap-3 px-8 pb-4">
          <SoundWave />
          <span className="shrink-0 rounded-full bg-primary px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-white shadow-blue">
            Step {step}
          </span>
          <SoundWave flip />
        </div>

        <div className="relative z-10 px-6 pb-6">
          <h3 className="font-ui text-center text-xl font-semibold tracking-tight text-heading">{title}</h3>
          <p className="mt-2 text-center text-sm text-subtle">{description}</p>
        </div>
      </div>
    </div>
  );
}

function HookMockup() {
  return (
    <div className="relative -mx-8 flex h-[260px] w-[calc(100%+4rem)] items-center justify-center" aria-hidden>
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
    <div className="relative -mx-8 flex h-[260px] w-[calc(100%+4rem)] items-center justify-center" aria-hidden>
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
    <div className="relative -mx-8 flex h-[300px] w-[calc(100%+4rem)] items-center justify-center" aria-hidden>
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
      <div className="mx-auto max-w-7xl px-5 sm:px-6">
        <div className="text-center">
          <span
            className="relative mb-5 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium text-slate-100 [text-shadow:0_1px_1px_rgba(0,0,0,0.5)] sm:mb-8"
            style={{
              backgroundImage:
                "linear-gradient(160deg, #e2e8f0 0%, #94a3b8 10%, #334155 32%, #0b1220 52%, #1e293b 70%, #64748b 88%, #cbd5e1 100%)",
              boxShadow:
                "inset 0 1px 1px rgba(255,255,255,0.7), inset 0 -1px 2px rgba(0,0,0,0.8), inset 0 0 0 1px rgba(255,255,255,0.08), 0 10px 24px -6px rgba(15,23,42,0.55), 0 2px 4px rgba(15,23,42,0.4)",
            }}
          >
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-5 top-px h-px rounded-full bg-gradient-to-r from-transparent via-white/80 to-transparent"
            />
            <CircleDot className="h-3.5 w-3.5 text-slate-300" />
            How it Works
            <CircleDot className="h-3.5 w-3.5 text-slate-300" />
          </span>
          <h2 className="font-display text-2xl font-bold tracking-tight text-heading sm:text-3xl md:text-5xl">
            Go Viral in 3 Simple Steps
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm font-normal text-subtle sm:mt-4 md:text-base">
            Discover viral ideas, extract what makes them work, and transform them into unique scripts tailored to your niche.
          </p>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-10 sm:mt-10 sm:gap-12 md:grid-cols-3 md:gap-8 lg:gap-12">
          <StepOneCard />
          <StepTwoCard />
          <StepThreeCard />
        </div>
      </div>
    </section>
  );
}
