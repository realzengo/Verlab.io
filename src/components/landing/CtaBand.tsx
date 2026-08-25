import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Sparkle } from "lucide-react";
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
          <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl md:text-5xl">
            Ready to Get Started?
          </h2>
          <p className="mt-3 text-base text-white/80 sm:text-[17px]">
            Join thousands of satisfied customers and transform your workflow today.
          </p>
          <Link
            href={APP_URL}
            className="btn-tactile-light mt-6 inline-flex items-center gap-3 rounded-[1.25rem] px-8 py-4"
          >
            <Sparkle className="h-5 w-5 shrink-0 fill-current" />
            <span className="text-left">
              <span className="mb-[-2px] block text-[10px] font-bold uppercase tracking-wider opacity-60">
                Get started
              </span>
              <span className="block text-xl font-bold leading-none tracking-tight">Make an account</span>
            </span>
            <ArrowRight className="h-6 w-6 shrink-0" />
          </Link>
        </div>
      </div>
    </section>
  );
}
