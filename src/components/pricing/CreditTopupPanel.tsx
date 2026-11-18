"use client";

import type { ReactNode } from "react";
import { Check, Coins, Loader2, Lock } from "lucide-react";
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

function FeatureChecklist({ credits, featured, compact }: { credits: number; featured?: boolean; compact?: boolean }) {
  const images = Math.floor(credits / CHEAPEST_IMAGE_CREDITS).toLocaleString("en-US");
  const videos = Math.floor(credits / CHEAPEST_VIDEO_CREDITS).toLocaleString("en-US");
  // Phone copy is cut short so each item stays on one line; the video spec
  // drops off on the narrowest phones (under 360px).
  const items: { key: string; label: ReactNode }[] = compact
    ? [
        { key: "images", label: `Up to ${images} Nano Banana Pro images` },
        {
          key: "videos",
          label: (
            <>
              Up to {videos} Seedance 2.0 videos<span className="hidden min-[360px]:inline">, 720p 5s</span>
            </>
          ),
        },
      ]
    : [
        { key: "images", label: `Up to ${images} Nano Banana Pro image generations` },
        { key: "videos", label: `Up to ${videos} Seedance 2.0 720p, 5s video generations` },
      ];
  return (
    <ul className={cn("flex flex-col", compact ? "mt-3 gap-1" : "mt-3 gap-1.5")}>
      {items.map((item) => (
        <li
          key={item.key}
          className={cn(
            "flex items-start gap-2 tabular-nums",
            compact ? "text-xs leading-5" : "text-sm leading-5",
            featured ? "text-white/80" : "text-subtle"
          )}
        >
          <Check
            className={cn("shrink-0", compact ? "mt-1 h-3.5 w-3.5" : "mt-0.5 h-4 w-4", featured ? "text-white" : "text-subtle")}
            strokeWidth={2}
          />
          <span>{item.label}</span>
        </li>
      ))}
    </ul>
  );
}

// One chip shape for the rate and the "Best value" tag, so the title row
// reads as one line of quiet labels next to the credits figure.
const CHIP = "inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium tabular-nums";
const CHIP_TONE = "border-hairline bg-white text-subtle dark:border-white/10 dark:bg-white/[0.06] dark:text-white/70";
const CHIP_TONE_FEATURED = "border-white/20 bg-white/10 text-white/85";
// Phone size of the same chips.
const CHIP_SM = "inline-flex h-6 shrink-0 items-center whitespace-nowrap rounded-full border px-2 text-[11px] font-medium leading-none";

function creditsPerDollar(credits: number, priceUsd: number): number {
  return priceUsd > 0 ? Math.round(credits / priceUsd) : 0;
}

function RateChip({ credits, priceUsd, featured }: { credits: number; priceUsd: number; featured?: boolean }) {
  return (
    <span className={cn(CHIP, featured ? CHIP_TONE_FEATURED : CHIP_TONE)}>
      <Coins className="h-3.5 w-3.5" strokeWidth={1.75} />
      $1 = {creditsPerDollar(credits, priceUsd)} credits
    </span>
  );
}

function SaveBadge({ percent, featured, small }: { percent: number; featured?: boolean; small?: boolean }) {
  if (percent <= 0) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full font-semibold tabular-nums text-white",
        small ? "h-5 px-1.5 text-[11px]" : "h-6 px-2 text-xs",
        featured ? "bg-white/15 ring-1 ring-inset ring-white/25" : "bg-[#e11d63]"
      )}
    >
      −{percent}%
    </span>
  );
}

function MostPopularBadge({ small }: { small?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full bg-white font-semibold text-[#1f40d6] shadow-[0_1px_2px_rgba(8,18,95,0.25)]",
        small ? "h-6 shrink-0 whitespace-nowrap px-2 text-[11px] leading-none" : "h-7 px-2.5 text-xs"
      )}
    >
      Most popular
    </span>
  );
}

