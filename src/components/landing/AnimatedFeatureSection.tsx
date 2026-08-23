"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, type ReactNode } from "react";
import { useAnimationGate } from "@/lib/hooks/useAnimationGate";
import { ArrowDown, ArrowRight, BadgeCheck, Check, Images, Play, Sparkles, Wand2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { APP_URL } from "@/lib/constants";

function GlassCard({
  position,
  scale,
  tilt,
  className,
  children,
}: {
  position: string;
  scale: string;
  tilt: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("absolute", position, scale)}>
      <div className={tilt}>
        <div
          className={cn(
            "relative overflow-hidden rounded-2xl border border-white/15 bg-slate-900/80 p-4",
            className
          )}
          style={{
            boxShadow:
              "inset 0 1px 1px rgba(255,255,255,0.55), inset 1px 0 0 rgba(255,255,255,0.14), inset -1px 0 0 rgba(255,255,255,0.08), inset 0 -1px 1px rgba(0,0,0,0.25), 0 25px 65px -20px rgba(0,0,0,0.5)",
          }}
        >
          {children}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br from-white/20 via-white/0 to-transparent"
          />
        </div>
      </div>
    </div>
  );
}

function ViewsBadge({ children }: { children: ReactNode }) {
  return (
    <span className="absolute bottom-1 left-1 rounded-full border border-white/20 bg-black/70 px-1.5 py-0.5 text-[7px] font-semibold leading-none text-white shadow-sm">
      {children} views
    </span>
  );
}

function StatusPill({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <span
      className="relative inline-flex items-center gap-1.5 overflow-hidden whitespace-nowrap rounded-full border border-white/20 bg-slate-900/80 px-3 py-1.5 text-xs font-semibold text-white"
      style={{
        boxShadow:
          "inset 0 1px 1px rgba(255,255,255,0.55), inset 1px 0 0 rgba(255,255,255,0.14), inset -1px 0 0 rgba(255,255,255,0.08), inset 0 -1px 1px rgba(0,0,0,0.3), 0 10px 30px -10px rgba(0,0,0,0.55)",
      }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/25 via-white/0 to-transparent"
      />
      <span className="relative z-10 inline-flex items-center gap-1.5">
        {icon}
        {children}
      </span>
    </span>
  );
}

function ChannelPreview({
  avatarSrc,
  name,
  subs,
  verified,
  thumbs,
}: {
  avatarSrc: string;
  name: string;
  subs: string;
  verified?: boolean;
  thumbs: [string, string];
}) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-white/[0.12] bg-white/10 p-1.5 shadow-[0_10px_30px_-8px_rgba(0,0,0,0.55)]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/[0.08] via-transparent to-transparent"
      />
      <div className="relative flex items-center gap-1.5">
        <Image
          src={avatarSrc}
          alt=""
          width={20}
          height={20}
          className="h-5 w-5 shrink-0 rounded-full object-cover ring-1 ring-white/20"
        />
        <div className="min-w-0">
          <div className="flex items-center gap-0.5">
            <p className="truncate text-[10px] font-bold leading-tight text-white">{name}</p>
            {verified && <BadgeCheck className="h-2.5 w-2.5 shrink-0 fill-[#1d9bf0] text-white" />}
          </div>
          <p className="truncate text-[7px] leading-tight text-white/45">{subs}</p>
        </div>
      </div>
      <div className="relative mt-1.5 grid grid-cols-2 gap-1">
        {thumbs.map((src) => (
          <div
            key={src}
            className="relative aspect-video overflow-hidden rounded-md border border-white/10 bg-slate-900/40"
          >
            <Image src={src} alt="" fill sizes="120px" className="object-cover" />
          </div>
        ))}
      </div>
    </div>
  );
}

function NicheBendCard() {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-sm font-semibold text-white">
        <Wand2 className="h-4 w-4" />
        Niche Bending
      </div>

      <p className="mt-3 text-[9px] font-bold uppercase tracking-wider text-white/50">Niche:</p>
      <div className="mt-1">
        <ChannelPreview
          avatarSrc="/niche-avatar.png"
          name="Primate Economics"
          subs="485K subscribers"
          verified
          thumbs={["/niche-thumb-1.png", "/niche-thumb-2.png"]}
        />
      </div>

      <div className="my-1.5 flex justify-center">
        <span className="grid h-5 w-5 place-items-center rounded-full bg-blue-500 text-white shadow-[0_0_0_4px_rgba(59,130,246,0.25)]">
          <ArrowDown className="h-3 w-3" />
        </span>
      </div>

      <p className="text-[9px] font-bold uppercase tracking-wider text-white/50">Bend:</p>
      <div className="mt-1">
        <ChannelPreview
          avatarSrc="/bend-avatar.png"
          name="Apesthetic"
          subs="169K subscribers"
          thumbs={["/bend-thumb-1.png", "/bend-thumb-2.png"]}
        />
      </div>
    </div>
  );
}

