import { CreditCard, Cog, FileText, UserRound } from "lucide-react";
import type { ActivityLogEntry, ActivityType } from "@/lib/types";
import { cn } from "@/lib/utils";

const TYPE_ICON: Record<ActivityType, typeof UserRound> = {
  billing: CreditCard,
  user: UserRound,
  system: Cog,
  content: FileText,
};

// Category dots, the sticker palette's other sanctioned use alongside icon
// tiles: one color per activity kind, carried on the plate only.
const TYPE_STICKER: Record<ActivityType, string> = {
  billing: "admin-sticker-green",
  user: "admin-sticker-blue",
  system: "admin-sticker-orange",
  content: "admin-sticker-purple",
};

export function ActivityFeed({ entries }: { entries: ActivityLogEntry[] }) {
  return (
    <ul className="flex flex-col">
      {entries.map((entry, i) => {
        const Icon = TYPE_ICON[entry.type];
        return (
          <li
            key={entry.id}
            className={cn("flex items-start gap-3 py-3", i !== entries.length - 1 && "border-b border-hairline")}
          >
            <span
              className={cn(
                "admin-sticker flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                TYPE_STICKER[entry.type]
              )}
            >
              <Icon className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] leading-[1.33] text-heading">{entry.message}</p>
              <p className="mt-0.5 text-sm text-subtle">{entry.actor}</p>
            </div>
            <span className="shrink-0 whitespace-nowrap text-sm text-subtle">{timeAgo(entry.timestamp)}</span>
          </li>
        );
      })}
    </ul>
  );
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const hours = Math.round(diffMs / 3_600_000);
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}
