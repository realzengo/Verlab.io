import { cn } from "@/lib/utils";

export function LogoMark({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 2363 2363" fill="currentColor" aria-hidden className={className} style={style}>
      <path d="M192,236 34,532 1019,2234 1343,2238 2331,519 2187,246 1442,239 1332,999 1690,1135 1334,1279 1203,1638 1058,1281 700,1149 1054,1002 915,239Z" />
    </svg>
  );
}

export function Logo({ className, height = 24 }: { className?: string; height?: number }) {
  return (
    <span
      className={cn("inline-flex items-center tracking-tight text-heading font-logo", className)}
      style={{ height, fontSize: height * 0.82, lineHeight: 1 }}
    >
      <span className="font-black">Verlab</span>
      <span className="font-normal">&nbsp;Studio</span>
    </span>
  );
}
