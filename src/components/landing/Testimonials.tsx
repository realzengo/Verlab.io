import { TestimonialsColumn, type Testimonial } from "@/components/ui/TestimonialColumn";

const TESTIMONIALS: Testimonial[] = [
  {
    name: "Maya R.",
    role: "Faceless Reddit channel",
    text: "I paste the top videos in my niche and Verlab hands me a bent SOP in seconds. My research time collapsed.",
    image: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=150&h=150",
  },
  {
    name: "Jonathan K.",
    role: "Clipping agency",
    text: "Niche Bending and the MCP alone replaced three tools we were paying for across the team.",
    image: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&q=80&w=150&h=150",
  },
  {
    name: "Deni O.",
    role: "Motivation Shorts",
    text: "The MCP is the killer feature — I run everything from inside Claude without leaving my workflow.",
    image: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&q=80&w=150&h=150",
  },
  {
    name: "Priya N.",
    role: "Faceless YouTube channel",
    text: "We went from guessing formats to shipping a proven script every morning. Verlab reads the winners so we don't have to.",
    image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=150&h=150",
  },
  {
    name: "Marcus T.",
    role: "Solo clipper",
    text: "I run five niches solo now. Verlab's SOPs mean I'm never staring at a blank timeline.",
    image: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=150&h=150",
  },
  {
    name: "Elena V.",
    role: "Content studio lead",
    text: "Onboarding new editors used to take weeks. Now I hand them a Verlab breakdown and they're cutting on day one.",
    image: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&q=80&w=150&h=150",
  },
  {
    name: "Owen D.",
    role: "Shorts creator",
    text: "The pacing and hook data alone paid for the subscription in the first week.",
    image: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=150&h=150",
  },
  {
    name: "Sana R.",
    role: "Growth marketer",
    text: "Verlab turned our competitor research into a repeatable system instead of a Friday afternoon scramble.",
    image: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=150&h=150",
  },
  {
    name: "Kabir L.",
    role: "Video editor",
    text: "Every brief I get now already has the structure mapped out. I just execute.",
    image: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&q=80&w=150&h=150",
  },
];

const firstColumn = TESTIMONIALS.slice(0, 3);
const secondColumn = TESTIMONIALS.slice(3, 6);
const thirdColumn = TESTIMONIALS.slice(6, 9);

export function Testimonials() {
  return (
    <section className="border-y border-hairline bg-gradient-to-b from-app to-surface">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-[90px] lg:px-8">
        <div className="mx-auto max-w-xl text-center">
          <span className="text-[13px] font-bold uppercase tracking-[1.4px] text-primary">Testimonials</span>
          <h2 className="mt-3.5 text-[28px] font-semibold leading-[1.1] tracking-[-1px] text-slate sm:text-[45px]">
            Built for creators who bend at scale
          </h2>
          <p className="mt-3 text-base text-body sm:mt-3.5 sm:text-[17px]">
            Faceless channels, agencies and solo clippers use Verlab to reverse-engineer what&rsquo;s already
            working.
          </p>
        </div>

        <div
          className="mt-8 flex max-h-[640px] justify-center gap-4 overflow-hidden sm:mt-12 sm:gap-5 [mask-image:linear-gradient(to_bottom,transparent,black_10%,black_90%,transparent)]"
          role="region"
          aria-label="Scrolling testimonials"
        >
          <TestimonialsColumn testimonials={firstColumn} duration={15} />
          <TestimonialsColumn testimonials={secondColumn} className="hidden sm:block" duration={19} />
          <TestimonialsColumn testimonials={thirdColumn} className="hidden lg:block" duration={17} />
        </div>

        <p className="mt-6 text-center text-xs text-subtle">Testimonials shown are placeholders for launch.</p>
      </div>
    </section>
  );
}
