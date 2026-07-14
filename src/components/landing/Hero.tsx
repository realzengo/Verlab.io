import { ArrowRight, Sparkles, Star, TrendingUp, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/Button";

const PLATFORM_CHIPS = ["TikTok", "Instagram Reels", "YouTube Shorts", "MCP for Claude & ChatGPT"];

export function Hero() {
  return (
    <section className="mx-auto flex max-w-6xl flex-col items-center px-4 pb-10 pt-[74px] text-center sm:px-6 lg:px-8">
      <div className="mb-6 inline-flex items-center gap-2.5">
        <span className="inline-flex gap-0.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star key={i} className="h-4 w-4 fill-star text-star" />
          ))}
        </span>
        <span className="text-[13px] font-medium text-subtle">Loved by faceless creators</span>
        <span className="ml-1 inline-flex">
          {["#c7d2fe,#a5b4fc", "#fbcfe8,#f9a8d4", "#bbf7d0,#86efac"].map((grad, i) => (
            <span
              key={i}
              className="-ml-1.5 h-[22px] w-[22px] rounded-full border-2 border-surface"
              style={{ background: `linear-gradient(135deg, ${grad.split(",")[0]}, ${grad.split(",")[1]})` }}
            />
          ))}
        </span>
      </div>

      <h1 className="max-w-4xl text-[44px] font-bold leading-[1.05] tracking-[-1.5px] text-heading sm:text-[56px] lg:text-[64px]">
        Bend any viral niche{" "}
        <span className="inline-block -rotate-[1.2deg] rounded-2xl bg-primary px-3.5 py-0.5 leading-[1.05] text-white shadow-blue">
          into your own
        </span>{" "}
        — and get the scripts to run it.
      </h1>

      <p className="mt-6 max-w-xl text-lg leading-relaxed text-body">
        Clypa finds the faceless niches blowing up on TikTok, reverse-engineers why they work, and
        bends them into a repeatable system for your channel.
      </p>

      <div className="mt-8 flex flex-col gap-3.5 sm:flex-row">
        <Button href="/app" size="lg" icon={Sparkles}>
          Get started free
        </Button>
        <Button href="#niche-bending" variant="secondary" size="lg" icon={ArrowRight} iconPosition="right">
          See how bending works
        </Button>
      </div>

      <p className="mt-3.5 text-[13px] text-subtle">Free plan · 5 transcripts a day · No card required</p>

      <div className="mt-7 flex flex-wrap items-center justify-center gap-2">
        {PLATFORM_CHIPS.map((chip) => (
          <span
            key={chip}
            className="inline-flex items-center gap-1.5 rounded-full border border-accent-line bg-accent px-3.5 py-1.5 text-[13px] font-semibold text-body"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            {chip}
          </span>
        ))}
      </div>

      <div className="mt-14 flex w-full max-w-3xl flex-col items-center gap-4 rounded-card-lg border border-hairline bg-surface p-6 shadow-card sm:flex-row sm:justify-center sm:gap-6">
        <div className="w-full max-w-[220px] rounded-card-sm border border-hairline bg-app p-4 text-left">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-subtle">Source niche</span>
          <p className="mt-1.5 text-sm font-semibold text-heading">Medical Malpractice</p>
          <span className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-success">
            <TrendingUp className="h-3.5 w-3.5" />
            94 momentum
          </span>
        </div>

        <div className="flex h-10 w-10 shrink-0 rotate-90 items-center justify-center rounded-full bg-primary text-white shadow-blue sm:rotate-0">
          <Wand2 className="h-4 w-4" />
        </div>

        <div className="w-full max-w-[220px] rounded-card-sm border border-accent-line bg-accent p-4 text-left">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-primary">Your niche</span>
          <p className="mt-1.5 text-sm font-semibold text-heading">Corporate Fraud</p>
          <span className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary">Same formula, new topic</span>
        </div>
      </div>
    </section>
  );
}
