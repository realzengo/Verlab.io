import { Play, Sparkle } from "lucide-react";
import { APP_URL } from "@/lib/constants";
import { Avatar } from "@/components/ui/Avatar";
import { cn } from "@/lib/utils";

type CardSize = "sm" | "md" | "lg";

interface Testimonial {
  name: string;
  role: string;
  image?: string;
  quote: string;
  size?: CardSize;
}

const TESTIMONIALS: Testimonial[] = [
  {
    name: "Sana",
    role: "TikTok Creator",
    image: "/reviewers/reviewer-08.jpeg",
    size: "lg",
    quote:
      "Verlab turned our competitor research into a repeatable system instead of a Friday afternoon scramble. We paste in the channels we're watching, get back a bent SOP with the hooks and pacing that are actually working, and the whole team pulls from the same playbook.",
  },
  {
    name: "Jonathan",
    role: "TikTok Creator",
    image: "/reviewers/reviewer-02.jpeg",
    quote: "Niche Bending and the MCP alone replaced three tools we were paying for across the team.",
  },
  {
    name: "Maya",
    role: "TikTok Creator",
    image: "/reviewers/reviewer-01.jpeg",
    size: "sm",
    quote: "I paste the top videos in my niche and Verlab hands me a bent SOP in seconds.",
  },
  {
    name: "Zex2d",
    role: "YouTube Shorts Creator",
    image: "/reviewers/reviewer-07.jpeg",
    quote: "The pacing and hook data alone paid for the subscription in the first week.",
  },
  {
    name: "Marcus",
    role: "TikTok Creator",
    image: "/reviewers/reviewer-05.jpeg",
    size: "sm",
    quote: "I run five niches solo now. Verlab's SOPs mean I'm never staring at a blank timeline.",
  },
  {
    name: "Priya",
    role: "TikTok Creator",
    image: "/reviewers/reviewer-04.jpeg",
    quote: "We went from guessing formats to shipping a proven script every morning.",
  },
  {
    name: "Owen",
    role: "YouTube Shorts Creator",
    image: "/reviewers/reviewer-03.jpeg",
    size: "lg",
    quote: "Voice Studio finally sounds like a person, not a robot reading a teleprompter. It picked up the exact cadence I use on camera.",
  },
  {
    name: "Elena",
    role: "TikTok Creator",
    image: "/reviewers/reviewer-09.jpeg",
    quote: "Our agency runs twelve client channels off one Verlab workspace now.",
  },
  {
    name: "Devon",
    role: "YouTube Shorts Creator",
    image: "/reviewers/reviewer-06.jpeg",
    size: "sm",
    quote: "Clipping full episodes into shorts used to eat my whole Sunday. Now it's an hour, tops.",
  },
  {
    name: "Kavi",
    role: "TikTok Creator",
    quote: "The downloader plus caption removal turned my Sunday batch into ten minutes.",
  },
  {
    name: "Lina",
    role: "TikTok Creator",
    size: "lg",
    quote:
      "We finally have a single source of truth for what's actually trending in our niche, instead of five people on the team all watching different videos and arguing about it in Slack.",
  },
  {
    name: "Theo",
    role: "YouTube Shorts Creator",
    quote: "Script Writer nails the hook every time. No more rewriting the first line five times.",
  },
  {
    name: "Amara",
    role: "TikTok Creator",
    size: "sm",
    quote: "Managing 20 channels used to need a full team. Now it's me and Verlab.",
  },
  {
    name: "Ben",
    role: "TikTok Creator",
    quote: "Clients think I hired a research team. It's just Verlab running in the background.",
  },
  {
    name: "Noah",
    role: "TikTok Creator",
    quote: "Our launch teaser used Verlab end to end: script, voiceover, and the cut itself.",
  },
  {
    name: "Ines",
    role: "YouTube Shorts Creator",
    size: "lg",
    quote:
      "I manage content for three brands and Verlab is the only tool all three teams agreed to standardize on. That alone tells you something.",
  },
  {
    name: "Callum",
    role: "Instagram Creator",
    size: "sm",
    quote: "Image Generator gives me thumbnail options in the time it used to take to open Photoshop.",
  },
  {
    name: "Rina",
    role: "Instagram Creator",
    quote: "The MCP inside Claude means I never leave my chat to go bend a niche anymore.",
  },
  {
    name: "Diego",
    role: "TikTok Creator",
    size: "sm",
    quote: "I recommend Verlab to every student who asks how to find a niche that's actually working.",
  },
  {
    name: "Hana",
    role: "Instagram Creator",
    quote: "Study Niches turned into our team's shared research library almost by accident.",
  },
];

const SIZE_STYLES: Record<
  CardSize,
  { card: string; quote: string; avatar: "sm" | "md" | "lg"; avatarClass: string }
