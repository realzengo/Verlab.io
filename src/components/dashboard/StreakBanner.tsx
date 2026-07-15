import { Flame, Gift } from "lucide-react";
import type { MockUser } from "@/lib/types";
import { cn } from "@/lib/utils";

export function StreakBanner({ streak }: { streak: MockUser["streak"] }) {
  return (
    <div className="flex flex-col gap-4 rounded-card border border-hairline bg-gradient-to-r from-amber-500/[0.06] to-transparent p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3.5">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-amber-500">
          <Flame className="h-5 w-5" />
        </span>
        <div>
          <p className="text-sm font-semibold text-heading">{streak.current}-day streak</p>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-body">
            <Gift className="h-3.5 w-3.5 text-amber-500" />
            $100 monthly raffle — hit a {streak.goal}-day streak to enter ({streak.daysToGo} days to go).
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 pl-14 sm:pl-0">
        {streak.days.map((day, i) => (
          <div
            key={i}
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition-colors",
              day.status === "hit" && "bg-primary text-white",
              day.status === "today" && "bg-amber-500 text-white shadow-[0_0_0_3px] shadow-amber-500/20",
              day.status === "missed" && "bg-app text-subtle",
              day.status === "future" && "border border-hairline text-body"
            )}
          >
            {day.status === "today" ? <Flame className="h-3.5 w-3.5" /> : day.label}
          </div>
        ))}
      </div>
    </div>
  );
}
