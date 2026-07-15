import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "text" | "white";
type Size = "sm" | "md" | "lg";

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: "bg-primary text-white btn-glow hover:bg-primary-hover hover:-translate-y-px active:scale-95",
  secondary: "bg-surface text-heading border border-hairline hover:bg-app",
  ghost: "bg-transparent text-heading hover:bg-accent",
  text: "bg-transparent text-primary hover:underline underline-offset-4 px-0",
  white: "bg-white text-primary hover:bg-[#f2f4ff] hover:-translate-y-px",
};

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
    children,
    className,
    ...rest
  } = props;

  const classes = cn(
    "inline-flex items-center justify-center rounded-full font-semibold transition-[background-color,box-shadow,transform] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none",
    variant !== "text" && "rounded-full",
    VARIANT_CLASSES[variant],
    SIZE_CLASSES[size],
    className
  );

  const content = (
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
