"use client";

import * as React from "react";
import * as TogglePrimitive from "@radix-ui/react-toggle";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const toggleVariants = cva(
  "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full text-body transition-colors hover:text-heading focus:outline-none focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 data-[state=on]:text-heading",
  {
    variants: {
      variant: {
        default: "border border-hairline bg-surface hover:bg-accent",
        ghost: "border border-transparent bg-transparent hover:bg-accent",
      },
      size: {
        default: "h-9 w-9",
        sm: "h-8 w-8",
        lg: "h-11 w-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

const Toggle = React.forwardRef<
  React.ElementRef<typeof TogglePrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof TogglePrimitive.Root> &
    VariantProps<typeof toggleVariants>
>(({ className, variant, size, ...props }, ref) => (
  <TogglePrimitive.Root
    ref={ref}
    className={cn(toggleVariants({ variant, size, className }))}
    {...props}
  />
));

Toggle.displayName = TogglePrimitive.Root.displayName;

export { Toggle, toggleVariants };
