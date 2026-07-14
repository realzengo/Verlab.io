"use client";

import { useState } from "react";
import { ArrowRight, Wand2 } from "lucide-react";
import { NICHES } from "@/lib/mock-data";
import type { Niche } from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { NicheCard } from "@/components/features/NicheCard";
import { Button } from "@/components/ui/Button";

interface BendSourceTargetPickerProps {
  onSubmit: (sourceNiche: string, targetNiche: string) => void;
}

export function BendSourceTargetPicker({ onSubmit }: BendSourceTargetPickerProps) {
  const [selected, setSelected] = useState<Niche | null>(NICHES[0] ?? null);
  const [targetNiche, setTargetNiche] = useState("");

  const canSubmit = Boolean(selected) && targetNiche.trim().length > 0;

  return (
    <Card className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_auto_1fr]">
        <div className="flex flex-col gap-3">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-body">
            1. Pick a source niche
          </span>
          <div className="flex flex-col gap-2">
            {NICHES.map((niche) => (
              <NicheCard
                key={niche.id}
                niche={niche}
                variant="compact"
                selected={selected?.id === niche.id}
                onSelect={setSelected}
              />
            ))}
          </div>
        </div>

        <div className="hidden items-center justify-center lg:flex">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-white">
            <ArrowRight className="h-4 w-4" />
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-body">
            2. Your niche
          </span>
          <p className="text-sm text-body">What topic do you want to bend this into?</p>
          <input
            type="text"
            value={targetNiche}
            onChange={(event) => setTargetNiche(event.target.value)}
            placeholder="e.g. Startup failures, True crime, Pet health..."
            className="rounded-card-sm border border-hairline bg-white px-4 py-3 text-sm text-heading placeholder:text-body focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
      </div>

      <Button
        icon={Wand2}
        disabled={!canSubmit}
        onClick={() => selected && onSubmit(selected.name, targetNiche.trim())}
        className="self-start"
      >
        Bend it
      </Button>
    </Card>
  );
}
