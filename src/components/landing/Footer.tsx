import Image from "next/image";
import Link from "next/link";
import { europaGrotesk } from "@/lib/fonts";
import { LogoMark } from "@/components/ui/Logo";

type LinkGroup = { heading: string; links: { label: string; href: string }[] };

const LINK_GROUPS: LinkGroup[] = [
  {
    heading: "Generate Videos",
    links: [
      { label: "Niche Bending", href: "/app/bend" },
      { label: "Script Generator", href: "/app/scripts" },
      { label: "Image Generator", href: "/app/image-generator" },
      { label: "Video Library", href: "/app/library" },
    ],
  },
  {
    heading: "AI Tools",
    links: [
      { label: "Niche Explorer", href: "/app/niches" },
      { label: "Transcript Extractor", href: "/app/transcripts" },
      { label: "MCP Connect", href: "/app/mcp" },
      { label: "Downloads", href: "/app/downloads" },
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

const SOCIAL_LINKS = [
  { label: "TikTok", href: "#", src: "/social-tiktok-mono.png" },
  { label: "Instagram", href: "#", src: "/social-instagram-mono.png" },
  { label: "YouTube", href: "#", src: "/social-youtube-mono.png" },
];

export function Footer() {
  return (
    <footer className="w-full bg-surface px-8 pb-8 pt-2">
      <div className="flex w-full flex-col rounded-3xl bg-black p-6 md:p-10">
        <div className="mb-10 grid grid-cols-1 gap-x-12 gap-y-16 md:grid-cols-2 lg:grid-cols-4">
          {LINK_GROUPS.map((group) => (
            <div key={group.heading}>
              <h3 className="mb-4 text-lg font-bold text-white">{group.heading}</h3>
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
            <LogoMark className="h-7 w-7 shrink-0 text-white" />
            <span className={`${europaGrotesk.className} text-2xl font-bold tracking-tight text-white`}>Verlab</span>
          </Link>

          <div className="flex gap-3">
            {SOCIAL_LINKS.map(({ label, href, src }) => (
              <a
                key={label}
                href={href}
                aria-label={label}
                className="flex h-12 w-12 shrink-0 cursor-pointer items-center justify-center rounded-full border border-white/10 bg-white/5 opacity-80 transition-colors duration-200 hover:border-white/20 hover:bg-white/10 hover:opacity-100"
              >
                <Image src={src} alt={label} width={24} height={24} unoptimized className="h-6 w-6 object-contain" />
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
