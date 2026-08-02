import type { Metadata } from "next";
import Link from "next/link";
import { Database, Lock, ShieldCheck, UserCheck } from "lucide-react";
import { LegalPageLayout, type LegalSection } from "@/components/legal/LegalPageLayout";

export const metadata: Metadata = {
  title: "Privacy Policy — Verlab AI",
  description: "How Verlab collects, uses, and protects your data.",
};

const SECTIONS: LegalSection[] = [
  {
    id: "introduction",
    title: "Introduction",
    body: (
      <p>
        This Privacy Policy explains how Verlab (&quot;Verlab,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;)
        collects, uses, shares, and protects information when you use verlab.io and the Verlab dashboard (the
        &quot;Service&quot;). By using the Service, you agree to the collection and use of information as described
        here.
      </p>
    ),
  },
  {
    id: "information-we-collect",
    title: "Information We Collect",
    body: (
      <>
        <p className="font-semibold text-heading">2.1 Account Information</p>
        <p>Name, email address, password (hashed), and profile details you provide when you sign up or sign in with a third-party provider.</p>
        <p className="font-semibold text-heading">2.2 Billing Information</p>
        <p>
          Subscription plan, billing history, and payment details. Card and payment information is collected and
          processed directly by our payment processor — Verlab does not store full card numbers on its own servers.
        </p>
        <p className="font-semibold text-heading">2.3 Content You Provide</p>
        <p>Topics, niches, transcripts, uploads, and any other content you submit to generate scripts or SOPs.</p>
        <p className="font-semibold text-heading">2.4 Usage Data</p>
        <p>
          Log data, device and browser information, IP address, and interactions with the Service (such as features
          used and pages visited), collected automatically to operate and improve the Service.
        </p>
        <p className="font-semibold text-heading">2.5 Cookies</p>
        <p>Cookies and similar technologies used to keep you signed in, remember preferences (such as dark mode), and understand aggregate usage.</p>
      </>
    ),
  },
  {
    id: "how-we-use-information",
    title: "How We Use Information",
    body: (
      <ul className="list-disc space-y-2 pl-5 marker:text-primary">
        <li>Provide, maintain, and personalize the Service, including generating scripts and niche recommendations.</li>
        <li>Process payments and manage subscriptions.</li>
        <li>Send account, billing, and product-related communications.</li>
        <li>Monitor, secure, and improve the reliability and performance of the Service.</li>
        <li>Detect, prevent, and address fraud, abuse, or security incidents.</li>
        <li>Comply with legal obligations.</li>
      </ul>
    ),
  },
  {
    id: "sharing",
    title: "Third-Party Services & Data Sharing",
    body: (
      <>
        <p>
          We do not sell your personal information. We share data only with service providers that help us run
          Verlab, under confidentiality and data-processing terms, including:
        </p>
        <ul className="list-disc space-y-2 pl-5 marker:text-primary">
          <li>Our authentication and database provider, used to store account and application data.</li>
          <li>Our payment processor, used to handle subscription billing.</li>
          <li>Analytics and infrastructure providers, used to operate and monitor the Service.</li>
        </ul>
        <p>
          We may also disclose information if required by law, to protect the rights and safety of Verlab and its
          users, or in connection with a merger, acquisition, or sale of assets.
        </p>
      </>
    ),
  },
  {
    id: "data-retention",
    title: "Data Retention",
    body: (
      <p>
        We retain account and content data for as long as your account is active, and for a reasonable period after
        cancellation in case you choose to reactivate, as described in our{" "}
        <Link href="/legal/refunds" className="text-primary hover:underline">
          Refund Policy
        </Link>
        . You may request deletion of your data at any time as described below.
      </p>
    ),
  },
  {
    id: "your-rights",
    title: "Your Rights & Choices",
    body: (
      <>
        <p>Depending on where you live, you may have the right to:</p>
        <ul className="list-disc space-y-2 pl-5 marker:text-primary">
          <li>Access, correct, or delete the personal information we hold about you.</li>
          <li>Export a copy of your data.</li>
          <li>Object to or restrict certain processing of your data.</li>
          <li>Withdraw consent for optional communications at any time.</li>
        </ul>
        <p>
          You can update most account information directly from your{" "}
          <Link href="/app/settings" className="text-primary hover:underline">
            account settings
          </Link>
          , or contact us using the details below to exercise any of these rights.
        </p>
      </>
    ),
  },
  {
    id: "security",
    title: "Data Security",
    body: (
      <p>
        We use industry-standard technical and organizational measures — including encryption in transit,
        access controls, and hashed passwords — to protect your information. No method of transmission or storage is
        completely secure, and we cannot guarantee absolute security.
      </p>
    ),
  },
  {
    id: "childrens-privacy",
    title: "Children's Privacy",
    body: (
      <p>
        The Service is not directed to children under 16, and we do not knowingly collect personal information from
        them. If you believe a child has provided us with personal information, please contact us and we will delete
        it.
      </p>
    ),
  },
  {
    id: "international-transfers",
    title: "International Data Transfers",
    body: (
      <p>
        Your information may be processed and stored in countries other than your own. Where required, we rely on
        appropriate safeguards to protect data transferred internationally in accordance with applicable law.
      </p>
    ),
  },
  {
    id: "changes",
    title: "Changes to This Policy",
    body: (
      <p>
        We may update this Privacy Policy from time to time. Material changes will be reflected by an updated
        &quot;Last updated&quot; date above, and we encourage you to review this page periodically.
      </p>
    ),
  },
  {
    id: "contact",
    title: "Contact Information",
    body: (
      <ul className="list-disc space-y-2 pl-5 marker:text-primary">
        <li>
          Email:{" "}
          <a href="mailto:support@verlab.io" className="text-primary hover:underline">
            support@verlab.io
          </a>
        </li>
      </ul>
    ),
  },
];

const HIGHLIGHTS = [
  { icon: Lock, text: "Your data is encrypted and never sold." },
  { icon: Database, text: "Stored securely with vetted infrastructure providers." },
  { icon: UserCheck, text: "You can access, export, or delete your data anytime." },
];

export default function PrivacyPolicyPage() {
  return (
    <LegalPageLayout
      icon={ShieldCheck}
      activeHref="/legal/privacy"
      title="Privacy Policy"
      description="How Verlab collects, uses, and protects your data."
      effectiveDate="July 16, 2026"
      updatedDate="July 16, 2026"
      highlights={HIGHLIGHTS}
      sections={SECTIONS}
    />
  );
}
