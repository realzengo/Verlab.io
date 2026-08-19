import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { APP_URL } from "@/lib/constants";

export function CtaBand() {
  return (
    <section className="w-full px-4 pb-2 pt-14 text-center sm:px-6 sm:pb-3 sm:pt-20 lg:px-8">
      <div className="relative overflow-hidden rounded-card-lg px-5 py-14 text-white sm:px-6 sm:py-32">
        <Image
          src="/cta-bg-grass.jpeg"
          alt=""
          fill
          aria-hidden
          sizes="(min-width: 1024px) 1024px, 100vw"
          className="object-cover object-[50%_35%] saturate-[1.2]"
        />
        <div aria-hidden className="absolute inset-0 bg-black/30" />
        <div
          aria-hidden
          className="absolute inset-0 opacity-50 mix-blend-overlay"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
          }}
        />
        <div className="relative">
          <h2 className="text-[26px] font-bold leading-[1.15] tracking-[-0.8px] sm:text-[40px]">
            Ready to Get Started?
          </h2>
          <p className="mt-3 text-base text-white/80 sm:text-[17px]">
            Join thousands of satisfied customers and transform your workflow today.
          </p>
          <Link
            href={APP_URL}
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-white py-2 pl-6 pr-2 text-sm font-semibold text-black sm:gap-3 sm:pl-7 sm:text-base"
          >
            Get started
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-blue-500 text-white sm:h-9 sm:w-9">
              <ArrowRight className="h-4 w-4" />
            </span>
          </Link>
        </div>
      </div>
    </section>
  );
}
