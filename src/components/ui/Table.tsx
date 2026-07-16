import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("overflow-x-auto rounded-card border border-hairline bg-surface", className)}>
      <table className="w-full min-w-[560px] border-collapse text-left text-sm">{children}</table>
    </div>
  );
}

export function TableHead({ children }: { children: ReactNode }) {
  return <thead className="border-b border-hairline bg-app">{children}</thead>;
}

export function TableRow({
  children,
  className,
  onClick,
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <tr className={cn("border-b border-hairline last:border-0", className)} onClick={onClick}>
      {children}
    </tr>
  );
}

export function TableHeaderCell({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <th className={cn("px-4 py-3 text-xs font-semibold uppercase tracking-wide text-body", className)}>
      {children}
    </th>
  );
}

export function TableCell({
  children,
  className,
  colSpan,
}: {
  children: ReactNode;
  className?: string;
  colSpan?: number;
}) {
  return (
    <td colSpan={colSpan} className={cn("px-4 py-3.5 text-sm text-heading", className)}>
      {children}
    </td>
  );
}
