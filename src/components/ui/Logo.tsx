import Image from "next/image";
import { cn } from "@/lib/utils";

export function Logo({ className, height = 24 }: { className?: string; height?: number }) {
  const width = height * 4; // source wordmark is ~4:1

  return (
    <span className={cn("inline-flex items-center", className)} style={{ height }}>
      <Image
        src="/logo/clypa-logo-light.png"
        alt="Clypa"
        width={width}
        height={height}
        priority
        className="block h-full w-auto dark:hidden"
      />
      <Image
        src="/logo/clypa-logo-dark.png"
        alt="Clypa"
        width={width}
        height={height}
        priority
        className="hidden h-full w-auto dark:block"
      />
    </span>
  );
}
