import Image from "next/image";
import Link from "next/link";
import { europaGrotesk } from "@/lib/fonts";
import { APP_URL } from "@/lib/constants";

type LinkGroup = { heading: string; links: { label: string; href: string }[] };

const LINK_GROUPS: LinkGroup[] = [
  {
    heading: "Generate Videos",
    links: [
      { label: "Niche Bending", href: "/script-bending" },
      { label: "Script Generator", href: "/script-bending" },
      { label: "Image Generator", href: `${APP_URL}/image-generator` },
      { label: "Video Library", href: `${APP_URL}/library` },
    ],
  },
  {
    heading: "AI Tools",
    links: [
      { label: "Niche Explorer", href: `${APP_URL}/niches` },
      { label: "Transcript Extractor", href: `${APP_URL}/transcripts` },
      { label: "MCP Connect", href: `${APP_URL}/mcp` },
    ],
  },
  {
    heading: "Product",
    links: [
      { label: "Pricing", href: "/pricing" },
      { label: "How it Works", href: "/#workflow" },
      { label: "FAQ", href: "/#faq" },
      { label: "Affiliates", href: "/affiliates" },
    ],
  },
  {
    heading: "Legal",
    links: [
      { label: "Terms of Service", href: "/legal/terms" },
      { label: "Privacy Policy", href: "/legal/privacy" },
      { label: "Refund Policy", href: "/legal/refunds" },
      { label: "Log In", href: "/login" },
    ],
  },
];

// Flat, heading-free link list for the phone-width footer — condensed labels
// so every entry stays on one line inside a narrow 3-col grid.
const MOBILE_FOOTER_LINKS: { label: string; href: string }[] = [
  { label: "Niche Bending", href: "/script-bending" },
  { label: "Niches", href: `${APP_URL}/niches` },
  { label: "Pricing", href: "/pricing" },
  { label: "Scripts", href: "/script-bending" },
  { label: "Transcripts", href: `${APP_URL}/transcripts` },
  { label: "How it Works", href: "/#workflow" },
  { label: "Images", href: `${APP_URL}/image-generator` },
  { label: "MCP", href: `${APP_URL}/mcp` },
  { label: "FAQ", href: "/#faq" },
  { label: "Library", href: `${APP_URL}/library` },
  { label: "Affiliates", href: "/affiliates" },
];

const MOBILE_LEGAL_LINKS = [
  { label: "Terms", href: "/legal/terms" },
  { label: "Privacy", href: "/legal/privacy" },
  { label: "Refunds", href: "/legal/refunds" },
];

const SOCIAL_LINKS = [
  { label: "Instagram", href: "https://www.instagram.com/verlab.io/", src: "/social-instagram-mono.png" },
  { label: "YouTube", href: "#", src: "/social-youtube-mono.png" },
];

export function Footer() {
  return (
    <footer className="w-full bg-surface px-4 pb-6 pt-2 md:px-8 md:pb-8">
      <div className="flex w-full flex-col rounded-3xl bg-black p-6 md:p-10">
        {/* Phone view — logo/socials up top, flat link grid, legal row + copyright */}
        <div className="md:hidden">
          <div className="flex items-center justify-between gap-4">
            <Link href="/" className="flex items-center gap-2.5">
              <span className="relative block h-7 w-7 shrink-0">
                <Image src="/logo-mark-white.png" alt="" fill className="object-contain" sizes="28px" />
              </span>
              <span className={`${europaGrotesk.className} text-2xl font-bold tracking-tight text-white`}>Verlab</span>
            </Link>

            <div className="flex gap-2">
              {SOCIAL_LINKS.map(({ label, href, src }) => (
                <a
                  key={label}
                  href={href}
                  aria-label={label}
                  target={href.startsWith("http") ? "_blank" : undefined}
                  rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
                  className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border border-white/10 bg-white/5 opacity-80 transition-colors duration-200 hover:border-white/20 hover:bg-white/10 hover:opacity-100"
                >
                  <Image src={src} alt={label} width={20} height={20} unoptimized className="h-5 w-5 object-contain" />
                </a>
              ))}
            </div>
          </div>

          <p className="mt-4 max-w-md text-sm leading-relaxed text-white/50">
            Everything you need to make money with social media, all in one place.
          </p>

          <div className="mt-8 grid grid-cols-3 gap-x-4 gap-y-4">
            {MOBILE_FOOTER_LINKS.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="text-xs font-medium leading-tight text-white/50 transition-colors hover:text-white"
              >
                {link.label}
              </Link>
            ))}
          </div>

          <div className="mt-8 flex flex-col gap-4 border-t border-white/10 pt-6">
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {MOBILE_LEGAL_LINKS.map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  className="text-xs font-medium text-white/40 transition-colors hover:text-white/70"
                >
                  {link.label}
                </Link>
              ))}
            </div>
            <p className="text-xs text-white/30">&copy; {new Date().getFullYear()} Verlab Studio. All rights reserved.</p>
          </div>
        </div>

        {/* Desktop/tablet view — unchanged headed groups + logo/socials row */}
        <div className="hidden md:block">
          <div className="mb-10 grid grid-cols-1 gap-x-12 gap-y-16 md:grid-cols-2 lg:grid-cols-4">
            {LINK_GROUPS.map((group) => (
              <div key={group.heading}>
                <h3 className="font-ui mb-4 text-lg font-semibold text-white">{group.heading}</h3>
                <ul className="flex flex-col gap-3">
                  {group.links.map((link) => (
                    <li key={link.label}>
                      <Link href={link.href} className="text-sm font-medium text-white/50 transition-colors hover:text-white">
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="flex w-full flex-col items-center justify-between gap-6 sm:flex-row">
            <Link href="/" className="flex items-center gap-2.5">
              <span className="relative block h-7 w-7 shrink-0">
                <Image src="/logo-mark-white.png" alt="" fill className="object-contain" sizes="28px" />
              </span>
              <span className={`${europaGrotesk.className} text-2xl font-bold tracking-tight text-white`}>Verlab</span>
            </Link>

            <div className="flex gap-3">
              {SOCIAL_LINKS.map(({ label, href, src }) => (
                <a
                  key={label}
                  href={href}
                  aria-label={label}
                  target={href.startsWith("http") ? "_blank" : undefined}
                  rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
                  className="flex h-12 w-12 shrink-0 cursor-pointer items-center justify-center rounded-full border border-white/10 bg-white/5 opacity-80 transition-colors duration-200 hover:border-white/20 hover:bg-white/10 hover:opacity-100"
                >
                  <Image src={src} alt={label} width={24} height={24} unoptimized className="h-6 w-6 object-contain" />
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
