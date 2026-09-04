import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { europaGrotesk } from "@/lib/fonts";
import { APP_URL } from "@/lib/constants";
import { cn } from "@/lib/utils";

type LinkGroup = { heading: string; links: { label: string; href: string; external?: boolean }[] };

const LINK_GROUPS: LinkGroup[] = [
  {
    heading: "Navigation",
    links: [
      { label: "Video Generator", href: `${APP_URL}/video-generator` },
      { label: "Image Generator", href: `${APP_URL}/image-generator` },
      { label: "Niche Explorer", href: `${APP_URL}/niches` },
      { label: "Pricing", href: "/pricing" },
    ],
  },
  {
    heading: "Socials",
    links: [
      { label: "Instagram", href: "https://www.instagram.com/verlab.io/", external: true },
      { label: "YouTube", href: "#", external: true },
    ],
  },
  {
    heading: "Pages",
    links: [
      { label: "Privacy Policy", href: "/legal/privacy" },
      { label: "Terms of Service", href: "/legal/terms" },
      { label: "Refund Policy", href: "/legal/refunds" },
      { label: "Affiliates", href: "/affiliates" },
    ],
  },
];

function InstagramGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="5" stroke="currentColor" strokeWidth="1.75" />
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.75" />
      <circle cx="17.2" cy="6.8" r="1.1" fill="currentColor" />
    </svg>
  );
}

const GLOW_GRADIENT =
  "radial-gradient(251% 163% at 48.2% 0%, rgba(255, 255, 255, 0) 21.2961%, rgba(88, 124, 255, 0.84) 42.4039%, rgb(43, 73, 230) 59.6847%, rgb(18, 28, 110) 73.7683%)";

const CONTAINER = "mx-auto max-w-[1600px] px-6 sm:px-10 lg:px-20";

export function Footer({ backgroundClassName = "bg-[#F8F9FC]" }: { backgroundClassName?: string } = {}) {
  return (
    <footer className={cn("relative w-full overflow-hidden", backgroundClassName)}>
      <nav className="flex w-full justify-center px-6 pt-[176px] sm:px-10 sm:pt-[192px] lg:px-20 lg:pt-[208px]">
        <div className="mx-auto flex w-max max-w-full flex-col items-center gap-16 md:flex-row md:items-center md:gap-x-16 lg:gap-x-24">
          <div className="flex max-w-[305px] flex-col items-start gap-5">
            <Link href="/" className="flex items-center">
              <Image
                src="/verlab-studio-logo.png"
                alt="Verlab Studio"
                width={1600}
                height={474}
                sizes="200px"
                className="h-10 w-auto"
              />
            </Link>

            <div className="h-px w-full bg-black/10" />

            <div className="flex flex-col items-start gap-4">
              <p className="text-[15px] leading-snug tracking-[-0.01em] text-slate-600">
                Generate videos, images, voiceovers, and scripts, all in one place.
              </p>

              <div className="flex items-center gap-2.5">
                <Link
                  href={APP_URL}
                  className="group inline-flex items-center gap-1.5 rounded-full border border-[#333] bg-black px-4 py-2.5 text-sm font-medium tracking-[-0.02em] text-white shadow-[0_10px_14px_-3px_rgba(0,0,0,0.22),0_2.3px_3.2px_-2px_rgba(0,0,0,0.3)] transition-transform duration-200 hover:scale-[1.03]"
                >
                  Get Started
                  <ArrowUpRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:rotate-45" />
                </Link>
                <a
                  href="https://www.instagram.com/verlab.io/"
                  aria-label="Instagram"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-black transition-opacity duration-200 hover:opacity-80"
                >
                  <InstagramGlyph className="h-4 w-4 text-white" />
                </a>
              </div>
            </div>
          </div>

          <div className="flex gap-6 sm:gap-20 lg:gap-24">
            {LINK_GROUPS.map((group) => (
              <div key={group.heading} className="flex flex-col items-start gap-2 sm:gap-3">
                <h3 className="text-[15px] font-medium tracking-[-0.02em] text-black sm:text-[18px]">{group.heading}</h3>
                <ul className="flex flex-col items-start gap-2 sm:gap-2.5">
                  {group.links.map((link) => (
                    <li key={link.label}>
                      {link.external ? (
                        <a
                          href={link.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="whitespace-nowrap text-[12.5px] tracking-[-0.02em] text-[#545454] transition-colors hover:text-black sm:whitespace-normal sm:text-[15px]"
                        >
                          {link.label}
                        </a>
                      ) : (
                        <Link
                          href={link.href}
                          className="whitespace-nowrap text-[12.5px] tracking-[-0.02em] text-[#424242] transition-colors hover:text-black sm:whitespace-normal sm:text-[15px]"
                        >
                          {link.label}
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </nav>

      <div className="relative mt-0 sm:mt-4 lg:mt-9">
        <div aria-hidden className="absolute inset-0" style={{ backgroundImage: GLOW_GRADIENT }} />

        <div
          className="relative flex h-[150px] items-end justify-center overflow-hidden px-6 select-none sm:h-[200px] lg:h-[250px]"
          style={{ perspective: "600px" }}
        >
          <span
            className={`${europaGrotesk.className} select-none whitespace-nowrap font-bold uppercase leading-[0.8] tracking-[0.02em]`}
            style={{
              userSelect: "none",
              WebkitUserSelect: "none",
              fontSize: "clamp(2.75rem, 9vw, 8rem)",
              color: "transparent",
              backgroundImage:
                "linear-gradient(0deg, rgb(255, 255, 255) 9.55976%, rgba(61, 61, 255, 0) 100%)",
              backgroundClip: "text",
              WebkitBackgroundClip: "text",
              WebkitTextStroke: "1px rgba(255,255,255,0.65)",
              textShadow: "0 1px 2px rgba(255,255,255,0.15)",
              transform: "rotateX(10deg)",
              transformOrigin: "50% 100%",
            }}
          >
            Verlab Studio
          </span>
        </div>

        <div className={`relative flex items-center justify-between border-t border-white/15 py-5 text-xs tracking-[-0.01em] text-white ${CONTAINER}`}>
          <span>Verlab &copy; {new Date().getFullYear()}</span>
          <span>All rights reserved.</span>
        </div>
      </div>
    </footer>
  );
}
