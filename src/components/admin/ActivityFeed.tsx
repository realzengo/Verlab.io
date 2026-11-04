import { CreditCard, Cog, FileText, UserRound } from "lucide-react";
import type { ActivityLogEntry, ActivityType } from "@/lib/types";

const TYPE_ICON: Record<ActivityType, typeof UserRound> = {
  billing: CreditCard,
  user: UserRound,
  system: Cog,
  content: FileText,
};

const TYPE_LABEL: Record<ActivityType, string> = {
  billing: "Billing",
  user: "User",
  system: "System",
  content: "Content",
};

// A timeline: one neutral glyph per kind on a rail, the message in ink, who
// and when in muted ink. The kind is named in text, never carried by color.
export function ActivityFeed({ entries }: { entries: ActivityLogEntry[] }) {
  if (entries.length === 0) {
    return <p className="py-8 text-center text-[13px] text-subtle">No activity recorded yet.</p>;
  }

  return (
    <ol className="relative flex flex-col">
      {entries.map((entry, i) => {
        const Icon = TYPE_ICON[entry.type];
        const last = i === entries.length - 1;
        return (
          <li key={entry.id} className="relative flex gap-3 pb-4 last:pb-0">
            {!last && <span aria-hidden="true" className="absolute bottom-0 left-[13px] top-7 w-px bg-hairline" />}
            <span className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-hairline bg-surface text-subtle">
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1 pt-1">
              <div className="flex items-baseline justify-between gap-3">
                <p className="min-w-0 text-[13px] leading-5 text-heading">{entry.message}</p>
                <time dateTime={entry.timestamp} className="shrink-0 whitespace-nowrap text-[12px] text-subtle">
                  {timeAgo(entry.timestamp)}
                </time>
              </div>
              <p className="mt-0.5 text-[12px] text-subtle">
                {TYPE_LABEL[entry.type]} · {entry.actor}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}
