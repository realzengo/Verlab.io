import type { Metadata } from "next";
import Link from "next/link";
import { FileText, RefreshCw, ShieldCheck } from "lucide-react";
import { LegalPageLayout, type LegalSection } from "@/components/legal/LegalPageLayout";
import { APP_URL } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Terms of Service — Verlab AI",
  description: "The terms and conditions that govern your use of Verlab's niche research and script-generation tools.",
};

const SECTIONS: LegalSection[] = [
  {
    id: "acceptance",
    title: "Acceptance of Terms",
    body: (
      <>
        <p>
          These Terms of Service (&quot;Terms&quot;) form a binding agreement between you and Verlab (&quot;Verlab,&quot;
          &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) governing your access to and use of verlab.io, the Verlab
          dashboard, and any related tools (together, the &quot;Service&quot;).
        </p>
        <p>
          By creating an account or otherwise using the Service, you agree to these Terms. If you do not agree, do
          not use the Service.
        </p>
      </>
    ),
  },
  {
    id: "the-service",
    title: "Description of the Service",
    body: (
      <>
        <p>
          Verlab helps creators discover trending niches on TikTok, Instagram Reels, and YouTube Shorts, and uses AI to
          reverse-engineer that content into scripts, hooks, and SOPs for the user&apos;s own channel.
        </p>
        <p>
          Features, usage limits, and available plans may change over time and vary by subscription tier as described
          on our{" "}
          <Link href="/pricing" className="text-primary hover:underline">
            Pricing
          </Link>{" "}
          page.
        </p>
      </>
    ),
  },
  {
    id: "accounts",
    title: "Accounts & Eligibility",
    body: (
      <ul className="list-disc space-y-2 pl-5 marker:text-primary">
        <li>You must be at least 16 years old to create a Verlab account.</li>
        <li>You are responsible for the accuracy of the information you provide and for maintaining the security of your login credentials.</li>
        <li>You are responsible for all activity that occurs under your account, whether or not you authorized it.</li>
        <li>We may suspend or terminate accounts that provide false information or violate these Terms.</li>
      </ul>
    ),
  },
  {
    id: "billing",
    title: "Subscriptions & Billing",
    body: (
      <>
        <p className="font-semibold text-heading">4.1 Plans & Payment</p>
        <p>
          Paid plans are billed in advance on a recurring basis (monthly or annually, depending on the plan you
          select) via our third-party payment processor. Prices are shown in USD unless stated otherwise.
        </p>
        <p className="font-semibold text-heading">4.2 Automatic Renewal</p>
        <p>
          Subscriptions renew automatically at the end of each billing cycle unless cancelled beforehand from your{" "}
          <Link href={`${APP_URL}/settings/subscription`} className="text-primary hover:underline">
            subscription settings
          </Link>
          .
        </p>
        <p className="font-semibold text-heading">4.3 Refunds</p>
        <p>
          All payments are non-refundable except where required by law. See our{" "}
          <Link href="/legal/refunds" className="text-primary hover:underline">
            Refund Policy
          </Link>{" "}
          for full details on cancellation and billing.
        </p>
      </>
    ),
  },
  {
    id: "acceptable-use",
    title: "Acceptable Use",
    body: (
      <>
        <p>You agree not to use the Service to:</p>
        <ul className="list-disc space-y-2 pl-5 marker:text-primary">
          <li>Violate any applicable law, or the terms of service of TikTok, Instagram, YouTube, or any other platform you connect or publish to.</li>
          <li>Scrape, resell, or redistribute Verlab&apos;s underlying niche data or datasets outside the Service.</li>
          <li>Reverse engineer, decompile, or attempt to extract the source code of the Service.</li>
          <li>Upload content that is unlawful, infringing, defamatory, or that you do not have the rights to use.</li>
          <li>Interfere with or disrupt the integrity or performance of the Service, including via automated scraping or abuse of API rate limits.</li>
        </ul>
      </>
    ),
  },
  {
    id: "content-ip",
    title: "Content & Intellectual Property",
    body: (
      <>
        <p className="font-semibold text-heading">6.1 Your Content</p>
        <p>
          You retain ownership of any content you submit to Verlab (topics, transcripts, uploads) and of the scripts,
          hooks, and outputs generated for your account. You grant Verlab a limited license to process that content
          solely to operate and improve the Service.
        </p>
        <p className="font-semibold text-heading">6.2 Our Platform</p>
        <p>
          The Service, including its design, software, models, and underlying niche-analysis data, is owned by Verlab
          and protected by intellectual property laws. These Terms do not grant you any rights to our trademarks,
          branding, or proprietary technology beyond what is necessary to use the Service.
        </p>
        <p className="font-semibold text-heading">6.3 AI-Generated Output</p>
        <p>
          Scripts and other outputs are generated with the assistance of AI models and may be inspired by, or
          structurally similar to, publicly available content. You are responsible for reviewing generated output and
          ensuring your own use of it complies with applicable law and third-party rights before you publish it.
        </p>
      </>
    ),
  },
  {
    id: "third-party-platforms",
    title: "Third-Party Platforms",
    body: (
      <p>
        Verlab analyzes publicly available content and metadata from third-party platforms such as TikTok, Instagram,
        and YouTube. We are not affiliated with, endorsed by, or sponsored by any of these platforms, and we do not
        control their availability, terms, or data. Changes to a third-party platform&apos;s API or policies may
        affect the accuracy or availability of related Verlab features without notice.
      </p>
    ),
  },
  {
    id: "termination",
    title: "Termination",
    body: (
      <p>
        You may stop using the Service and cancel your subscription at any time. We may suspend or terminate your
        access to the Service, with or without notice, if we reasonably believe you have violated these Terms, pose a
        risk to the Service or other users, or if required by law.
      </p>
    ),
  },
  {
    id: "disclaimers",
    title: "Disclaimers & Limitation of Liability",
    body: (
      <>
        <p>
          The Service is provided &quot;as is&quot; and &quot;as available,&quot; without warranties of any kind.
          Verlab does not guarantee that any niche, script, or strategy suggested by the Service will result in
          particular views, followers, or revenue.
        </p>
        <p>
          To the fullest extent permitted by law, Verlab will not be liable for any indirect, incidental, or
          consequential damages arising from your use of the Service, and our total liability for any claim will not
          exceed the amount you paid us in the twelve months preceding the claim.
        </p>
      </>
    ),
  },
  {
    id: "changes",
    title: "Changes to These Terms",
    body: (
      <p>
        We may update these Terms from time to time. Material changes will be reflected by an updated &quot;Last
        updated&quot; date above, and continued use of the Service after changes take effect constitutes acceptance
        of the revised Terms.
      </p>
    ),
  },
  {
    id: "governing-law",
    title: "Governing Law",
    body: (
      <p>
        These Terms are governed by and construed in accordance with the laws of the jurisdiction in which Verlab is
        registered, without regard to its conflict of law provisions.
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
  { icon: RefreshCw, text: "Cancel your subscription anytime, no questions asked." },
  { icon: ShieldCheck, text: "You own every script and hook Verlab generates for you." },
  { icon: FileText, text: "You're responsible for how you publish generated content." },
];

export default function TermsOfServicePage() {
  return (
    <LegalPageLayout
      icon={FileText}
      activeHref="/legal/terms"
      title="Terms of Service"
      description="The rules and conditions that govern your use of Verlab."
      effectiveDate="July 16, 2026"
      updatedDate="July 16, 2026"
      highlights={HIGHLIGHTS}
      sections={SECTIONS}
    />
  );
}
