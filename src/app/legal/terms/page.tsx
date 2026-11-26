import type { Metadata } from "next";
import Link from "next/link";
import { Ban, CreditCard, ShieldCheck } from "lucide-react";
import { LegalPageLayout, type LegalSection } from "@/components/legal/LegalPageLayout";
import { LEGAL_LAST_UPDATED } from "@/components/legal/legalDocs";
import { LEGAL_LINK, LEGAL_LIST, LegalSubheading } from "@/components/legal/prose";
import { APP_URL, CONTACT_EMAIL, CONTACT_MAILTO, OPERATOR_NAME, OPERATOR_STATEMENT } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Terms of Service | Verlab",
  description:
    "The terms for using Verlab's AI tools: who runs Verlab, paid plans and credits, acceptable use, your content, copyright complaints and Moroccan governing law.",
};

const Email = () => (
  <a href={CONTACT_MAILTO} className={LEGAL_LINK}>
    {CONTACT_EMAIL}
  </a>
);

const RefundPolicyLink = () => (
  <Link href="/legal/refunds" className={LEGAL_LINK}>
    Refund Policy
  </Link>
);

const SECTIONS: LegalSection[] = [
  {
    id: "who-we-are",
    title: "Who we are",
    body: (
      <p>
        {OPERATOR_STATEMENT} Contact: <Email />. In these Terms, &quot;Verlab&quot;, &quot;we&quot;, &quot;us&quot;
        and &quot;our&quot; mean {OPERATOR_NAME}, operating Verlab.
      </p>
    ),
  },
  {
    id: "agreement",
    title: "Agreeing to these Terms",
    body: (
      <>
        <p>
          These Terms apply to verlab.io, app.verlab.io, the Verlab MCP connector and everything else we offer under
          the Verlab name (together, &quot;the Service&quot;). By creating an account or using the Service, you agree
          to them. If you don&apos;t agree, please don&apos;t use the Service.
        </p>
        <p>
          Our{" "}
          <Link href="/legal/privacy" className={LEGAL_LINK}>
            Privacy Policy
          </Link>{" "}
          and <RefundPolicyLink /> are part of these Terms.
        </p>
      </>
    ),
  },
  {
    id: "the-service",
    title: "What Verlab does",
    body: (
      <>
        <p>Verlab is a set of AI tools for short-form video creators, including:</p>
        <ul className={LEGAL_LIST}>
          <li>AI clipping, which turns a long video into short vertical clips with captions;</li>
          <li>niche research: Niche Finder, Niche Bend, SOP playbooks and creator &amp; channel analysis;</li>
          <li>transcripts of TikTok, Instagram Reels and YouTube videos;</li>
          <li>an AI script writer;</li>
          <li>AI image and video generation;</li>
          <li>AI voiceovers and voice cloning; and</li>
          <li>the Verlab MCP connector, which lets assistants such as Claude and ChatGPT use these tools for you.</li>
        </ul>
        <p>
          Which tools each plan includes is shown on our{" "}
          <Link href="/pricing" className={LEGAL_LINK}>
            Pricing
          </Link>{" "}
          page. Tools and AI models change over time: we may add, change or retire them.
        </p>
      </>
    ),
  },
  {
    id: "accounts",
    title: "Your account",
    body: (
      <ul className={LEGAL_LIST}>
        <li>You must be at least 16 years old to use Verlab.</li>
        <li>Give accurate details, confirm your email address, and keep your login secure.</li>
        <li>An account is for one person. Don&apos;t share it or sell access to it.</li>
        <li>You are responsible for everything done through your account, including through tools you connect to it.</li>
      </ul>
    ),
  },
  {
    id: "plans-and-billing",
    title: "Plans, billing and renewal",
    body: (
      <>
        <ul className={LEGAL_LIST}>
          <li>Verlab is a paid service. There is no free plan, and every tool needs an active paid plan.</li>
          <li>
            Plans are billed in advance, monthly or yearly, and renew automatically at the end of each period until
            you cancel.
          </li>
          <li>
            Prices are the ones shown on our{" "}
            <Link href="/pricing" className={LEGAL_LINK}>
              Pricing
            </Link>{" "}
            page when you pay, in US dollars. Taxes may be added depending on the country you live in.
          </li>
          <li>Payments are processed by our payment provider. We never see or store your full card number.</li>
          <li>If we change the price of your plan, we&apos;ll tell you before the new price applies to a renewal.</li>
        </ul>
        <p>
          You can cancel at any time, and you can get a refund within 14 days of any payment. Both are explained in
          our <RefundPolicyLink />.
        </p>
      </>
    ),
  },
  {
    id: "credits",
    title: "Credits",
    body: (
      <ul className={LEGAL_LIST}>
        <li>
          Credits are how Verlab&apos;s AI tools are paid for. Each job uses credits from your balance, and different
          tools and settings use different amounts.
        </li>
        <li>
          Your plan adds credits each billing period. A yearly plan adds the whole year&apos;s credits at the start of
          the year. You can also buy extra credits as a top-up.
        </li>
        <li>Unused credits stay in your balance. You can spend them while you have an active plan.</li>
        <li>
          Credits have no cash value. They can&apos;t be exchanged for money, transferred to another account or sold.
        </li>
        <li>
          If a job fails, you don&apos;t pay for it: most tools only take credits once the result is ready, and the
          rest give the credits back automatically.
        </li>
      </ul>
    ),
  },
  {
    id: "acceptable-use",
    title: "Acceptable use",
    body: (
      <>
        <p>You agree not to use Verlab to create, upload or share:</p>
        <ul className={LEGAL_LIST}>
          <li>anything illegal;</li>
          <li>any sexual content involving minors, of any kind;</li>
          <li>intimate or sexual content of a real person without their consent;</li>
          <li>harassment, threats or bullying;</li>
          <li>hate speech, or content that promotes violent extremism or terrorism.</li>
        </ul>

        <LegalSubheading>Real people, likenesses and voices</LegalSubheading>
        <ul className={LEGAL_LIST}>
          <li>No deepfakes, face swaps or impersonation of real people.</li>
          <li>
            Don&apos;t create content that uses a real person&apos;s face, likeness or voice without their explicit
            consent.
          </li>
          <li>
            Voice cloning is only for your own voice, or a voice you have explicit written permission to use.
          </li>
          <li>Don&apos;t use anything made with Verlab to deceive, scam or defraud anyone.</li>
        </ul>

        <LegalSubheading>Content you submit</LegalSubheading>
        <ul className={LEGAL_LIST}>
          <li>
            Only submit videos, links, audio, images and text that you own or have the rights to use.
          </li>
          <li>
            Respect copyright, and the terms of the platforms your content comes from (such as YouTube, TikTok and
            Instagram).
          </li>
        </ul>

        <LegalSubheading>Platforms and audiences</LegalSubheading>
        <ul className={LEGAL_LIST}>
          <li>No spam, fake engagement, or fake accounts.</li>
          <li>Don&apos;t present AI-generated content as real news or as a real event.</li>
        </ul>

        <LegalSubheading>The Service itself</LegalSubheading>
        <ul className={LEGAL_LIST}>
          <li>Don&apos;t try to break, overload, scrape or get around the limits of the Service.</li>
          <li>Don&apos;t copy, resell or redistribute Verlab&apos;s data, or reverse engineer its software.</li>
        </ul>

        <p>
          We may remove content, stop a job, or suspend or close an account that breaks these rules. Where the law
          requires it, we may also report illegal content to the authorities.
        </p>
      </>
    ),
  },
  {
    id: "your-content",
    title: "Your content and AI output",
    body: (
      <>
        <LegalSubheading>What you submit</LegalSubheading>
        <p>
          You keep ownership of what you submit. You let us store and process it, and send it to the AI providers that
          power our tools, only so we can produce the results you ask for and run the Service. The{" "}
          <Link href="/legal/privacy" className={LEGAL_LINK}>
            Privacy Policy
          </Link>{" "}
          explains this in detail.
        </p>
        <LegalSubheading>What you create</LegalSubheading>
        <p>
          You can use, publish and monetize the scripts, images, videos, voiceovers and clips you make with Verlab,
          subject to other people&apos;s rights and to these Terms. AI output can be wrong, can look like existing
          work, or can be similar to what other users get. Check it before you publish it. You are responsible for
          how you use it.
        </p>
      </>
    ),
  },
  {
    id: "our-service",
    title: "Our service and brand",
    body: (
      <p>
        Verlab&apos;s software, design, data and brand belong to us and are protected by intellectual property laws.
        These Terms don&apos;t give you any right to them beyond using the Service as intended.
      </p>
    ),
  },
  {
    id: "copyright",
    title: "Copyright complaints",
    body: (
      <>
        <p>
          If you believe something on Verlab infringes your copyright, send a notice (including a DMCA notice) to{" "}
          {OPERATOR_NAME} at <Email />. Please include:
        </p>
        <ul className={LEGAL_LIST}>
          <li>your full name and how to contact you;</li>
          <li>the work you believe is being infringed;</li>
          <li>the material you want removed, with a link or enough detail for us to find it;</li>
          <li>a statement that you believe in good faith the use isn&apos;t authorized by you, your agent or the law;</li>
          <li>
            a statement that the information in your notice is accurate and that you own the copyright or are allowed
            to act for the owner; and
          </li>
          <li>your signature (a typed full name is fine).</li>
        </ul>
        <p>
          When we receive a complete notice, we remove or disable the material and tell the user who posted it. If
          you think your material was removed by mistake, reply to us at the same address and explain why. We may
          then restore it, unless the person who complained tells us they&apos;ve taken legal action. We close the
          accounts of people who repeatedly infringe copyright.
        </p>
      </>
    ),
  },
  {
    id: "third-party-platforms",
    title: "Other platforms",
    body: (
      <p>
        Some tools work with public content and data from platforms such as TikTok, Instagram and YouTube. Verlab
        isn&apos;t affiliated with, endorsed by or sponsored by any of them. Changes they make to their services can
        affect our tools without notice.
      </p>
    ),
  },
  {
    id: "ending",
    title: "Suspension and closing your account",
    body: (
      <p>
        You can stop using Verlab and cancel at any time, and you can delete your account from Settings. We may
        suspend or close your account if you break these Terms, if your use puts the Service or other people at
        risk, or if the law requires it. Where it&apos;s reasonable to do so, we&apos;ll tell you first and explain
        why.
      </p>
    ),
  },
  {
    id: "disclaimers",
    title: "Disclaimers and liability",
    body: (
      <>
        <p>
          We work hard to keep Verlab running well, but the Service is provided &quot;as is&quot;. We don&apos;t
          promise it will always be available or error-free, or that any niche, script or video will reach a certain
          number of views, followers or earnings.
        </p>
        <p>
          As far as the law allows, we aren&apos;t liable for indirect or consequential losses, such as lost profits,
          lost revenue or lost data, and our total liability for any claim is limited to what you paid us in the 12
          months before the claim. Nothing in these Terms limits any liability that can&apos;t be limited by law.
        </p>
      </>
    ),
  },
  {
    id: "governing-law",
    title: "Governing law and disputes",
    body: (
      <>
        <p>
          These Terms are governed by the laws of Morocco. If you have a problem, please email us first at <Email />
          {" "}and we&apos;ll try to sort it out with you directly.
        </p>
        <p>
          If a dispute can&apos;t be resolved that way, it will be handled by the competent courts of Morocco. If you
          use Verlab as a consumer, you keep any mandatory consumer protection rights given to you by the laws of the
          country where you live, including any right to bring a claim in your local courts.
        </p>
      </>
    ),
  },
  {
    id: "changes",
    title: "Changes to these Terms",
    body: (
      <p>
        We may update these Terms from time to time. When we do, we change the &quot;Last updated&quot; date at the top
        of this page, and for important changes we&apos;ll also let you know in the app or by email. If you keep using
        Verlab after a change takes effect, the new Terms apply.
      </p>
    ),
  },
  {
    id: "contact",
    title: "Contact",
    body: (
      <p>
        Questions about these Terms, copyright notices and everything else: <Email />. You can also manage your plan
        any time from your{" "}
        <Link href={`${APP_URL}/settings/subscription`} className={LEGAL_LINK}>
          subscription settings
        </Link>
        .
      </p>
    ),
  },
];

const HIGHLIGHTS = [
  { icon: CreditCard, text: "Paid plans only. Cancel anytime, 14-day refunds" },
  { icon: ShieldCheck, text: "You own what you make. Only submit content you have the rights to" },
  { icon: Ban, text: "No deepfakes, impersonation, or cloning someone else's voice" },
];

export default function TermsOfServicePage() {
  return (
    <LegalPageLayout
      activeHref="/legal/terms"
      title="Terms of Service"
      description="The rules for using Verlab, in plain language"
      effectiveDate={LEGAL_LAST_UPDATED}
      updatedDate={LEGAL_LAST_UPDATED}
      highlights={HIGHLIGHTS}
      sections={SECTIONS}
    />
  );
}