> = {
  sm: {
    card: "p-3.5 sm:p-5",
    quote: "text-xs sm:text-sm",
    avatar: "sm",
    avatarClass: "h-6! w-6! text-[9px]! sm:h-7! sm:w-7! sm:text-[10px]!",
  },
  md: {
    card: "p-3.5 sm:p-6",
    quote: "text-xs sm:text-[15px]",
    avatar: "md",
    avatarClass: "h-6! w-6! text-[9px]! sm:h-9! sm:w-9! sm:text-xs!",
  },
  lg: {
    card: "p-3.5 sm:p-7",
    quote: "text-[13px] sm:text-lg",
    avatar: "lg",
    avatarClass: "h-6! w-6! text-[9px]! sm:h-12! sm:w-12! sm:text-sm!",
  },
};

function TestimonialCard({ name, role, image, quote, size = "md" }: Testimonial) {
  const styles = SIZE_STYLES[size];
  return (
    <div
      className={cn(
        "mb-3 break-inside-avoid rounded-xl border border-slate-200/70 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:mb-4 sm:rounded-2xl",
        styles.card
      )}
    >
      <blockquote>
        <p className={cn("line-clamp-6 leading-snug text-slate-600 sm:line-clamp-none sm:leading-relaxed", styles.quote)}>
          {quote}
        </p>
        <footer className="mt-3 flex items-center gap-2 border-t border-slate-100 pt-3 sm:mt-5 sm:gap-3 sm:pt-4">
          <Avatar
            name={name}
            src={image}
            size={styles.avatar}
            className={cn("ring-2 ring-white shadow-sm", styles.avatarClass)}
          />
          <div>
            <cite className="block text-xs font-semibold not-italic text-heading sm:text-sm">{name}</cite>
            <span className="block text-[10px] text-slate-500 sm:text-xs">{role}</span>
          </div>
        </footer>
      </blockquote>
    </div>
  );
}

export default function Testimonial2() {
  return (
    <section className="relative w-full overflow-hidden bg-[#F8F9FC] py-20 sm:py-28">
      <div className="relative z-10 mx-auto max-w-2xl px-4 text-center">
        <h2 className="font-display text-[28px] font-bold tracking-tight text-heading sm:text-3xl md:text-5xl">
          What our users are saying
        </h2>
        <p className="mt-4 text-base leading-relaxed text-slate-500">
          Real results from creators and teams shipping content on Verlab every day.
        </p>
      </div>

      <div className="relative mt-14 sm:mt-16">
        <div className="relative mx-auto h-[560px] w-full max-w-[1600px] overflow-hidden px-4 sm:h-[580px] sm:px-8 lg:h-[640px] lg:px-12 xl:px-16">
          <div className="[column-width:150px] [column-gap:1rem] sm:[column-width:280px]">
            {TESTIMONIALS.map((testimonial) => (
              <TestimonialCard key={testimonial.name} {...testimonial} />
            ))}
          </div>
        </div>

        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-64 bg-gradient-to-b from-transparent to-[#F8F9FC] sm:h-80"
        />

        <div className="relative z-10 mt-4 flex justify-center sm:-mt-10">
          <a
            href={APP_URL}
            className="font-ui group relative isolate inline-flex items-center gap-2 overflow-hidden rounded-2xl bg-[radial-gradient(220%_220%_at_28%_18%,#6d9bff_0%,#335cff_65%,#1c3fd6_100%)] px-8 py-4 text-base font-bold text-white shadow-[0_4px_0_0_#1a37c4,0_10px_24px_-8px_rgba(28,63,214,0.5),inset_0_1px_0_0_rgba(255,255,255,0.5),inset_0_-1px_0_0_rgba(0,0,0,0.25)] transition-[transform,box-shadow] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] hover:shadow-[0_4px_0_0_#1a37c4,0_12px_28px_-8px_rgba(28,63,214,0.55),inset_0_1px_0_0_rgba(255,255,255,0.6),inset_0_-1px_0_0_rgba(0,0,0,0.3)] active:translate-y-1 active:shadow-[0_0_0_0_#1a37c4,0_4px_10px_-6px_rgba(28,63,214,0.5),inset_0_1px_0_0_rgba(255,255,255,0.5),inset_0_-1px_0_0_rgba(0,0,0,0.25)] active:duration-100"
          >
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(140%_140%_at_50%_50%,#6d9bff_0%,#335cff_65%,#1c3fd6_100%)] opacity-0 transition-opacity duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:opacity-100"
            />
            <span className="relative flex items-center gap-2">
              <Sparkle className="h-4 w-4 fill-white" />
              Get Started
              <Play className="relative -mb-px ml-1 inline h-3.5 w-3.5 fill-white" />
            </span>
          </a>
        </div>
      </div>
    </section>
  );
}
