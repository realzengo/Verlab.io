"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ShieldCheck, Star } from "lucide-react";
import type { ReactNode } from "react";

const TESTIMONIAL = {
  quote:
    "Niche Bending and the MCP alone replaced three tools we were paying for across the team.",
  name: "Jonathan K.",
  role: "Clipping agency",
  image: "/reviewers/reviewer-02.jpeg",
};

export function AuthShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen w-full bg-app">
      {/* Brand panel — desktop only */}
      <div className="relative hidden w-[42%] shrink-0 overflow-hidden bg-[#0a0b10] lg:flex lg:flex-col lg:justify-center lg:px-12 lg:py-16 xl:px-16">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.12] [mask-image:radial-gradient(ellipse_70%_60%_at_30%_20%,black,transparent)]"
          style={{
            backgroundImage:
              "radial-gradient(circle, rgba(255,255,255,0.9) 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute left-0 top-0 h-[26rem] w-[26rem] -translate-x-1/3 -translate-y-1/3 rounded-full bg-primary/25 opacity-70 blur-3xl animate-blob-a"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute bottom-0 right-0 h-72 w-72 translate-x-1/4 translate-y-1/4 rounded-full bg-blue-500/20 opacity-60 blur-3xl animate-blob-b"
        />

        <Link
          href="/"
          className="absolute left-12 top-12 z-10 block h-8 w-[130px] xl:left-16 xl:top-14"
        >
          <Image
            src="/logo-full-dark.png"
            alt="Verlab Studio"
            fill
            className="object-contain object-left"
            sizes="130px"
          />
        </Link>

        <div className="relative z-10 flex flex-col gap-14">
          <div className="max-w-md">
            <h2 className="text-[34px] font-bold leading-[1.15] tracking-[-0.5px] text-white">
              Build a <span className="text-[#7d9dff]">non-competitive</span>{" "}
              faceless page.
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-white/55">
              Real transcripts and proven formats turned into a repeatable SOP
              for every niche — not just metadata guesses.
            </p>
          </div>

          <div className="flex flex-col gap-6">
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.6)] backdrop-blur-xl">
              <div className="flex gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400"
                  />
                ))}
              </div>
              <p className="mt-3 text-sm leading-relaxed text-white/80">
                &ldquo;{TESTIMONIAL.quote}&rdquo;
              </p>
              <div className="mt-4 flex items-center gap-3">
                <span className="relative block h-9 w-9 shrink-0 overflow-hidden rounded-full border border-white/15">
                  <Image
                    src={TESTIMONIAL.image}
                    alt={TESTIMONIAL.name}
                    fill
                    className="object-cover object-top"
                    sizes="36px"
                  />
                </span>
                <div className="leading-tight">
                  <p className="text-sm font-semibold text-white">
                    {TESTIMONIAL.name}
                  </p>
                  <p className="text-xs text-white/45">{TESTIMONIAL.role}</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-white/40">
              <ShieldCheck className="h-3.5 w-3.5" />
              Trusted by 100k+ creators worldwide
            </div>
          </div>
        </div>
      </div>

      {/* Form panel */}
      <div className="relative flex flex-1 flex-col items-center justify-center overflow-hidden px-4 py-16 sm:px-8">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 opacity-[0.5] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,black,transparent)] dark:opacity-[0.14] lg:hidden"
          style={{
            backgroundImage:
              "radial-gradient(circle, var(--color-hairline) 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-0 -z-10 h-[26rem] w-[26rem] -translate-x-1/2 -translate-y-1/3 rounded-full bg-primary/10 opacity-70 blur-3xl animate-blob-a dark:opacity-25 lg:hidden"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute bottom-0 right-1/4 -z-10 h-64 w-64 translate-y-1/3 rounded-full bg-blue-400/10 opacity-60 blur-3xl animate-blob-b dark:opacity-20 lg:hidden"
        />

        <Link
          href="/"
          className="absolute left-6 top-6 inline-flex items-center gap-1.5 rounded-full border border-hairline bg-surface px-3 py-1.5 text-xs font-medium text-body shadow-card transition-colors hover:text-heading sm:left-8 sm:top-8"
        >
          <ArrowLeft className="h-3 w-3" />
          Back to site
        </Link>

        <div className="w-full max-w-sm rounded-3xl border border-hairline bg-surface p-8 shadow-card sm:p-10 lg:rounded-none lg:border-none lg:bg-transparent lg:p-0 lg:shadow-none">
          <div className="mb-8 flex justify-center lg:hidden">
            <span className="relative block h-9 w-[145px]">
              <Image
                src="/logo-full-light.png"
                alt="Verlab Studio"
                fill
                className="object-contain dark:hidden"
                sizes="145px"
              />
              <Image
                src="/logo-full-dark.png"
                alt="Verlab Studio"
                fill
                className="hidden object-contain dark:block"
                sizes="145px"
              />
            </span>
          </div>

          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            >
              {children}
            </motion.div>
          </AnimatePresence>

          <div className="mt-8 flex items-center justify-center gap-2 text-[11px] font-medium uppercase tracking-wide text-subtle lg:hidden">
            <ShieldCheck className="h-3.5 w-3.5" />
            Trusted by 100k+ creators worldwide
          </div>
        </div>
      </div>
    </div>
  );
}
