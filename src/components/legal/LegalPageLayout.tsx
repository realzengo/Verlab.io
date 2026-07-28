import type { ReactNode } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Calendar, ChevronRight, Layers } from "lucide-react";
import { Nav } from "@/components/landing/Nav";
import { Footer } from "@/components/landing/Footer";
import { LegalToc } from "@/components/legal/LegalToc";
import { LEGAL_DOCS } from "@/components/legal/legalDocs";

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
  icon: LucideIcon;
  activeHref: string;
  title: string;
  description: string;
  effectiveDate: string;
  updatedDate: string;
  highlights: LegalHighlight[];
  sections: LegalSection[];
};

export function LegalPageLayout({
  icon: Icon,
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
        {/* Hero */}
        <div className="relative isolate overflow-hidden">
          <div
            aria-hidden
            className="pointer-events-none absolute -left-24 -top-24 -z-10 h-72 w-72 rounded-full bg-blue-100/40 opacity-40 blur-3xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -right-24 top-0 -z-10 h-80 w-80 rounded-full bg-blue-100/40 opacity-30 blur-3xl"
          />

          <div className="mx-auto max-w-6xl px-4 pb-10 pt-28 sm:px-6 sm:pt-32 lg:px-8">
            <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm text-subtle">
              <Link href="/" className="hover:text-primary">
                Home
              </Link>
              <ChevronRight className="h-3.5 w-3.5" />
              <Link href="/legal" className="hover:text-primary">
                Legal
              </Link>
              <ChevronRight className="h-3.5 w-3.5" />
              <span className="text-heading">{title}</span>
            </nav>

            {/* Quick-switch tabs */}
            <div className="mt-5 flex flex-wrap gap-2">
              {LEGAL_DOCS.map((doc) => {
                const isActive = doc.href === activeHref;
                return (
                  <Link
                    key={doc.href}
                    href={doc.href}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
                      isActive
                        ? "border-primary bg-primary text-white"
                        : "border-hairline bg-surface text-body hover:text-heading"
                    }`}
                  >
                    <doc.icon className="h-3.5 w-3.5" />
                    {doc.label}
                  </Link>
                );
              })}
            </div>

            <div className="mt-7 flex items-start gap-4">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary-hover text-white">
                <Icon className="h-6 w-6" />
              </span>
              <div>
                <h1 className="text-3xl font-semibold tracking-tight text-heading sm:text-[42px]">{title}</h1>
                <p className="mt-2 max-w-xl text-base text-body">{description}</p>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3 text-sm text-subtle">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-hairline bg-surface px-3 py-1.5 shadow-card">
                <Calendar className="h-3.5 w-3.5" /> Effective {effectiveDate}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-hairline bg-surface px-3 py-1.5 shadow-card">
                <Calendar className="h-3.5 w-3.5" /> Last updated {updatedDate}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-hairline bg-surface px-3 py-1.5 shadow-card">
                <Layers className="h-3.5 w-3.5" /> {sections.length} sections
              </span>
            </div>

            {/* TL;DR highlights */}
            <div className="mt-8 rounded-card-lg border border-accent-line bg-accent p-5 sm:p-6">
              <p className="text-xs font-bold uppercase tracking-wide text-primary">The short version</p>
              <ul className="mt-3.5 grid grid-cols-1 gap-3.5 sm:grid-cols-3">
                {highlights.map(({ icon: HighlightIcon, text }, index) => (
                  <li key={index} className="flex items-start gap-2.5 text-sm text-heading">
                    <HighlightIcon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span>{text}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="mx-auto max-w-6xl px-4 pb-20 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-[220px_1fr] lg:gap-10">
            <div className="lg:sticky lg:top-24 lg:self-start">
              <LegalToc items={sections.map(({ id, title: sectionTitle }) => ({ id, title: sectionTitle }))} />
            </div>

            <div className="min-w-0 max-w-3xl">
              <div className="flex flex-col gap-5">
                {sections.map((section, index) => (
                  <section
                    key={section.id}
                    id={section.id}
                    className="scroll-mt-28 rounded-card-lg border border-hairline bg-surface p-6 shadow-card transition-shadow hover:shadow-card-hover sm:p-8"
                  >
                    <div className="flex items-start gap-4">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary-hover text-sm font-bold text-white">
                        {index + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <h2 className="text-xl font-semibold text-heading sm:text-2xl">{section.title}</h2>
                        <div className="mt-3.5 space-y-4 text-[15px] leading-relaxed text-body">{section.body}</div>
                      </div>
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
