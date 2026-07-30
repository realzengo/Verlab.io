import { Download, Image as ImageIcon, Sparkles, TrendingUp, Wand2 } from "lucide-react";

// Shared preview thumbnails for ToolCard -- used on both the /app home
// dashboard and /app/tools so a given tool looks identical wherever its
// card appears.

export function BendPreview() {
  return (
    <div className="flex items-center justify-center gap-3">
      <div className="rounded-card-sm border border-hairline bg-surface px-3 py-2.5 text-left shadow-card">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-body">Source</span>
        <p className="text-xs font-semibold text-heading">Medical Malpractice</p>
      </div>
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-white">
        <Wand2 className="h-3.5 w-3.5" />
      </div>
      <div className="rounded-card-sm border border-primary/30 bg-primary/10 px-3 py-2.5 text-left">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-primary">Your niche</span>
        <p className="text-xs font-semibold text-heading">Corporate Fraud</p>
      </div>
    </div>
  );
}

export function NicheFinderPreview() {
  const rows = [
    { name: "Medical Malpractice", category: "True crime", score: 94 },
    { name: "Corporate Espionage", category: "Business", score: 88 },
  ];
  return (
    <div className="flex w-full max-w-[240px] flex-col gap-2">
      {rows.map((row) => (
        <div
          key={row.name}
          className="flex items-center justify-between rounded-card-sm border border-hairline bg-surface px-3 py-2 text-left shadow-card"
        >
          <div>
            <p className="text-xs font-semibold text-heading">{row.name}</p>
            <p className="text-[10px] text-body">{row.category}</p>
          </div>
          <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-success">
            <TrendingUp className="h-3 w-3" />
            {row.score}
          </span>
        </div>
      ))}
    </div>
  );
}

export function ImageGeneratorPreview() {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-card-sm border border-hairline bg-gradient-to-br from-accent to-primary/15 shadow-card">
        <ImageIcon className="h-6 w-6 text-primary" />
      </div>
      <div className="flex items-center gap-1.5 rounded-card-sm border border-hairline bg-surface px-3 py-2.5 text-left shadow-card">
        <Sparkles className="h-3.5 w-3.5 shrink-0 text-primary" />
        <span className="text-xs font-medium text-heading">Generating thumbnail...</span>
      </div>
    </div>
  );
}

export function DownloaderPreview() {
  return (
    <div className="flex w-full max-w-[220px] flex-col gap-1.5 rounded-card-sm border border-hairline bg-surface p-3 text-left shadow-card">
      <div className="flex items-center gap-2">
        <Download className="h-3.5 w-3.5 shrink-0 text-primary" />
        <span className="truncate text-xs font-medium text-heading">tiktok.com/@creator/video</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
        <div className="h-full w-2/3 rounded-full bg-primary" />
      </div>
    </div>
  );
}

export function TranscriptPreview() {
  return (
    <div className="flex w-full max-w-[220px] flex-col gap-1.5 text-left">
      <div className="flex gap-2 text-[11px] text-body">
        <span className="font-mono">0:04</span>
        <span className="line-clamp-1">The $2.3M mistake surgeons hope you never learn about...</span>
      </div>
      <div className="flex gap-2 text-[11px] text-body">
        <span className="font-mono">0:09</span>
        <span className="line-clamp-1">Here&rsquo;s what actually happened...</span>
      </div>
    </div>
  );
}

export function ScriptPreview() {
  const beats = [
    { label: "Hook", tone: "text-primary" },
    { label: "Body", tone: "text-heading" },
    { label: "CTA", tone: "text-heading" },
  ];
  return (
    <div className="flex items-center gap-1.5">
      {beats.map((beat, i) => (
        <div key={beat.label} className="flex items-center gap-1.5">
          <div className="rounded-card-sm border border-hairline bg-surface px-3 py-2.5 text-center shadow-card">
            <span className={`text-[11px] font-semibold ${beat.tone}`}>{beat.label}</span>
          </div>
          {i < beats.length - 1 && <div className="h-px w-3 bg-hairline" />}
        </div>
      ))}
    </div>
  );
}
