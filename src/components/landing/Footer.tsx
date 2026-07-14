import Link from "next/link";
import { Wand2 } from "lucide-react";

const COLUMNS = [
  {
    title: "Product",
    links: [
      { label: "Niche Bending", href: "#niche-bending" },
      { label: "Features", href: "#features" },
      { label: "Pricing", href: "#pricing" },
    ],
  },
  {
    title: "Developers",
    links: [
      { label: "API", href: "#developers" },
      { label: "MCP", href: "#developers" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "Log in", href: "/app" },
      { label: "Get started", href: "/app" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="border-t border-hairline bg-white">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
          <div className="col-span-2 sm:col-span-1">
            <Link href="/" className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-chip bg-primary text-white">
                <Wand2 className="h-3.5 w-3.5" />
              </span>
              <span className="text-sm font-semibold text-heading">Clypa</span>
            </Link>
            <p className="mt-3 text-sm leading-relaxed text-body">
              Bend any viral niche into your own.
            </p>
          </div>

          {COLUMNS.map((column) => (
            <div key={column.title}>
              <span className="text-xs font-semibold uppercase tracking-wide text-body">{column.title}</span>
              <ul className="mt-3 flex flex-col gap-2.5">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <a href={link.href} className="text-sm text-body hover:text-heading">
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 border-t border-hairline pt-6 text-xs text-body">
          © {new Date().getFullYear()} Clypa. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
