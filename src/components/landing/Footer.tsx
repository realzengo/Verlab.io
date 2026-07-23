import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

const COLUMNS = [
  {
    title: "Product",
    links: [
      { label: "Niche Bending", href: "#niche-bending" },
      { label: "Niche Finder", href: "#features" },
      { label: "SOP Builder", href: "#features" },
      { label: "Script Maker", href: "#features" },
      { label: "Pricing", href: "/pricing" },
    ],
  },
  {
    title: "Platforms",
    links: [
      { label: "TikTok", href: "#" },
      { label: "Instagram Reels", href: "#" },
      { label: "YouTube Shorts", href: "#" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "Pricing", href: "/pricing" },
      { label: "Developer API", href: "/app/settings/api" },
      { label: "Log in", href: "/app" },
      { label: "Get started", href: "/app" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Terms", href: "/legal/terms" },
      { label: "Privacy", href: "/legal/privacy" },
      { label: "Refunds", href: "/legal/refunds" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="border-t border-hairline bg-app">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
        <div className="grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-5 sm:gap-8">
          <div className="col-span-2 sm:col-span-1">
            <Link href="/" className="flex items-center">
              <Logo height={22} />
            </Link>
            <p className="mt-3 max-w-[220px] text-[13px] leading-[1.6] text-subtle">
              Bend any viral niche into your own — TikTok, Reels &amp; Shorts.
            </p>
          </div>

          {COLUMNS.map((column) => (
            <div key={column.title}>
              <span className="text-xs font-bold uppercase tracking-wide text-heading">{column.title}</span>
              <ul className="mt-3.5 flex flex-col gap-2.5">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <a href={link.href} className="text-sm text-body hover:text-primary">
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-col items-center gap-4 border-t border-hairline pt-[22px] text-[13px] text-subtle sm:flex-row sm:justify-between">
          <span>© {new Date().getFullYear()} Verlab. All rights reserved.</span>
          <div className="flex items-center gap-2.5">
            <ThemeToggle className="h-8 w-8" />
            <a
              href="https://www.instagram.com/verlab.io"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram"
              className="flex h-8 w-8 items-center justify-center rounded-full border border-hairline bg-surface"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-subtle">
                <rect x="2" y="2" width="20" height="20" rx="5" />
                <circle cx="12" cy="12" r="4.5" />
                <circle cx="17.2" cy="6.8" r="1.1" fill="currentColor" stroke="none" />
              </svg>
            </a>
            <a
              href="#"
              aria-label="YouTube"
              className="flex h-8 w-8 items-center justify-center rounded-full border border-hairline bg-surface"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="text-subtle">
                <path d="M22 8.7s-.2-1.6-.8-2.3c-.8-.9-1.7-.9-2.1-1C16.4 5.2 12 5.2 12 5.2h0s-4.4 0-7.1.2c-.4 0-1.3.1-2.1 1-.6.7-.8 2.3-.8 2.3S1.8 10.6 1.8 12.5v1.8c0 1.9.2 3.8.2 3.8s.2 1.6.8 2.3c.8.9 1.9.9 2.4 1 1.7.2 7.3.2 7.3.2s4.4 0 7.1-.2c.4 0 1.3-.1 2.1-1 .6-.7.8-2.3.8-2.3s.2-1.9.2-3.8v-1.8c0-1.9-.2-3.8-.2-3.8zM9.7 15.5v-6l5.8 3-5.8 3z" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
