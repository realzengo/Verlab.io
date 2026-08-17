import NumberFlow from "@number-flow/react";
import type { PricingFrequency, PricingPlan } from "@/lib/types";
import { cn } from "@/lib/utils";

function FireIcon(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <g filter="url(#fire-icon-shadow)">
        <path
          d="M17.8488 7.91802C17.7687 7.8379 17.6708 7.778 17.563 7.74331C17.4551 7.70861 17.3406 7.70011 17.2289 7.71851C17.118 7.73706 17.013 7.78158 16.9226 7.84846C16.8322 7.91533 16.7589 8.00265 16.7087 8.10328C16.4908 8.48037 16.2249 8.82766 15.9178 9.13646C15.8455 7.26321 15.1595 5.46565 13.9655 4.02045C13.2974 3.33454 12.4899 2.80016 11.5974 2.45349C10.7049 2.10682 9.74831 1.95595 8.79244 2.0111C8.66354 2.01144 8.53715 2.04674 8.42673 2.11325C8.31631 2.17975 8.22599 2.27496 8.16541 2.38874C8.1082 2.50016 8.08137 2.62469 8.08763 2.74979C8.09388 2.87488 8.133 2.99612 8.20104 3.10128C8.30079 3.25091 10.4669 6.58558 7.9944 9.58536C7.36737 9.09371 6.65483 8.31705 6.65483 7.71139C6.65389 7.55184 6.59942 7.39722 6.50015 7.2723C6.40088 7.14739 6.26256 7.05941 6.10735 7.02245C5.95213 6.9855 5.789 7.0017 5.6441 7.06848C5.49919 7.13526 5.38089 7.24874 5.30814 7.39075C4.33486 9.50313 3.82236 11.7985 3.80469 14.1242C3.80469 20.2663 8.37205 21.8624 8.56443 21.9621C8.70252 22.009 8.85169 22.0125 8.99178 21.9719C9.13188 21.9314 9.25615 21.8488 9.34783 21.7354C9.43951 21.6219 9.49417 21.4831 9.50443 21.3376C9.51469 21.1921 9.48007 21.047 9.40523 20.9218C8.72928 19.7081 8.46196 18.309 8.64281 16.9316C9.08173 17.7828 9.735 18.5048 10.5382 19.0265C10.6893 19.1267 10.8729 19.1655 11.0516 19.135C11.2303 19.1046 11.3907 19.0072 11.5001 18.8626C12.4854 17.4209 12.9526 15.6877 12.8254 13.9461C13.5736 15.0933 14.1436 17.238 13.0962 21.0715C13.0691 21.1763 13.0663 21.2859 13.0879 21.3919C13.1095 21.498 13.155 21.5978 13.221 21.6836C13.2869 21.7695 13.3715 21.8392 13.4684 21.8874C13.5653 21.9357 13.672 21.9612 13.7802 21.9621C13.8439 21.9725 13.9089 21.9725 13.9726 21.9621C15.6072 21.4149 17.0236 20.3588 18.0147 18.9484C19.0058 17.5381 19.5195 15.8475 19.4805 14.1242C19.4805 9.68512 18.0127 8.08903 17.8488 7.91802Z"
          fill="url(#fire-icon-fill)"
          shapeRendering="crispEdges"
        />
        <path
          d="M8.82129 2.51074C9.70559 2.45973 10.5903 2.59923 11.416 2.91992C12.2353 3.23816 12.9776 3.72701 13.5928 4.35449C14.709 5.71239 15.35 7.39845 15.418 9.15527L15.4629 10.3037L16.2725 9.48926C16.61 9.14986 16.9021 8.76796 17.1416 8.35352L17.1494 8.33984L17.1562 8.32617C17.1712 8.29626 17.1928 8.26989 17.2197 8.25C17.2465 8.2302 17.2777 8.21653 17.3105 8.21094C17.3437 8.20557 17.3782 8.20943 17.4102 8.21973C17.4409 8.22969 17.469 8.24618 17.4922 8.26855C17.6046 8.38655 18.9804 9.87857 18.9805 14.124V14.1357C19.017 15.7522 18.5351 17.3382 17.6055 18.6611C16.6868 19.9683 15.3784 20.9503 13.8682 21.4688C13.8656 21.4685 13.8629 21.4692 13.8604 21.4688L13.8223 21.4629L13.7842 21.4619C13.7519 21.4616 13.7203 21.4538 13.6914 21.4395C13.6625 21.4251 13.6368 21.4045 13.6172 21.3789C13.5976 21.3534 13.5846 21.3235 13.5781 21.292C13.5717 21.2604 13.572 21.2276 13.5801 21.1963L13.5791 21.1953C14.648 17.2778 14.0939 14.9759 13.2441 13.6729L12.3271 13.9824C12.4458 15.6064 12.0097 17.2215 11.0938 18.5674C11.0614 18.6062 11.0178 18.634 10.9678 18.6426C10.9145 18.6517 10.8595 18.6393 10.8145 18.6094L10.8105 18.6074L10.543 18.4209C9.93466 17.9669 9.43608 17.3793 9.08691 16.7021L8.35547 15.2822L8.14746 16.8662C7.95263 18.3501 8.24056 19.8575 8.96875 21.165L8.97168 21.1719L8.97656 21.1787C8.9987 21.2159 9.00891 21.2595 9.00586 21.3027C9.00275 21.346 8.98621 21.3872 8.95898 21.4209C8.93164 21.4547 8.89432 21.4791 8.85254 21.4912C8.81112 21.5032 8.76744 21.5019 8.72656 21.4883C8.43879 21.3637 7.45635 20.9569 6.46777 19.957C5.38887 18.8656 4.3056 17.0564 4.30469 14.1279C4.32179 11.8788 4.81591 9.65889 5.75488 7.61523C5.77671 7.57448 5.81147 7.54184 5.85352 7.52246C5.89659 7.50266 5.94507 7.49788 5.99121 7.50879C6.03735 7.51978 6.07881 7.54595 6.1084 7.58301C6.1231 7.60151 6.13478 7.62257 6.14258 7.64453L6.15527 7.71387C6.1562 8.18846 6.42188 8.64515 6.69434 8.99707C6.98167 9.36821 7.34793 9.71375 7.68555 9.97852L8.07031 10.2803L8.37988 9.90332C9.73568 8.25839 9.81873 6.50976 9.55273 5.17676C9.29427 3.88162 8.70522 2.95743 8.62109 2.83008C8.6008 2.79871 8.58878 2.76192 8.58691 2.72461C8.58513 2.68824 8.59218 2.65171 8.6084 2.61914C8.62637 2.58717 8.65314 2.56099 8.68457 2.54199C8.71751 2.52216 8.7555 2.51084 8.79395 2.51074H8.82129Z"
          stroke="url(#fire-icon-stroke)"
          shapeRendering="crispEdges"
        />
      </g>
      <defs>
        <filter id="fire-icon-shadow" x="2.80469" y="1" width="17.6777" height="22" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
          <feFlood floodOpacity="0" result="BackgroundImageFix" />
          <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha" />
          <feMorphology radius="1" operator="dilate" in="SourceAlpha" result="effect1_dropShadow" />
          <feOffset />
          <feComposite in2="hardAlpha" operator="out" />
          <feColorMatrix type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.1 0" />
          <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow" />
          <feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow" result="shape" />
          <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha" />
          <feOffset dy="0.198603" />
          <feGaussianBlur stdDeviation="1" />
          <feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1" />
          <feColorMatrix type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.8 0" />
          <feBlend mode="normal" in2="shape" result="effect2_innerShadow" />
        </filter>
        <linearGradient id="fire-icon-fill" x1="2.78508" y1="2" x2="20.9655" y2="19.0995" gradientUnits="userSpaceOnUse">
          <stop stopColor="white" />
          <stop offset="1" stopColor="white" stopOpacity="0.01" />
        </linearGradient>
        <linearGradient id="fire-icon-stroke" x1="11.6436" y1="2" x2="11.6436" y2="22" gradientUnits="userSpaceOnUse">
          <stop stopColor="white" stopOpacity="0.1" />
          <stop offset="1" stopColor="white" stopOpacity="0.01" />
        </linearGradient>
      </defs>
    </svg>
  );
}

