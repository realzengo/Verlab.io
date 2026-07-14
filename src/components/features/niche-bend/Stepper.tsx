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
    <div className="sticky top-0 z-20 -mt-2 bg-app/95 py-4 backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-center gap-2">
        {STEPS.map(({ step, label }, index) => {
          const complete = step < currentStep;
          const current = step === currentStep;
          const clickable = complete && !!onStepClick;
          return (
            <div key={step} className="flex flex-1 items-center gap-2 last:flex-none">
              <button
                type="button"
                disabled={!clickable}
                onClick={() => onStepClick?.(step)}
                className={cn(
                  "flex shrink-0 items-center gap-2 rounded-full",
                  clickable && "cursor-pointer hover:opacity-80"
                )}
              >
                <span
                  className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                    complete || current ? "bg-primary text-white" : "bg-accent text-primary"
                  )}
                >
                  {complete ? <Check className="h-3.5 w-3.5" /> : step}
                </span>
                <span
                  className={cn(
                    "hidden text-sm font-semibold sm:inline",
                    complete || current ? "text-heading" : "text-body"
                  )}
                >
                  {label}
                </span>
              </button>
              {index < STEPS.length - 1 && (
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-accent">
                  <div
                    className="h-full rounded-full bg-primary transition-[width] duration-300"
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
