import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: { label: string; href: string };
  /** Extra classes, e.g. `flex-1 justify-center` to fill a stretched panel. */
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center gap-3 rounded-card border border-dashed border-hairline bg-surface px-6 py-16 text-center", className)}>
      <div className="flex h-12 w-12 items-center justify-center rounded-chip bg-accent">
        <Icon className="h-5 w-5 text-primary" />
      </div>
      <h3 className="text-base font-semibold text-heading">{title}</h3>
      <p className="max-w-sm text-sm text-body">{description}</p>
      {action && (
        <Button href={action.href} size="sm" className="mt-2">
          {action.label}
        </Button>
      )}
    </div>
  );
}
