import { ArrowUpRight, Zap } from "lucide-react";
import { BUTTON_3D_MOTION, button3d } from "@/components/landing/button3d";
import { Avatar } from "@/components/ui/Avatar";
import { VerifiedBadge } from "@/components/landing/VerifiedBadge";
import { APP_URL } from "@/lib/constants";
import { cn } from "@/lib/utils";

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
            className={cn("inline-flex items-center gap-2 rounded-2xl px-8 py-4 text-base font-bold text-white", BUTTON_3D_MOTION)}
            style={button3d(4)}
          >
            <Zap className="h-4 w-4 fill-white" />
            Make an account
            <ArrowUpRight className="h-4 w-4" strokeWidth={2.25} />
          </a>
        </div>
      </div>
    </section>
  );
}
