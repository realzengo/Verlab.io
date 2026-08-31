"use client";

import { useState, type FormEvent } from "react";
import {
  ArrowRight,
  BarChart3,
  Check,
  Clock,
  Percent,
  Share2,
  Sparkles,
  TrendingUp,
  UserPlus,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Accordion } from "@/components/ui/Accordion";
import { EMAIL_MAX } from "@/lib/validation";

const STAT_CHIPS = [
  { label: "30% Recurring Commissions", icon: Percent },
  { label: "90-Day Cookie Window", icon: Clock },
  { label: "$50 Minimum Payout", icon: Wallet },
];

const STEPS = [
  {
    title: "Apply",
    description: "Tell us where you'll share Verlab. Applications are reviewed within a day.",
    icon: UserPlus,
  },
  {
    title: "Share your link",
    description: "Drop your unique referral link in videos, bios, or posts.",
    icon: Share2,
  },
  {
    title: "Earn every month",
    description: "Get 30% of every payment your referrals make, for as long as they stay subscribed.",
    icon: Wallet,
  },
];

const BENEFITS = [
  {
    title: "Recurring, not one-time",
    description: "Commissions renew every billing cycle your referral stays subscribed, not a single flat bounty.",
    icon: TrendingUp,
  },
  {
    title: "Real-time dashboard",
    description: "Track clicks, signups, and earnings live from your own affiliate dashboard.",
    icon: BarChart3,
  },
  {
    title: "90-day cookie window",
    description: "Get credit for referrals even if they subscribe weeks after clicking your link.",
    icon: Clock,
  },
  {
    title: "Fast, reliable payouts",
    description: "Automatic monthly payouts once your unpaid balance clears the $50 minimum.",
    icon: Wallet,
  },
];

const FAQ_ITEMS = [
  {
    id: "affiliate-earn",
    trigger: "How much can I earn?",
    content:
      "30% recurring commission on every paid plan your referral stays on, with no cap on how many creators you refer.",
  },
  {
    id: "affiliate-payout",
    trigger: "When do I get paid?",
    content: "Payouts run monthly once your unpaid balance passes the $50 minimum.",
  },
  {
    id: "affiliate-cookie",
    trigger: "How long does the cookie last?",
    content: "90 days. If someone clicks your link and subscribes within 90 days, you get the credit.",
  },
  {
    id: "affiliate-who",
    trigger: "Who can apply?",
    content: "Any creator or educator with an audience relevant to faceless content, video editing, or social growth.",
  },
  {
    id: "affiliate-cost",
    trigger: "Is there a cost to join?",
    content: "No, joining the Verlab affiliate program is completely free.",
  },
];

function WaitlistForm() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!email) return;

    setSubmitting(true);
    setError(null);

    const res = await fetch("/api/affiliates/waitlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    setSubmitting(false);

    if (!res.ok) {
      setError("Something went wrong. Try again.");
      return;
    }

    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="mx-auto flex max-w-md items-center justify-center gap-2 rounded-full border border-hairline bg-surface px-5 py-3.5 text-sm font-semibold text-heading shadow-card">
        <Check className="h-4 w-4 shrink-0 text-primary" />
        You&rsquo;re on the list. We&rsquo;ll be in touch.
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto flex max-w-md flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          type="email"
          required
          maxLength={EMAIL_MAX}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Enter your email address"
          className="flex-1 appearance-none rounded-full border border-hairline bg-surface px-5 py-3 text-sm text-heading placeholder-subtle shadow-card focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <Button type="submit" icon={ArrowRight} iconPosition="right" size="lg" disabled={submitting} className="shrink-0">
          {submitting ? "Joining…" : "Join Waitlist"}
        </Button>
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
    </form>
  );
}

