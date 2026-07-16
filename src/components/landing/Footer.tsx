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
          <span>© {new Date().getFullYear()} Clypa. All rights reserved.</span>
          <div className="flex items-center gap-2.5">
            <ThemeToggle className="h-8 w-8" />
            <a
              href="#"
              aria-label="X"
              className="flex h-8 w-8 items-center justify-center rounded-full border border-hairline bg-surface"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-subtle">
                <path d="M18 2h3l-7 8 8 12h-6l-5-7-5 7H3l8-9L3 2h6l4 6 5-6z" />
              </svg>
            </a>
            <a
              href="#"
              aria-label="TikTok"
              className="flex h-8 w-8 items-center justify-center rounded-full border border-hairline bg-surface"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-subtle">
                <path d="M16 3c.3 2 1.6 3.7 4 4v3c-1.5 0-2.9-.4-4-1v6.5A5.5 5.5 0 1 1 10.5 10c.5 0 1 .1 1.5.2V13a2.5 2.5 0 1 0 2 2.4V3h2z" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
