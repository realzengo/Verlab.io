import { ArrowRight } from "lucide-react";
import type { NicheBendResult } from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { SopView } from "@/components/features/SopView";

interface BendResultPanelProps {
  sourceNiche: string;
  targetNiche: string;
  result: NicheBendResult;
}

export function BendResultPanel({ sourceNiche, targetNiche, result }: BendResultPanelProps) {
  return (
    <div className="flex flex-col gap-6">
      <Card>
        <span className="text-[11px] font-semibold uppercase tracking-wide text-primary">
          {sourceNiche} → {targetNiche}
        </span>
        <p className="mt-2 text-sm leading-relaxed text-heading">{result.analysis}</p>
      </Card>

      <SopView sop={result.sop} title="Bent SOP" />

      {result.scriptIdeas.length > 0 && (
        <Card>
          <span className="text-[11px] font-semibold uppercase tracking-wide text-body">Script ideas</span>
          <ul className="mt-3 flex flex-col gap-2.5">
            {result.scriptIdeas.map((idea, i) => (
              <li key={i} className="rounded-2xl bg-accent px-3.5 py-2.5 text-sm leading-snug text-heading">
                <span className="mr-1.5 font-semibold text-primary">&rarr;</span>
                {idea}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {result.scripts.length > 0 && (
        <div className="flex flex-col gap-4">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-body">Starter scripts</span>
          {result.scripts.map((script, i) => (
            <Card key={i}>
              <p className="whitespace-pre-line text-sm leading-relaxed text-heading">{script}</p>
            </Card>
          ))}
        </div>
      )}

      <Button
        href={`/app/scripts?topic=${encodeURIComponent(targetNiche)}`}
        icon={ArrowRight}
        iconPosition="right"
        className="self-start"
      >
        Make scripts
      </Button>
    </div>
  );
}
