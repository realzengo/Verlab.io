import type { Metadata } from "next";
import Link from "next/link";
import { CreditCard, RefreshCw, XCircle } from "lucide-react";
import { LegalPageLayout, type LegalSection } from "@/components/legal/LegalPageLayout";
import { APP_URL } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Refund Policy, Verlab AI",
  description: "Verlab's refund and cancellation policy: how billing works, how to cancel, and what happens to your data.",
};

const SECTIONS: LegalSection[] = [
  {
    id: "no-refunds",
    title: "No Refunds",
    body: (
      <>
        <ul className="list-disc space-y-2 pl-5 marker:text-primary">
          <li>All sales are final. We do not offer refunds for any subscription, credits, or add-on once a payment has been successfully processed.</li>
          <li>By subscribing to Verlab, you acknowledge and agree that you have read, understood, and accepted this no-refund policy.</li>
          <li>No exceptions are made to this policy, including for unused credits, partial-month usage, accidental purchases, or a change of mind.</li>
        </ul>
        <p>
          We encourage you to use the free tier or review our{" "}
          <Link href="/pricing" className="text-primary hover:underline">
            plan details
          </Link>{" "}
          carefully before upgrading, since every plan is billed in advance and is non-refundable.
        </p>
      </>
    ),
  },
  {
    id: "cancellation-policy",
    title: "Cancellation Policy",
    body: (
      <>
        <p className="font-semibold text-heading">2.1 Eligibility</p>
        <p>All subscribers may cancel at any time, for any reason, with no approval required from Verlab.</p>

        <p className="font-semibold text-heading">2.2 Cancellation Process</p>
        <p>To cancel your subscription:</p>
        <ul className="list-disc space-y-2 pl-5 marker:text-primary">
          <li>
            Go to{" "}
            <Link href={`${APP_URL}/settings/subscription`} className="text-primary hover:underline">
              app.verlab.io/settings/subscription
            </Link>
          </li>
          <li>Open the <strong className="text-heading">Subscription</strong> tab in your account settings</li>
          <li>Press <strong className="text-heading">&quot;Cancel subscription&quot;</strong></li>
          <li>Confirm the cancellation when prompted</li>
        </ul>

        <p className="font-semibold text-heading">2.3 Service Continuation</p>
        <p>
          Once cancelled, your plan remains active until the end of your current billing cycle. You will keep full
          access to your plan&apos;s features until that date.
        </p>

        <p className="font-semibold text-heading">2.4 No Additional Charges</p>
        <p>No further payments will be collected once your cancellation has been processed.</p>

        <p className="font-semibold text-heading">2.5 Data Retention</p>
        <p>
          We generally retain your account data in case you choose to reactivate. Verlab reserves the right to delete
          data associated with a cancelled account after a reasonable retention period. If you would like your data
          removed sooner, contact us using the details below and we will act in accordance with applicable privacy
          laws and our{" "}
          <Link href="/legal/privacy" className="text-primary hover:underline">
            Privacy Policy
          </Link>
          .
        </p>
      </>
    ),
  },
  {
    id: "contact",
    title: "Contact Information",
    body: (
      <>
        <p>For any questions or concerns regarding this Refund Policy, please contact us:</p>
        <ul className="list-disc space-y-2 pl-5 marker:text-primary">
          <li>
            Email:{" "}
            <a href="mailto:support@verlab.io" className="text-primary hover:underline">
              support@verlab.io
            </a>
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "amendments",
    title: "Amendments",
    body: (
      <ul className="list-disc space-y-2 pl-5 marker:text-primary">
        <li>Verlab reserves the right to modify this Policy at any time, effective upon posting of an updated version on our website.</li>
        <li>You are responsible for periodically reviewing this Policy. The &quot;Last updated&quot; date above indicates when it was last revised.</li>
      </ul>
    ),
  },
  {
    id: "governing-law",
    title: "Governing Law",
    body: (
      <p>
        This Policy is governed by and construed in accordance with the laws of the jurisdiction in which Verlab is
        registered, without regard to its conflict of law provisions.
      </p>
    ),
  },
];

const HIGHLIGHTS = [
  { icon: XCircle, text: "All sales are final. No exceptions." },
  { icon: RefreshCw, text: "Cancel anytime, no questions asked." },
  { icon: CreditCard, text: "No further charges once you've cancelled." },
];

export default function RefundPolicyPage() {
  return (
    <LegalPageLayout
      icon={RefreshCw}
      activeHref="/legal/refunds"
      title="Refund Policy"
      description="Billing, cancellation, and our no-refund policy, explained plainly."
      effectiveDate="July 16, 2026"
      updatedDate="July 16, 2026"
      highlights={HIGHLIGHTS}
      sections={SECTIONS}
    />
  );
}
