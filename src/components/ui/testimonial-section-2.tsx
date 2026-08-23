import Image from "next/image";
import Link from "next/link";
import { CircleDot, Play, Quote, Sparkle, Star } from "lucide-react";
import { APP_URL } from "@/lib/constants";

interface Testimonial {
  name: string;
  image: string;
  quote: string;
}

const testimonials: Testimonial[] = [
  {
    name: "Maya",
    image: "/reviewers/reviewer-01.jpeg",
    quote: "I paste the top videos in my niche and Verlab hands me a bent SOP in seconds.",
  },
  {
    name: "Jonathan",
    image: "/reviewers/reviewer-02.jpeg",
    quote: "Niche Bending and the MCP alone replaced three tools we were paying for across the team.",
  },
  {
    name: "Zex2d",
    image: "/reviewers/reviewer-07.jpeg",
    quote: "The pacing and hook data alone paid for the subscription in the first week.",
  },
  {
    name: "Marcus",
    image: "/reviewers/reviewer-05.jpeg",
    quote: "I run five niches solo now. Verlab's SOPs mean I'm never staring at a blank timeline.",
  },
  {
    name: "Priya",
    image: "/reviewers/reviewer-04.jpeg",
    quote: "We went from guessing formats to shipping a proven script every morning.",
  },
  {
    name: "Sana",
    image: "/reviewers/reviewer-08.jpeg",
    quote: "Verlab turned our competitor research into a repeatable system instead of a Friday afternoon scramble.",
  },
];

function TestimonialCard({ name, image, quote }: Testimonial) {
  return (
    <div className="group relative flex flex-col rounded-2xl border border-hairline bg-surface p-6 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg">
      <div className="flex items-center justify-between">
        <div className="flex gap-0.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star key={i} className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
          ))}
        </div>
        <Quote className="h-6 w-6 shrink-0 fill-slate-100 text-slate-100" strokeWidth={0} />
      </div>
      <p className="mt-4 flex-1 text-[15px] leading-relaxed text-body">&ldquo;{quote}&rdquo;</p>
      <div className="mt-6 flex items-center gap-3 border-t border-hairline pt-4">
        <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full ring-1 ring-black/5">
          <Image src={image} alt="" fill sizes="36px" className="object-cover object-top" />
        </div>
        <p className="text-sm font-bold text-heading">{name}</p>
      </div>
    </div>
  );
}

export default function Testimonial2() {
  return (
    <section className="relative w-full overflow-hidden bg-white pb-16 pt-2 sm:pb-24 dark:bg-background">
      <div className="relative mx-auto max-w-6xl px-4 text-center">
        <span
          className="relative mb-5 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium text-slate-100 [text-shadow:0_1px_1px_rgba(0,0,0,0.5)] sm:mb-8"
          style={{
            backgroundImage:
              "linear-gradient(160deg, #e2e8f0 0%, #94a3b8 10%, #334155 32%, #0b1220 52%, #1e293b 70%, #64748b 88%, #cbd5e1 100%)",
            boxShadow:
              "inset 0 1px 1px rgba(255,255,255,0.7), inset 0 -1px 2px rgba(0,0,0,0.8), inset 0 0 0 1px rgba(255,255,255,0.08)",
          }}
        >
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-5 top-px h-px rounded-full bg-gradient-to-r from-transparent via-white/80 to-transparent"
          />
          <CircleDot className="h-3.5 w-3.5 text-slate-300" />
          Reviews
          <CircleDot className="h-3.5 w-3.5 text-slate-300" />
        </span>
        <h2 className="text-2xl font-bold leading-tight tracking-tight text-heading sm:text-3xl md:text-4xl">
          What our users are saying
        </h2>
      </div>

      <div className="relative mx-auto mt-10 grid max-w-7xl grid-cols-1 gap-4 px-4 sm:mt-14 sm:grid-cols-2 lg:grid-cols-3">
        {testimonials.map((testimonial) => (
          <TestimonialCard key={testimonial.name} {...testimonial} />
        ))}
      </div>

      <div className="relative mx-auto max-w-6xl px-4 text-center">
        <div className="mt-10 flex justify-center sm:mt-12">
          <Link
            href={APP_URL}
            className="inline-flex items-center gap-2 rounded-xl bg-btn-primary px-8 py-4 text-lg font-extrabold text-white transition-transform hover:scale-105"
          >
            <Sparkle className="h-4 w-4 fill-white" />
            Get Started
            <Play className="h-3.5 w-3.5 fill-white" />
          </Link>
        </div>
      </div>
    </section>
  );
}
