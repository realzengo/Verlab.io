"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { CODE_MAX, isValidCode } from "@/lib/validation";

// Same /api/promo-codes/redeem endpoint TopUpModal's "Have a promo code?"
// field uses -- duplicated here (rather than reusing that field) because
// this needs to be reachable from Account, the one settings tab that's never
// paywall-restricted (see settings/layout.tsx's RESTRICTED_TABS) -- a code
// granting someone their first credits has to work before they have any
// credits or a subscription to unlock Credit History with.
export function RedeemCodeSection() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [redeeming, setRedeeming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleRedeem(event: FormEvent) {
    event.preventDefault();
    if (!code.trim()) return;

    if (!isValidCode(code)) {
      setError("Enter a valid code (letters, numbers, - and _ only).");
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
          ? `${data.rewardValue.toLocaleString()} credits added to your balance!`
          : `${data.rewardValue}% discount unlocked!`
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
    <div>
      <h2 className="font-bold text-lg mb-6 mt-10 text-heading">Redeem a code</h2>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between py-4 border-b border-hairline last:border-0">
        <div className="min-w-0">
          <p className="font-medium text-heading text-sm sm:text-base">Promo code</p>
          <p className="text-body text-xs sm:text-sm mt-0.5">Got a code for free credits or a discount? Enter it below.</p>
          {success && <p className="mt-2 text-sm text-success">{success}</p>}
        </div>

        <form onSubmit={handleRedeem} className="mt-3 sm:mt-0 flex flex-col items-start sm:items-end gap-1.5">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={code}
              maxLength={CODE_MAX}
              onChange={(event) => {
                setCode(event.target.value);
                setError(null);
              }}
              placeholder="Enter code"
              className="w-40 sm:w-48 rounded-md border border-hairline bg-surface px-3 py-2 sm:py-1.5 text-sm uppercase tracking-wide text-heading outline-none placeholder:normal-case placeholder:tracking-normal focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
            <button
              type="submit"
              disabled={redeeming || !code.trim()}
              className="shrink-0 px-4 py-2 sm:py-1.5 bg-heading text-app rounded-md text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {redeeming ? <Loader2 className="h-4 w-4 animate-spin" /> : "Apply"}
            </button>
          </div>
          {error && <p className="text-xs text-danger">{error}</p>}
        </form>
      </div>
    </div>
  );
}
