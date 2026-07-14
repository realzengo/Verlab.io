import type { MockUser } from "@/lib/types";
import { cn } from "@/lib/utils";

export function StreakBanner({ streak }: { streak: MockUser["streak"] }) {
  return (
    <div className="flex flex-col gap-4 rounded-card border border-hairline bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-heading">
        <span className="font-semibold">
          {streak.current}-day streak <span aria-hidden>🔥</span>
        </span>{" "}
        — hit a {streak.goal}-day streak to enter the monthly raffle ({streak.daysToGo} days to go).
      </p>

      <div className="flex items-center gap-2">
        {streak.days.map((day, i) => (
          <div
            key={i}
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold",
              day.status === "hit" && "bg-primary text-white",
              day.status === "today" && "border-2 border-primary text-primary",
              day.status === "missed" && "bg-app text-body",
              day.status === "future" && "border border-hairline text-body"
            )}
          >
            {day.label}
          </div>
        ))}
      </div>
    </div>
  );
}
