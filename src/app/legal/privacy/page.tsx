import type { Metadata } from "next";
import Link from "next/link";
import { Database, Lock, UserCheck } from "lucide-react";
import { LegalPageLayout, type LegalSection } from "@/components/legal/LegalPageLayout";
import { LEGAL_LAST_UPDATED } from "@/components/legal/legalDocs";
import { LEGAL_LINK, LEGAL_LIST, LegalSubheading } from "@/components/legal/prose";
import { APP_URL, CONTACT_EMAIL, CONTACT_MAILTO, OPERATOR_COUNTRY, OPERATOR_NAME } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Privacy Policy | Verlab",
  description:
    "What personal data Verlab collects, how your content is processed by AI providers, the service providers we use, and how to access or delete your data.",
};

const Email = () => (
  <a href={CONTACT_MAILTO} className={LEGAL_LINK}>
    {CONTACT_EMAIL}
  </a>
);

// Every provider here is one the code actually calls (see the Step 0 audit
// of 2026-11-26). Add a row when a new provider is wired in, remove it when
// one is taken out.
const SERVICE_PROVIDERS: { name: string; purpose: string }[] = [
  { name: "Supabase", purpose: "Sign-in, our database and file storage." },
  { name: "Vercel", purpose: "Hosting the website, the app and our scheduled jobs." },
  { name: "Railway", purpose: "Servers that render your clips." },
  { name: "Our payment provider", purpose: "Checkout, subscriptions and payments, plus a conversion-tracking pixel on our website." },
  { name: "PostHog", purpose: "Product analytics and error reports." },
  { name: "Resend", purpose: "Sending billing emails, such as a notice that a payment failed." },
  { name: "Anthropic", purpose: "AI writing, such as scripts and creator analysis." },
  { name: "OpenRouter", purpose: "Access to AI language models for niche research, analysis and prompt suggestions." },
  { name: "Replicate", purpose: "AI video models, voice cloning (with MiniMax models) and speech-to-text for clipping." },
  { name: "fal", purpose: "AI image and video models, and AI voiceovers." },
  { name: "ElevenLabs", purpose: "Searching the voice library used for voiceovers." },
  { name: "Cloudflare", purpose: "AI image generation, and Turnstile bot checks when you sign up, sign in or check out." },
  { name: "ScrapeCreators, SociaVault and Apify", purpose: "Public video, transcript and channel data from TikTok, Instagram and YouTube." },
  { name: "Google (YouTube Data API)", purpose: "Public information about YouTube videos and channels." },
  { name: "video-download-api.com", purpose: "Fetching the YouTube video you link to, so AI clipping can cut and caption it." },
  { name: "Google (MediaPipe)", purpose: "Face-tracking models that run inside your browser. Your video is not sent to Google." },
];

