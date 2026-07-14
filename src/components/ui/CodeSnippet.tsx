"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function CodeSnippet({
  code,
  language = "bash",
  copyable = true,
}: {
  code: string;
  language?: string;
  copyable?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="relative overflow-hidden rounded-card-sm border border-hairline bg-heading">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-white/50">{language}</span>
        {copyable && (
          <button
            type="button"
            onClick={handleCopy}
            aria-label="Copy code"
            className="flex items-center gap-1.5 rounded-full px-2 py-1 text-[11px] font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white"
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copied" : "Copy"}
          </button>
        )}
      </div>
      <pre className="overflow-x-auto px-4 py-4 text-xs leading-relaxed text-white/90">
        <code>{code}</code>
      </pre>
    </div>
  );
}
