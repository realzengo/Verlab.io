"use client";

import { useState } from "react";
import {
  ArrowLeft,
  Bookmark,
  Check,
  CheckCircle2,
  ChevronDown,
  Copy,
  Download,
  FileText,
  Image as ImageIcon,
  Languages,
  ListChecks,
  MoreHorizontal,
  PlayCircle,
  Search,
  Sparkles,
  Wand2,
  XCircle,
} from "lucide-react";
import type { Transcript } from "@/lib/types";
import { TRANSCRIPTS } from "@/lib/mock-data";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Table, TableHead, TableRow, TableHeaderCell, TableCell } from "@/components/ui/Table";
import { ExportModal } from "@/components/transcripts/ExportModal";
import { cn, formatDate } from "@/lib/utils";

type PageView = "history" | "result";
type RowStatus = "complete" | "processing" | "failed";

interface HistoryRow {
  id: string;
  title: string;
  sourceUrl: string;
  folder: string;
  platform: "tiktok" | "reels" | "shorts";
  date: string;
  duration: string;
  status: RowStatus;
  bookmarked: boolean;
}

const HISTORY_ROWS: HistoryRow[] = [
  {
    id: "row-1",
    title: "The $2.3M mistake surgeons hope you never learn about",
    sourceUrl: "tiktok.com/@crayoncapital",
    folder: "Medical Drama",
    platform: "tiktok",
    date: "2026-05-28T08:00:00.000Z",
    duration: "0:58",
    status: "complete",
    bookmarked: true,
  },
  {
    id: "row-2",
    title: "The intern who leaked a decade of trade secrets",
    sourceUrl: "tiktok.com/@bensbusinessbreakdown",
    folder: "Corporate Fraud",
    platform: "tiktok",
    date: "2026-06-01T12:30:00.000Z",
    duration: "1:01",
    status: "complete",
    bookmarked: false,
  },
  {
    id: "row-3",
    title: "The trade that erased a nation's pension fund",
    sourceUrl: "instagram.com/reel/C8xYzabcdEf",
    folder: "Financial Collapse",
    platform: "reels",
    date: "2026-06-08T15:45:00.000Z",
    duration: "0:52",
    status: "complete",
    bookmarked: false,
  },
  {
    id: "row-4",
    title: "Inside the courtroom that changed maritime law forever",
    sourceUrl: "youtube.com/shorts/x92kLp0",
    folder: "Legal Drama",
    platform: "shorts",
    date: "2026-06-10T09:15:00.000Z",
    duration: "1:14",
    status: "processing",
    bookmarked: false,
  },
  {
    id: "row-5",
    title: "The audit that took down a Fortune 500 CFO",
    sourceUrl: "tiktok.com/@bensbusinessbreakdown",
    folder: "Corporate Fraud",
    platform: "tiktok",
    date: "2026-06-11T18:05:00.000Z",
    duration: "0:47",
    status: "failed",
    bookmarked: false,
  },
];

const STATUS_BADGE: Record<RowStatus, { label: string; variant: "success" | "warning" | "danger" }> = {
  complete: { label: "Complete", variant: "success" },
  processing: { label: "Processing", variant: "warning" },
  failed: { label: "Failed", variant: "danger" },
};

const LANGUAGES = ["Original", "English", "Spanish", "Portuguese", "French"];

