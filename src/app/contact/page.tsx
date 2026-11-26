import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Mail } from "lucide-react";
import { Nav } from "@/components/landing/Nav";
import { Footer } from "@/components/landing/Footer";
import { BezelPanel, INK_TITLE } from "@/components/brand/BrandKit";
import { LEGAL_DOCS } from "@/components/legal/legalDocs";
import { CONTACT_EMAIL, CONTACT_MAILTO, OPERATOR_COUNTRY, OPERATOR_NAME } from "@/lib/constants";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Contact | Verlab",
  description: `Contact Verlab at ${CONTACT_EMAIL} for support, billing, refunds, privacy or copyright questions. We reply within 24 hours.`,
};

export default function ContactPage() {
  return (
    <div className="flex min-h-screen flex-col bg-app">
      <Nav />
      <main className="flex-1">
        <div className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-12 px-4 pb-24 pt-32 sm:px-8 sm:pt-40 lg:grid-cols-[minmax(0,1fr)_minmax(0,640px)] lg:gap-16">
          <div className="max-w-xl">
            <p className="text-sm text-subtle">Contact</p>
            <h1 className={cn(INK_TITLE, "mt-3 text-[40px] leading-[1.05] tracking-[-0.03em] sm:text-[56px]")}>
              Get in touch
            </h1>
            <p className="mt-4 text-lg leading-7 text-subtle">
              Support, billing, refunds, privacy requests and copyright notices all go to one inbox.
            </p>

            <a
              href={CONTACT_MAILTO}
              className="mt-8 inline-flex max-w-full items-center gap-3 rounded-2xl border border-hairline bg-surface px-5 py-4 transition-colors hover:bg-app"
            >
              <Mail className="size-[18px] shrink-0 text-subtle" strokeWidth={1.5} />
              <span className="min-w-0 truncate text-base font-medium text-heading">{CONTACT_EMAIL}</span>
            </a>
            <p className="mt-3 text-sm text-subtle">We reply within 24 hours.</p>

            <p className="mt-8 text-sm text-subtle">
              Verlab is operated by {OPERATOR_NAME}, {OPERATOR_COUNTRY}.
            </p>
          </div>

          <BezelPanel className="self-start">
            <p className="border-b border-hairline px-6 py-4 text-sm font-medium text-heading">Policies</p>
            <ul className="divide-y divide-hairline">
              {LEGAL_DOCS.map((doc) => (
                <li key={doc.href}>
                  <Link href={doc.href} className="group flex items-center gap-4 px-6 py-5 transition-colors hover:bg-app">
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