export function AnimatedFeatureSection() {
  const { ref, inView } = useAnimationGate<HTMLDivElement>();

  return (
    <section className="mt-10 mb-2 md:mt-16">
      <div
        ref={ref}
        data-inview={inView}
        className="anim-gate relative isolate mx-auto h-[360px] w-[calc(100%-2rem)] overflow-hidden rounded-lg bg-[#6aa7dc] sm:h-[487px] sm:rounded-xl"
      >
        {/* Background — z-0: deep-space gradient + an animated starfield texture on top of it */}
        <div
          aria-hidden
          className="absolute inset-0 z-0 bg-gradient-to-b from-[#0b1a3a] via-[#0a1230] to-[#050916]"
        />
        <Image
          src="/starfield.jpg"
          alt=""
          fill
          aria-hidden
          sizes="100vw"
          className="z-0 animate-sky-zoom object-cover opacity-70 saturate-[1.4] pointer-events-none"
        />
        {/* 4-wall perspective tunnel — z-10, floor/ceiling/left/right converge on a
            center vanishing point with a soft glow */}
        <div aria-hidden className="tunnel z-10">
          <div className="plane plane-floor" />
          <div className="plane plane-ceiling" />
          <div className="plane plane-left" />
          <div className="plane plane-right" />
        </div>
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-1/2 z-10 h-[240px] w-[440px] -translate-x-1/2 -translate-y-1/2 rounded-full sm:h-[320px] sm:w-[600px]"
          style={{ background: "radial-gradient(circle at 50% 50%, rgba(8,15,40,.85) 0%, rgba(8,15,40,.4) 20%, transparent 38%)" }}
        />

        {/* Title block — z-20. Badge, heading, copy, and CTA share one flex flow so they
            can never overlap, no matter how the heading wraps at a given width. */}
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 px-6 text-center sm:gap-4 sm:px-8">
          <div
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-1/2 -z-10 h-[210px] w-[400px] -translate-x-1/2 -translate-y-1/2 rounded-[100%] bg-[#0a0f24]/90 blur-[80px] sm:h-[400px] sm:w-[860px] sm:blur-[120px]"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-1/2 -z-10 h-[105px] w-[210px] -translate-x-1/2 -translate-y-1/2 rounded-[100%] bg-blue-950 blur-[40px] sm:h-[200px] sm:w-[440px] sm:blur-[60px]"
          />

          <h2 className="whitespace-nowrap font-display text-2xl font-bold tracking-tight text-transparent bg-gradient-to-b from-white to-blue-100 bg-clip-text pb-1 sm:text-7xl">
            Clone What Works
          </h2>
          <p className="max-w-xl text-xs font-bold text-blue-100/80 sm:hidden">
            Reverse-engineer and clone winning video niches.
          </p>
          <p className="hidden max-w-xl text-sm font-bold text-blue-100/80 sm:block">
            The all-in-one studio for reverse-engineering and cloning winning video niches.
          </p>
          <Link
            href={APP_URL}
            className="mt-1 inline-flex items-center gap-2 rounded-full border border-white/25 bg-white py-2 pl-6 pr-2 text-sm font-semibold text-slate-900 shadow-[0_0_0_1px_rgba(255,255,255,0.05),0_8px_24px_rgba(0,0,0,0.5)] sm:mt-2 sm:gap-3 sm:pl-7 sm:text-base"
          >
            Try Verlab Studio
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-blue-500 text-white sm:h-9 sm:w-9">
              <ArrowRight className="h-4 w-4" />
            </span>
          </Link>
        </div>

        {/* Floating solid cards — z-30, frontmost so shadows fall on the grid.
            Phones show just two cards, flat-rotated and tucked corner-to-corner
            like scattered photos (matching the reference layout); tablet/desktop
            keep the original 3D-tilted three-card spread from sm/xl onward. */}
        <div aria-hidden className="pointer-events-none absolute inset-0 z-30">
          <GlassCard
            position="top-[-6%] left-[-4%] sm:top-[0%] sm:left-[1%] md:top-[9%] md:left-[0%] xl:top-[16%] xl:left-[6%] 2xl:left-[13%]"
            scale="origin-top-left scale-[0.26] sm:scale-[0.46] md:scale-[0.56] xl:scale-100"
            tilt="[transform:rotate(-8deg)] sm:[transform:perspective(1000px)_rotateY(10deg)_rotateX(4deg)]"
            className="w-[270px]"
          >
            <NicheBendCard />
          </GlassCard>

          <GlassCard
            position="hidden sm:block sm:top-[-3%] sm:right-[1%] md:top-[5%] md:right-[0%] xl:top-[10%] xl:right-[6%] 2xl:right-[13%]"
            scale="origin-top-right sm:scale-[0.46] md:scale-[0.56] xl:scale-100"
            tilt="[transform:perspective(1000px)_rotateY(-10deg)_rotateX(4deg)]"
            className="w-[270px]"
          >
            <div className="flex items-center gap-2">
              <Image
                src="/zex2d-avatar.jpeg"
                alt=""
                width={36}
                height={36}
                className="h-9 w-9 shrink-0 rounded-full object-cover"
              />
              <div className="min-w-0 text-left">
                <div className="flex items-center gap-1 text-xs font-semibold text-white">
                  <span className="truncate">zex2d</span>
                  <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-[#1d9bf0]">
                    <Check className="h-2.5 w-2.5 text-white" strokeWidth={3.5} />
                  </span>
                </div>
                <p className="text-[10px] text-white/70">30M views &middot; 070 videos</p>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-1.5">
              <div className="relative aspect-[3/4] overflow-hidden rounded-lg bg-slate-600">
                <Image src="/zex2d-video-1.png" alt="" fill sizes="90px" className="object-cover" />
                <Play className="absolute inset-0 m-auto h-4 w-4 fill-white text-white drop-shadow" />
                <ViewsBadge>1M</ViewsBadge>
              </div>
              <div className="relative aspect-[3/4] overflow-hidden rounded-lg bg-slate-600">
                <Image src="/zex2d-video-2.png" alt="" fill sizes="90px" className="object-cover" />
                <Play className="absolute inset-0 m-auto h-4 w-4 fill-white text-white drop-shadow" />
                <ViewsBadge>1.3M</ViewsBadge>
              </div>
              <div className="relative aspect-[3/4] overflow-hidden rounded-lg bg-slate-600">
                <Image src="/zex2d-video-3.png" alt="" fill sizes="90px" className="object-cover" />
                <Play className="absolute inset-0 m-auto h-4 w-4 fill-white text-white drop-shadow" />
                <ViewsBadge>2M</ViewsBadge>
              </div>
            </div>
            <div className="mt-3">
              <StatusPill icon={<Sparkles className="h-3 w-3 text-blue-400" />}>Scripts that get views&hellip;</StatusPill>
            </div>
          </GlassCard>

          <GlassCard
            position="bottom-[-6%] right-[-4%] sm:bottom-[-4%] sm:right-[1%] md:bottom-[-4%] md:right-[3%] xl:bottom-[-5%] xl:right-[11%] 2xl:right-[17%]"
            scale="origin-bottom-right scale-[0.3] sm:scale-[0.5] md:scale-[0.56] xl:scale-100"
            tilt="[transform:rotate(7deg)] sm:[transform:perspective(1000px)_rotateY(-6deg)_rotateX(4deg)]"
            className="w-[270px]"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-sm font-semibold text-white">
                <Images className="h-4 w-4" />
                Text to Image
              </div>
              <span className="rounded-md bg-white/25 px-2 py-0.5 text-[11px] font-medium text-white">Ready</span>
            </div>
            <p className="mt-3 truncate rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-[10px] text-white/60">
              &ldquo;a tabby cat in warm afternoon light&rdquo;
            </p>
            <div className="mt-2 grid grid-cols-4 gap-1">
              {["text2img-thumb-1.png", "text2img-thumb-2.png", "text2img-thumb-3.png", "text2img-thumb-4.png"].map(
                (src) => (
                  <div key={src} className="relative aspect-square overflow-hidden rounded-md bg-slate-600">
                    <Image src={`/${src}`} alt="" fill sizes="60px" className="object-cover" />
                  </div>
                )
              )}
            </div>
          </GlassCard>
        </div>
      </div>
    </section>
  );
}
