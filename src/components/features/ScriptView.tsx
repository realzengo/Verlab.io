"use client";

import { Download, RefreshCw } from "lucide-react";
import type { Script } from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

interface ScriptViewProps {
  script: Script;
  variant?: "full" | "compact";
  onRegenerate?: () => void;
  onExport?: (format: "txt" | "pdf" | "xml") => void;
}

export function ScriptView({ script, variant = "full", onRegenerate, onExport }: ScriptViewProps) {
  const compact = variant === "compact";

  return (
    <Card padded={!compact} className={compact ? "flex flex-col gap-3 p-4" : "flex flex-col gap-5"}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-heading">{script.title}</h3>
          <p className="text-xs text-body">{script.topic}</p>
        </div>
        {!compact && (onRegenerate || onExport) && (
          <div className="flex shrink-0 gap-2">
            {onRegenerate && (
              <Button variant="secondary" size="sm" icon={RefreshCw} onClick={onRegenerate}>
                Regenerate
              </Button>
            )}
            {onExport && (
              <Button variant="secondary" size="sm" icon={Download} onClick={() => onExport("txt")}>
                Export
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <div className="rounded-card-sm bg-accent px-4 py-3">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-primary">Hook</span>
          <p className="mt-1 text-sm font-medium text-heading">{script.hook}</p>
        </div>
        <div className="px-1">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-body">Body</span>
          <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-heading">{script.body}</p>
        </div>
        <div className="rounded-card-sm border border-hairline px-4 py-3">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-body">CTA</span>
          <p className="mt-1 text-sm text-heading">{script.cta}</p>
        </div>
      </div>
    </Card>
  );
}
