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
  id: string;
  description: string;
  badges: string[];
  href: string;
  logo: string;
  featured?: boolean;
}

const MODELS: FeaturedModel[] = [
  {
    id: "Seedance 2.5",
    description: "Up to 30s in 1080p",
    badges: ["Video"],
    href: "/video-generator",
    logo: SEEDANCE_ICON,
    featured: true,
  },
  {
    id: "Kling 3.0",
    description: "Best for cinematic shots",
    badges: ["Video"],
    href: "/video-generator",
    logo: KLING_ICON,
  },
  {
    id: "Veo 3 Quality",
    description: "Native audio, premium realism",
    badges: ["Video"],
    href: "/video-generator",
    logo: GOOGLE_ICON,
  },
  {
    id: "Sora 2",
    description: "Strong physics & realism",
    badges: ["New", "Video"],
    href: "/video-generator",
    logo: SORA_ICON,
  },
  {
    id: "Nano Banana Pro",
    description: "Highest quality photoreal stills",
    badges: ["New", "Image"],
    href: "/image-generator",
    logo: GOOGLE_ICON,
  },
  {
    id: "GPT Image 2",
    description: "Sharp detail, follows a long prompt",
    badges: ["Image"],
    href: "/image-generator",
    logo: GPT_ICON,
  },
  {
    id: "Grok Imagine",
    description: "Fast, expressive motion",
    badges: ["Video"],
    href: "/video-generator",
    logo: GROK_ICON,
  },
  {
    id: "Veo 3 Fast",
    description: "Faster & cheaper native audio",
    badges: ["Video"],
    href: "/video-generator",
    logo: GOOGLE_ICON,
  },
];

export function FeaturedTools() {
  return (
    <section>
      <h2 className="text-xl font-bold tracking-tight text-heading">Top models</h2>

      <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {MODELS.map((model) => (
          <Link
            key={model.id}
            href={model.href}
            className={cn(
              "group flex flex-col rounded-2xl p-5 transition-shadow duration-300 [transition-timing-function:cubic-bezier(0.19,1,0.22,1)]",
              model.featured
                ? "bg-gradient-to-br from-[#5CA5FF] to-[#2563EB] text-white shadow-[inset_0_0_14px_1px_#98CCFB] hover:shadow-[inset_0_0_32px_6px_#98CCFB]"
                : "bg-app text-heading hover:shadow-[2px_3px_3px_rgba(16,24,40,0.18)] dark:border dark:border-hairline dark:bg-surface dark:hover:shadow-[2px_3px_4px_rgba(0,0,0,0.75)]"
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <Image
                src={model.logo}
                alt=""
                width={28}
                height={28}
                className={cn(
                  "h-7 w-7 object-contain",
                  model.featured ? "brightness-0 invert" : "brightness-0 dark:brightness-0 dark:invert"
                )}
              />
              <div className="flex items-center gap-1">
                {model.badges.map((badge) => (
                  <span
                    key={badge}
                    className={cn(
                      "inline-flex items-center rounded-full border px-2 py-1 text-[11px] font-semibold",
                      model.featured
                        ? "border-white/25 bg-white/10 text-white"
                        : "border-hairline bg-surface text-subtle dark:bg-white/[0.06]"
                    )}
                  >
                    {badge}
                  </span>
                ))}
              </div>
            </div>

            <h3 className={cn("mt-4 text-[15px] font-bold", model.featured ? "text-white" : "text-heading")}>{model.id}</h3>
            <p className={cn("mt-1 text-sm", model.featured ? "text-white/75" : "text-subtle")}>{model.description}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
