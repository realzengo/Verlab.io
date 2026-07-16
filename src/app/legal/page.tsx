import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Nav } from "@/components/landing/Nav";
import { Footer } from "@/components/landing/Footer";
import { Card } from "@/components/ui/Card";
import { LEGAL_DOCS } from "@/components/legal/legalDocs";

export const metadata: Metadata = {
  title: "Legal — Clypa",
  description: "Clypa's Terms of Service, Privacy Policy, and Refund Policy.",
};

export default function LegalHubPage() {
  return (
    <div className="flex min-h-screen flex-col bg-app">
      <Nav />
      <main className="flex-1">
        <div className="relative isolate overflow-hidden">
          <div
            aria-hidden
            className="pointer-events-none absolute -left-24 -top-24 -z-10 h-72 w-72 rounded-full bg-blue-100/40 opacity-40 blur-3xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -right-24 top-0 -z-10 h-80 w-80 rounded-full bg-blue-100/40 opacity-30 blur-3xl"
          />

          <div className="mx-auto max-w-4xl px-4 pb-16 pt-28 sm:px-6 sm:pt-32 lg:px-8">
            <span className="inline-flex items-center rounded-full border border-hairline bg-surface px-3 py-1 text-xs font-bold uppercase tracking-wide text-primary shadow-card">
              Legal
            </span>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-heading sm:text-[42px]">
              The fine print, made readable.
            </h1>
            <p className="mt-3 max-w-xl text-base text-body">
              Everything about how Clypa works, what we do with your data, and how billing works — in one place.
            </p>

            <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-3">
              {LEGAL_DOCS.map((doc) => (
                <Link key={doc.href} href={doc.href} className="group">
                  <Card hoverLift className="h-full">
                    <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary-hover text-white">
                      <doc.icon className="h-5 w-5" />
                    </span>
                    <h2 className="mt-4 font-semibold text-heading">{doc.label}</h2>
                    <p className="mt-1.5 text-sm text-body">{doc.description}</p>
                    <span className="mt-4 flex items-center gap-1 text-sm font-medium text-primary">
                      Read more
                      <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
