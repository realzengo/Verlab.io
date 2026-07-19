"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Check,
  Copy,
  Download,
  Eye,
  FileBadge,
  FileText,
  FileX,
  Folder,
  Loader2,
  Search,
  Sparkles,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

const PLACEHOLDER =
  "Describe the video you want to create, and add reference videos to help write a viral script.";

// Simulated progress: jumps quickly at first, then eases off — never
// reaching PROGRESS_CAP on its own so it doesn't look "done" before the
// real generation actually finishes (which snaps it to 100 immediately).
const PROGRESS_CAP = 92;
const PROGRESS_TIME_CONSTANT_MS = 3_500;
const PROGRESS_TICK_MS = 150;

// Number of bars drawn in the "Generating your Script..." popup's segmented
// progress meter.
const PROGRESS_SEGMENT_COUNT = 28;

type ReferenceKind = "sop" | "transcript";

type ReferenceFile = {
  name: string;
  content: string;
};

interface ScriptHistoryItem {
  id: string;
  prompt: string;
  content: string;
  created_at: string;
}

interface ParsedScript {
  title: string | null;
  script: string;
  metrics: { label: string; value: string }[];
}

// Parses the model's "---\nTITLE: ...\n\nSCRIPT:\n...\n\nMETRICS:\n- ...\n---"
// output into display-ready pieces. Falls back to raw text for formats that
// don't match (e.g. the idea-generation mode, or a still-streaming response
// that hasn't reached a section yet).
function parseScriptOutput(raw: string): ParsedScript {
  const cleaned = raw.trim().replace(/^-{3,}\s*/, "").replace(/\s*-{3,}$/, "").trim();

  const titleMatch = cleaned.match(/TITLE:\s*(.+)/);
  const scriptMatch = cleaned.match(/SCRIPT:\s*([\s\S]*?)(?=\n{1,2}METRICS:|$)/);
  const metricsMatch = cleaned.match(/METRICS:\s*([\s\S]*)/);

  const title = titleMatch?.[1]?.trim() || null;
  const script = (scriptMatch?.[1] ?? (title ? "" : cleaned)).trim();

  const metrics: { label: string; value: string }[] = [];
  if (metricsMatch) {
    for (const line of metricsMatch[1].split("\n")) {
      const match = line.match(/^-\s*([^:]+):\s*(.+)$/);
      if (match) metrics.push({ label: match[1].trim(), value: match[2].trim() });
    }
  }

  return { title, script, metrics };
}

type DropZoneProps = {
  label: string;
  icon: LucideIcon;
  file: ReferenceFile | null;
  isUploading?: boolean;
  onSelect: (file: File) => void;
  onClear: () => void;
};

function DropZone({ label, icon: Icon, file, isUploading, onSelect, onClear }: DropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  function openPicker() {
    if (isUploading) return;
    inputRef.current?.click();
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragOver(false);
    if (isUploading) return;
    const droppedFile = event.dataTransfer.files?.[0];
    if (droppedFile) onSelect(droppedFile);
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={openPicker}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openPicker();
        }
      }}
      onDragOver={(event) => {
        event.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handleDrop}
      className={cn(
        "group relative flex min-w-0 flex-1 aspect-square cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-xl bg-slate-100 shadow-[inset_0_1px_1px_rgba(255,255,255,0.7),inset_0_-1px_2px_rgba(0,0,0,0.1)] transition-colors hover:bg-slate-200/70 dark:bg-zinc-900 dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.06),inset_0_-2px_3px_rgba(0,0,0,0.6)] dark:hover:bg-zinc-800",
        isDragOver && "bg-slate-200/70 dark:bg-zinc-800",
        isUploading && "pointer-events-none opacity-70"
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".txt,.md,.csv,.pdf,.docx,text/plain,text/markdown,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        className="hidden"
        onChange={(event) => {
          const selected = event.target.files?.[0];
          if (selected) onSelect(selected);
          event.target.value = "";
        }}
      />
      {isUploading ? (
        <>
          <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
          <span className="text-xs font-medium text-slate-500">Reading file…</span>
        </>
      ) : file ? (
        <>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onClear();
            }}
            aria-label={`Remove ${label}`}
            className="absolute right-1.5 top-1.5 z-10 rounded-full bg-white/90 p-1 text-slate-500 opacity-0 shadow-sm transition-opacity duration-150 hover:text-slate-700 group-hover:opacity-100 group-focus-within:opacity-100 dark:bg-zinc-800/90 dark:text-slate-300 dark:hover:text-white"
          >
            <X className="h-3.5 w-3.5" />
          </button>
          <Icon className="h-6 w-6 text-blue-500" />
          <span className="max-w-[90%] truncate px-1 text-xs font-medium text-slate-600 dark:text-slate-300">
            {file.name}
          </span>
        </>
      ) : (
        <>
          <Icon className="h-6 w-6 text-slate-400" />
          <span className="text-sm font-medium text-slate-500">{label}</span>
        </>
      )}
    </div>
  );
}

