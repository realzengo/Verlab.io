import type { AnchorHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PlasticLinkButtonProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  children: ReactNode;
}

// Anchor counterpart to PlasticButton (src/components/ui/plastic-button.tsx) --
// same glass-pill recipe, but a plain <a> so it works from Server Components
// (no onClick/client boundary needed for a plain navigation link).
const GLASS_LINK_STYLES = `
@keyframes plastic-link-sheen {
  from { transform: translateX(-140%) skewX(-16deg); }
  to   { transform: translateX(320%)  skewX(-16deg); }
}
.plastic-link-sheen { transform: translateX(-140%) skewX(-16deg); }
.plastic-link-btn:hover .plastic-link-sheen {
  animation: plastic-link-sheen 0.85s cubic-bezier(0.32, 0, 0.24, 1);
}
.plastic-link-btn::after {
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
.plastic-link-btn:hover::after { opacity: 1; }
@media (prefers-reduced-motion: reduce) {
  .plastic-link-btn:hover .plastic-link-sheen { animation: none; }
}
`;

export function PlasticLinkButton({ children, className, ...anchorProps }: PlasticLinkButtonProps) {
  return (
    <a
      {...anchorProps}
      className={cn(
        "plastic-link-btn relative isolate inline-flex items-center justify-center gap-1.5 overflow-hidden",
        "rounded-full px-4 py-1.75 text-sm font-medium text-white",
        "transition-transform duration-150 ease-out active:scale-[0.98]",
        className
      )}
      style={{
        backgroundImage:
          "radial-gradient(101.79% 101.79% at 65.61% 81.79%, rgba(255,255,255,0.6) 0%, rgba(255,255,255,0) 100%), radial-gradient(114.65% 114.65% at 9.73% 17.27%, #1e82e0 0%, #1c38ea 100%)",
        backgroundBlendMode: "overlay, normal",
        boxShadow: "inset -3px -3px 4px rgba(191,229,251,0.4), inset 4px 4px 4px rgba(19,26,228,0.1)",
      }}
    >
      <style>{GLASS_LINK_STYLES}</style>

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

      <span
        aria-hidden
        className="plastic-link-sheen pointer-events-none absolute inset-y-0 left-0 z-10 w-1/3 blur-[5px]"
        style={{
          background: "linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.55) 50%, rgba(255,255,255,0) 100%)",
        }}
      />

      <span className="relative z-30 flex items-center gap-1.5">{children}</span>
    </a>
  );
}