function Dropdown({
  label,
  icon: Icon,
  value,
  onChange,
}: {
  label: string;
  icon: typeof Languages;
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <Button
        type="button"
        variant="secondary"
        size="sm"
        icon={Icon}
        onClick={() => setOpen((o) => !o)}
        className="gap-2"
      >
        {label}: {value}
        <ChevronDown className="h-3.5 w-3.5" />
      </Button>
      {open && (
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

function IconButton({ icon: Icon, label, onClick }: { icon: typeof Copy; label: string; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-hairline bg-surface text-body transition-colors hover:bg-app"
    >
      <Icon className="h-4 w-4" />
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

export default function TranscriptsPage() {
  const [view, setView] = useState<PageView>("history");
  const [bulkInput, setBulkInput] = useState("");
  const [translateTo, setTranslateTo] = useState("Original");
  const [retranslateTo, setRetranslateTo] = useState("Original");
  const [activeTranscript, setActiveTranscript] = useState<Transcript | null>(null);
  const [showTimestamps, setShowTimestamps] = useState(true);
  const [copied, setCopied] = useState(false);
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [exportModalOpen, setExportModalOpen] = useState(false);

  const allSelected = selectedRows.length === HISTORY_ROWS.length;
  const exportCount = selectedRows.length > 0 ? selectedRows.length : HISTORY_ROWS.length;
  const stats = {
    total: HISTORY_ROWS.length,
    complete: HISTORY_ROWS.filter((r) => r.status === "complete").length,
    processing: HISTORY_ROWS.filter((r) => r.status === "processing").length,
    failed: HISTORY_ROWS.filter((r) => r.status === "failed").length,
  };

  const toggleAllRows = () => setSelectedRows(allSelected ? [] : HISTORY_ROWS.map((r) => r.id));
  const toggleRow = (id: string) =>
    setSelectedRows((prev) => (prev.includes(id) ? prev.filter((rowId) => rowId !== id) : [...prev, id]));

  const handleExtract = () => {
    if (!bulkInput.trim()) return;
    setActiveTranscript(TRANSCRIPTS[0] ?? null);
    setShowTimestamps(true);
    setView("result");
    setBulkInput("");
  };

  const handleCopy = async () => {
    if (!activeTranscript) return;
    const fullText = activeTranscript.lines
      .map((line) => (showTimestamps ? `[${line.timestamp}] ${line.text}` : line.text))
      .join("\n");
    await navigator.clipboard.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="flex flex-col gap-6 pt-2">
      <div>
        <h2 className="text-lg font-semibold text-heading">Transcripts</h2>
        <p className="mt-1 text-sm text-body">
          Paste a TikTok, Reels, or Shorts link to pull a clean, timestamped transcript.
        </p>
      </div>

      {/* Component 1: Bulk Input Hero — visible in both states */}
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
          placeholder="Paste up to 50 video links here (or tiktok collection)"
          rows={4}
          className="w-full resize-none rounded-card-sm border border-hairline bg-app p-4 text-sm text-heading placeholder:text-body focus:outline-none focus:ring-2 focus:ring-primary/30"
        />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Dropdown label="Translate" icon={Languages} value={translateTo} onChange={setTranslateTo} />
          <Button variant="primary" disabled={!bulkInput.trim()} onClick={handleExtract}>
            Extract
          </Button>
        </div>
      </Card>

      {view === "history" ? (
        <>
          {/* Component 2: Transcript History Dashboard */}
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

          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex w-full max-w-xs items-center gap-2 rounded-full border border-hairline bg-surface px-4 py-2">
                <Search className="h-4 w-4 shrink-0 text-body" />
                <input
                  type="text"
                  placeholder="Search transcripts..."
                  className="w-full min-w-0 bg-transparent text-sm text-heading placeholder:text-body focus:outline-none"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="secondary" size="sm" icon={ChevronDown} iconPosition="right">
                  All Folders
                </Button>
                <Button variant="secondary" size="sm" icon={ChevronDown} iconPosition="right">
                  Status
                </Button>
                <Button variant="secondary" size="sm" icon={ChevronDown} iconPosition="right">
                  Platform
                </Button>
                <Button variant="secondary" size="sm" icon={Bookmark}>
                  Bookmarked
                </Button>
              </div>
            </div>

            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell className="w-10">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleAllRows}
                      className="h-4 w-4 rounded border-hairline accent-primary"
                      aria-label="Select all rows"
                    />
                  </TableHeaderCell>
                  <TableHeaderCell>Content</TableHeaderCell>
                  <TableHeaderCell>Source</TableHeaderCell>
                  <TableHeaderCell>Folder</TableHeaderCell>
                  <TableHeaderCell>Platform</TableHeaderCell>
                  <TableHeaderCell>Date</TableHeaderCell>
                  <TableHeaderCell>Duration</TableHeaderCell>
                  <TableHeaderCell>Status</TableHeaderCell>
                  <TableHeaderCell className="text-right">Actions</TableHeaderCell>
                </TableRow>
              </TableHead>
              <tbody>
                {HISTORY_ROWS.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={selectedRows.includes(row.id)}
                        onChange={() => toggleRow(row.id)}
                        className="h-4 w-4 rounded border-hairline accent-primary"
                        aria-label={`Select ${row.title}`}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-8 shrink-0 items-center justify-center rounded-lg bg-ink text-white">
                          <PlayCircle className="h-4 w-4" />
                        </div>
                        <span className="line-clamp-2 max-w-xs text-sm font-medium text-heading">{row.title}</span>
                        {row.bookmarked && <Bookmark className="h-3.5 w-3.5 shrink-0 fill-star text-star" />}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-body">{row.sourceUrl}</span>
                    </TableCell>
                    <TableCell>{row.folder}</TableCell>
                    <TableCell>
                      <Badge className="capitalize">{row.platform}</Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-body">{formatDate(row.date)}</TableCell>
                    <TableCell>{row.duration}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_BADGE[row.status].variant}>{STATUS_BADGE[row.status].label}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <button
                        type="button"
                        aria-label="Row actions"
                        className="ml-auto flex h-8 w-8 items-center justify-center rounded-full text-body hover:bg-app"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                    </TableCell>
                  </TableRow>
                ))}
              </tbody>
            </Table>
          </div>
        </>
      ) : (
        activeTranscript && (
          <>
            {/* Component 3: Extracted Result View */}
            <Button variant="text" icon={ArrowLeft} onClick={() => setView("history")} className="self-start">
              Back to history
            </Button>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,280px)_1fr]">
              <div className="flex flex-col gap-3">
                <div className="flex aspect-[9/16] w-full items-center justify-center rounded-card border border-hairline bg-ink">
                  <PlayCircle className="h-12 w-12 text-white/70" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Button variant="secondary" size="sm" icon={ImageIcon}>
                    Save cover image
                  </Button>
                  <Button variant="secondary" size="sm" icon={Download}>
                    Download video
                  </Button>
                </div>
              </div>

              <Card className="flex flex-col gap-4">
                <div className="flex flex-col gap-2.5">
                  <p className="text-sm text-body">
                    You can do more with <span className="font-semibold text-primary">Clypa AI</span>
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="secondary" size="sm" icon={Sparkles}>
                      Write hooks
                    </Button>
                    <Button variant="secondary" size="sm" icon={Wand2}>
                      Rewrite scripts
                    </Button>
                    <Button variant="secondary" size="sm" icon={ListChecks}>
                      Get framework
                    </Button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-hairline pt-4">
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
                    <Dropdown label="Retranslate" icon={Languages} value={retranslateTo} onChange={setRetranslateTo} />
                    <IconButton icon={copied ? Check : Copy} label="Copy transcript" onClick={handleCopy} />
                    <IconButton icon={Download} label="Download transcript" />
                  </div>
                </div>

                <div className="flex max-h-[420px] flex-col gap-3 overflow-y-auto pr-1">
                  {activeTranscript.lines.map((line, i) => (
                    <div key={i} className="flex gap-3 text-sm">
                      {showTimestamps && (
                        <span className="w-10 shrink-0 font-mono text-xs text-body">{line.timestamp}</span>
                      )}
                      <p className="leading-relaxed text-heading">{line.text}</p>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </>
        )
      )}

      <ExportModal
        isOpen={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        count={exportCount}
        onExport={() => setExportModalOpen(false)}
      />
    </div>
  );
}
