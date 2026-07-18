import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface BaseProps {
  children: ReactNode;
  className?: string;
}

type ButtonProps = BaseProps & ButtonHTMLAttributes<HTMLButtonElement> & { href?: undefined };
type LinkProps = BaseProps & AnchorHTMLAttributes<HTMLAnchorElement> & { href: string };

export function GlassButton(props: ButtonProps | LinkProps) {
  const { children, className, ...rest } = props;

  const classes = cn(
    "group btn-bevel inline-flex items-center rounded-[1.15rem] px-8 py-6 text-lg font-semibold backdrop-blur-md",
    "bg-btn-primary/95 hover:bg-btn-primary",
    "text-white transition-all duration-300 hover:-translate-y-0.5",
    "border border-primary/20 dark:border-white/10",
    "hover:shadow-md hover:shadow-primary/30 dark:hover:shadow-primary/20",
    className
  );

  const content = (
    <>
      <span className="opacity-90 transition-opacity group-hover:opacity-100">{children}</span>
      <span className="ml-3 opacity-70 transition-all duration-300 group-hover:translate-x-1.5 group-hover:opacity-100">
        →
      </span>
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
