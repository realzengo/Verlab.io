"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { CircleCheck, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { CODE_MAX, isValidCode } from "@/lib/validation";
import { SettingsRow, settingsButton, settingsInput } from "@/components/settings/SettingsSection";

// Same /api/promo-codes/redeem endpoint TopUpModal's "Have a promo code?"
// field uses -- duplicated here (rather than reusing that field) because
// this needs to be reachable from Account, the one settings tab that's never
// paywall-restricted (see settings/layout.tsx's RESTRICTED_TABS) -- a code
// granting someone their first credits has to work before they have any
// credits or a subscription to unlock Credit History with.
/** The "Promo code" row in the Account tab's Plan section. */
export function RedeemCodeRow() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [redeeming, setRedeeming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleRedeem(event: FormEvent) {
    event.preventDefault();
    if (!code.trim()) return;

    if (!isValidCode(code)) {
      setError("Codes use letters, numbers, - and _ only");
      return;
    }

    setRedeeming(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/promo-codes/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Could not redeem code");
        return;
      }

      setSuccess(
        data.rewardType === "credits"
          ? `${data.rewardValue.toLocaleString()} credits added to your balance`
          : `Code redeemed for a ${data.rewardValue}% discount`
      );
      setCode("");
      router.refresh();
    } catch {
      setError("Could not redeem code. Please try again.");
    } finally {
      setRedeeming(false);
    }
  }

  return (
    <SettingsRow
      label="Promo code"
      description="Redeem a code for free credits or a discount"
      control={
        <form onSubmit={handleRedeem} className="flex w-full items-center gap-2 sm:w-auto">
          <input
            type="text"
            aria-label="Promo code"
            value={code}
            maxLength={CODE_MAX}
            onChange={(event) => {
              setCode(event.target.value);
              setError(null);
            }}
            placeholder="Enter code"
            className={cn(settingsInput({ size: "sm", invalid: !!error }), "uppercase placeholder:normal-case sm:w-44")}
          />
          <button type="submit" disabled={redeeming || !code.trim()} className={settingsButton("secondary")}>
            {redeeming ? <Loader2 className="h-4 w-4 animate-spin" /> : "Apply"}
          </button>
        </form>
      }
    >
      {success && (
        <p className="mt-2 flex items-center gap-1.5 text-sm text-success">
          <CircleCheck className="h-4 w-4 shrink-0" strokeWidth={1.75} />
          {success}
        </p>
      )}
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </SettingsRow>
  );
}
