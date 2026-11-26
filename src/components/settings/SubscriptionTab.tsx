"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Clock } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { CancelSubscriptionDialog } from "@/components/settings/CancelSubscriptionDialog";
import { SettingsRow, SettingsSection, settingsButton } from "@/components/settings/SettingsSection";
import { CANCEL_BUTTON_LABEL } from "@/lib/cancellation";
import { useResetOnPageRestore } from "@/lib/hooks/useResetOnPageRestore";

const PLAN_LABELS: Record<string, string> = { core: "Core", pro: "Pro", scale: "Scale" };

interface SubscriptionTabProps {
  plan: string;
  subscriptionStatus: string | null;
  subscriptionPeriod: string | null;
  currentPeriodEnd: string | null;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

export function SubscriptionTab({ plan, subscriptionStatus, subscriptionPeriod, currentPeriodEnd }: SubscriptionTabProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [justCancelled, setJustCancelled] = useState(false);

  // Whop's own status vocabulary distinguishes "canceling" (cancellation
  // requested, access continues until the period ends) from "canceled"
  // (access has already ended -- see handleMembershipDeactivated, which also
  // reverts `plan` to "core" at that point). Once truly ended there's no
  // active billing left to manage, so it should read exactly like an account
  // with no plan rather than showing a stale cancellation date forever.
  const isEnding = subscriptionStatus === "canceling" || justCancelled;
  const hasEnded = subscriptionStatus === "canceled" || subscriptionStatus === "expired";
  const hasBilling = subscriptionStatus !== null && !hasEnded;

  useResetOnPageRestore(() => setLoading(false));

  async function openPortal() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const data = await res.json();

      if (!res.ok || !data.url) {
        setError(data.error ?? "Could not open billing portal");
        setLoading(false);
        return;
      }

      window.location.href = data.url;
    } catch {
      setError("Could not open billing portal. Please try again.");
      setLoading(false);
    }
  }

  // `plan` alone isn't trustworthy here -- it defaults to "core" for an
  // account that's never subscribed, and keeps its last paid value after a
  // subscription lapses (see handleMembershipDeactivated). hasBilling is the
  // real signal, so a non-subscriber reads as exactly that instead of "on
  // the Core plan".
  const planLabel = `${PLAN_LABELS[plan] ?? plan} plan`;
  const billedCopy = `Billed ${subscriptionPeriod === "yearly" ? "yearly" : "monthly"}`;
  const statusCopy = !hasBilling
    ? "Pick a plan to start a subscription"
    : isEnding && currentPeriodEnd
      ? `Access ends ${formatDate(currentPeriodEnd)}`
      : currentPeriodEnd
        ? `${billedCopy}, renews ${formatDate(currentPeriodEnd)}`
        : billedCopy;

  return (
    <div className="flex flex-col gap-10">
      <SettingsSection title="Subscription" description="Your plan, renewal date and billing">
        <SettingsRow
          label={
            <>
              {hasBilling ? planLabel : "No paid plan"}
              {isEnding && (
                <Badge variant="warning">
                  <Clock className="h-3 w-3" />
                  Ending soon
                </Badge>
              )}
            </>
          }
          description={statusCopy}
          control={
            hasBilling ? (
              <button type="button" disabled={loading} onClick={openPortal} className={settingsButton()}>
                {loading ? "Opening…" : "Manage billing"}
                {!loading && <ArrowUpRight className="h-4 w-4 text-subtle" strokeWidth={1.75} />}
              </button>
            ) : (
              <Link href="/pricing" className={settingsButton("primary")}>
                View plans
              </Link>
            )
          }
        />

        {hasBilling && !isEnding && (
          <SettingsRow
            label={CANCEL_BUTTON_LABEL}
            description="You'll keep access until the end of the current billing period"
            control={
              <button type="button" disabled={loading} onClick={() => setCancelOpen(true)} className={settingsButton("danger")}>
                {CANCEL_BUTTON_LABEL}
              </button>
            }
          />
        )}
      </SettingsSection>

      {error && <p className="-mt-6 text-sm text-danger">{error}</p>}
      {justCancelled && (
        <p className="-mt-6 text-sm text-body">
          Your subscription is cancelled. You keep full access
          {currentPeriodEnd ? ` until ${formatDate(currentPeriodEnd)}` : " until the end of your billing period"}, and you
          won&apos;t be charged again.
        </p>
      )}

      <CancelSubscriptionDialog
        isOpen={cancelOpen}
        onClose={() => setCancelOpen(false)}
        accessEndsLabel={currentPeriodEnd ? formatDate(currentPeriodEnd) : null}
        onCancelled={() => {
          setCancelOpen(false);
          setJustCancelled(true);
          router.refresh();
        }}
      />
    </div>
  );
}
