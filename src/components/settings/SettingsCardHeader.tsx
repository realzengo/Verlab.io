import type { LucideIcon } from "lucide-react";

export function SettingsCardHeader({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-3.5">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary-hover text-white">
          <Icon className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-heading">{title}</h2>
          {description && <p className="text-sm text-body">{description}</p>}
        </div>
      </div>
      <div className="mt-5 border-b border-hairline" />
    </div>
  );
}
