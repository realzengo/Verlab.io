import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS: { step: 1 | 2 | 3; label: string }[] = [
  { step: 1, label: "Analyze" },
  { step: 2, label: "Choose a bend" },
  { step: 3, label: "Your SOP" },
];

// The MCP page's tab track: a soft gray pill holding white segments, with
// mono step numbers. Sticky so it stays in reach through the long SOP.
export function Stepper({
  currentStep,
  onStepClick,
}: {
  currentStep: 1 | 2 | 3;
  onStepClick?: (step: 1 | 2 | 3) => void;
}) {
  return (
    <div className="pointer-events-none sticky top-3 z-20 flex justify-center">
      <nav
        aria-label="Progress"
        className="pointer-events-auto inline-flex items-center gap-0.5 rounded-full border border-[#EBEDF0] bg-[#F5F6F8]/95 p-1 shadow-[0_8px_24px_-14px_rgba(15,23,42,0.25)] backdrop-blur-sm dark:border-white/[0.06] dark:bg-[#141416]/95"
      >
        {STEPS.map(({ step, label }) => {
          const complete = step < currentStep;
          const current = step === currentStep;
          const clickable = complete && !!onStepClick;
          return (
            <button
              key={step}
              type="button"
              disabled={!clickable}
              onClick={() => onStepClick?.(step)}
              aria-current={current ? "step" : undefined}
              className={cn(
                "inline-flex h-8 items-center gap-2 rounded-full px-3.5 text-[13px] font-medium transition-colors duration-150",
                current
                  ? "bg-white text-heading shadow-[0_1px_2px_rgba(15,23,42,0.08),0_0_0_1px_rgba(15,23,42,0.05)] dark:bg-[#232326] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_0_0_1px_rgba(255,255,255,0.06)]"
                  : complete
                    ? "text-heading hover:bg-white/70 dark:hover:bg-white/5"
                    : "text-subtle"
              )}
            >
              {complete ? (
                <Check className="h-3.5 w-3.5 text-primary" strokeWidth={2.25} />
              ) : (
                <span className="font-mono text-[11px] tracking-wider text-subtle">0{step}</span>
              )}
              <span className={cn(!current && "hidden sm:inline")}>{label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
