import { Play, Zap } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { VerifiedBadge } from "@/components/landing/VerifiedBadge";
import { APP_URL } from "@/lib/constants";

interface Testimonial {
  name: string;
  image?: string;
  quote: string;
}

const TESTIMONIALS: Testimonial[] = [
  {
    name: "Jonathan",
    image: "/reviewers/reviewer-02.jpeg",
    quote: "Niche Bending and the MCP alone replaced three tools we were paying for across the team.",
  },
  {
    name: "Maya",
    image: "/reviewers/reviewer-01.jpeg",
    quote: "I paste the top videos in my niche and Verlab hands me a bent SOP in seconds.",
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
    name: "Owen",
    image: "/reviewers/reviewer-03.jpeg",
    quote: "Voice Studio finally sounds like a person, not a robot reading a teleprompter.",
  },
];

function TestimonialCard({ name, image, quote }: Testimonial) {
  return (
    <div className="rounded-2xl border border-hairline bg-white px-5 py-7 sm:px-6 sm:py-8">
      <div className="flex items-center gap-2.5">
        <Avatar name={name} src={image} size="md" />
        <span className="text-base font-bold text-heading">{name}</span>
      </div>
      <p className="mt-4 text-base leading-relaxed text-subtle">{quote}</p>
    </div>
  );
}

export function TestimonialsGridSection() {
  return (
    <section className="w-full bg-white pb-14 pt-14 sm:pb-20 sm:pt-24">
      <div className="mx-auto max-w-[96rem] px-5 sm:px-6">
        <div className="flex justify-center">
          <VerifiedBadge label="Testimonials" className="mb-5 sm:mb-6" />
        </div>
        <h2 className="text-center font-display text-xl font-bold leading-[1.15] tracking-[-0.015em] text-heading sm:text-3xl sm:tracking-tight md:text-5xl">
          <span className="sm:hidden">Verlab Has Generated Millions of Views. For Thousands of Creators.</span>
          <span className="hidden sm:inline">
            Verlab Has Generated Millions of Views.
            <br />
            For Thousands of Creators.
          </span>
        </h2>

        <div className="mt-8 grid grid-cols-1 gap-4 sm:mt-10 sm:grid-cols-3 sm:gap-5">
          {TESTIMONIALS.map((testimonial) => (
            <TestimonialCard key={testimonial.name} {...testimonial} />
          ))}
        </div>

        <div className="mt-8 flex justify-center sm:mt-10">
          <a
            href={APP_URL}
            className="group relative isolate inline-flex items-center gap-2 overflow-hidden rounded-2xl bg-[radial-gradient(220%_220%_at_28%_18%,#6d9bff_0%,#335cff_65%,#1c3fd6_100%)] px-8 py-4 text-base font-bold text-white shadow-[0_4px_0_0_#1a37c4,inset_0_1px_0_0_rgba(255,255,255,0.5),inset_0_-1px_0_0_rgba(0,0,0,0.25)] transition-[transform,box-shadow] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] hover:shadow-[0_4px_0_0_#1a37c4,inset_0_1px_0_0_rgba(255,255,255,0.6),inset_0_-1px_0_0_rgba(0,0,0,0.3)] active:translate-y-1 active:shadow-[0_0_0_0_#1a37c4,inset_0_1px_0_0_rgba(255,255,255,0.5),inset_0_-1px_0_0_rgba(0,0,0,0.25)] active:duration-100"
          >
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(140%_140%_at_50%_50%,#6d9bff_0%,#335cff_65%,#1c3fd6_100%)] opacity-0 transition-opacity duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:opacity-100"
            />
            <span className="relative flex items-center gap-2">
              <Zap className="h-4 w-4 fill-white" />
              Make an account
              <Play className="relative -mb-px ml-1 inline h-3.5 w-3.5 fill-white" />
            </span>
          </a>
        </div>
      </div>
    </section>
  );
}