function PurchaseButton({
  featured,
  loading,
  disabled,
  onClick,
  className,
}: {
  featured: boolean;
  loading: boolean;
  disabled: boolean;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex w-full items-center justify-center gap-1.5 bg-white font-semibold",
        "transition-[transform,box-shadow,background-color] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-[#f7f7f8]",
        "active:translate-y-[3px]",
        "outline-none focus-visible:ring-4 focus-visible:ring-primary/25",
        "disabled:pointer-events-none disabled:opacity-50",
        // On the blue card the lip is a deep Verlab navy and the label
        // takes the brand blue; elsewhere it's the neutral gray lip.
        featured
          ? "text-[#1f40d6] shadow-[0_3px_0_0_rgba(8,18,95,0.45),0_8px_16px_-8px_rgba(8,18,95,0.6)] active:shadow-[0_0_0_0_rgba(8,18,95,0.45),0_4px_8px_-6px_rgba(8,18,95,0.5)]"
          : "text-[#0b0d12] shadow-[0_3px_0_0_#d4d4d8,0_8px_16px_-8px_rgba(0,0,0,0.25)] active:shadow-[0_0_0_0_#d4d4d8,0_4px_8px_-6px_rgba(0,0,0,0.2)] dark:shadow-[0_3px_0_0_#a1a1aa,0_8px_16px_-8px_rgba(0,0,0,0.5)]",
        className
      )}
    >
      {loading ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          Starting checkout…
        </>
      ) : (
        "Purchase"
      )}
    </button>
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
  const strike = featured ? "text-white/55 decoration-white/55" : "text-subtle decoration-subtle";
  const ink = featured ? "text-white" : "text-heading";
  const checkout = () => onCheckout(pack.id);

  return (
    <div
      className={cn(
        "relative rounded-[20px] p-4 sm:flex sm:items-center sm:justify-between sm:gap-8 sm:rounded-3xl sm:px-7 sm:py-6",
        featured
          ? "topup-featured-card isolate overflow-hidden"
          : "border border-[#E8EAEE] bg-[#F6F7F9] dark:border-white/[0.07] dark:bg-white/[0.025]"
      )}
    >
      {featured && (
        // The Verlab V, large and faint, cropped by the card's bottom edge in
        // the open space left of the price column -- the brand mark set into
        // the card like a credit card's. On phones it tucks into the
        // top-right corner instead, behind the price.
        // eslint-disable-next-line @next/next/no-img-element -- static brand mark
        <img
          src="/logo-mark-white.png"
          alt=""
          aria-hidden
          width={230}
          height={200}
          className="pointer-events-none absolute -right-6 -top-10 -z-10 w-[150px] opacity-[0.07] select-none sm:-bottom-14 sm:right-[264px] sm:top-auto sm:w-[200px]"
        />
      )}

      {/* Phone: a compact receipt. Credits and price share the first line,
          the rate and the saving sit under them, then a short checklist and
          a full-width Purchase. */}
      <div className="sm:hidden">
        <div className="flex items-baseline justify-between gap-3">
          <span className={cn("text-xl font-semibold leading-7 tracking-[-0.02em] tabular-nums", ink)}>
            {pack.creditsNum.toLocaleString("en-US")} credits
          </span>
          <span className={cn("text-xl font-semibold leading-7 tracking-[-0.02em] tabular-nums", ink)}>
            {formatUsd(pack.priceUsd)}
          </span>
        </div>
        <div className="mt-1.5 flex min-h-6 items-center justify-between gap-3">
          <span className="flex min-w-0 items-center gap-2">
            {/* On the narrowest phones a badged pack drops the rate so the
                badge and the saving still fit on one line. */}
            <span
              className={cn(
                "whitespace-nowrap text-xs tabular-nums",
                featured ? "text-white/75" : "text-subtle",
                pack.badge && "hidden min-[360px]:inline"
              )}
            >
              $1 = {creditsPerDollar(pack.creditsNum, pack.priceUsd)} credits
            </span>
            {featured ? (
              <MostPopularBadge small />
            ) : (
              pack.badge && <span className={cn(CHIP_SM, CHIP_TONE)}>{pack.badge.label}</span>
            )}
          </span>
          {percent > 0 && (
            <span className="flex shrink-0 items-center gap-1.5">
              <span className={cn("text-xs font-medium tabular-nums line-through", strike)}>{formatUsd(list)}</span>
              <SaveBadge percent={percent} featured={featured} small />
            </span>
          )}
        </div>
        <FeatureChecklist credits={pack.creditsNum} featured={featured} compact />
        <PurchaseButton
          featured={featured}
          loading={loading}
          disabled={disabled}
          onClick={checkout}
          className="mt-4 h-11 rounded-xl text-[15px]"
        />
      </div>

      {/* Desktop */}
      <div className="hidden min-w-0 flex-1 sm:block">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className={cn("text-[28px] font-semibold leading-9 tracking-[-0.02em] tabular-nums", ink)}>
            {pack.creditsNum.toLocaleString("en-US")} credits
          </span>
          <RateChip credits={pack.creditsNum} priceUsd={pack.priceUsd} featured={featured} />
          {featured ? (
            <MostPopularBadge />
          ) : (
            pack.badge && <span className={cn(CHIP, CHIP_TONE)}>{pack.badge.label}</span>
          )}
        </div>
        <FeatureChecklist credits={pack.creditsNum} featured={featured} />
      </div>

      {/* Fixed-width column so every price lines up on the right edge and
          every Purchase button is the same size. */}
      <div className="hidden w-[208px] shrink-0 flex-col items-end gap-4 sm:flex">
        <div className="flex items-center justify-end gap-2">
          {percent > 0 && (
            <span className={cn("text-base font-medium tabular-nums line-through", strike)}>{formatUsd(list)}</span>
          )}
          <span className={cn("text-[28px] font-semibold leading-9 tracking-[-0.02em] tabular-nums", ink)}>
            {formatUsd(pack.priceUsd)}
          </span>
          <SaveBadge percent={percent} featured={featured} />
        </div>
        <PurchaseButton
          featured={featured}
          loading={loading}
          disabled={disabled}
          onClick={checkout}
          className="h-12 rounded-2xl text-[15px]"
        />
      </div>
    </div>
  );
}

export function CreditTopupPanel({
  onCheckoutPack,
  checkingOutId,
}: {
  onCheckoutPack: (packId: PackId) => void;
  checkingOutId: PackId | null;
}) {
  return (
    <div className="mx-auto mt-6 flex w-full max-w-4xl flex-col gap-2.5 sm:mt-10 sm:gap-3">
      {PACKS.map((pack) => (
        <PackRow
          key={pack.id}
          pack={pack}
          onCheckout={onCheckoutPack}
          disabled={checkingOutId !== null}
          loading={checkingOutId === pack.id}
        />
      ))}

      <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-subtle">
        <Lock className="h-3.5 w-3.5" strokeWidth={1.75} />
        Secure checkout, payments are encrypted
      </p>
    </div>
  );
}
