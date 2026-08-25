"use client";

import Image from "next/image";
import { motion, type MotionStyle } from "framer-motion";
import { cn } from "@/lib/utils";

export interface PayPalNotificationProps {
  amount: string;
  className?: string;
  /** Motion values (e.g. scroll-linked y/opacity) go here, not on a wrapping
   * element -- opacity or transform on an ancestor creates a new stacking
   * context that cuts off backdrop-filter from the real page behind it,
   * flattening the frosted glass into a plain dark box. */
  style?: MotionStyle;
}

/**
 * iOS-style glass notification: dark, blurred, with a hairline that catches
 * light only along the top edge — matches the system banner's real material.
 */
export function PayPalNotification({ amount, className, style }: PayPalNotificationProps) {
  return (
    <motion.div
      style={style}
      className={cn(
        "w-[320px] shrink-0 rounded-[22px] bg-black/30 p-3 backdrop-blur-2xl backdrop-saturate-150 sm:w-[380px] sm:p-3.5",
        "shadow-[inset_0_1px_0_rgba(255,255,255,0.25),inset_0_0_0_1px_rgba(255,255,255,0.08),0_24px_48px_-16px_rgba(0,0,0,0.55)]",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-white p-[7px] sm:h-10 sm:w-10">
          <Image
            src="/paypal-symbol.png"
            alt=""
            width={80}
            height={96}
            className="h-full w-full object-contain"
          />
        </div>
        <div className="min-w-0 flex-1 pt-px">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-[14px] font-semibold tracking-[-0.1px] text-white sm:text-[15px]">
              PayPal
            </p>
            <span className="shrink-0 text-[11px] text-white/45 sm:text-[12px]">now</span>
          </div>
          <p className="mt-0.5 text-[12.5px] leading-snug text-white/80 sm:text-[13.5px]">
            You received ${amount} USD from Paypal Inc.
          </p>
        </div>
      </div>
    </motion.div>
  );
}

export default PayPalNotification;
