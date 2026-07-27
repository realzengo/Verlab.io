"use client";

import { useEffect, useRef, useState } from "react";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseIsoDate(value: string): Date | null {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

// Grid always starts on a Monday, spanning 6 full weeks so the layout never
// jumps height between months with 4 vs 6 visible weeks.
function buildMonthGrid(viewDate: Date): Date[] {
  const firstOfMonth = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
  const startOffset = (firstOfMonth.getDay() + 6) % 7;
  const gridStart = new Date(firstOfMonth);
  gridStart.setDate(firstOfMonth.getDate() - startOffset);

  return Array.from({ length: 42 }, (_, i) => {
    const day = new Date(gridStart);
    day.setDate(gridStart.getDate() + i);
    return day;
  });
}

export function DatePicker({
  value,
  onChange,
  placeholder = "Select date",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const selected = parseIsoDate(value);
  const [viewDate, setViewDate] = useState(selected ?? new Date());
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setIsOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  function open() {
    setViewDate(selected ?? new Date());
    setIsOpen(true);
  }

  const today = new Date();
  const days = buildMonthGrid(viewDate);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => (isOpen ? setIsOpen(false) : open())}
        className="flex w-full items-center gap-2 rounded-lg border border-hairline bg-surface px-3 py-2 text-left text-sm outline-none transition-colors focus:border-primary"
      >
        <Calendar className="h-4 w-4 shrink-0 text-subtle" />
        <span className={selected ? "text-heading" : "text-subtle"}>
          {selected
            ? selected.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
            : placeholder}
        </span>
      </button>

      {isOpen && (
        <div className="absolute right-0 top-[calc(100%+8px)] z-20 w-72 rounded-xl border border-hairline bg-surface p-4 shadow-card-hover">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold text-heading">
              {viewDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
            </p>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                className="rounded-md p-1 text-body hover:bg-accent hover:text-heading"
                aria-label="Previous month"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
                className="rounded-md p-1 text-body hover:bg-accent hover:text-heading"
                aria-label="Next month"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-y-1">
            {WEEKDAYS.map((day, i) => (
              <span key={i} className="text-center text-[11px] font-medium uppercase tracking-wide text-subtle">
                {day}
              </span>
            ))}
            {days.map((day) => {
              const inMonth = day.getMonth() === viewDate.getMonth();
              const isSelected = selected != null && isSameDay(day, selected);
              const isToday = isSameDay(day, today);
              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  onClick={() => {
                    onChange(toIsoDate(day));
                    setIsOpen(false);
                  }}
                  className={cn(
                    "mx-auto flex h-8 w-8 items-center justify-center rounded-full text-sm transition-colors",
                    !inMonth && "text-subtle/40 hover:bg-accent/60",
                    inMonth && !isSelected && "text-heading hover:bg-accent",
                    isSelected && "bg-btn-primary font-semibold text-white hover:bg-btn-primary-hover",
                    !isSelected && isToday && "border border-primary/50 text-primary"
                  )}
                >
                  {day.getDate()}
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex items-center justify-between border-t border-hairline pt-3">
            <button
              type="button"
              onClick={() => {
                onChange("");
                setIsOpen(false);
              }}
              className="text-xs font-medium text-body hover:text-heading"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => {
                onChange(toIsoDate(today));
                setViewDate(today);
                setIsOpen(false);
              }}
              className="text-xs font-medium text-primary hover:underline"
            >
              Today
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
