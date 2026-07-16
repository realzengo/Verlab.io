import { CreditCard, Cog, FileText, UserRound } from "lucide-react";
import type { ActivityLogEntry, ActivityType } from "@/lib/types";
import { cn } from "@/lib/utils";

const TYPE_ICON: Record<ActivityType, typeof UserRound> = {
  billing: CreditCard,
  user: UserRound,
  system: Cog,
  content: FileText,
};

const TYPE_CLASSES: Record<ActivityType, string> = {
  billing: "bg-success-tint text-success",
  user: "bg-accent text-primary",
  system: "bg-warning-tint text-warning",
  content: "bg-[#f3e8ff] text-[#7c3aed] dark:bg-violet-400/15 dark:text-violet-300",
};

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const hours = Math.round(diffMs / 3_600_000);
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function ActivityFeed({ entries }: { entries: ActivityLogEntry[] }) {
  return (
    <ul className="flex flex-col">
      {entries.map((entry, i) => {
        const Icon = TYPE_ICON[entry.type];
        return (
          <li key={entry.id} className={cn("flex items-start gap-3 py-3", i !== entries.length - 1 && "border-b border-hairline")}>
            <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full", TYPE_CLASSES[entry.type])}>
              <Icon className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-heading">{entry.message}</p>
              <p className="mt-0.5 text-xs text-body">{entry.actor}</p>
            </div>
            <span className="shrink-0 whitespace-nowrap text-xs text-subtle">{timeAgo(entry.timestamp)}</span>
          </li>
        );
      })}
    </ul>
  );
}
