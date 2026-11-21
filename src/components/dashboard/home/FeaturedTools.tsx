import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

const GOOGLE_ICON = "/logos/ai/google-color.svg";
const GPT_ICON = "/logos/ai/chatgpt.png";
const GROK_ICON = "/logos/ai/grok.svg";
const KLING_ICON = "/logos/ai/kling.svg";
const SEEDANCE_ICON = "/logos/ai/seedance.webp";
const SORA_ICON = "/logos/ai/sora.svg";

interface FeaturedModel {
  name: string;
  description: string;
  kind: "Video" | "Image";
  href: string;
  logo: string;
  /** Shows the blue "New" pill beside the kind. */
  isNew?: boolean;
  /** The highlighted card (blue edge + soft halo); others take that look on hover. */
  featured?: boolean;
}

const MODELS: FeaturedModel[] = [
  {
    name: "Seedance 2.5",
    description: "Up to 30s in 1080p",
    kind: "Video",
    href: "/video-generator",
    logo: SEEDANCE_ICON,
    featured: true,
  },
  {
    name: "Kling 3.0",
    description: "Best for cinematic shots",
    kind: "Video",
    href: "/video-generator",
    logo: KLING_ICON,
  },
  {
    name: "Veo 3 Quality",
    description: "Native audio, premium realism",
    kind: "Video",
    href: "/video-generator",
    logo: GOOGLE_ICON,
  },
  {
    name: "Sora 2",
    description: "Strong physics & realism",
    kind: "Video",
    href: "/video-generator",
    logo: SORA_ICON,
  },
  {
    name: "Nano Banana Pro",
    description: "Highest quality photoreal stills",
    kind: "Image",
    href: "/image-generator",
    logo: GOOGLE_ICON,
  },
  {
    name: "GPT Image 2",
    description: "Sharp detail, follows a long prompt",
    kind: "Image",
    href: "/image-generator",
    logo: GPT_ICON,
  },
  {
    name: "Grok Imagine",
    description: "Fast, expressive motion",
    kind: "Video",
    href: "/video-generator",
    logo: GROK_ICON,
  },
  {
    name: "Veo 3 Fast",
    description: "Faster & cheaper native audio",
    kind: "Video",
    href: "/video-generator",
    logo: GOOGLE_ICON,
  },
];

// Card chrome measured off the reference grid: white 24px-radius cards with a
// 1px rail-line border, 28px mono logo top left, stadium tags top right
// (same pill as the sidebar badge), then a 15.5px semibold name and a
// 13.4px description, in the rail's Open Sauce One.
const CARD =
  "group flex flex-col rounded-3xl border bg-white p-4 outline-none transition-[border-color,box-shadow] duration-200 focus-visible:ring-2 focus-visible:ring-primary/40 dark:bg-[#101115]";
const CARD_LIT =
  "border-[#c5d6f8] shadow-[0_2px_10px_-2px_rgba(43,96,189,0.16),0_0_0_3px_rgba(197,214,248,0.28)] dark:border-[#2d4170] dark:shadow-[0_0_0_3px_rgba(64,110,220,0.12)]";
const CARD_IDLE =
  "border-(--rail-line) hover:border-[#c5d6f8] hover:shadow-[0_2px_10px_-2px_rgba(43,96,189,0.16),0_0_0_3px_rgba(197,214,248,0.28)] dark:hover:border-[#2d4170] dark:hover:shadow-[0_0_0_3px_rgba(64,110,220,0.12)]";
const PILL = "inline-flex h-4 items-center rounded-full px-[6.5px] text-[10.6px] leading-4";

export function FeaturedTools() {
  return (
    <section>
      <h2 className="text-xl font-bold tracking-tight text-heading">Top models</h2>

      <div className="mt-4 grid grid-cols-2 gap-3 font-['Open_Sauce_One',ui-sans-serif,system-ui,sans-serif] sm:mt-5 sm:grid-cols-4">
        {MODELS.map((model) => (
          <Link key={model.name} href={model.href} className={cn(CARD, model.featured ? CARD_LIT : CARD_IDLE)}>
            <div className="flex items-start justify-between gap-2">
              <Image
                src={model.logo}
                alt=""
                width={28}
                height={28}
                className="h-7 w-7 shrink-0 object-contain brightness-0 dark:invert"
              />
              <div className="mt-px flex items-center gap-1.5">
                {model.isNew && (
                  <span className={cn(PILL, "bg-[#e6edfc] text-[#2b60bd] dark:bg-[#2b60bd]/20 dark:text-[#8fb0f0]")}>
                    New
                  </span>
                )}
                <span className={cn(PILL, "bg-[#f0f1f2] text-(--rail-text) dark:bg-(--rail-badge)")}>{model.kind}</span>
              </div>
            </div>

            <h3 className="mt-6 truncate text-[15.5px] font-semibold leading-5 tracking-[-0.03em] text-(--rail-ink)">
              {model.name}
            </h3>
            <p className="mt-[5px] truncate text-[13.4px] leading-5 tracking-[-0.01em] text-(--rail-text)">
              {model.description}
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}
