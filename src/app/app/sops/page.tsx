"use client";

import { useState } from "react";
import { ClipboardList } from "lucide-react";
import { SOPS } from "@/lib/mock-data";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { SopView } from "@/components/features/SopView";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";

export default function SopsPage() {
  const [selectedId, setSelectedId] = useState(SOPS[0]?.id ?? null);
  const selected = SOPS.find((sop) => sop.id === selectedId) ?? null;

  return (
    <div className="flex flex-col gap-6 pt-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-heading">SOP Builder</h2>
          <p className="mt-1 text-sm text-body">
            Reverse-engineered SOPs from niche bends — hook formula, structure, pacing, do&rsquo;s and don&rsquo;ts.
          </p>
        </div>
        <Button href="/app/bend">Bend a niche to build one</Button>
      </div>

      {SOPS.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No SOPs yet"
          description="Bend a niche to generate your first SOP."
          action={{ label: "Bend a niche", href: "/app/bend" }}
        />
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
          <div className="flex flex-col gap-2">
            {SOPS.map((sop) => (
              <button
                key={sop.id}
                type="button"
                onClick={() => setSelectedId(sop.id)}
                className={cn(
                  "rounded-card-sm border px-4 py-3 text-left transition-colors",
                  sop.id === selectedId ? "border-primary bg-accent" : "border-hairline bg-white hover:border-primary/40"
                )}
              >
                <p className="text-sm font-semibold text-heading">{sop.title}</p>
                <p className="mt-1 text-xs text-body">{formatDate(sop.createdAt)}</p>
              </button>
            ))}
          </div>

          {selected ? (
            <SopView sop={selected} title={selected.title} />
          ) : (
            <Card className="flex items-center justify-center py-16 text-sm text-body">
              Select a SOP to view it
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
