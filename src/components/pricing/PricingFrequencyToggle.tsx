import type { PricingFrequency } from "@/lib/types";
import { cn } from "@/lib/utils";

const FREQUENCIES: PricingFrequency[] = ["monthly", "yearly"];

export function PricingFrequencyToggle({
  frequency,
  onChange,
}: {
  frequency: PricingFrequency;
  onChange: (frequency: PricingFrequency) => void;
}) {
  const activeIndex = FREQUENCIES.indexOf(frequency);

  return (
    <div className="relative mx-auto flex w-fit rounded-full border border-hairline bg-app p-1">
      <span
        className="absolute inset-y-1 w-[calc(50%-4px)] rounded-full bg-primary shadow-blue transition-transform duration-300 ease-out"
        style={{ transform: `translateX(${activeIndex * 100}%)` }}
        aria-hidden
      />
      {FREQUENCIES.map((freq) => (
        <button
          key={freq}
          type="button"
          onClick={() => onChange(freq)}
          className={cn(
            "relative z-10 w-24 rounded-full py-1.5 text-sm font-semibold capitalize transition-colors",
            frequency === freq ? "text-white" : "text-body hover:text-heading"
          )}
        >
          {freq}
        </button>
      ))}
    </div>
  );
}
