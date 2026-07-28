import { Button } from "@/components/ui/Button";
import { TrustBadge } from "@/components/landing/TrustBadge";
import { StarIcon } from "@/components/landing/StarIcon";

export function Hero() {
  return (
    <section className="relative isolate mx-auto flex max-w-6xl flex-col items-center px-4 pb-8 pt-24 text-center sm:px-6 sm:pb-10 sm:pt-28 lg:px-8 md:pt-40">
      <TrustBadge />

      <div className="relative flex w-full justify-center">
        <div
          aria-hidden
          className="animate-blob-a pointer-events-none absolute left-0 top-1/2 -z-10 h-64 w-1/2 rounded-full bg-blue-100/40 opacity-30 blur-3xl md:h-80 md:w-80"
        />
        <div
          aria-hidden
          className="animate-blob-b pointer-events-none absolute right-0 top-1/2 -z-10 h-64 w-1/2 rounded-full bg-blue-100/40 opacity-30 blur-3xl md:h-80 md:w-80"
        />

        <h1 className="relative max-w-6xl text-[26px] font-bold leading-[1.15] tracking-[-0.5px] text-heading sm:text-[72px] sm:leading-[1.05] sm:tracking-[-2px] lg:text-[84px]">
          <span className="whitespace-nowrap">
            Build a{" "}
            <span className="inline-block -rotate-[1.2deg] rounded-lg bg-primary px-2.5 py-0.5 leading-[1.05] text-white sm:rounded-2xl sm:px-4 sm:py-1">
              Non-Competitive
            </span>
          </span>
          <br />
          Faceless Page
        </h1>
      </div>

      <p className="mt-5 max-w-xl text-sm leading-relaxed text-body sm:hidden">
        Everything you need to grow and profit.
      </p>
      <p className="mt-7 hidden max-w-2xl text-lg font-bold leading-relaxed text-gray-400 sm:block">
        Everything you need to make money with social media, all in one place.
      </p>

      <div className="mt-7 flex justify-center sm:mt-10">
        <Button href="/app" size="lg" icon={StarIcon} bevel={false} className="px-6 py-3.5 text-base font-bold! shadow-none sm:px-10 sm:py-5 sm:text-xl">
          Try Verlab Now
        </Button>
      </div>
    </section>
  );
}