const SECTIONS: LegalSection[] = [
  {
    id: "who-we-are",
    title: "Who is responsible for your data",
    body: (
      <>
        <p>
          The data controller is {OPERATOR_NAME}, operating Verlab (verlab.io), an individual based in{" "}
          {OPERATOR_COUNTRY}. Contact: <Email />.
        </p>
        <p>
          We handle personal data in line with Moroccan Law No. 09-08 on the protection of individuals with regard to
          the processing of personal data, and with the other privacy laws that apply to our users, such as the
          General Data Protection Regulation (GDPR) for users in the European Union.
        </p>
      </>
    ),
  },
  {
    id: "what-we-collect",
    title: "What we collect",
    body: (
      <>
        <LegalSubheading>Account details</LegalSubheading>
        <p>
          Your email address and password (stored only in hashed form by our sign-in provider). If you sign in with
          Google, we also receive your name and profile picture from Google.
        </p>
        <LegalSubheading>Billing details</LegalSubheading>
        <p>
          Your plan, billing period, payment history and credit balance. Card details are collected and processed by
          our payment provider. We never see or store your full card number.
        </p>
        <LegalSubheading>Content you submit</LegalSubheading>
        <p>
          The links, videos, images, audio, voice samples, prompts, scripts and other text you give our tools, and
          the results they produce for you.
        </p>
        <LegalSubheading>Usage and device data</LegalSubheading>
        <p>
          Your IP address, browser and device type, the pages and features you use, and error reports. Most of this
          is collected automatically when you use Verlab.
        </p>
      </>
    ),
  },
  {
    id: "how-we-use-it",
    title: "How we use it",
    body: (
      <>
        <ul className={LEGAL_LIST}>
          <li>To run the tools you use and show you your results and history.</li>
          <li>To process payments and manage your plan and credits.</li>
          <li>To send account, billing and service messages.</li>
          <li>To keep Verlab secure and prevent fraud and abuse, including checks when you sign up or pay.</li>
          <li>To understand how Verlab is used and fix problems.</li>
          <li>To meet our legal obligations.</li>
        </ul>
        <p>
          Where the GDPR applies, we rely on these legal bases: performing our contract with you (running the
          Service), our legitimate interests (security, fraud prevention and improving Verlab), your consent where we
          ask for it, and legal obligations.
        </p>
        <p>We don&apos;t sell your personal data.</p>
      </>
    ),
  },
  {
    id: "ai-processing",
    title: "How AI tools process your content",
    body: (
      <>
        <p>
          When you run a tool, the content that job needs (for example a prompt, an uploaded image or clip, audio, a
          transcript or a video link) is sent to the AI provider that powers that tool, so it can produce the result
          you asked for. The result is sent back to Verlab and saved in your account. Each provider handles that data
          under its own terms, only to deliver the result.
        </p>
        <p>
          For AI clipping, we fetch the YouTube video you link to, keep the cut sections in private storage while you
          edit, and delete them after 7 days. Only submit videos you own or have permission to use.
        </p>
      </>
    ),
  },
  {
    id: "voice-samples",
    title: "Voice samples and cloned voices",
    body: (
      <>
        <p>
          A voice sample you record or upload is used only to create your cloned voice. The sample file is deleted
          from our storage as soon as the cloning attempt finishes, whether it worked or not.
        </p>
        <p>
          To delete a cloned voice, open the voice library in the AI Voiceover tool, go to the{" "}
          <strong className="text-heading">Cloned</strong> tab and choose <strong className="text-heading">Delete</strong>.
          That removes the voice from your account and deletes our record and preview of it, so it can&apos;t be used
          again through Verlab. Our voice-cloning provider doesn&apos;t currently offer a way to delete the voice model
          on its side. Once you delete it in Verlab, that model is no longer linked to your account and nobody can
          use it through Verlab. You can also ask us to delete your voice data at <Email />.
        </p>
      </>
    ),
  },
  {
    id: "service-providers",
    title: "Service providers",
    body: (
      <>
        <p>We share data with these providers only so they can do their job for Verlab:</p>
        <ul className={LEGAL_LIST}>
          {SERVICE_PROVIDERS.map((provider) => (
            <li key={provider.name}>
              <strong className="text-heading">{provider.name}</strong>: {provider.purpose}
            </li>
          ))}
        </ul>
        <p>
          We may also share data when the law requires it, to protect the rights and safety of our users or of
          Verlab, or as part of a sale or transfer of the Service.
        </p>
      </>
    ),
  },
  {
    id: "international-transfers",
    title: "International transfers",
    body: (
      <p>
        Our providers process data in several countries, including outside Morocco and the European Union. When data
        leaves the country you live in, we rely on the safeguards the applicable law requires, such as standard
        contractual clauses where the GDPR applies.
      </p>
    ),
  },
  {
    id: "retention",
    title: "How long we keep data",
    body: (
      <ul className={LEGAL_LIST}>
        <li>Your account and your work are kept while your account exists, including after you cancel, in case you come back.</li>
        <li>Clip source sections are deleted 7 days after they&apos;re made. Voice samples are deleted right after cloning.</li>
        <li>
          When you delete your account, we delete its data, except anything we must keep by law (such as payment
          records).
        </li>
      </ul>
    ),
  },
  {
    id: "your-rights",
    title: "Your rights",
    body: (
      <>
        <p>You can ask us to:</p>
        <ul className={LEGAL_LIST}>
          <li>give you a copy of the personal data we hold about you;</li>
          <li>correct it if it&apos;s wrong;</li>
          <li>delete it;</li>
          <li>send it to you in a portable format;</li>
          <li>stop or limit certain uses of it; or</li>
          <li>withdraw a consent you gave us.</li>
        </ul>
        <p>
          Email <Email /> and we&apos;ll reply within 24 hours. You can also change your details from your{" "}
          <Link href={`${APP_URL}/settings`} className={LEGAL_LINK}>
            account settings
          </Link>{" "}
          and delete your account yourself from Settings → Account → Delete account.
        </p>
        <p>
          You also have the right to complain to a data protection authority: in Morocco, the CNDP (Commission
          Nationale de contrôle de la protection des Données à caractère Personnel), or, in the European Union, the
          authority in your country.
        </p>
      </>
    ),
  },
  {
    id: "security",
    title: "Security",
    body: (
      <p>
        We protect your data with encryption in transit, access controls, private storage with short-lived links, and
        hashed passwords. No system is perfectly secure, so we can&apos;t guarantee absolute security, but we&apos;ll
        tell you without undue delay if a breach affects your data.
      </p>
    ),
  },
  {
    id: "cookies",
    title: "Cookies",
    body: (
      <ul className={LEGAL_LIST}>
        <li>Necessary cookies keep you signed in and remember settings such as light or dark mode.</li>
        <li>Analytics (PostHog) helps us understand how Verlab is used.</li>
        <li>Our payment provider&apos;s pixel measures whether a visit leads to a purchase.</li>
      </ul>
    ),
  },
  {
    id: "children",
    title: "Children",
    body: (
      <p>
        Verlab is not for anyone under 16, and we don&apos;t knowingly collect data from them. If you believe a child
        has given us personal data, email <Email /> and we&apos;ll delete it.
      </p>
    ),
  },
  {
    id: "changes",
    title: "Changes to this policy",
    body: (
      <p>
        We may update this policy from time to time. When we do, we change the &quot;Last updated&quot; date at the
        top of this page, and for important changes we&apos;ll also let you know in the app or by email.
      </p>
    ),
  },
  {
    id: "contact",
    title: "Contact",
    body: (
      <p>
        For any privacy question or request: <Email />. We reply within 24 hours.
      </p>
    ),
  },
];

const HIGHLIGHTS = [
  { icon: Lock, text: "We never sell your personal data" },
  { icon: Database, text: "Your content goes to AI providers only to make your results" },
  { icon: UserCheck, text: "Access, export or delete your data at any time" },
];

export default function PrivacyPolicyPage() {
  return (
    <LegalPageLayout
      activeHref="/legal/privacy"
      title="Privacy Policy"
      description="What we collect, how it's used, and your rights"
      effectiveDate={LEGAL_LAST_UPDATED}
      updatedDate={LEGAL_LAST_UPDATED}
      highlights={HIGHLIGHTS}
      sections={SECTIONS}
    />
  );
}
