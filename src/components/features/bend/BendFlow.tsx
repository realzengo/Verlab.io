"use client";

import { useState } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import type { NicheBendResult } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { BendSourceTargetPicker } from "@/components/features/bend/BendSourceTargetPicker";
import { BendMappingVisual } from "@/components/features/bend/BendMappingVisual";
import { BendResultPanel } from "@/components/features/bend/BendResultPanel";
import { normalizeBendResult } from "@/components/features/bend/normalizeBendResult";

type FlowState =
  | { step: "select" }
  | { step: "loading"; sourceNiche: string; targetNiche: string }
  | { step: "result"; sourceNiche: string; targetNiche: string; result: NicheBendResult }
  | { step: "error"; sourceNiche: string; targetNiche: string; message: string };

export function BendFlow() {
  const [state, setState] = useState<FlowState>({ step: "select" });

  const runBend = async (sourceNiche: string, targetNiche: string) => {
    setState({ step: "loading", sourceNiche, targetNiche });

    try {
      const response = await fetch("/api/bend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceNiche, targetNiche }),
      });

      const data = await response.json();

      if (!response.ok) {
        setState({
          step: "error",
          sourceNiche,
          targetNiche,
          message: data?.error ?? "Something went wrong bending this niche.",
        });
        return;
      }

      setState({ step: "result", sourceNiche, targetNiche, result: normalizeBendResult(data) });
    } catch {
      setState({
        step: "error",
        sourceNiche,
        targetNiche,
        message: "Couldn't reach the bending service. Check your connection and try again.",
      });
    }
  };

  if (state.step === "select") {
    return <BendSourceTargetPicker onSubmit={runBend} />;
  }

  if (state.step === "loading") {
    return <BendMappingVisual sourceNiche={state.sourceNiche} targetNiche={state.targetNiche} />;
  }

  if (state.step === "error") {
    return (
      <Card className="flex flex-col items-center gap-4 py-12 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-chip bg-red-50">
          <AlertTriangle className="h-5 w-5 text-red-500" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-heading">Bend failed</h3>
          <p className="mt-1.5 max-w-sm text-sm text-body">{state.message}</p>
        </div>
        <Button
          variant="secondary"
          icon={RotateCcw}
          onClick={() => runBend(state.sourceNiche, state.targetNiche)}
        >
          Try again
        </Button>
        <Button variant="text" onClick={() => setState({ step: "select" })}>
          Start over
        </Button>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <BendResultPanel sourceNiche={state.sourceNiche} targetNiche={state.targetNiche} result={state.result} />
      <Button variant="secondary" icon={RotateCcw} onClick={() => setState({ step: "select" })} className="self-start">
        Bend another niche
      </Button>
    </div>
  );
}
