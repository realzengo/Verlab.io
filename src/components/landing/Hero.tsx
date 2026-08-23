import Image from "next/image";
import { Sparkle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { OrbitingCircles } from "@/components/landing/OrbitingCircles";
import { TrustBadge } from "@/components/landing/TrustBadge";
import { APP_URL } from "@/lib/constants";
import { cn } from "@/lib/utils";

function OrbitDot({ size = "sm" }: { size?: "sm" | "md" }) {
  return (
    <span className="relative flex items-center justify-center">
      <span className={cn("absolute rounded-full bg-primary/10", size === "md" ? "size-10" : "size-7")} />
      <span className={cn("absolute rounded-full bg-primary/20", size === "md" ? "size-6" : "size-4")} />
      <span className={cn("relative rounded-full bg-primary", size === "md" ? "size-3" : "size-2")} />
    </span>
  );
}

export function Hero() {
  return (
    <section className="relative isolate mx-auto flex max-w-6xl flex-col items-center px-4 pb-6 pt-24 text-center sm:px-6 sm:pb-10 sm:pt-32 lg:px-8 md:pt-48">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 hidden items-center justify-center overflow-hidden lg:flex"
      >
        <OrbitingCircles radius={220} duration={20} speed={0.5}>
          <OrbitDot size="md" />
          <OrbitDot />
        </OrbitingCircles>
        <OrbitingCircles radius={320} duration={20} speed={0.25} reverse>
          <OrbitDot />
          <OrbitDot size="md" />
          <OrbitDot />
        </OrbitingCircles>
        <OrbitingCircles radius={420} duration={20} speed={0.1}>
          <OrbitDot />
          <OrbitDot />
          <OrbitDot size="md" />
          <OrbitDot />
        </OrbitingCircles>
      </div>

      <TrustBadge />

      <div className="relative flex w-full justify-center">
        <h1 className="relative max-w-6xl font-display text-[clamp(24px,7.8vw,29px)] font-medium leading-[1.1] tracking-[-0.5px] text-heading sm:text-[72px] sm:leading-[1.05] sm:tracking-[-2px] lg:text-[84px]">
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

      <p className="mt-4 max-w-xl text-sm font-bold leading-relaxed text-gray-400 sm:hidden">
        Everything you need to grow and profit.
      </p>
      <p className="mt-7 hidden max-w-2xl text-lg font-bold leading-relaxed text-gray-400 sm:block">
        Everything you need to make money with social media, all in one place.
      </p>

      <div className="mt-8 flex justify-center sm:mt-14">
        <Button
          href={APP_URL}
          variant="flatBlue"
          icon={Sparkle}
          iconClassName="fill-current"
          className="px-7 py-4 sm:px-10 sm:py-5"
        >
          Try Verlab Now
        </Button>
      </div>

      <div className="relative mt-10 w-full sm:mt-14">
        <div
          aria-hidden
          className="animate-image-glow absolute left-1/2 top-[12%] -z-10 h-1/4 w-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-r from-sky-500 to-blue-600 blur-[4rem] lg:w-3/4 lg:blur-[10rem]"
        />
        <div className="relative rounded-xl border border-hairline bg-surface/30 p-1.5 backdrop-blur-md sm:rounded-[32px] sm:p-2">
          <div className="overflow-hidden rounded-lg border border-hairline bg-surface sm:rounded-[22px]">
            <Image
              src="/hero-app-preview-v2.png"
              alt="The Verlab dashboard — niche research and AI content tools"
              width={1400}
              height={945}
              priority
              className="w-full rounded-lg sm:rounded-[20px]"
            />
          </div>
        </div>
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-1/4 bg-gradient-to-t from-background to-transparent"
        />
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
          priority
          className="mt-5 h-auto w-full max-w-[240px] sm:mt-6 sm:max-w-md"
        />
      </div>
    </section>
  );
}
