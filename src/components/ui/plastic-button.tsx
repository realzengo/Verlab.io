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

// Same glass-pill recipe as GlassCtaButton (src/components/landing/GlassCtaButton.tsx),
// rebuilt on a <button> so it can carry onClick/disabled/loading state.
const GLASS_BUTTON_STYLES = `
@keyframes plastic-btn-sheen {
  from { transform: translateX(-140%) skewX(-16deg); }
  to   { transform: translateX(320%)  skewX(-16deg); }
}
.plastic-btn-sheen { transform: translateX(-140%) skewX(-16deg); }
.plastic-btn:hover .plastic-btn-sheen {
  animation: plastic-btn-sheen 0.85s cubic-bezier(0.32, 0, 0.24, 1);
}
.plastic-btn::after {
  content: "";
  position: absolute;
  inset: 1px;
  z-index: 1;
  border-radius: inherit;
  opacity: 0;
  mix-blend-mode: overlay;
  background: radial-gradient(101.79% 101.79% at 65.61% 81.79%, rgba(255,255,255,0.6) 0%, rgba(255,255,255,0) 100%);
  transition: opacity 0.3s ease-in-out;
}
.plastic-btn:hover::after { opacity: 1; }
@media (prefers-reduced-motion: reduce) {
  .plastic-btn:hover .plastic-btn-sheen { animation: none; }
}
`;

export const PlasticButton = forwardRef<HTMLButtonElement, PlasticButtonProps>(
  ({ text, loading = false, loadingText = "Generating…", disabled = false, trailing, onClick, className, type = "button" }, ref) => {
    return (
      <button
        ref={ref}
        type={type}
        onClick={onClick}
        disabled={disabled || loading}
        className={cn(
          "plastic-btn relative isolate inline-flex items-center justify-center gap-1.5 overflow-hidden",
          "rounded-full px-4 py-1.75 text-sm font-medium text-white",
          "transition-transform duration-150 ease-out active:scale-[0.98]",
          "disabled:opacity-50 disabled:pointer-events-none",
          className
        )}
        style={{
          backgroundImage:
            "radial-gradient(101.79% 101.79% at 65.61% 81.79%, rgba(255,255,255,0.6) 0%, rgba(255,255,255,0) 100%), radial-gradient(114.65% 114.65% at 9.73% 17.27%, #1e82e0 0%, #1c38ea 100%)",
          backgroundBlendMode: "overlay, normal",
          boxShadow: "inset -3px -3px 4px rgba(191,229,251,0.4), inset 4px 4px 4px rgba(19,26,228,0.1)",
        }}
      >
        <style>{GLASS_BUTTON_STYLES}</style>

        {/* The lit edge. Blurred by a hair so it reads as glass, not as a stroke. */}
        <span aria-hidden className="pointer-events-none absolute inset-0 z-20 blur-[1px]">
          <span
            className="absolute -left-px -top-px z-20 h-full w-full"
            style={{
              opacity: 0.45,
              padding: 2,
              borderRadius: 9999,
              background: "linear-gradient(176.87deg, rgba(255,255,255,0.5) 8.56%, rgba(255,255,255,0) 85.04%)",
              WebkitMask: "linear-gradient(#fff, #fff) content-box, linear-gradient(#fff, #fff)",
              WebkitMaskComposite: "xor",
              mask: "linear-gradient(#fff, #fff) content-box, linear-gradient(#fff, #fff)",
              maskComposite: "exclude",
            }}
          />
        </span>

        {/* The sweep. It waits off the left edge and crosses once per hover. */}
        <span
          aria-hidden
          className="plastic-btn-sheen pointer-events-none absolute inset-y-0 left-0 z-10 w-1/3 blur-[5px]"
          style={{
            background: "linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.55) 50%, rgba(255,255,255,0) 100%)",
          }}
        />

        <span className="relative z-30 flex items-center gap-1.5">
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
