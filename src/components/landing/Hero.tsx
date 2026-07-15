import { Star, Zap } from "lucide-react";
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

      <div className="relative">
        <div
          aria-hidden
          className="absolute left-1/2 top-1/2 -z-10 h-64 w-3/4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-500 opacity-30 blur-3xl"
        />

        <h1 className="relative z-10 max-w-4xl text-[28px] font-bold leading-[1.1] tracking-[-1px] text-heading sm:text-[60px] sm:leading-[1.05] sm:tracking-[-1.5px] lg:text-[76px]">
          Build a{" "}
          <span className="inline-block -rotate-[1.2deg] rounded-lg bg-primary px-3.5 py-0.5 leading-[1.05] text-white sm:rounded-2xl">
            Non-Competitive
          </span>
          <br />
          Faceless Page
        </h1>
      </div>

      <p className="mt-6 max-w-xl text-lg leading-relaxed text-body sm:hidden">
        Everything you need to grow and profit.
      </p>
      <p className="mt-6 hidden max-w-xl text-base leading-relaxed text-body sm:block">
        Everything you need to make money with social media, all in one place.
      </p>

      <div className="mt-8 flex justify-center">
        <Button href="/app" size="lg" icon={Zap} className="px-8 py-4 text-lg">
          Get started free
        </Button>
      </div>

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
    </section>
  );
}
