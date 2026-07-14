"use client";

import { useState } from "react";
import { Check, ChevronDown, Copy, Download, PlayCircle } from "lucide-react";
import type { Transcript } from "@/lib/types";
import { AGENTS } from "@/lib/mock-data";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function TranscriptView({
  transcript,
  variant = "full",
}: {
  transcript: Transcript;
  variant?: "full" | "compact";
}) {
  const [copied, setCopied] = useState(false);
  const [agentMenuOpen, setAgentMenuOpen] = useState(false);
  const fullText = transcript.lines.map((line) => `[${line.timestamp}] ${line.text}`).join("\n");

  const handleCopy = async () => {
    await navigator.clipboard.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (variant === "compact") {
    return (
      <Card className="flex gap-3 p-4">
        <div className="flex h-16 w-10 shrink-0 items-center justify-center rounded-lg bg-ink text-white">
          <PlayCircle className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-heading">{transcript.title}</p>
          <p className="mt-1 line-clamp-2 text-xs text-body">{transcript.lines[0]?.text}</p>
        </div>
      </Card>
    );
  }

  return (
    <Card padded={false} className="grid grid-cols-1 gap-0 overflow-hidden md:grid-cols-[220px_1fr]">
      <div className="flex flex-col gap-3 border-b border-hairline bg-app p-5 md:border-b-0 md:border-r">
        <div className="flex aspect-[9/16] w-full items-center justify-center rounded-card-sm bg-ink">
          <PlayCircle className="h-10 w-10 text-white/70" />
        </div>
        <Badge className="self-start capitalize">{transcript.platform}</Badge>
        <p className="text-sm font-semibold leading-snug text-heading">{transcript.title}</p>
        <p className="text-xs text-body">{formatDuration(transcript.durationSeconds)}</p>
      </div>

      <div className="flex flex-col gap-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-body">Transcript</span>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" icon={copied ? Check : Copy} onClick={handleCopy}>
              {copied ? "Copied" : "Copy"}
            </Button>
            <Button variant="secondary" size="sm" icon={Download}>
              Export
            </Button>
            <div className="relative">
              <Button
                variant="secondary"
                size="sm"
                icon={ChevronDown}
                iconPosition="right"
                onClick={() => setAgentMenuOpen((open) => !open)}
              >
                Run AI agent
              </Button>
              {agentMenuOpen && (
                <div className="absolute right-0 z-10 mt-2 w-56 rounded-card-sm border border-hairline bg-surface p-1.5 shadow-card-hover">
                  {AGENTS.map((agent) => (
                    <button
                      key={agent.id}
                      type="button"
                      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-heading hover:bg-accent"
                      onClick={() => setAgentMenuOpen(false)}
                    >
                      <agent.icon className="h-4 w-4 text-primary" />
                      {agent.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 overflow-y-auto">
          {transcript.lines.map((line, i) => (
            <div key={i} className="flex gap-3 text-sm">
              <span className="w-10 shrink-0 font-mono text-xs text-body">{line.timestamp}</span>
              <p className="leading-relaxed text-heading">{line.text}</p>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
