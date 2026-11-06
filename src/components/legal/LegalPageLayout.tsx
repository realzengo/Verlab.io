import type { ReactNode } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Nav } from "@/components/landing/Nav";
import { Footer } from "@/components/landing/Footer";
import { BezelPanel, INK_TITLE } from "@/components/brand/BrandKit";
import { LegalToc } from "@/components/legal/LegalToc";
import { LEGAL_DOCS } from "@/components/legal/legalDocs";
import { clauseNumber } from "@/components/legal/prose";
import { cn } from "@/lib/utils";

export type LegalSection = {
  id: string;
  title: string;
  body: ReactNode;
};

export type LegalHighlight = {
  icon: LucideIcon;
  text: string;
};

type LegalPageLayoutProps = {
  activeHref: string;
  title: string;
  description: string;
  effectiveDate: string;
  updatedDate: string;
  highlights: LegalHighlight[];
  sections: LegalSection[];
};

export function LegalPageLayout({
  activeHref,
  title,
  description,
  effectiveDate,
  updatedDate,
  highlights,
  sections,
}: LegalPageLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col bg-app">
      <Nav />
      <main className="flex-1">
        <div className="mx-auto w-full max-w-7xl px-4 pb-24 pt-32 sm:px-8 sm:pt-40">
          {/* Header: title on the left, the document's dates on the right */}
          <header className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <Link href="/legal" className="text-sm text-subtle transition-colors hover:text-heading">
                Legal
              </Link>
              <h1 className={cn(INK_TITLE, "mt-3 text-[40px] leading-[1.05] tracking-[-0.03em] sm:text-[56px]")}>
                {title}
              </h1>
              <p className="mt-3 text-lg leading-7 text-subtle">{description}</p>
            </div>
            <dl className="grid w-fit grid-cols-[auto_auto] gap-x-6 gap-y-1.5 text-sm lg:pb-2">
              <dt className="text-subtle">Effective</dt>
              <dd className="tabular-nums text-heading">{effectiveDate}</dd>
              <dt className="text-subtle">Last updated</dt>
              <dd className="tabular-nums text-heading">{updatedDate}</dd>
            </dl>
          </header>

          {/* Document switcher */}
          <nav
            aria-label="Legal documents"
            className="mt-10 flex gap-6 overflow-x-auto border-b border-hairline [scrollbar-width:none] sm:gap-8 [&::-webkit-scrollbar]:hidden"
          >
            {LEGAL_DOCS.map((doc) => {
              const isActive = doc.href === activeHref;
              return (
                <Link
                  key={doc.href}
                  href={doc.href}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "-mb-px shrink-0 whitespace-nowrap border-b-2 pb-3 text-[15px] transition-colors",
                    isActive
                      ? "border-heading font-medium text-heading"
                      : "border-transparent text-subtle hover:text-heading"
                  )}
                >
                  {doc.label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-8 grid grid-cols-1 gap-8 lg:mt-12 lg:grid-cols-[232px_minmax(0,1fr)] lg:gap-16">
            <aside className="sticky top-[84px] z-30 self-start lg:top-32">
              <LegalToc items={sections.map(({ id, title: sectionTitle }) => ({ id, title: sectionTitle }))} />
            </aside>

            <div className="min-w-0">
              <BezelPanel>
                <p className="border-b border-hairline px-6 py-4 text-sm font-medium text-heading">The short version</p>
                <ul className="grid divide-y divide-hairline sm:grid-cols-3 sm:divide-x sm:divide-y-0">
                  {highlights.map(({ icon: HighlightIcon, text }) => (
                    <li key={text} className="flex items-start gap-3 px-5 py-4 sm:flex-col sm:gap-4 sm:p-6">
                      <HighlightIcon className="mt-[3px] size-[18px] shrink-0 text-subtle sm:mt-0" strokeWidth={1.5} />
                      <p className="text-[15px] leading-6 text-heading">{text}</p>
                    </li>
                  ))}
                </ul>
              </BezelPanel>

              <div className="mt-6">
                {sections.map((section, index) => (
                  <section
                    key={section.id}
                    id={section.id}
                    className="scroll-mt-36 border-t border-hairline py-10 first:border-t-0 sm:grid sm:grid-cols-[56px_minmax(0,1fr)]"
                  >
                    <span className="font-mono text-[13px] tabular-nums leading-8 text-subtle">
                      {clauseNumber(index)}
                    </span>
                    <div className="min-w-0 max-w-[680px]">
                      <h2 className="text-[22px] font-semibold leading-8 tracking-[-0.01em] text-heading">
                        {section.title}
                      </h2>
                      <div className="mt-4 space-y-4 text-[15px] leading-[1.75] text-body">{section.body}</div>
                    </div>
                  </section>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