export default function ScriptWriterPage() {
  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [transcriptFile, setTranscriptFile] = useState<ReferenceFile | null>(null);
  const [sopFile, setSopFile] = useState<ReferenceFile | null>(null);
  const [history, setHistory] = useState<ScriptHistoryItem[]>([]);
  const [progress, setProgress] = useState<number | null>(null);
  const [popupDismissed, setPopupDismissed] = useState(false);
  const [copiedResult, setCopiedResult] = useState(false);
  const [copiedHistoryId, setCopiedHistoryId] = useState<string | null>(null);
  const [uploadingKind, setUploadingKind] = useState<ReferenceKind | null>(null);
  const [viewingScript, setViewingScript] = useState<ScriptHistoryItem | null>(null);
  const [copiedModal, setCopiedModal] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const canSubmit = prompt.trim().length > 0 && !isGenerating;

  const filteredHistory = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return history;
    return history.filter((item) => item.prompt.toLowerCase().includes(query));
  }, [history, search]);

  // Load the user's persisted SOP/Transcript reference files and past
  // scripts once on mount, so nothing needs re-uploading between visits.
  useEffect(() => {
    fetch("/api/script-references")
      .then((response) => {
        if (!response.ok) throw new Error();
        return response.json();
      })
      .then((data) => {
        for (const row of data.referenceFiles ?? []) {
          const reference = { name: row.file_name, content: row.content };
          if (row.kind === "sop") setSopFile(reference);
          if (row.kind === "transcript") setTranscriptFile(reference);
        }
      })
      .catch(() => setError("Couldn't load your saved SOP/Transcript files."));

    loadHistory();
  }, []);

  function loadHistory() {
    fetch("/api/scripts")
      .then((response) => {
        if (!response.ok) throw new Error();
        return response.json();
      })
      .then((data) => setHistory(data.scripts ?? []))
      .catch(() => setError("Couldn't load your script history. Try refreshing the page."));
  }

  // Uploads the raw file and lets the server extract its text (PDF/DOCX are
  // parsed server-side; plain text passes through as-is) -- the client never
  // has to guess the format. Shows a per-dropzone loading state while that's
  // in flight, and surfaces a clear error if extraction or the save fails.
  async function saveReferenceFile(kind: ReferenceKind, file: File) {
    const label = kind === "sop" ? "SOP" : "transcript";
    setUploadingKind(kind);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("kind", kind);
      formData.append("file", file);

      const response = await fetch("/api/script-references", { method: "PUT", body: formData });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || `Failed to save the ${label} file. Please try again.`);

      const reference = { name: data.fileName ?? file.name, content: data.content ?? "" };
      if (kind === "sop") setSopFile(reference);
      else setTranscriptFile(reference);
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to save the ${label} file. Please try again.`);
    } finally {
      setUploadingKind(null);
    }
  }

  async function clearReferenceFile(kind: ReferenceKind) {
    const previous = kind === "sop" ? sopFile : transcriptFile;
    if (kind === "sop") setSopFile(null);
    else setTranscriptFile(null);

    try {
      const response = await fetch("/api/script-references", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind }),
      });
      if (!response.ok) throw new Error();
      setError(null);
    } catch {
      if (kind === "sop") setSopFile(previous);
      else setTranscriptFile(previous);
      setError(`Failed to remove the ${kind === "sop" ? "SOP" : "transcript"} file. Please try again.`);
    }
  }

  // Drives the popup's segmented progress bar while a generation is in
  // flight: fast climb early on, decelerating toward PROGRESS_CAP. Real
  // completion (in `handleSubmit`) snaps straight to 100 regardless of
  // where this simulated curve has gotten to.
  useEffect(() => {
    if (!isGenerating) return;

    const start = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - start;
      const eased = PROGRESS_CAP * (1 - Math.exp(-elapsed / PROGRESS_TIME_CONSTANT_MS));
      setProgress(Math.round(eased));
    }, PROGRESS_TICK_MS);

    return () => clearInterval(interval);
  }, [isGenerating]);

  async function handleSubmit() {
    if (!canSubmit) return;

    const message = prompt.trim();
    setIsGenerating(true);
    setError(null);
    setResult("");
    setProgress(0);
    setPopupDismissed(false);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const response = await fetch("/api/generate-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, sop: sopFile?.content, transcripts: transcriptFile?.content }),
        signal: abortController.signal,
      });

      if (!response.ok || !response.body) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error ?? "Failed to generate script.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        setResult((prev) => prev + decoder.decode(value, { stream: true }));
      }

      setProgress(100);
      loadHistory();
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
    } finally {
      setIsGenerating(false);
    }
  }

  function cancelGeneration() {
    abortControllerRef.current?.abort();
    setIsGenerating(false);
    setPopupDismissed(true);
  }

  async function handleCopy(text: string = result) {
    await navigator.clipboard.writeText(text);
    setCopiedResult(true);
    setTimeout(() => setCopiedResult(false), 1500);
  }

  async function handleCopyHistoryItem(id: string, content: string) {
    await navigator.clipboard.writeText(content);
    setCopiedHistoryId(id);
    setTimeout(() => setCopiedHistoryId((current) => (current === id ? null : current)), 1500);
  }

  async function handleCopyModal(content: string) {
    await navigator.clipboard.writeText(content);
    setCopiedModal(true);
    setTimeout(() => setCopiedModal(false), 1500);
  }

  function handleDownloadScript(item: ScriptHistoryItem, title: string | null) {
    const filename = (title ?? item.prompt)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "script";

    const blob = new Blob([item.content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${filename}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function handleViewScript() {
    setPopupDismissed(true);
    resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // Resets the prompter for a fresh script, keeping the persisted
  // SOP/Transcript references and history intact.
  function handleGenerateAnother() {
    setResult("");
    setError(null);
    setPrompt("");
    setPopupDismissed(false);
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
      textareaRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSubmit();
    }
  }

  return (
    <div className="relative isolate">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 -top-24 -z-10 h-56 bg-blue-400/40 blur-[90px] dark:bg-blue-500/25 sm:-top-40 sm:h-72 sm:blur-[120px]"
      />

      <div className="relative mx-auto w-full max-w-3xl pt-8 sm:pt-12">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Scriptwriter</h1>
        <p className="mt-2 text-slate-500">
          Create engaging scripts for your videos with AI-powered writing assistance.
        </p>
      </div>

      {/* Prompter */}
      <div className="mt-8 flex flex-col gap-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 md:flex-row">
        {/* Text Input Area */}
        <div className="flex flex-1 gap-3">
          <textarea
            ref={textareaRef}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={PLACEHOLDER}
            disabled={isGenerating}
            className="h-full min-h-[150px] w-full resize-none bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400 disabled:opacity-60 dark:text-white"
          />
        </div>

        {/* Square Drop Zones */}
        <div className="flex w-full flex-col gap-3 md:w-[280px]">
          <div className="flex gap-3">
            <DropZone
              label="Transcript"
              icon={FileText}
              file={transcriptFile}
              isUploading={uploadingKind === "transcript"}
              onSelect={(file) => saveReferenceFile("transcript", file)}
              onClear={() => clearReferenceFile("transcript")}
            />
            <DropZone
              label="SOP"
              icon={FileBadge}
              file={sopFile}
              isUploading={uploadingKind === "sop"}
              onSelect={(file) => saveReferenceFile("sop", file)}
              onClear={() => clearReferenceFile("sop")}
            />
          </div>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="group flex w-full items-center justify-center gap-2 rounded-xl bg-blue-500 py-3 font-medium text-white shadow-sm transition-colors hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating…
              </>
            ) : (
              <>
                Generate
                <ArrowRight className="h-4 w-4 transition-transform duration-150 group-hover:translate-x-0.5" />
              </>
            )}
          </button>
        </div>
      </div>

      {(isGenerating || (result && !error)) && !popupDismissed && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4 backdrop-blur-sm"
          onClick={() => setPopupDismissed(true)}
        >
          <div
            className="w-full max-w-sm overflow-hidden rounded-2xl bg-white text-center shadow-2xl dark:bg-zinc-900"
            onClick={(event) => event.stopPropagation()}
          >
            {isGenerating ? (
              <div className="p-6 pt-4">
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={cancelGeneration}
                    aria-label="Cancel generation"
                    className="text-slate-400 hover:text-slate-600 dark:text-zinc-500 dark:hover:text-zinc-300"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="mx-auto -mt-3 flex h-16 w-16 items-center justify-center rounded-full bg-primary">
                  <Sparkles className="h-8 w-8 text-white" />
                </div>

                <h3 className="mt-4 text-lg font-semibold text-slate-900 dark:text-white">
                  Generating your Script...
                </h3>

                <div className="mt-5 flex items-center gap-[3px]">
                  {Array.from({ length: PROGRESS_SEGMENT_COUNT }).map((_, index) => {
                    const filled = index < Math.round(((progress ?? 0) / 100) * PROGRESS_SEGMENT_COUNT);
                    return (
                      <span
                        key={index}
                        className={`h-2 flex-1 rounded-full transition-colors duration-300 ${
                          filled ? "bg-primary" : "bg-slate-200 dark:bg-zinc-800"
                        }`}
                      />
                    );
                  })}
                </div>

                <p className="mt-3 text-xs text-slate-500 dark:text-zinc-400">
                  Analyzing your SOP and transcripts to match the formula
                </p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-zinc-800">
                  <h3 className="text-base font-semibold text-slate-900 dark:text-white">Script Ready</h3>
                  <button
                    type="button"
                    onClick={() => setPopupDismissed(true)}
                    aria-label="Close"
                    className="text-slate-400 hover:text-slate-600 dark:text-zinc-500 dark:hover:text-zinc-300"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="p-6">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-500/10">
                    <Check className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
                  </div>

                  <h3 className="mt-4 text-lg font-semibold text-slate-900 dark:text-white">Script ready!</h3>
                  <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
                    Your script has been generated successfully
                  </p>

                  <div className="mt-5 flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleCopy()}
                      className="flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border border-slate-200 px-2 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:text-zinc-200 dark:hover:bg-white/5"
                    >
                      <Copy className="h-4 w-4 shrink-0" />
                      {copiedResult ? "Copied!" : "Copy"}
                    </button>
                    <button
                      type="button"
                      onClick={handleViewScript}
                      className="flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl bg-btn-primary px-2 py-3 text-sm font-semibold text-white hover:bg-btn-primary-hover"
                    >
                      <Eye className="h-4 w-4 shrink-0" />
                      View Script
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {error && (
        <p className="mt-4 text-sm font-medium text-red-500" role="alert">
          {error}
        </p>
      )}

      {(isGenerating || result) &&
        (() => {
          const parsed = parseScriptOutput(result);
          return (
            <div
              ref={resultRef}
              className="mt-6 overflow-hidden rounded-card border border-hairline bg-surface shadow-card"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline px-6 py-4">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-primary">
                    <Sparkles className="h-4 w-4" />
                  </span>
                  <h2 className="truncate text-base font-semibold text-heading">
                    {parsed.title ?? (isGenerating ? "Generating your script…" : "Generated Script")}
                  </h2>
                </div>

                {!isGenerating && result && (
                  <div className="flex shrink-0 gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      icon={copiedResult ? Check : Copy}
                      onClick={() => handleCopy()}
                    >
                      {copiedResult ? "Copied" : "Copy"}
                    </Button>
                    <Button type="button" variant="primary" size="sm" icon={Sparkles} onClick={handleGenerateAnother}>
                      Generate Another
                    </Button>
                  </div>
                )}
              </div>

              <div className="px-6 py-5">
                {parsed.metrics.length > 0 && (
                  <div className="mb-4 flex flex-wrap gap-2">
                    {parsed.metrics.map((metric) => (
                      <Badge key={metric.label}>
                        {metric.label}: {metric.value}
                      </Badge>
                    ))}
                  </div>
                )}
                <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-heading">
                  {parsed.script || result}
                  {isGenerating && (
                    <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-body align-middle" />
                  )}
                </p>
              </div>
            </div>
          );
        })()}

      {/* History */}
      <div className="mt-12 flex items-center gap-2 text-lg font-semibold text-slate-700 dark:text-slate-200">
        <Folder className="h-5 w-5" />
        Recently Created
      </div>

      <div className="relative mt-4">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search Scripts..."
          className={cn(
            "w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-11 pr-4 text-sm text-slate-900 outline-none placeholder:text-slate-400",
            "focus:border-slate-300 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white dark:placeholder:text-zinc-500"
          )}
        />
      </div>

      {filteredHistory.length === 0 ? (
        <div className="mt-4 flex h-48 flex-col items-center justify-center gap-2 rounded-2xl bg-slate-50 text-slate-400 dark:bg-zinc-900/50">
          <FileX className="h-8 w-8" />
          <p className="text-sm font-medium">Nothing Here!</p>
        </div>
      ) : (
        <div className="mt-4 flex flex-col gap-3">
          {filteredHistory.map((item) => {
            const parsed = parseScriptOutput(item.content);
            return (
              <div
                key={item.id}
                className="group relative rounded-card border border-hairline bg-surface transition-colors hover:bg-app"
              >
                <button
                  type="button"
                  onClick={() => setViewingScript(item)}
                  className="block w-full p-4 pr-12 text-left"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium text-heading">{parsed.title ?? item.prompt}</p>
                    <span className="shrink-0 text-xs text-body">
                      {new Date(item.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-body">{parsed.script || item.content}</p>
                </button>

                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    handleCopyHistoryItem(item.id, item.content);
                  }}
                  aria-label="Copy script"
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-surface p-1.5 text-body opacity-0 shadow-sm ring-1 ring-hairline transition-opacity group-hover:opacity-100 hover:text-heading"
                >
                  {copiedHistoryId === item.id ? (
                    <Check className="h-3.5 w-3.5 text-success" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {viewingScript &&
        (() => {
          const parsed = parseScriptOutput(viewingScript.content);
          return (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm"
              onClick={() => setViewingScript(null)}
            >
              <div
                className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-zinc-900"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="flex items-center justify-between gap-3 border-b border-hairline px-6 py-4">
                  <h3 className="truncate text-base font-semibold text-heading">
                    {parsed.title ?? viewingScript.prompt}
                  </h3>
                  <button
                    type="button"
                    onClick={() => setViewingScript(null)}
                    aria-label="Close"
                    className="shrink-0 text-slate-400 hover:text-slate-600 dark:text-zinc-500 dark:hover:text-zinc-300"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="overflow-y-auto px-6 py-5">
                  {parsed.metrics.length > 0 && (
                    <div className="mb-4 flex flex-wrap gap-2">
                      {parsed.metrics.map((metric) => (
                        <Badge key={metric.label}>
                          {metric.label}: {metric.value}
                        </Badge>
                      ))}
                    </div>
                  )}
                  <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-heading">
                    {parsed.script || viewingScript.content}
                  </p>
                </div>

                <div className="flex shrink-0 gap-2 border-t border-hairline px-6 py-4">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    icon={copiedModal ? Check : Copy}
                    onClick={() => handleCopyModal(viewingScript.content)}
                  >
                    {copiedModal ? "Copied" : "Copy"}
                  </Button>
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    icon={Download}
                    onClick={() => handleDownloadScript(viewingScript, parsed.title)}
                  >
                    Download .txt
                  </Button>
                </div>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
