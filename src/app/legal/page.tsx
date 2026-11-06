import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Nav } from "@/components/landing/Nav";
import { Footer } from "@/components/landing/Footer";
import { BezelPanel, INK_TITLE } from "@/components/brand/BrandKit";
import { LEGAL_DOCS } from "@/components/legal/legalDocs";
import { LEGAL_LINK } from "@/components/legal/prose";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Legal, Verlab AI",
  description: "Verlab's Terms of Service, Privacy Policy, and Refund Policy.",
};

export default function LegalHubPage() {
  return (
    <div className="flex min-h-screen flex-col bg-app">
      <Nav />
      <main className="flex-1">
        <div className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-12 px-4 pb-24 pt-32 sm:px-8 sm:pt-40 lg:grid-cols-[minmax(0,1fr)_minmax(0,640px)] lg:gap-16">
          <div className="max-w-xl">
            <p className="text-sm text-subtle">Legal</p>
            <h1 className={cn(INK_TITLE, "mt-3 text-[40px] leading-[1.05] tracking-[-0.03em] sm:text-[56px]")}>
              The fine print, made readable
            </h1>
            <p className="mt-4 text-lg leading-7 text-subtle">
              Everything about how Verlab works, what we do with your data, and how billing works, in one place.
            </p>
            <p className="mt-8 text-sm text-subtle">
              Questions about any of these?{" "}
              <a href="mailto:support@verlab.io" className={LEGAL_LINK}>
                support@verlab.io
              </a>
            </p>
          </div>

          <BezelPanel className="self-start">
            <ul className="divide-y divide-hairline">
              {LEGAL_DOCS.map((doc) => (
                <li key={doc.href}>
                  <Link
                    href={doc.href}
                    className="group flex items-center gap-4 px-6 py-5 transition-colors hover:bg-app"
                  >
                    <doc.icon className="size-[18px] shrink-0 text-subtle" strokeWidth={1.5} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-base font-medium text-heading">{doc.label}</span>
                      <span className="mt-0.5 block text-sm text-subtle">{doc.description}</span>
                    </span>
                    <ArrowRight
                      className="size-4 shrink-0 text-subtle transition-transform group-hover:translate-x-0.5"
                      strokeWidth={1.5}
                    />
                  </Link>
                </li>
              ))}
            </ul>
          </BezelPanel>
        </div>
      </main>
      <Footer />
    </div>
  );
}
