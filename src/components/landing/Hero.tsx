import { Zap } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { TrustBadge } from "@/components/landing/TrustBadge";
import { InstagramIcon, TikTokIcon, YouTubeIcon } from "@/components/landing/PlatformIcons";

const PLATFORM_CHIPS = [
  { label: "TikTok", icon: TikTokIcon },
  { label: "Instagram Reels", icon: InstagramIcon },
  { label: "YouTube Shorts", icon: YouTubeIcon },
];

export function Hero() {
  return (
    <section className="relative isolate mx-auto flex max-w-6xl flex-col items-center px-4 pb-10 pt-28 text-center sm:px-6 lg:px-8 md:pt-40">
      <TrustBadge />

      <div className="relative flex w-full justify-center">
        <div
          aria-hidden
          className="pointer-events-none absolute left-0 top-1/2 -z-10 h-64 w-1/2 -translate-x-1/4 -translate-y-1/2 rounded-full bg-blue-100/40 opacity-30 blur-3xl md:h-80 md:w-80"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute right-0 top-1/2 -z-10 h-64 w-1/2 translate-x-1/4 -translate-y-1/2 rounded-full bg-blue-100/40 opacity-30 blur-3xl md:h-80 md:w-80"
        />

        <h1 className="relative max-w-5xl text-[28px] font-bold leading-[1.1] tracking-[-1px] text-heading sm:text-[60px] sm:leading-[1.05] sm:tracking-[-1.5px] lg:text-[68px]">
          <span className="whitespace-nowrap">
            Build a{" "}
            <span className="inline-block -rotate-[1.2deg] rounded-lg bg-primary px-3.5 py-0.5 leading-[1.05] text-white sm:rounded-2xl">
              Non-Competitive
            </span>
          </span>
          <br />
          Faceless Page
        </h1>
      </div>

      <p className="mt-6 max-w-xl text-sm leading-relaxed text-body sm:hidden">
        Everything you need to grow and profit.
      </p>
      <p className="mt-6 hidden max-w-xl text-base leading-relaxed text-body sm:block">
        Everything you need to make money with social media, all in one place.
      </p>

      <div className="mt-8 flex justify-center">
        <Button href="/app" size="lg" icon={Zap} bevel={false} className="px-6 py-3.5 text-base font-bold! shadow-none sm:px-8 sm:py-4 sm:text-lg">
          Try Verlab Now
        </Button>
      </div>

      <div className="mt-7 flex w-full -mx-4 snap-x snap-mandatory gap-1.5 overflow-x-auto px-4 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] sm:mx-0 sm:w-auto sm:flex-wrap sm:items-center sm:justify-center sm:gap-2 sm:overflow-visible sm:px-0 sm:pb-0 [&::-webkit-scrollbar]:hidden">
        {PLATFORM_CHIPS.map(({ label, icon: Icon }) => (
          <span
            key={label}
            className="inline-flex shrink-0 snap-start items-center gap-1 rounded-full border border-hairline bg-surface px-2 py-1 text-[10px] font-semibold text-heading shadow-card first:ml-auto last:mr-auto sm:gap-1.5 sm:px-3 sm:py-1.5 sm:text-xs sm:first:ml-0 sm:last:mr-0"
          >
            <Icon className="h-3 w-3 shrink-0 text-subtle sm:h-3.5 sm:w-3.5" />
            {label}
          </span>
        ))}
      </div>
    </section>
  );
}
