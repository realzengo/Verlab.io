"use client";

import * as React from "react";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "destructive";
type Size = "default" | "sm";
type Haptic = "heavy" | "light" | "none";

const SWITCH_THEME = {
  "--ease-spring": "cubic-bezier(0.175, 0.885, 0.32, 1.275)",
} as React.CSSProperties;

const TRACK_SIZE_CLASSES: Record<Size, string> = {
  default: "h-8 w-[52px]",
  sm: "h-6 w-10",
};

const TRACK_CHECKED_CLASSES: Record<Variant, string> = {
  primary: "bg-primary border-primary",
  destructive: "bg-danger border-danger",
};

const HALO_CHECKED_CLASSES: Record<Variant, string> = {
  primary: "bg-primary",
  destructive: "bg-danger",
};

const ICON_CHECKED_CLASSES: Record<Variant, string> = {
  primary: "text-primary",
  destructive: "text-danger",
};

function playHapticFeedback(type: Haptic) {
  if (type === "none" || typeof window === "undefined") return;

  try {
    const AudioContextCtor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) return;

    const ctx = new AudioContextCtor();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    const now = ctx.currentTime;

    if (type === "heavy") {
      oscillator.type = "triangle";
      oscillator.frequency.setValueAtTime(180, now);
      oscillator.frequency.exponentialRampToValueAtTime(40, now + 0.15);
      gainNode.gain.setValueAtTime(0.4, now);
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
      oscillator.start(now);
      oscillator.stop(now + 0.15);
    } else {
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(800, now);
      gainNode.gain.setValueAtTime(0.15, now);
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
      oscillator.start(now);
      oscillator.stop(now + 0.08);
    }
  } catch {
    // Best-effort audio cue — safe to ignore (e.g. autoplay policy blocks it).
  }
}

export interface SwitchProps {
  checked: boolean;
  onChange?: () => void;
  onCheckedChange?: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
  variant?: Variant;
  size?: Size;
  showIcons?: boolean;
  checkedIcon?: React.ReactNode;
  uncheckedIcon?: React.ReactNode;
  haptic?: Haptic;
  className?: string;
}

export function Switch({
  checked,
  onChange,
  onCheckedChange,
  label,
  disabled = false,
  variant = "primary",
  size = "default",
  showIcons = false,
  checkedIcon,
  uncheckedIcon,
  haptic = "none",
  className,
}: SwitchProps) {
  const [isPressed, setIsPressed] = React.useState(false);
  const [isHovered, setIsHovered] = React.useState(false);

  const isSmall = size === "sm";
  const shouldRenderIcons = showIcons || !!checkedIcon || !!uncheckedIcon;

  const translateDist = isSmall ? "translate-x-[16px]" : "translate-x-[20px]";
  const handleSizeUnchecked = isSmall ? "ml-[2px] h-3 w-3" : "ml-[2px] h-4 w-4";
  const handleSizeChecked = isSmall ? "h-4 w-4" : "h-6 w-6";
  const handleSizePressed = isSmall ? "-ml-[2px] h-5 w-5" : "-ml-[2px] h-7 w-7";
  const iconClasses = isSmall ? "h-2.5 w-2.5" : "h-3.5 w-3.5";

  function handleClick() {
    if (disabled) return;
    playHapticFeedback(haptic);
    onChange?.();
    onCheckedChange?.(!checked);
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={handleClick}
      onPointerDown={() => !disabled && setIsPressed(true)}
      onPointerUp={() => setIsPressed(false)}
      onPointerLeave={() => {
        setIsPressed(false);
        setIsHovered(false);
      }}
      onPointerEnter={() => !disabled && setIsHovered(true)}
      style={SWITCH_THEME}
      className={cn(
        "inline-flex shrink-0 cursor-pointer items-center rounded-full border-2 transition-colors duration-300",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "disabled:cursor-not-allowed disabled:opacity-50",
        TRACK_SIZE_CLASSES[size],
        checked ? TRACK_CHECKED_CLASSES[variant] : "border-hairline bg-hairline",
        className
      )}
    >
      <span
        className={cn(
          "block h-full w-full transition-transform duration-300 ease-[var(--ease-spring)]",
          checked ? translateDist : "translate-x-0"
        )}
      >
        <span
          className={cn(
            "absolute top-1/2 left-[2px] flex -translate-y-1/2 items-center justify-center rounded-full bg-white shadow-sm transition-all duration-300",
            isPressed
              ? handleSizePressed
              : checked || (shouldRenderIcons && !isSmall)
                ? handleSizeChecked
                : handleSizeUnchecked
          )}
        >
          {shouldRenderIcons && (
            <span className="relative flex h-full w-full items-center justify-center overflow-hidden">
              <span
                className={cn(
                  "absolute inset-0 flex items-center justify-center transition-all duration-300",
                  ICON_CHECKED_CLASSES[variant],
                  checked ? "rotate-0 scale-100 opacity-100" : "-rotate-45 scale-50 opacity-0"
                )}
              >
                {checkedIcon ?? <Check className={iconClasses} strokeWidth={4} />}
              </span>
              <span
                className={cn(
                  "absolute inset-0 flex items-center justify-center text-subtle transition-all duration-300",
                  !checked ? "rotate-0 scale-100 opacity-100" : "rotate-45 scale-50 opacity-0"
                )}
              >
                {uncheckedIcon ?? <X className={iconClasses} strokeWidth={4} />}
              </span>
            </span>
          )}
        </span>

        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute top-1/2 left-[2px] -translate-x-1/2 -translate-y-1/2 rounded-full transition-all duration-200",
            isSmall ? "h-8 w-8" : "h-10 w-10",
            checked ? HALO_CHECKED_CLASSES[variant] : "bg-foreground",
            isPressed ? "scale-100 opacity-10" : isHovered ? "scale-100 opacity-5" : "scale-50 opacity-0",
            checked ? "left-[14px]" : shouldRenderIcons && !isSmall ? "left-[14px]" : "left-[10px]",
            isSmall && (checked ? "left-[10px]" : "left-[8px]")
          )}
        />
      </span>
    </button>
  );
}