export function AffiliatePage() {
  return (
    <>
      <section
        id="waitlist"
        className="relative isolate mx-auto flex max-w-6xl flex-col items-center px-4 pb-10 pt-28 text-center sm:px-6 lg:px-8 md:pt-40"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute left-0 top-1/2 -z-10 h-64 w-1/2 -translate-x-1/4 -translate-y-1/2 rounded-full bg-blue-100/40 opacity-30 blur-3xl md:h-80 md:w-80"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute right-0 top-1/2 -z-10 h-64 w-1/2 translate-x-1/4 -translate-y-1/2 rounded-full bg-blue-100/40 opacity-30 blur-3xl md:h-80 md:w-80"
        />

        <span className="mb-6 inline-flex items-center gap-1.5 rounded-full border border-hairline bg-surface px-3 py-1.5 text-xs font-semibold text-primary shadow-card md:mb-8">
          <Sparkles className="h-3.5 w-3.5" />
          Verlab Partners, applications open
        </span>

        <h1 className="max-w-4xl font-display text-[28px] font-bold leading-[1.1] tracking-[-1px] text-heading sm:text-[60px] sm:leading-[1.05] sm:tracking-[-1.5px] lg:text-[76px]">
          Earn{" "}
          <span className="inline-block -rotate-[1.2deg] rounded-lg bg-primary px-3.5 py-0.5 leading-[1.05] text-white sm:rounded-2xl">
            30% Recurring
          </span>
          <br />
          for Every Referral
        </h1>

        <p className="mt-6 max-w-xl text-sm leading-relaxed text-body sm:text-base">
          Join the Verlab affiliate program and get paid every month your referrals stay subscribed, no cap, no
          complicated tiers.
        </p>

        <div className="mt-8 w-full">
          <WaitlistForm />
        </div>

        <div className="mt-7 flex w-full -mx-4 snap-x snap-mandatory gap-1.5 overflow-x-auto px-4 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] sm:mx-0 sm:w-auto sm:flex-wrap sm:items-center sm:justify-center sm:gap-2 sm:overflow-visible sm:px-0 sm:pb-0 [&::-webkit-scrollbar]:hidden">
          {STAT_CHIPS.map(({ label, icon: Icon }) => (
            <span
              key={label}
              className="inline-flex shrink-0 snap-start items-center gap-1.5 rounded-full border border-hairline bg-surface px-3 py-1.5 text-xs font-semibold text-heading shadow-card first:ml-auto last:mr-auto sm:first:ml-0 sm:last:mr-0"
            >
              <Icon className="h-3.5 w-3.5 shrink-0 text-primary" />
              {label}
            </span>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-[90px] lg:px-8">
        <div className="mx-auto max-w-xl text-center">
          <span className="text-[13px] font-bold uppercase tracking-[1.4px] text-primary">How it works</span>
          <h2 className="mt-3.5 font-display text-[28px] font-bold leading-[1.1] tracking-[-1px] text-slate sm:text-[45px]">
            Three steps to your first payout
          </h2>
          <p className="mt-3 text-base text-body sm:mt-3.5 sm:text-[17px]">
            No minimums to apply, no gatekeeping. Just share and earn.
          </p>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-4 sm:mt-12 sm:grid-cols-3 sm:gap-5">
          {STEPS.map((step, i) => (
            <div key={step.title} className="rounded-card border border-hairline bg-surface p-4 shadow-card sm:p-[22px]">
              <div className="mb-4 flex h-[90px] items-center justify-center rounded-2xl border border-accent-line bg-accent sm:mb-[18px] sm:h-[110px]">
                <step.icon className="h-9 w-9 text-primary" strokeWidth={1.8} />
              </div>
              <div className="inline-flex items-center gap-2 text-[15px] font-bold text-heading">
                <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-primary text-[12px] font-bold text-white">
                  {i + 1}
                </span>
                {step.title}
              </div>
              <p className="mt-2 text-sm leading-[1.55] text-subtle">{step.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-[90px] lg:px-8">
        <div className="mx-auto max-w-xl text-center">
          <span className="text-[13px] font-bold uppercase tracking-[1.4px] text-primary">Why partner with us</span>
          <h2 className="mt-3.5 font-display text-[28px] font-bold leading-[1.1] tracking-[-1px] text-slate sm:text-[45px]">
            Built to actually pay out
          </h2>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-4 sm:mt-12 sm:grid-cols-2 sm:gap-5">
          {BENEFITS.map((benefit) => (
            <Card key={benefit.title} hoverLift className="flex flex-col gap-0">
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-chip bg-accent">
                <benefit.icon className="h-[22px] w-[22px] text-primary" strokeWidth={1.8} />
              </div>
              <h3 className="font-ui text-[19px] font-semibold tracking-[-0.2px] text-heading">{benefit.title}</h3>
              <p className="mt-2 text-sm leading-[1.6] text-subtle">{benefit.description}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 py-14 sm:px-6 sm:py-[90px] lg:px-8">
        <div className="text-center">
          <span className="text-[13px] font-bold uppercase tracking-[1.4px] text-primary">FAQs</span>
          <h2 className="mt-3.5 font-display text-[28px] font-bold leading-[1.1] tracking-[-1px] text-slate sm:text-[45px]">
            Affiliate program questions
          </h2>
        </div>

        <div className="mt-8 sm:mt-12">
          <Accordion items={FAQ_ITEMS} />
        </div>
      </section>

      <section className="px-4 py-14 text-center sm:px-6 sm:py-20 lg:px-8">
        <div className="mx-auto max-w-6xl rounded-card-lg bg-primary px-5 py-10 text-white shadow-blue sm:px-6 sm:py-14">
          <h2 className="font-display text-[26px] font-bold leading-[1.15] tracking-[-0.8px] sm:text-[40px]">
            Ready to start earning?
          </h2>
          <p className="mt-3 text-base text-white/80 sm:text-[17px]">
            Join the waitlist now and be first in line when the program opens.
          </p>
          <Button href="#waitlist" icon={Sparkles} size="lg" variant="white" className="mt-6 w-full sm:w-auto">
            Join the waitlist
          </Button>
        </div>
      </section>
    </>
  );
}
