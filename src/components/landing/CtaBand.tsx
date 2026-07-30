import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function CtaBand() {
  return (
    <section className="w-full px-4 pb-2 pt-14 text-center sm:px-6 sm:pb-3 sm:pt-20 lg:px-8">
      <div className="relative overflow-hidden rounded-card-lg px-5 py-14 text-white sm:px-6 sm:py-32">
        <Image
          src="/cta-bg.png"
          alt=""
          fill
          aria-hidden
          sizes="(min-width: 1024px) 1024px, 100vw"
          className="object-cover object-bottom"
        />
        <div aria-hidden className="absolute inset-0 bg-black/30" />
        <div className="relative">
          <h2 className="text-[26px] font-bold leading-[1.15] tracking-[-0.8px] sm:text-[40px]">
            Ready to Get Started?
          </h2>
          <p className="mt-3 text-base text-white/80 sm:text-[17px]">
            Join thousands of satisfied customers and transform your workflow today.
          </p>
          <Link
            href="/app"
            className="liquid-glass mt-6 inline-flex items-center gap-2 rounded-full py-2 pl-6 pr-2 text-sm font-semibold sm:gap-3 sm:pl-7 sm:text-base"
          >
            Get started
            <span className="liquid-glass-puck grid h-8 w-8 shrink-0 place-items-center rounded-full text-white sm:h-9 sm:w-9">
              <ArrowRight className="h-4 w-4" />
            </span>
          </Link>
        </div>
      </div>
    </section>
  );
}
