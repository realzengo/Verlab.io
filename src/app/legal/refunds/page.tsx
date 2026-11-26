import type { Metadata } from "next";
import Link from "next/link";
import { CalendarCheck, RefreshCw, RotateCcw } from "lucide-react";
import { LegalPageLayout, type LegalSection } from "@/components/legal/LegalPageLayout";
import { LEGAL_LAST_UPDATED } from "@/components/legal/legalDocs";
import { LEGAL_LINK, LEGAL_LIST, LegalSubheading } from "@/components/legal/prose";
import { CANCEL_BUTTON_LABEL, CANCEL_CONFIRM_LABEL } from "@/lib/cancellation";
import { APP_URL, CONTACT_EMAIL, CONTACT_MAILTO, OPERATOR_STATEMENT } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Refund Policy | Verlab",
  description:
    "Full refunds within 14 days of any Verlab payment, how to cancel your subscription at any time, and what happens to your plan and data afterwards.",
};

const Email = () => (
  <a href={CONTACT_MAILTO} className={LEGAL_LINK}>
    {CONTACT_EMAIL}
  </a>
);

const SECTIONS: LegalSection[] = [
  {
    id: "who-we-are",
    title: "Who we are",
    body: (
      <>
        <p>{OPERATOR_STATEMENT}</p>
        <p>
          This policy explains when you can get your money back and how to cancel a Verlab subscription. Questions
          about it go to <Email />.
        </p>
      </>
    ),
  },
  {
    id: "refunds",
    title: "14-day refunds",
    body: (
      <>
        <p>
          You can ask for a full refund within 14 days of any payment you make to Verlab. That covers your first
          subscription payment, every renewal (monthly or yearly), and credit top-ups. The 14 days start on the day
          the payment is taken.
        </p>
        <p>You don&apos;t need to give a reason.</p>
      </>
    ),
  },
  {
    id: "requesting-a-refund",
    title: "How to request a refund",
    body: (
      <>
        <p>
          Email <Email /> and include:
        </p>
        <ul className={LEGAL_LIST}>
          <li>the email address you use to sign in to Verlab, and</li>
          <li>the date of the payment you want refunded.</li>
        </ul>
        <p>
          We reply within 24 hours. Approved refunds are sent back to the payment method you originally paid with,
          through our payment provider. How quickly the money shows up after that depends on your bank or card issuer.
        </p>
      </>
    ),
  },
  {
    id: "credits",
    title: "Credits and refunds",
    body: (
      <ul className={LEGAL_LIST}>
        <li>When a payment is refunded, we may remove the credits that payment added from your balance.</li>
        <li>Unused credits stay in your balance. You can spend them while you have an active plan.</li>
        <li>Credits have no cash value and are never paid out or exchanged for money.</li>
      </ul>
    ),
  },
  {
    id: "fair-use",
    title: "Fair use",
    body: (
      <>
        <p>
          We may refuse a refund where there is clear abuse of this policy. For example:
        </p>
        <ul className={LEGAL_LIST}>
          <li>spending a large part of a payment&apos;s credits and then asking for that payment back, or</li>
          <li>asking for refunds again and again, such as repeatedly subscribing, refunding and subscribing again.</li>
        </ul>
        <p>If we refuse a refund, we&apos;ll tell you why. You can still cancel at any time.</p>
      </>
    ),
  },
  {
    id: "cancelling",
    title: "How to cancel",
    body: (
      <>
        <p>You can cancel at any time. You don&apos;t need to give a reason, and nobody has to approve it.</p>
        <ol className="list-decimal space-y-2 pl-5 marker:text-subtle">
          <li>
            Sign in at{" "}
            <Link href={APP_URL} className={LEGAL_LINK}>
              app.verlab.io
            </Link>
            .
          </li>
          <li>Click your profile picture and name in the top-right corner.</li>
          <li>
            Choose <strong className="text-heading">Settings</strong>.
          </li>
          <li>
            Open the <strong className="text-heading">Subscription</strong> tab.
          </li>
          <li>
            Click <strong className="text-heading">{CANCEL_BUTTON_LABEL}</strong>.
          </li>
          <li>
            Click <strong className="text-heading">{CANCEL_CONFIRM_LABEL}</strong> to confirm.
          </li>
        </ol>
        <p>
          If you can&apos;t sign in, email <Email /> from your account&apos;s email address and we&apos;ll cancel it
          for you.
        </p>
      </>
    ),
  },
  {
    id: "after-cancelling",
    title: "What happens after you cancel",
    body: (
      <ul className={LEGAL_LIST}>
        <li>
          Your plan stays active, with full access, until the end of the period you&apos;ve already paid for (the
          month or the year).
        </li>
        <li>Your subscription won&apos;t renew, and no further payments are taken.</li>
        <li>
          Cancelling doesn&apos;t refund the current period by itself. If you&apos;re within 14 days of the payment
          and want your money back, request a refund as described above.
        </li>
      </ul>
    ),
  },
  {
    id: "your-data",
    title: "Your data after cancelling",
    body: (
      <>
        <p>
          We keep your account and your work after you cancel, so everything is still there if you come back.
        </p>
        <LegalSubheading>Deleting your data</LegalSubheading>
        <p>
          You can delete your account and its data yourself at any time from Settings → Account → Delete account, or
          ask us to do it by emailing <Email />. See our{" "}
          <Link href="/legal/privacy" className={LEGAL_LINK}>
            Privacy Policy
          </Link>{" "}
          for more on how we handle your data.
        </p>
      </>
    ),
  },
  {
    id: "changes",
    title: "Changes to this policy",
    body: (
      <p>
        We may update this policy from time to time. When we do, we change the &quot;Last updated&quot; date at the
        top of this page. Changes apply to payments made after the new version is posted. A refund request is
        handled under the version that was in place when you made the payment.
      </p>
    ),
  },
  {
    id: "governing-law",
    title: "Governing law",
    body: (
      <p>
        This policy is governed by the laws of Morocco. Nothing in it takes away rights you have under the consumer
        protection laws of the country where you live.
      </p>
    ),
  },
  {
    id: "contact",
    title: "Contact",
    body: (
      <p>
        Refunds, cancellations and any question about this policy: <Email />. We reply within 24 hours.
      </p>
    ),
  },
];

const HIGHLIGHTS = [
  { icon: RotateCcw, text: "Full refund within 14 days of any payment" },
  { icon: RefreshCw, text: "Cancel anytime from Settings, no reason needed" },
  { icon: CalendarCheck, text: "Keep full access until the end of your paid period" },
];

export default function RefundPolicyPage() {
  return (
    <LegalPageLayout
      activeHref="/legal/refunds"
      title="Refund Policy"
      description="Refunds, cancellation, and what happens afterwards"
      effectiveDate={LEGAL_LAST_UPDATED}
      updatedDate={LEGAL_LAST_UPDATED}
      highlights={HIGHLIGHTS}
      sections={SECTIONS}
    />
  );
}
