import { Children } from "react";
import { cn } from "@/lib/utils";

export function OrbitingCircles({
  className,
  children,
  reverse,
  duration = 20,
  radius = 160,
  speed = 1,
}: {
  className?: string;
  children: React.ReactNode;
  reverse?: boolean;
  duration?: number;
  radius?: number;
  speed?: number;
}) {
  const calculatedDuration = duration / speed;
  const items = Children.toArray(children);

  return (
    <>
      <svg xmlns="http://www.w3.org/2000/svg" className="pointer-events-none absolute inset-0 size-full">
        <circle
          className="stroke-primary/[0.14]"
          strokeDasharray="5 5"
          cx="50%"
          cy="50%"
          r={radius}
          fill="none"
        />
      </svg>
      {items.map((child, index) => {
        const angle = (360 / items.length) * index;
        return (
          <div
            key={index}
            style={
              {
                "--duration": calculatedDuration,
                "--radius": radius,
                "--angle": angle,
              } as React.CSSProperties
            }
            className={cn(
              "absolute left-1/2 top-1/2 flex size-4 -translate-x-1/2 -translate-y-1/2 transform-gpu animate-orbit items-center justify-center rounded-full",
              reverse && "[animation-direction:reverse]",
              className
            )}
          >
            {child}
          </div>
        );
      })}
    </>
  );
}
