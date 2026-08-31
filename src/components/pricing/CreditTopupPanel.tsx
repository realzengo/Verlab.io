"use client";

import { Check, Coins, Loader2, Lock, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { PACKS, type PackId } from "@/components/TopUpModal";
import { IMAGE_MODEL_PRICING, getVideoGenerationCost } from "@/lib/config/pricing";

// Cheapest real per-generation cost for the two tools called out in every
// row's feature checklist -- Nano Banana Pro at its lowest resolution tier,
// and Seedance 2 at 720p/5s (the flagship image/video pairing this app
// charges credits for -- see src/lib/config/pricing.ts). Computed once from
// the same tables the generation routes bill against, so this copy can never
// drift out of sync with what a credit actually buys.
const CHEAPEST_IMAGE_CREDITS = IMAGE_MODEL_PRICING["Nano Banana Pro"].resolutionCredits!["512px"]!;
const CHEAPEST_VIDEO_CREDITS = getVideoGenerationCost({ model: "Seedance 2", durationSeconds: 5, outputs: 1, resolution: "720p" });

// 500-credit pack's own rate ($8.00 / 0.5 = $16.00/1000) is the highest
// (worst) rate in the lineup -- the anchor every other pack's "Save X%"
// badge is measured against.
const BASE_RATE_PER_1000_USD = 16;

function listPriceUsd(credits: number): number {
  return (credits / 1000) * BASE_RATE_PER_1000_USD;
}

function savePercent(credits: number, priceUsd: number): number {
  const list = listPriceUsd(credits);
  if (list <= 0) return 0;
  return Math.round(((list - priceUsd) / list) * 100);
}

/** "$8.00" -> "$8", "$178.50" stays "$178.50" -- whole-dollar pack prices read cleaner without a trailing ".00". */
function formatUsd(amount: number): string {
  return `$${amount.toFixed(2).replace(/\.00$/, "")}`;
}

function FeatureChecklist({ credits, featured }: { credits: number; featured?: boolean }) {
  const images = Math.floor(credits / CHEAPEST_IMAGE_CREDITS);
  const videos = Math.floor(credits / CHEAPEST_VIDEO_CREDITS);
  return (
    <ul className="mt-2 flex flex-col gap-1">
      <li className={cn("flex items-center gap-1.5 whitespace-nowrap text-[11px] sm:gap-2 sm:text-sm", featured ? "text-white/65" : "text-subtle")}>
        <Check className={cn("h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4", featured ? "text-white/75" : "text-subtle")} strokeWidth={2.5} />
        Up to {images.toLocaleString()} Nano Banana Pro image generations
      </li>
      <li className={cn("flex items-center gap-1.5 whitespace-nowrap text-[11px] sm:gap-2 sm:text-sm", featured ? "text-white/65" : "text-subtle")}>
        <Check className={cn("h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4", featured ? "text-white/75" : "text-subtle")} strokeWidth={2.5} />
        Up to {videos.toLocaleString()} Seedance 2.0 720p, 5s video generations
      </li>
    </ul>
  );
}

function RateChip({ credits, priceUsd, featured }: { credits: number; priceUsd: number; featured?: boolean }) {
  const creditsPerDollar = priceUsd > 0 ? Math.round(credits / priceUsd) : 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium",
        featured
          ? "border-white/15 bg-white/10 text-white/75"
          : "border-hairline bg-white text-subtle dark:border-white/15 dark:bg-white/10 dark:text-white/75"
      )}
    >
      <Coins className="h-3 w-3" />
      $1 = {creditsPerDollar} credits
    </span>
  );
}

function SaveBadge({ percent }: { percent: number }) {
  if (percent <= 0) return null;
  return (
    <span className="inline-flex items-center rounded-full bg-gradient-to-r from-pink-600 to-rose-500 px-2.5 py-1 text-xs font-bold text-white shadow-[0_4px_14px_-2px_rgba(219,39,119,0.5)]">
      − {percent}%
    </span>
  );
}

function MostPopularBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[#ffef00] px-2.5 py-1 text-xs font-bold text-black">
      <Sparkles className="h-3 w-3" />
      Most Popular
    </span>
  );
}

function PackRow({
  pack,
  onCheckout,
  disabled,
  loading,
}: {
  pack: (typeof PACKS)[number];
  onCheckout: (packId: PackId) => void;
  disabled: boolean;
  loading: boolean;
}) {
  const percent = savePercent(pack.creditsNum, pack.priceUsd);
  const list = listPriceUsd(pack.creditsNum);
  const featured = pack.badge?.tone === "primary";

  const content = (
    <div
      className={cn(
        "relative flex flex-col gap-3.5 rounded-2xl p-4 sm:flex-row sm:items-center sm:justify-between sm:rounded-[1.75rem] sm:p-6",
        featured ? "topup-neon-card" : "border border-hairline bg-gray-100 dark:bg-surface"
      )}
      style={!featured ? { boxShadow: "inset 0 2px 6px rgba(0, 0, 0, 0.08), var(--shadow-card)" } : undefined}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-3">
          <span className={cn("text-2xl font-extrabold tracking-tight sm:text-3xl", featured ? "text-white" : "text-heading")}>
            {pack.creditsNum.toLocaleString()} credits
          </span>
          <RateChip credits={pack.creditsNum} priceUsd={pack.priceUsd} featured={featured} />
          {featured ? (
            <MostPopularBadge />
          ) : (
            pack.badge && (
              <span className="inline-flex items-center rounded-full border border-hairline px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-subtle">
                {pack.badge.label}
              </span>
            )
          )}
        </div>
        <FeatureChecklist credits={pack.creditsNum} featured={featured} />
      </div>

      <div className="flex flex-col gap-3 sm:shrink-0 sm:items-end sm:justify-center sm:gap-4">
        <div className="flex flex-wrap items-baseline gap-2 sm:justify-end sm:gap-2.5">
          <span className={cn("text-2xl font-extrabold tabular-nums sm:text-3xl", featured ? "text-white" : "text-heading")}>
            {formatUsd(pack.priceUsd)}
          </span>
          {percent > 0 && (
            <span className={cn("text-lg font-bold line-through sm:text-xl", featured ? "text-pink-400" : "text-pink-600")}>
              {formatUsd(list)}
            </span>
          )}
          <SaveBadge percent={percent} />
        </div>
        <button
          type="button"
          onClick={() => onCheckout(pack.id)}
          disabled={disabled}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-2xl bg-white px-6 py-3 text-base font-bold text-black transition-colors duration-150 hover:bg-gray-50 disabled:pointer-events-none disabled:opacity-50 sm:w-auto sm:px-16 sm:py-3.5"
          style={{ boxShadow: "0 4px 0 0 #d4d4d8, 0 10px 20px -6px rgba(0, 0, 0, 0.22)" }}
        >
          {loading ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Processing…
            </>
          ) : (
            "Purchase"
          )}
        </button>
      </div>
    </div>
  );

  return content;
}

export function CreditTopupPanel({
  onCheckoutPack,
  checkingOutId,
}: {
  onCheckoutPack: (packId: PackId) => void;
  checkingOutId: PackId | null;
}) {
  return (
    <div className="mx-auto mt-10 flex w-full max-w-4xl flex-col gap-3">
      {PACKS.map((pack) => (
        <PackRow
          key={pack.id}
          pack={pack}
          onCheckout={onCheckoutPack}
          disabled={checkingOutId !== null}
          loading={checkingOutId === pack.id}
        />
      ))}

      <p className="mt-2 flex items-center justify-center gap-1.5 text-xs text-subtle">
        <Lock className="h-3.5 w-3.5" />
        Secure checkout · Payments are encrypted
      </p>
    </div>
  );
}
