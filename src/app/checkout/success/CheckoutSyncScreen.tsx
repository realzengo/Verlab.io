"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { pollUntilSettled } from "@/lib/polling";

interface ProfileSnapshot {
  credits: number;
  plan: string;
  subscription_status: string | null;
}

const POLL_INTERVAL_MS = 1500;
const TIMEOUT_MS = 30_000;

/**
 * Polls our own DB (never Polar) until the webhook-driven update to credits/
 * plan/subscription_status shows up, then hands off into the dashboard. This
 * exists because Polar's redirect can land before the webhook has processed
 * -- proxy.ts's paywall gate would otherwise bounce a paying user back to
 * /pricing for that brief window. See src/proxy.ts's /checkout carve-out.
 */
export function CheckoutSyncScreen({ initial }: { initial: ProfileSnapshot }) {
  const router = useRouter();
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    const cancel = pollUntilSettled(
      async () => {
        const res = await fetch("/api/checkout/sync-status", { cache: "no-store" });
        if (!res.ok) throw new Error("Could not check sync status");
        return (await res.json()) as ProfileSnapshot;
      },
      (current) =>
        current.credits !== initial.credits ||
        current.plan !== initial.plan ||
        current.subscription_status !== initial.subscription_status,
      (current) => {
        const changed =
          current.credits !== initial.credits ||
          current.plan !== initial.plan ||
          current.subscription_status !== initial.subscription_status;
        if (changed) router.push("/app/settings/credits");
      },
      { intervalMs: POLL_INTERVAL_MS, timeoutMs: TIMEOUT_MS, onTimeout: () => setTimedOut(true) }
    );

    return cancel;
  }, [initial, router]);

  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center gap-5 bg-app px-4 text-center">
      {timedOut ? (
        <>
          <CheckCircle2 className="h-10 w-10 text-success" />
          <div>
            <h1 className="text-lg font-semibold text-heading">Payment received</h1>
            <p className="mt-1.5 max-w-sm text-sm text-body">
              This is taking longer than usual to show up on your account. It&apos;ll finish syncing shortly --
              head to your dashboard and refresh in a minute if it&apos;s not there yet.
            </p>
          </div>
          <Button href="/app/settings/credits" variant="primary">
            Go to dashboard
          </Button>
        </>
      ) : (
        <>
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <div>
            <h1 className="text-lg font-semibold text-heading">Confirming your payment…</h1>
            <p className="mt-1.5 max-w-sm text-sm text-body">
              Hang tight, this only takes a few seconds.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
