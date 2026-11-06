import { forwardRef, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface PlasticButtonProps {
  text: ReactNode;
  loading?: boolean;
  loadingText?: ReactNode;
  disabled?: boolean;
  trailing?: ReactNode;
  onClick?(): void;
  className?: string;
  type?: "button" | "submit";
}

// Same chunky, extruded CTA recipe as the landing page's "Try Verlab Now"
// button (src/components/landing/VerlabProcess.tsx) -- a flat bottom-edge
// shadow reads as a pressed 3D lip, and active: drops the button onto it.
// Hover is the nav CTA's light sweep + face wash (`.cta-shine`, globals.css).
export const PlasticButton = forwardRef<HTMLButtonElement, PlasticButtonProps>(
  ({ text, loading = false, loadingText = "Generating…", disabled = false, trailing, onClick, className, type = "button" }, ref) => {
    return (
      <button
        ref={ref}
        type={type}
        onClick={onClick}
        disabled={disabled || loading}
        className={cn(
          "cta-shine relative isolate inline-flex items-center justify-center gap-1.5 overflow-hidden",
          "rounded-2xl bg-[radial-gradient(220%_220%_at_28%_18%,#6d9bff_0%,#335cff_65%,#1c3fd6_100%)] px-4 py-1.75 text-sm font-bold text-white",
          "shadow-[0_4px_0_0_#1a37c4,inset_0_1px_0_0_rgba(255,255,255,0.5),inset_0_-1px_0_0_rgba(0,0,0,0.25)]",
          "transition-[transform,box-shadow] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
          "active:translate-y-1 active:shadow-[0_0_0_0_#1a37c4,inset_0_1px_0_0_rgba(255,255,255,0.5),inset_0_-1px_0_0_rgba(0,0,0,0.25)] active:duration-100",
          "disabled:translate-y-0 disabled:opacity-50 disabled:pointer-events-none",
          className
        )}
      >
        <span className="relative z-10 flex items-center gap-1.5">
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {loadingText}
            </>
          ) : (
            <>
              {text}
              {trailing}
            </>
          )}
        </span>
      </button>
    );
  }
);

PlasticButton.displayName = "PlasticButton";