// Splits "1,000 Credits (AI Tools)" into a bold lead ("1,000 Credits") and a
// plain trailing descriptor ("(AI Tools)").
function splitFeatureText(text: string): { bold: string; rest: string } {
  const parenIndex = text.indexOf(" (");
  if (parenIndex === -1) return { bold: text, rest: "" };
  return { bold: text.slice(0, parenIndex), rest: text.slice(parenIndex + 1) };
}

// The reference always shows a per-month figure -- in yearly mode that's the
// discounted monthly-equivalent (annual total / 12), with the real annual
// total moved into the subtext ("per month, billed at $X per year").
function yearlySavePercent(plan: PricingPlan): number {
  if (plan.monthlyOnly || plan.price.monthly === 0) return 0;
  return Math.round(((plan.price.monthly * 12 - plan.price.yearly) / (plan.price.monthly * 12)) * 100);
}

export function PricingCard({
  plan,
  frequency,
  onSelect,
  ctaHref,
  compact = false,
}: {
  plan: PricingPlan;
  frequency: PricingFrequency;
  onSelect?: (plan: PricingPlan) => void;
  ctaHref?: string;
  /** Skips the recommended card's scale-up — for narrow containers (e.g. the admin preview) where the 8% scale would overflow and overlap neighboring content. */
  compact?: boolean;
}) {
  const yearlyUnavailable = plan.monthlyOnly && frequency === "yearly";
  const isYearly = frequency === "yearly";
  const price = isYearly ? Math.round(plan.price.yearly / 12) : plan.price.monthly;
  const savePercent = isYearly ? yearlySavePercent(plan) : 0;

  const ctaClassName = cn(
    "mb-5 w-full rounded-xl py-2.5 text-center text-[13px] font-semibold transition-all disabled:pointer-events-none disabled:opacity-50",
    plan.recommended
      ? "bg-primary text-white shadow-md hover:bg-primary-hover"
      : "border border-btn-secondary-border bg-btn-secondary text-heading hover:bg-btn-secondary-hover"
  );

  const priceBlock = (
    <>
      <h2 className="mb-1.5 text-lg font-semibold text-heading">{plan.name}</h2>
      <p className="mb-4 text-[13px] text-subtle">{plan.info}</p>

      {yearlyUnavailable ? (
        <p className="mt-2 mb-5 text-[11px] text-subtle">Not available on yearly billing</p>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <span className="text-3xl font-bold leading-none text-heading">
              $<NumberFlow value={price} className="text-3xl font-bold leading-none text-heading" />
            </span>
            {savePercent > 0 && (
              <span className="rounded-full bg-success-tint px-2 py-0.5 text-[10px] font-semibold text-success">
                Save {savePercent}%
              </span>
            )}
          </div>
          <p className="mt-2 mb-5 text-[11px] text-subtle">
            {isYearly ? `per month, billed at $${plan.price.yearly} per year` : "billed monthly"}
          </p>
        </>
      )}

      {yearlyUnavailable ? (
        <button type="button" disabled className={ctaClassName}>
          {plan.cta}
        </button>
      ) : ctaHref ? (
        <a href={ctaHref} className={ctaClassName}>
          {plan.cta}
        </a>
      ) : (
        <button type="button" onClick={() => onSelect?.(plan)} className={ctaClassName}>
          {plan.cta}
        </button>
      )}

      <div className="mt-1 flex w-full flex-col">
        <p className="mb-2.5 text-[11px] font-bold text-heading">Whats inside:</p>

        <ul className="flex w-full flex-col">
          {plan.features.map((feature) => {
            const { bold, rest } = splitFeatureText(feature.text);
            return (
              <li key={feature.text} className="flex w-full flex-col">
                <div className="flex w-full items-start gap-2">
                  <svg
                    className={cn("mt-0.5 h-3 w-3 shrink-0", plan.recommended ? "text-primary" : "text-heading")}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2.5}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>

                  <div className="flex flex-wrap items-center gap-1 text-xs">
                    <span className="font-semibold text-heading">{bold}</span>
                    {rest && <span className="text-subtle">{rest}</span>}
                  </div>
                </div>

                <div className="my-2.5 h-px w-full bg-hairline" />
              </li>
            );
          })}
        </ul>
      </div>
    </>
  );

  if (plan.recommended) {
    return (
      <div
        className={cn(
          "relative z-10 flex flex-col rounded-[2rem] bg-gradient-to-b from-primary to-primary/60 p-[6px] pt-0",
          !compact && "lg:scale-[1.08]"
        )}
      >
        <div className="flex h-9 items-center justify-center gap-1.5 text-sm font-bold text-white">
          <FireIcon className="h-5 w-5" />
          Most Popular
        </div>
        <div className="flex w-full h-full flex-grow flex-col items-stretch rounded-[1.625rem] bg-surface px-6 py-8 text-left">
          {priceBlock}
        </div>
      </div>
    );
  }

  return <div className="flex h-full flex-col rounded-3xl border border-hairline bg-surface p-6 shadow-card">{priceBlock}</div>;
}
