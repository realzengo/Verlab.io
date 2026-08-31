import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "text" | "white" | "tactileLight" | "tactileBlue" | "flatBlue";
type Size = "sm" | "md" | "lg";

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: "bg-btn-primary text-white hover:bg-btn-primary-hover",
  secondary:
    "bg-btn-secondary text-heading border border-btn-secondary-border hover:bg-btn-secondary-hover hover:-translate-y-px active:scale-95 btn-secondary",
  ghost: "bg-transparent text-heading hover:bg-accent",
  text: "bg-transparent text-primary hover:underline underline-offset-4 px-0",
  white: "btn-white bg-white text-primary hover:bg-[#f2f4ff] hover:-translate-y-px",
  tactileLight: "btn-tactile-light rounded-[1.25rem]! text-[#0f172a]",
  tactileBlue: "btn-tactile-blue rounded-[1.25rem]! text-white",
  flatBlue: "btn-flat-blue rounded-[1.25rem]! text-white",
};

const TACTILE_VARIANTS: Variant[] = ["tactileLight", "tactileBlue", "flatBlue"];

const SIZE_CLASSES: Record<Size, string> = {
  sm: "text-xs px-3.5 py-1.5 gap-1.5",
  md: "text-sm px-5 py-2.5 gap-2",
  lg: "text-base px-6 py-3 gap-2",
};

interface BaseProps {
  variant?: Variant;
  size?: Size;
  icon?: LucideIcon;
  iconPosition?: "left" | "right";
  bevel?: boolean;
  /** Small uppercase label above the main text — the tactile variants' two-line pill look. */
  eyebrow?: string;
  /** Extra classes for the icon — e.g. "fill-current" for closed-shape icons like Sparkle. Leave unset for line icons like ArrowRight, whose open paths render a filled sliver artifact under fill-current. */
  iconClassName?: string;
  children: ReactNode;
  className?: string;
}

type ButtonProps = BaseProps &
  ButtonHTMLAttributes<HTMLButtonElement> & { href?: undefined };

type LinkProps = BaseProps &
  AnchorHTMLAttributes<HTMLAnchorElement> & { href: string };

export function Button(props: ButtonProps | LinkProps) {
  const {
    variant = "primary",
    size = "md",
    icon: Icon,
    iconPosition = "left",
    bevel = false,
    eyebrow,
    iconClassName,
    children,
    className,
    ...rest
  } = props;

  const isTactile = TACTILE_VARIANTS.includes(variant);

  const classes = cn(
    "inline-flex items-center justify-center font-ui font-semibold transition-[background-color,box-shadow,transform] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-app disabled:opacity-50 disabled:pointer-events-none",
    !isTactile && variant !== "text" && "rounded-full",
    !isTactile && variant !== "text" && bevel && "btn-bevel",
    VARIANT_CLASSES[variant],
    isTactile ? "px-8 py-4 gap-2.5" : SIZE_CLASSES[size],
    className
  );

  const content = isTactile ? (
    <>
      {Icon && iconPosition === "left" && <Icon className={cn("h-5 w-5 shrink-0", iconClassName)} />}
      {eyebrow ? (
        <span className="text-left">
          <span className="mb-[-2px] block text-[10px] font-bold uppercase tracking-wider opacity-60">{eyebrow}</span>
          <span className="block text-lg font-bold leading-none tracking-tight antialiased">{children}</span>
        </span>
      ) : (
        <span className="text-lg font-bold leading-none tracking-tight antialiased">{children}</span>
      )}
      {Icon && iconPosition === "right" && <Icon className={cn("h-5 w-5 shrink-0", iconClassName)} />}
    </>
  ) : (
    <>
      {Icon && iconPosition === "left" && <Icon className="h-4 w-4 shrink-0" />}
      {children}
      {Icon && iconPosition === "right" && <Icon className="h-4 w-4 shrink-0" />}
    </>
  );

  if ("href" in props && props.href) {
    return (
      <Link href={props.href} className={classes} {...(rest as AnchorHTMLAttributes<HTMLAnchorElement>)}>
        {content}
      </Link>
    );
  }

  return (
    <button className={classes} {...(rest as ButtonHTMLAttributes<HTMLButtonElement>)}>
      {content}
    </button>
  );
}
