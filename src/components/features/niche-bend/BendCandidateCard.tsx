"use client";

import { Check } from "lucide-react";
import type { NicheBendCandidate } from "@/lib/types";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils";

export function BendCandidateCard({
  candidate,
  selected,
  onSelect,
}: {
  candidate: NicheBendCandidate;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <Card
      hoverLift
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect();
        }
      }}
      className={cn(
        "relative flex cursor-pointer flex-col gap-3 outline-none",
        selected && "ring-2 ring-primary"
      )}
    >
      {selected && (
        <span className="absolute right-4 top-4 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-white">
          <Check className="h-3 w-3" />
        </span>
      )}
      <h3 className="pr-6 text-base font-bold text-heading">{candidate.nicheName}</h3>
      <Badge className="w-fit">{candidate.angle}</Badge>
      <ul className="mt-1 flex flex-col gap-2">
        {candidate.exampleTitles.map((title, i) => (
          <li key={i} className="flex gap-1.5 text-sm leading-snug text-body">
            <span className="shrink-0 font-semibold text-primary">→</span>
            {title}
          </li>
        ))}
      </ul>
    </Card>
  );
}
