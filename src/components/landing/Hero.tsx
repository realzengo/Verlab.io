import Image from "next/image";
import { Button } from "@/components/ui/Button";
import { TrustBadge } from "@/components/landing/TrustBadge";
import { StarIcon } from "@/components/landing/StarIcon";

export function Hero() {
  return (
    <section className="relative isolate mx-auto flex max-w-6xl flex-col items-center px-4 pb-6 pt-20 text-center sm:px-6 sm:pb-10 sm:pt-28 lg:px-8 md:pt-40">
      <TrustBadge />

      <div className="relative flex w-full justify-center">
        <h1 className="relative max-w-6xl text-[clamp(24px,7.8vw,29px)] font-bold leading-[1.1] tracking-[-0.5px] text-heading sm:text-[72px] sm:leading-[1.05] sm:tracking-[-2px] lg:text-[84px]">
          <span className="whitespace-nowrap">
            Build a{" "}
            <span className="inline-block -rotate-[1.2deg] rounded-md bg-primary px-2.5 py-1 leading-[1.05] text-white sm:rounded-2xl sm:px-4 sm:py-1">
              Non-Competitive
            </span>
          </span>
          <br />
          Faceless Page
        </h1>
      </div>

      <p className="mt-4 max-w-xl text-base font-bold leading-relaxed text-gray-400 sm:hidden">
        Everything you need to grow and profit.
      </p>
      <p className="mt-7 hidden max-w-2xl text-lg font-bold leading-relaxed text-gray-400 sm:block">
        Everything you need to make money with social media, all in one place.
      </p>

      <div className="mt-8 flex justify-center sm:mt-14">
        <Button href="/app" size="lg" icon={StarIcon} bevel={false} className="px-7 py-4 text-lg font-bold! shadow-none sm:px-10 sm:py-5 sm:text-xl">
          Try Verlab Now
        </Button>
      </div>

      <div className="mt-14 flex flex-col items-center sm:mt-16">
        <p className="text-[10px] font-bold uppercase tracking-[1.5px] text-heading sm:text-xs sm:tracking-[2px]">
          Supported Platforms
        </p>
        <Image
          src="/hero-social.png"
          alt="YouTube, Instagram, TikTok"
          width={628}
          height={46}
          className="mt-5 h-auto w-full max-w-[240px] sm:mt-6 sm:max-w-md"
        />
      </div>
    </section>
  );
}
