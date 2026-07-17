"use client";

import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronDown,
  Copy,
  Download,
  FileText,
  Languages,
  Loader2,
  PlayCircle,
  Search,
  Sparkles,
  XCircle,
} from "lucide-react";
import type { TranscriptLine } from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Table, TableHead, TableRow, TableHeaderCell, TableCell } from "@/components/ui/Table";
import { ExportModal } from "@/components/transcripts/ExportModal";
import { cn, formatDate } from "@/lib/utils";

type PageView = "history" | "result";
type RowStatus = "queued" | "processing" | "complete" | "failed";

interface TranscriptRow {
  id: string;
  source_url: string;
  platform: "tiktok" | "reels" | "shorts";
  status: RowStatus;
  title: string | null;
  cover_url: string | null;
  duration_seconds: number | null;
  video_url: string | null;
  embed_url: string | null;
  lines: TranscriptLine[] | null;
  created_at: string;
}

const STATUS_BADGE: Record<RowStatus, { label: string; variant: "success" | "warning" | "danger" | "default" }> = {
  complete: { label: "Complete", variant: "success" },
  processing: { label: "Processing", variant: "warning" },
  queued: { label: "Queued", variant: "default" },
  failed: { label: "Failed", variant: "danger" },
};

const LANGUAGES = ["Original", "English", "Spanish", "Portuguese", "French"];

