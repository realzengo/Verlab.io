"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
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
import { TOOL_CREDIT_COSTS } from "@/lib/config/pricing";
import { notifyCreditsChanged } from "@/lib/client/credits-bus";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { Button } from "@/components/ui/Button";
import { PlasticButton } from "@/components/ui/plastic-button";
import { CreditCost } from "@/components/ui/CreditCost";
import { TopUpModal } from "@/components/TopUpModal";
import { BorderTrail } from "@/components/ui/BorderTrail";

const PLACEHOLDER =
  "Describe the video you want to create, and add reference videos to help write a viral script.";

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
// Derives a status label and rough completion percentage purely from the
// streamed text itself (no fake timers) so the modal never lies about
// progress it doesn't actually have.
function getGenerationProgress(result: string): { label: string; percent: number } {
  if (!result) {
    return { label: "Analyzing your SOP and transcripts to match the formula", percent: 8 };
  }
  if (result.length < 400) {
    return { label: "Drafting the hook and structure", percent: 30 };
  }
  if (result.length < 1200) {
    return { label: "Writing the full script", percent: 65 };
  }
  return { label: "Polishing the final draft", percent: 92 };
}

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
        "group relative flex min-w-0 flex-1 aspect-square cursor-pointer rounded-xl bg-gradient-to-br from-blue-300/60 via-indigo-200/40 to-blue-400/60 p-px transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 hover:from-blue-400/80 hover:via-indigo-300/60 hover:to-blue-500/80",
        "dark:from-blue-400/40 dark:via-indigo-400/20 dark:to-blue-300/40 dark:hover:from-blue-400/70 dark:hover:via-indigo-400/45 dark:hover:to-blue-300/70",
        isDragOver && "-translate-y-0.5 from-blue-400/90 via-indigo-300/70 to-blue-500/90 dark:from-blue-400/80 dark:via-indigo-400/55 dark:to-blue-300/80",
        isUploading && "pointer-events-none opacity-70"
      )}
    >
      <div
        className={cn(
          "relative flex h-full w-full flex-col items-center justify-center gap-2.5 overflow-hidden rounded-[11px] bg-white/70 shadow-[inset_0_1px_1px_rgba(255,255,255,0.7),inset_0_-1px_2px_rgba(0,0,0,0.05)] backdrop-blur-md transition-colors duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:bg-white/90 group-hover:shadow-[inset_0_1px_1px_rgba(255,255,255,0.8),inset_0_-1px_2px_rgba(0,0,0,0.05),0_16px_32px_-14px_rgba(15,23,42,0.22)]",
          "dark:bg-zinc-950/90 dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.06),inset_0_-2px_3px_rgba(0,0,0,0.6)] dark:group-hover:bg-zinc-900/90 dark:group-hover:shadow-[inset_0_1px_1px_rgba(255,255,255,0.08),inset_0_-2px_3px_rgba(0,0,0,0.6),0_16px_32px_-14px_rgba(0,0,0,0.65)]",
          isDragOver && "bg-white/95 dark:bg-zinc-900/95"
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
            <Icon className="h-6 w-6 text-slate-400 transition-colors duration-300 group-hover:text-blue-500 dark:group-hover:text-blue-400" />
            <span className="text-sm font-medium text-slate-500 transition-colors duration-300 group-hover:text-slate-700 dark:group-hover:text-slate-300">
              {label}
            </span>
          </>
        )}
      </div>
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
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [popupDismissed, setPopupDismissed] = useState(false);
  const [copiedResult, setCopiedResult] = useState(false);
  const [copiedHistoryId, setCopiedHistoryId] = useState<string | null>(null);
  const [uploadingKind, setUploadingKind] = useState<ReferenceKind | null>(null);
  const [viewingScript, setViewingScript] = useState<ScriptHistoryItem | null>(null);
  const [copiedModal, setCopiedModal] = useState(false);
  const [showTopUp, setShowTopUp] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const modalStreamRef = useRef<HTMLDivElement>(null);
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
    setIsLoadingHistory(true);
    fetch("/api/scripts")
      .then((response) => {
        if (!response.ok) throw new Error();
        return response.json();
      })
      .then((data) => setHistory(data.scripts ?? []))
      .catch(() => setError("Couldn't load your script history. Try refreshing the page."))
      .finally(() => setIsLoadingHistory(false));
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

  // Auto-scrolls the modal's live text preview to the bottom as streamed
  // tokens arrive, so the newest text is always in view.
  useEffect(() => {
    if (!isGenerating) return;
    modalStreamRef.current?.scrollTo({ top: modalStreamRef.current.scrollHeight });
  }, [isGenerating, result]);

  async function handleSubmit() {
    if (!canSubmit) return;

    const message = prompt.trim();
    setIsGenerating(true);
    setError(null);
    setResult("");
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
        if (response.status === 402) {
          setShowTopUp(true);
          return;
        }
        const data = await response.json().catch(() => null);
        throw new Error(data?.error ?? "Failed to generate script.");
      }

      // generate-script/route.ts charges before it ever starts streaming, so
      // the balance has already changed by the time this response resolves
      // — no need to wait for the stream to finish reading.
      notifyCreditsChanged();

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        setResult((prev) => prev + decoder.decode(value, { stream: true }));
      }

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
    <div className="relative">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 -top-24 -z-10 h-56 bg-blue-400/50 blur-[100px] dark:bg-blue-500/30 sm:-top-40 sm:h-72 sm:blur-[130px]"
      />

      <div className="relative mx-auto w-full max-w-3xl pt-8 sm:pt-12">
      {/* Header */}
      <div>
        <h1 className="bg-gradient-to-br from-heading via-heading to-primary bg-clip-text text-3xl font-extrabold tracking-tight text-transparent sm:text-4xl">
          Scriptwriter
        </h1>
        <p className="mt-2 text-xs font-medium tracking-wide text-body/60 sm:text-sm">
          Create engaging scripts for your videos with AI-powered writing assistance.
        </p>
      </div>

      {/* Prompter */}
      <div className="group relative mt-8">
        {/* Focused ambient glow — two soft blobs give the glass something
            textured to refract, instead of one flat wash. */}
        <div aria-hidden="true" className="pointer-events-none absolute -inset-20 -z-10 overflow-hidden">
          <div className="absolute -left-10 -top-16 h-56 w-72 rounded-full bg-blue-500/25 blur-[90px] transition-opacity duration-500 dark:bg-blue-500/35" />
          <div className="absolute -right-6 -bottom-12 h-48 w-64 rounded-full bg-indigo-500/0 blur-[90px] transition-opacity duration-500 dark:bg-indigo-500/25" />
        </div>

        {/* Border wrapper — a thin static border plus an animated light
            trail that travels the perimeter for a premium, "alive" edge. */}
        <div
          className={cn(
            "relative rounded-2xl border border-slate-200 shadow-[0_12px_32px_-16px_rgba(37,99,235,0.18)] transition-shadow duration-300",
            "dark:border-white/10 dark:shadow-[0_1px_0_rgba(255,255,255,0.04),0_24px_60px_-20px_rgba(37,99,235,0.55)]"
          )}
        >
          <BorderTrail
            size={140}
            className="bg-gradient-to-l from-blue-200 via-blue-500 to-blue-200 opacity-70 blur-[8px] dark:from-blue-400 dark:via-blue-300 dark:to-blue-400"
            transition={{ repeat: Infinity, duration: 16, ease: "linear" }}
          />

          <div
            className={cn(
              "relative flex flex-col gap-6 rounded-[calc(1rem-1px)] bg-white/60 p-5 backdrop-blur-2xl backdrop-saturate-150 md:flex-row",
              "dark:bg-zinc-950/80 dark:bg-[linear-gradient(180deg,rgba(59,130,246,0.14),rgba(9,9,11,0)_45%)]"
            )}
          >
            {/* Text Input Area */}
            <div className="relative flex flex-1 gap-3">
              <textarea
                ref={textareaRef}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={PLACEHOLDER}
                disabled={isGenerating}
                className="h-full min-h-[150px] w-full resize-none bg-transparent text-sm leading-relaxed text-slate-900 outline-none placeholder:text-slate-400 disabled:opacity-60 dark:text-white dark:placeholder:text-zinc-500"
              />
            </div>

            {/* Divider */}
            <div className="relative hidden w-px self-stretch bg-gradient-to-b from-transparent via-slate-200 to-transparent dark:via-white/10 md:block" />

            {/* Square Drop Zones */}
            <div className="relative flex w-full flex-col gap-3 md:w-[280px]">
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

              <PlasticButton
                text="Generate"
                loading={isGenerating}
                disabled={!canSubmit}
                onClick={handleSubmit}
                className="w-full py-3"
                trailing={<CreditCost amount={TOOL_CREDIT_COSTS.script.generation} className="text-blue-200/80" />}
              />
            </div>
          </div>
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
              (() => {
                const progress = getGenerationProgress(result);
                const wordCount = result.trim() ? result.trim().split(/\s+/).length : 0;
                return (
                  <div className="p-6 pt-5 text-left">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary">
                          <Sparkles className="h-4 w-4 text-white" />
                          <span className="absolute inset-0 -z-10 animate-ping rounded-full bg-primary/40" />
                        </span>
                        <div className="min-w-0">
                          <h3 className="text-base font-semibold leading-tight text-slate-900 dark:text-white">
                            Generating your script
                          </h3>
                          <p className="mt-0.5 text-xs leading-snug text-slate-400 dark:text-zinc-500">
                            {progress.label}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={cancelGeneration}
                        aria-label="Cancel generation"
                        className="shrink-0 rounded-full p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="mt-4 h-1 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-zinc-800">
                      <div
                        className="h-full rounded-full bg-primary transition-[width] duration-700 ease-out"
                        style={{ width: `${progress.percent}%` }}
                      />
                    </div>

                    <div className="relative mt-4">
                      <div
                        ref={modalStreamRef}
                        className="max-h-64 min-h-[7rem] overflow-y-auto rounded-xl bg-slate-50 p-4 text-sm leading-relaxed text-slate-700 dark:bg-zinc-800/60 dark:text-zinc-300"
                      >
                        {result ? (
                          <p className="whitespace-pre-wrap">
                            {result}
                            <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-current align-middle" />
                          </p>
                        ) : (
                          <div className="flex h-full items-center gap-2 text-slate-400 dark:text-zinc-500">
                            <span className="flex h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.3s]" />
                            <span className="flex h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.15s]" />
                            <span className="flex h-1.5 w-1.5 animate-bounce rounded-full bg-current" />
                          </div>
                        )}
                      </div>
                      <div className="pointer-events-none absolute inset-x-0 top-0 h-5 rounded-t-xl bg-gradient-to-b from-slate-50 to-transparent dark:from-zinc-800/60" />
                      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-5 rounded-b-xl bg-gradient-to-t from-slate-50 to-transparent dark:from-zinc-800/60" />
                    </div>

                    <div className="mt-4 flex items-center justify-between">
                      <span className="text-xs tabular-nums text-slate-400 dark:text-zinc-500">
                        {wordCount > 0 ? `${wordCount} words written` : "Starting up…"}
                      </span>
                      <button
                        type="button"
                        onClick={cancelGeneration}
                        className="text-xs font-semibold text-slate-500 transition-colors hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                );
              })()
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
                    <PlasticButton text="Generate Another" onClick={handleGenerateAnother} />
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

      {isLoadingHistory ? (
        <div className="mt-4 flex flex-col gap-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-card" />
          ))}
        </div>
      ) : filteredHistory.length === 0 ? (
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

      <TopUpModal isOpen={showTopUp} onClose={() => setShowTopUp(false)} />
    </div>
  );
}
