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
    id: "dmca",
    title: "DMCA / Copyright Policy",
    body: (
      <>
        <p>
          Verlab respects the intellectual property rights of others and expects users of the Service to do the
          same. We respond to notices of alleged copyright infringement that comply with the Digital Millennium
          Copyright Act (17 U.S.C. § 512) (&quot;DMCA&quot;).
        </p>

        <p className="font-semibold text-heading">Filing a Takedown Notice</p>
        <p>
          If you believe that content available on or through the Service infringes a copyright you own or control,
          you (or your authorized agent) may submit a written notice to our Designated Agent, below. To be effective
          under the DMCA, your notice must be in writing and include all of the following:
        </p>
        <ul className="list-disc space-y-2 pl-5 marker:text-primary">
          <li>A physical or electronic signature of the copyright owner or a person authorized to act on the owner&apos;s behalf.</li>
          <li>Identification of the copyrighted work claimed to have been infringed, or, if multiple works at a single online location are covered by one notice, a representative list of those works.</li>
          <li>Identification of the material claimed to be infringing and information reasonably sufficient to let us locate it — typically the specific URL(s) or in-app location of the content.</li>
          <li>Your name, mailing address, telephone number, and email address, so we can contact you about the notice.</li>
          <li>A statement that you have a good faith belief that the disputed use is not authorized by the copyright owner, its agent, or the law.</li>
          <li>A statement, made under penalty of perjury, that the information in the notice is accurate and that you are the copyright owner or authorized to act on the owner&apos;s behalf.</li>
        </ul>
        <p>
          Notices that do not substantially comply with these requirements may not receive a response. Under Section
          512(f) of the DMCA, anyone who knowingly and materially misrepresents that content is infringing may be
          liable for damages, including costs and attorneys&apos; fees, incurred by us or the affected user as a
          result of that misrepresentation.
        </p>

        <p className="font-semibold text-heading">Designated Agent</p>
        <p>
          Notices should be sent to our Designated Agent for copyright matters:
        </p>
        <ul className="list-disc space-y-2 pl-5 marker:text-primary">
          <li>Name: [DESIGNATED AGENT NAME]</li>
          <li>Company: Verlab</li>
          <li>Address: [STREET ADDRESS, CITY, STATE, ZIP]</li>
          <li>
            Email:{" "}
            <a href="mailto:dmca@verlab.io" className="text-primary hover:underline">
              dmca@verlab.io
            </a>
          </li>
          <li>Phone: [PHONE NUMBER]</li>
        </ul>
        <p>
          This information is also on file with the U.S. Copyright Office&apos;s Designated Agent Directory. Notices
          sent to any other address or contact may not be processed and do not constitute effective notice under the
          DMCA.
        </p>

        <p className="font-semibold text-heading">Our Response to a Valid Notice</p>
        <p>
          Upon receipt of a notice that substantially complies with the requirements above, we will remove or
          disable access to the identified material, notify the user who posted it, and provide that user with a
          copy of the notice.
        </p>

        <p className="font-semibold text-heading">Counter-Notification</p>
        <p>
          If you believe material you posted was removed or disabled by mistake or misidentification, you may submit
          a written counter-notice to our Designated Agent that includes:
        </p>
        <ul className="list-disc space-y-2 pl-5 marker:text-primary">
          <li>Your physical or electronic signature.</li>
          <li>Identification of the material that was removed or disabled and its location before removal.</li>
          <li>A statement, under penalty of perjury, that you have a good faith belief the material was removed or disabled as a result of mistake or misidentification.</li>
          <li>Your name, address, and telephone number, and a statement that you consent to the jurisdiction of the federal district court for the judicial district in which your address is located (or, if outside the United States, any judicial district in which Verlab may be found), and that you will accept service of process from the person who filed the original notice or their agent.</li>
        </ul>
        <p>
          If we receive a valid counter-notice, we will forward it to the original complaining party. Unless that
          party informs us within 10 business days that they have filed a lawsuit seeking a court order to restrain
          the user from engaging in the infringing activity, we may restore the removed material within 10 to 14
          business days of receiving the counter-notice, at our discretion and as required by the DMCA.
        </p>

        <p className="font-semibold text-heading">Repeat Infringer Policy</p>
        <p>
          In appropriate circumstances and at our sole discretion, Verlab will terminate the accounts of users who
          are determined to be repeat infringers. A user may be treated as a repeat infringer if we receive two or
          more valid, unretracted DMCA takedown notices against content associated with that user&apos;s account, or
          if a court has found the user liable for copyright infringement. We maintain and reasonably enforce this
          policy in accordance with 17 U.S.C. § 512(i), and we may terminate or suspend access at any stage of this
          process where we reasonably believe termination is warranted, independent of the notice count above.
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
    id: "dispute-resolution",
    title: "Dispute Resolution: Binding Arbitration & Class Action Waiver",
    body: (
      <>
        <p className="font-semibold text-heading">Agreement to Arbitrate</p>
        <p>
          You and Verlab agree that any dispute, claim, or controversy arising out of or relating to these Terms, the
          Service, or your relationship with Verlab (whether based in contract, tort, statute, fraud,
          misrepresentation, or any other legal theory, and whether arising before or after you agreed to these
          Terms) will be resolved exclusively through final and binding individual arbitration, rather than in court,
          except that either party may bring an individual claim in small claims court as described below, or seek
          injunctive relief in court for infringement or misuse of intellectual property.
        </p>
        <p>
          This arbitration provision is governed by the Federal Arbitration Act (FAA) and survives termination of
          your account or these Terms.
        </p>

        <p className="font-semibold text-heading">Arbitration Procedures</p>
        <p>
          The arbitration will be administered by the American Arbitration Association (AAA) under its Consumer
          Arbitration Rules, or, if the parties mutually agree, by JAMS under its Streamlined Arbitration Rules and
          Procedures. The applicable rules are available at{" "}
          <span className="whitespace-nowrap">adr.org</span> or <span className="whitespace-nowrap">jams-endispute.com</span>.
          The arbitrator, not any court, has exclusive authority to resolve any dispute over the interpretation,
          applicability, enforceability, or formation of these Terms, including any claim that all or part of this
          arbitration provision is void or voidable — except that the question of whether the Class Action Waiver
          below is enforceable is reserved for a court of competent jurisdiction, not the arbitrator.
        </p>
        <p>
          Arbitration will be conducted in English, before a single arbitrator, and may be conducted by video
          conference, telephone, or based on written submissions where permitted by the applicable rules. The
          arbitrator&apos;s award is final and binding and may be entered as a judgment in any court of competent
          jurisdiction.
        </p>

        <p className="font-semibold text-heading">Class Action, Collective Action & Representative Proceeding Waiver</p>
        <p>
          You and Verlab agree that each may bring claims against the other only in an individual capacity, and not
          as a plaintiff or class member in any purported class, collective, consolidated, or representative
          proceeding. Unless both you and Verlab agree otherwise in writing:
        </p>
        <ul className="list-disc space-y-2 pl-5 marker:text-primary">
          <li>No arbitrator or court may consolidate more than one party&apos;s claims, or otherwise preside over any form of a class, collective, representative, or multi-plaintiff proceeding.</li>
          <li>The arbitrator may award relief (including injunctive and declaratory relief) only in favor of the individual party seeking relief, and only to the extent necessary to provide relief warranted by that party&apos;s individual claim.</li>
          <li>You waive any right to participate as a plaintiff, claimant, or class member in any class, collective, or representative action against Verlab, whether filed in arbitration or in court, and whether brought by you, on your behalf, or by a third party purporting to act on your behalf.</li>
        </ul>
        <p>
          If this Class Action Waiver is found to be unenforceable as to a particular claim or request for relief
          (such as a request for public injunctive relief), that claim or request must be severed and brought in a
          court of competent jurisdiction, and the remainder of this arbitration provision will still apply to all
          other claims and disputes on an individual basis.
        </p>

        <p className="font-semibold text-heading">Jury Trial Waiver</p>
        <p>
          You and Verlab each waive any constitutional and statutory right to sue in court and have a trial in front
          of a judge or jury. You and Verlab are instead electing that all covered claims be resolved exclusively
          through arbitration under this provision, except as expressly provided above. Arbitration procedures are
          typically more limited, more efficient, and less costly than court proceedings, and any arbitration award
          is subject to very limited review by a court.
        </p>

        <p className="font-semibold text-heading">Small Claims Court Exception</p>
        <p>
          Either party may bring an individual claim in small claims court instead of arbitration if the claim
          qualifies for that court&apos;s jurisdiction and remains in that court on an individual, non-class basis.
        </p>

        <p className="font-semibold text-heading">30-Day Right to Opt Out</p>
        <p>
          You may opt out of this arbitration provision and Class Action Waiver by sending written notice to{" "}
          <a href="mailto:support@verlab.io" className="text-primary hover:underline">
            support@verlab.io
          </a>{" "}
          within 30 days of the date you first agree to these Terms. Your notice must include your name, the email
          address associated with your account, and a clear statement that you wish to opt out of arbitration. If
          you opt out, neither you nor Verlab will be required to arbitrate, but all other provisions of these Terms,
          including the Class Action Waiver and Jury Trial Waiver, will remain in effect to the fullest extent
          enforceable by law.
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
      updatedDate="August 17, 2026"
      highlights={HIGHLIGHTS}
      sections={SECTIONS}
    />
  );
}
