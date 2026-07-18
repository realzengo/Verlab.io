"use client";

import { forwardRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface GlowButtonProps {
  label?: string;
  onClick?(): void;
  className?: string;
}

export const GlowButton = forwardRef<HTMLButtonElement, GlowButtonProps>(
  ({ label = "Generate", onClick, className }, ref) => {
    const [isClicked, setIsClicked] = useState(false);

    const handleClick = () => {
      setIsClicked(true);
      setTimeout(() => setIsClicked(false), 200);
      onClick?.();
    };

    return (
      <button
        ref={ref}
        type="button"
        aria-label={label}
        className={cn(
          "glow-btn btn-bevel inline-flex items-center justify-center rounded-full bg-btn-primary px-5 py-2.5 text-sm font-semibold text-white transition-transform hover:-translate-y-px",
          className
        )}
        onClick={handleClick}
        data-state={isClicked ? "clicked" : undefined}
      >
        <span className="flex items-center justify-center gap-1.5">
          {label}
          <Sparkles size={16} className="ml-0.5" />
        </span>
      </button>
    );
  }
);

GlowButton.displayName = "GlowButton";