function Dropdown({
  label,
  icon: Icon,
  value,
  onChange,
  disabled,
}: {
  label: string;
  icon: typeof Languages;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <Button
        type="button"
        variant="secondary"
        size="sm"
        icon={Icon}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className="gap-2"
      >
        {label}: {value}
        <ChevronDown className="h-3.5 w-3.5" />
      </Button>
      {open && !disabled && (
        <div className="absolute left-0 z-10 mt-2 w-44 rounded-card-sm border border-hairline bg-surface p-1.5 shadow-card-hover">
          {LANGUAGES.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => {
                onChange(option);
                setOpen(false);
              }}
              className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-sm text-heading hover:bg-accent"
            >
              {option}
              {option === value && <Check className="h-3.5 w-3.5 text-primary" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function IconButton({
  icon: Icon,
  label,
  onClick,
  active,
}: {
  icon: typeof Copy;
  label: string;
  onClick?: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition-all duration-200",
        active ? "scale-110 border-primary bg-accent text-primary" : "scale-100 border-hairline bg-surface text-body hover:bg-app"
      )}
    >
      <Icon className={cn("h-4 w-4", active && "animate-bounce")} />
    </button>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  icon: typeof FileText;
  tone: "primary" | "success" | "warning" | "danger";
}) {
  const toneClasses: Record<typeof tone, string> = {
    primary: "bg-accent text-primary",
    success: "bg-success-tint text-success",
    warning: "bg-warning-tint text-warning",
    danger: "bg-danger-tint text-danger",
  };

  return (
    <Card className="flex items-center justify-between gap-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-body">{label}</p>
        <p className="mt-1.5 text-3xl font-bold text-heading">{value}</p>
      </div>
      <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-chip", toneClasses[tone])}>
        <Icon className="h-5 w-5" />
      </div>
    </Card>
  );
}

function firstUrl(input: string): string | null {
  const line = input
    .split(/\s+/)
    .map((s) => s.trim())
    .find(Boolean);
  return line ?? null;
}

export default function TranscriptsPage() {
  const [view, setView] = useState<PageView>("history");
  const [rows, setRows] = useState<TranscriptRow[]>([]);
  const [bulkInput, setBulkInput] = useState("");
  const [translateTo, setTranslateTo] = useState("Original");
  const [retranslateTo, setRetranslateTo] = useState("Original");
  const [activeRow, setActiveRow] = useState<TranscriptRow | null>(null);
  const [showTimestamps, setShowTimestamps] = useState(true);
  const [copied, setCopied] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [translatedLines, setTranslatedLines] = useState<TranscriptLine[] | null>(null);
  const [translating, setTranslating] = useState(false);
  const [translateError, setTranslateError] = useState<string | null>(null);
  const [coverFailed, setCoverFailed] = useState(false);

  useEffect(() => {
    fetchRows();
  }, []);

  function openRow(row: TranscriptRow) {
    setActiveRow(row);
    setTranslatedLines(null);
    setRetranslateTo("Original");
    setTranslateError(null);
    setCoverFailed(false);
  }

  async function fetchRows() {
    const res = await fetch("/api/transcripts");
    if (res.ok) {
      const data = await res.json();
      setRows(data.transcripts);
    }
  }

  function pollUntilSettled(id: string) {
    const interval = setInterval(async () => {
      const res = await fetch(`/api/transcripts/status/${id}`);
      if (!res.ok) return;
      const { transcript } = await res.json();
      setRows((prev) => prev.map((r) => (r.id === id ? transcript : r)));
      setActiveRow((prev) => (prev?.id === id ? transcript : prev));
      if (transcript.status === "complete" || transcript.status === "failed") {
        clearInterval(interval);
      }
    }, 1500);
  }

  const stats = {
    total: rows.length,
    complete: rows.filter((r) => r.status === "complete").length,
    processing: rows.filter((r) => r.status === "processing" || r.status === "queued").length,
    failed: rows.filter((r) => r.status === "failed").length,
  };

  const handleExtract = async () => {
    const url = firstUrl(bulkInput);
    if (!url) return;

    setSubmitting(true);
    setError(null);

    const res = await fetch("/api/transcripts/extract", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    const data = await res.json();
    setSubmitting(false);

    if (!res.ok) {
      setError(data.error ?? "Could not start extraction");
      return;
    }

    setBulkInput("");
    setShowTimestamps(true);
    setTranslatedLines(null);
    setRetranslateTo("Original");
    setTranslateError(null);
    await fetchRows();
    setActiveRow({
      id: data.id,
      source_url: url,
      platform: "tiktok",
      status: "queued",
      title: null,
      cover_url: null,
      duration_seconds: null,
      video_url: null,
      embed_url: null,
      lines: null,
      created_at: new Date().toISOString(),
    });
    setView("result");
    pollUntilSettled(data.id);
  };

  const handleCopy = async () => {
    const lines = translatedLines ?? activeRow?.lines;
    if (!lines) return;
    const fullText = lines
      .map((line) => (showTimestamps ? `[${line.timestamp}] ${line.text}` : line.text))
      .join("\n");
    await navigator.clipboard.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleDownloadTxt = () => {
    const lines = translatedLines ?? activeRow?.lines;
    if (!lines) return;
    const fullText = lines
      .map((line) => (showTimestamps ? `[${line.timestamp}] ${line.text}` : line.text))
      .join("\n");
    const blob = new Blob([fullText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const filename = `${(activeRow?.title || "transcript").replace(/[\\/:*?"<>|]+/g, " ").trim()}.txt`;
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
    setDownloaded(true);
    setTimeout(() => setDownloaded(false), 1200);
  };

  const handleRetranslate = async (language: string) => {
    setRetranslateTo(language);
    setTranslateError(null);

    if (language === "Original") {
      setTranslatedLines(null);
      return;
    }

    if (!activeRow?.lines?.length) return;

    setTranslating(true);
    try {
      const res = await fetch("/api/transcripts/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lines: activeRow.lines, targetLanguage: language }),
      });
      const data = await res.json();
      if (!res.ok) {
        setTranslateError(data.error ?? "Translation failed");
        setRetranslateTo("Original");
        return;
      }
      setTranslatedLines(data.lines);
    } catch {
      setTranslateError("Translation failed");
      setRetranslateTo("Original");
    } finally {
      setTranslating(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 pt-2">
      <div>
        <h2 className="text-lg font-semibold text-heading">Transcripts</h2>
        <p className="mt-1 text-sm text-body">
          Paste a TikTok, Reels, or Shorts link to pull a clean, timestamped transcript.
        </p>
      </div>

      <Card className="flex flex-col gap-4">
        <div>
          <h3 className="text-base font-semibold text-heading">Paste your video link here</h3>
          <p className="mt-1 text-sm text-body">
            Paste your TikTok, YouTube Shorts, or Instagram Reels link to get started.
          </p>
        </div>

        <textarea
          value={bulkInput}
          onChange={(event) => setBulkInput(event.target.value)}
          placeholder="Paste a video link here"
          rows={4}
          className="w-full resize-none rounded-card-sm border border-hairline bg-app p-4 text-sm text-heading placeholder:text-body focus:outline-none focus:ring-2 focus:ring-primary/30"
        />

        {error && <p className="text-sm text-danger">{error}</p>}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Dropdown label="Translate" icon={Languages} value={translateTo} onChange={setTranslateTo} />
          <Button
            variant="primary"
            icon={submitting ? Loader2 : undefined}
            disabled={!bulkInput.trim() || submitting}
            onClick={handleExtract}
          >
            {submitting ? "Extracting…" : "Extract"}
          </Button>
        </div>
      </Card>

      {view === "history" ? (
        <>
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-base font-semibold text-heading">Transcript History</h3>
            <Button variant="secondary" size="sm" icon={Download} onClick={() => setExportModalOpen(true)}>
              Export All
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Total Transcripts" value={stats.total} icon={FileText} tone="primary" />
            <StatCard label="Successfully Processed" value={stats.complete} icon={CheckCircle2} tone="success" />
            <StatCard label="Currently Processing" value={stats.processing} icon={Sparkles} tone="warning" />
            <StatCard label="Failed / Errors" value={stats.failed} icon={XCircle} tone="danger" />
          </div>

          {rows.length === 0 ? (
            <Card className="py-10 text-center text-sm text-body">No transcripts yet — paste a link above to get started.</Card>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex w-full max-w-xs items-center gap-2 rounded-full border border-hairline bg-surface px-4 py-2">
                <Search className="h-4 w-4 shrink-0 text-body" />
                <input
                  type="text"
                  placeholder="Search transcripts..."
                  className="w-full min-w-0 bg-transparent text-sm text-heading placeholder:text-body focus:outline-none"
                />
              </div>

              <Table>
                <TableHead>
                  <TableRow>
                    <TableHeaderCell>Content</TableHeaderCell>
                    <TableHeaderCell>Source</TableHeaderCell>
                    <TableHeaderCell>Platform</TableHeaderCell>
                    <TableHeaderCell>Date</TableHeaderCell>
                    <TableHeaderCell>Duration</TableHeaderCell>
                    <TableHeaderCell>Status</TableHeaderCell>
                  </TableRow>
                </TableHead>
                <tbody>
                  {rows.map((row) => (
                    <TableRow
                      key={row.id}
                      className={row.status === "complete" ? "cursor-pointer" : undefined}
                      onClick={() => {
                        if (row.status === "complete") {
                          openRow(row);
                          setView("result");
                        }
                      }}
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="flex h-11 w-8 shrink-0 items-center justify-center rounded-lg bg-ink text-white">
                            <PlayCircle className="h-4 w-4" />
                          </div>
                          <span className="line-clamp-2 max-w-xs text-sm font-medium text-heading">
                            {row.title ?? row.source_url}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-body">{row.source_url}</span>
                      </TableCell>
                      <TableCell>
                        <Badge className="capitalize">{row.platform}</Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-body">{formatDate(row.created_at)}</TableCell>
                      <TableCell>{row.duration_seconds ? `0:${String(row.duration_seconds).padStart(2, "0")}` : "—"}</TableCell>
                      <TableCell>
                        <Badge variant={STATUS_BADGE[row.status].variant}>{STATUS_BADGE[row.status].label}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </tbody>
              </Table>
            </div>
          )}
        </>
      ) : (
        activeRow && (
          <>
            <Button variant="text" icon={ArrowLeft} onClick={() => setView("history")} className="self-start">
              Back to history
            </Button>

            {activeRow.status !== "complete" && activeRow.status !== "failed" ? (
              <Card className="flex flex-col items-center gap-3 py-16 text-center">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <p className="text-sm text-body">Extracting transcript…</p>
              </Card>
            ) : activeRow.status === "failed" ? (
              <Card className="flex flex-col items-center gap-3 py-16 text-center">
                <XCircle className="h-6 w-6 text-danger" />
                <p className="text-sm text-body">Couldn&apos;t extract that transcript. Try a different link.</p>
              </Card>
            ) : (
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,280px)_1fr]">
                <div className="flex flex-col gap-3">
                  <div className="flex aspect-[9/16] w-full items-center justify-center overflow-hidden rounded-card border border-hairline bg-ink">
                    {activeRow.video_url ? (
                      <video
                        key={activeRow.video_url}
                        src={activeRow.video_url}
                        poster={activeRow.cover_url || undefined}
                        referrerPolicy="no-referrer"
                        controls
                        playsInline
                        className="h-full w-full object-cover"
                      />
                    ) : activeRow.embed_url ? (
                      <iframe
                        key={activeRow.embed_url}
                        src={activeRow.embed_url}
                        title={activeRow.title ?? "Video"}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        className="h-full w-full"
                      />
                    ) : activeRow.cover_url && !coverFailed ? (
                      <a
                        href={activeRow.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group relative h-full w-full"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={activeRow.cover_url}
                          alt={activeRow.title ?? "Video cover"}
                          referrerPolicy="no-referrer"
                          onError={() => setCoverFailed(true)}
                          className="h-full w-full object-cover"
                        />
                        <span className="absolute inset-0 flex items-center justify-center bg-black/20 transition-colors group-hover:bg-black/30">
                          <PlayCircle className="h-12 w-12 text-white/90" />
                        </span>
                      </a>
                    ) : (
                      <PlayCircle className="h-12 w-12 text-white/70" />
                    )}
                  </div>
                </div>

                <Card className="flex flex-col gap-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => setShowTimestamps((v) => !v)}
                      className="flex items-center gap-2 text-sm text-heading"
                    >
                      <span
                        className={cn(
                          "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors",
                          showTimestamps ? "bg-primary" : "bg-hairline"
                        )}
                      >
                        <span
                          className={cn(
                            "inline-block h-4 w-4 transform rounded-full bg-white shadow-card transition-transform",
                            showTimestamps ? "translate-x-4" : "translate-x-0.5"
                          )}
                        />
                      </span>
                      Show timestamp
                    </button>

                    <div className="flex items-center gap-2">
                      <Dropdown
                        label="Retranslate"
                        icon={translating ? Loader2 : Languages}
                        value={translating ? "Translating…" : retranslateTo}
                        onChange={handleRetranslate}
                        disabled={translating}
                      />
                      <IconButton icon={copied ? Check : Copy} label="Copy transcript" onClick={handleCopy} active={copied} />
                      <IconButton
                        icon={downloaded ? Check : Download}
                        label="Download as TXT"
                        onClick={handleDownloadTxt}
                        active={downloaded}
                      />
                    </div>
                  </div>

                  {translateError && <p className="text-sm text-danger">{translateError}</p>}

                  <div className="flex max-h-[420px] flex-col gap-3 overflow-y-auto pr-1">
                    {(translatedLines ?? activeRow.lines ?? []).map((line, i) => (
                      <div key={i} className="flex gap-3 text-sm">
                        {showTimestamps && (
                          <span className="w-10 shrink-0 font-mono text-xs text-body">{line.timestamp}</span>
                        )}
                        <p className="leading-relaxed text-heading">{line.text}</p>
                      </div>
                    ))}
                    {activeRow.lines?.length === 0 && (
                      <p className="text-sm text-body">No captions were found for this video.</p>
                    )}
                  </div>
                </Card>
              </div>
            )}
          </>
        )
      )}

      <ExportModal
        isOpen={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        count={rows.length}
        onExport={() => setExportModalOpen(false)}
      />
    </div>
  );
}

