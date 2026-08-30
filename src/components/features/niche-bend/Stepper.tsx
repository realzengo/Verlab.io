import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS: { step: 1 | 2 | 3; label: string }[] = [
  { step: 1, label: "Analyze" },
  { step: 2, label: "Choose Bend" },
  { step: 3, label: "Your SOP" },
];

export function Stepper({
  currentStep,
  onStepClick,
}: {
  currentStep: 1 | 2 | 3;
  onStepClick?: (step: 1 | 2 | 3) => void;
}) {
  return (
    <div className="sticky top-0 z-20 -mt-2 bg-white/80 py-5 backdrop-blur-xl dark:bg-black/80">
      <div className="mx-auto flex max-w-3xl items-center gap-2">
        {STEPS.map(({ step, label }, index) => {
          const complete = step < currentStep;
          const current = step === currentStep;
          const clickable = complete && !!onStepClick;
          return (
            <div key={step} className="flex flex-1 items-center gap-2.5 last:flex-none">
              <button
                type="button"
                disabled={!clickable}
                onClick={() => onStepClick?.(step)}
                className={cn(
                  "flex shrink-0 items-center gap-2.5 rounded-full transition-opacity",
                  clickable && "cursor-pointer hover:opacity-70"
                )}
              >
                <span
                  className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors duration-300",
                    (current || complete) && "bg-gradient-to-br from-[#6d93ff] to-primary text-white",
                    !current && !complete && "bg-accent text-body"
                  )}
                >
                  {complete ? <Check className="h-3.5 w-3.5" strokeWidth={2.5} /> : step}
                </span>
                <span
                  className={cn(
                    "hidden text-sm tracking-[-0.01em] sm:inline",
                    current ? "font-semibold text-heading" : complete ? "font-medium text-heading/80" : "font-medium text-body"
                  )}
                >
                  {label}
                </span>
              </button>
              {index < STEPS.length - 1 && (
                <div className="h-px flex-1 bg-hairline">
                  <div
                    className="h-full bg-gradient-to-r from-[#6d93ff] to-primary transition-[width] duration-500 ease-out"
                    style={{ width: complete ? "100%" : "0%" }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
