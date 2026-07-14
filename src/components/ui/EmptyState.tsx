import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: { label: string; href: string };
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-card border border-dashed border-hairline bg-white px-6 py-16 text-center">
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
