"use client";

import { useMemo, useState } from "react";
import { PenSquare, Wand2 } from "lucide-react";
import { SCRIPTS, SOPS, TRANSCRIPTS } from "@/lib/mock-data";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ScriptView } from "@/components/features/ScriptView";

export default function ScriptsPage() {
  const [sopId, setSopId] = useState(SOPS[0]?.id ?? "");
  const [transcriptId, setTranscriptId] = useState(TRANSCRIPTS[0]?.id ?? "");
  const [topic, setTopic] = useState("");
  const [resultIndex, setResultIndex] = useState<number | null>(null);

  const matches = useMemo(() => {
    const bySop = SCRIPTS.filter((script) => script.sopId === sopId);
    return bySop.length > 0 ? bySop : SCRIPTS;
  }, [sopId]);

  const script = resultIndex !== null ? matches[resultIndex % matches.length] : null;

  const handleGenerate = () => setResultIndex(0);
  const handleRegenerate = () => setResultIndex((i) => ((i ?? 0) + 1) % matches.length);

  return (
    <div className="flex flex-col gap-6 pt-2">
      <div>
        <h2 className="text-lg font-semibold text-heading">Script Maker</h2>
        <p className="mt-1 text-sm text-body">
          Select a bent SOP and a reference transcript, add a topic, and generate a ready-to-film script.
        </p>
      </div>

      <Card className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-xs font-semibold uppercase tracking-wide text-body">SOP</span>
            <select
              value={sopId}
              onChange={(event) => setSopId(event.target.value)}
              className="rounded-card-sm border border-hairline bg-white px-3 py-2.5 text-sm text-heading focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              {SOPS.map((sop) => (
                <option key={sop.id} value={sop.id}>
                  {sop.title}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-xs font-semibold uppercase tracking-wide text-body">Reference transcript</span>
            <select
              value={transcriptId}
              onChange={(event) => setTranscriptId(event.target.value)}
              className="rounded-card-sm border border-hairline bg-white px-3 py-2.5 text-sm text-heading focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              {TRANSCRIPTS.map((transcript) => (
                <option key={transcript.id} value={transcript.id}>
                  {transcript.title}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-xs font-semibold uppercase tracking-wide text-body">Topic</span>
            <input
              type="text"
              value={topic}
              onChange={(event) => setTopic(event.target.value)}
              placeholder="e.g. The invoice that exposed the fraud"
              className="rounded-card-sm border border-hairline bg-white px-3 py-2.5 text-sm text-heading placeholder:text-body focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </label>
        </div>

        <Button icon={Wand2} onClick={handleGenerate} className="self-start">
          Generate script
        </Button>
      </Card>

      {script ? (
        <ScriptView
          script={topic.trim() ? { ...script, topic } : script}
          onRegenerate={handleRegenerate}
          onExport={() => {}}
        />
      ) : (
        <EmptyState
          icon={PenSquare}
          title="No script yet"
          description="Fill in the fields above and generate your first script."
        />
      )}
    </div>
  );
}
