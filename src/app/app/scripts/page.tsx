"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Check,
  ChevronRight,
  Clock,
  Copy,
  Eye,
  FileBadge,
  FileText,
  FileX,
  Folder,
  Loader2,
  MoreHorizontal,
  Search,
  Sparkles,
  Trash2,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { TOOL_CREDIT_COSTS } from "@/lib/config/pricing";
import { notifyCreditsChanged } from "@/lib/client/credits-bus";
import { formatRelativeTime, parseScriptOutput, type ScriptRecord } from "@/lib/script-format";
import { Skeleton } from "@/components/ui/Skeleton";
import { PlasticButton } from "@/components/ui/plastic-button";
import { CreditCost } from "@/components/ui/CreditCost";
import { TopUpModal } from "@/components/TopUpModal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ScriptEditorModal } from "@/components/features/ScriptEditorModal";

const PLACEHOLDER =
  "Describe the video you want to create, and add reference videos to help write a viral script.";

// The "Recently Created" shelf only shows this many by default -- "History"
// expands to the full (search-filtered) list in place, no separate route.
const RECENT_LIMIT = 6;

type ReferenceKind = "sop" | "transcript";

type ReferenceFile = {
  name: string;
  content: string;
};

type ScriptHistoryItem = ScriptRecord;

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

  const hasFile = Boolean(file);

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
        "group relative flex min-w-0 flex-1 aspect-square cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl text-center transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]",
        hasFile
          ? "border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-zinc-900"
          : "border border-dashed border-slate-300 bg-slate-50/60 hover:border-blue-400 hover:bg-blue-50/50 dark:border-zinc-700 dark:bg-white/[0.02] dark:hover:border-blue-400/50 dark:hover:bg-blue-500/[0.06]",
        isDragOver && "border-blue-400 bg-blue-50/60 dark:border-blue-400/50 dark:bg-blue-500/10",
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
          <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
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
            className="absolute right-1.5 top-1.5 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-slate-500 opacity-0 transition-opacity duration-150 hover:bg-slate-200 hover:text-slate-700 group-hover:opacity-100 group-focus-within:opacity-100 dark:bg-white/10 dark:text-slate-300 dark:hover:bg-white/20 dark:hover:text-white"
          >
            <X className="h-3 w-3" />
          </button>
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
            <Icon className="h-4 w-4" />
          </div>
          <div className="flex w-full min-w-0 flex-col items-center gap-0.5 px-2">
            <span className="block w-full truncate text-center text-xs font-medium text-slate-700 dark:text-slate-200">
              {file.name}
            </span>
            <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
              {label}
            </span>
          </div>
        </>
      ) : (
        <>
          <Icon className="h-5 w-5 text-slate-400 transition-colors duration-200 group-hover:text-blue-500 dark:text-slate-500 dark:group-hover:text-blue-400" />
          <span className="text-xs font-medium text-slate-500 transition-colors duration-200 group-hover:text-slate-700 dark:text-slate-400 dark:group-hover:text-slate-200">
            {label}
          </span>
        </>
      )}
    </div>
  );
}

function ScriptWriterPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Prefilled from a "Generate script" handoff (see the video-idea cards in
  // VideoDetailModal) -- a lazy initializer rather than an effect so the URL
  // param is read once, at first render, without an extra setState-in-effect
  // render pass.
  const [prompt, setPrompt] = useState(() => searchParams.get("idea") ?? "");
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
  const [generatedScript, setGeneratedScript] = useState<ScriptHistoryItem | null>(null);
  const [showTopUp, setShowTopUp] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [deletingScript, setDeletingScript] = useState<ScriptHistoryItem | null>(null);
  const [showAllHistory, setShowAllHistory] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const modalStreamRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const canSubmit = prompt.trim().length > 0 && !isGenerating;

  const filteredHistory = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return history;
    return history.filter((item) => item.prompt.toLowerCase().includes(query));
  }, [history, search]);

  // Strips the one-time "idea" handoff param from the URL after it's been
  // consumed by the lazy prompt initializer above, so the long idea text
  // doesn't linger in the address bar or get reapplied on a later
  // back/forward navigation. Runs once on mount only.
  useEffect(() => {
    if (searchParams.get("idea")) {
      router.replace("/app/scripts", { scroll: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  async function loadHistory(): Promise<ScriptHistoryItem[]> {
    setIsLoadingHistory(true);
    try {
      const response = await fetch("/api/scripts");
      if (!response.ok) throw new Error();
      const data = await response.json();
      const scripts: ScriptHistoryItem[] = data.scripts ?? [];
      setHistory(scripts);
      return scripts;
    } catch {
      setError("Couldn't load your script history. Try refreshing the page.");
      return [];
    } finally {
      setIsLoadingHistory(false);
    }
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

      const scripts = await loadHistory();
      setGeneratedScript(scripts[0] ?? null);
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

  async function handleDeleteScript(item: ScriptHistoryItem) {
    try {
      const response = await fetch(`/api/scripts/${item.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error();
      setHistory((prev) => prev.filter((entry) => entry.id !== item.id));
      if (viewingScript?.id === item.id) setViewingScript(null);
      if (generatedScript?.id === item.id) setGeneratedScript(null);
    } catch {
      setError("Failed to delete the script. Please try again.");
    }
  }

  function handleViewScript() {
    setPopupDismissed(true);
    if (generatedScript) setViewingScript(generatedScript);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSubmit();
    }
  }

  return (
    <div className="relative">
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
        <div className="relative rounded-2xl border border-slate-200 shadow-sm transition-shadow duration-300 dark:border-white/10 dark:bg-[#111013]/80">
          <div className="relative flex flex-col gap-6 rounded-[calc(1rem-1px)] bg-[#F9FAFC] p-5 md:flex-row dark:bg-[#111013]">
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
      </div>

      {/* History -- deliberately outside the max-w-3xl wrapper above (unlike
          the header/composer/popups) so the card shelf can use the full
          content width instead of being squeezed into a narrow column. */}
      <div className="mt-12 w-full px-4 md:px-8">
      <div className="flex items-center gap-2 text-lg font-semibold text-slate-700 dark:text-slate-200">
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

      <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/50 sm:p-5">
        {isLoadingHistory ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-28 w-full rounded-card" />
            ))}
          </div>
        ) : filteredHistory.length === 0 ? (
          <div className="flex h-40 flex-col items-center justify-center gap-2 text-slate-400">
            <FileX className="h-8 w-8" />
            <p className="text-sm font-medium">Nothing Here!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {(showAllHistory ? filteredHistory : filteredHistory.slice(0, RECENT_LIMIT)).map((item) => {
              const parsed = parseScriptOutput(item.content);
              return (
              <div
                key={item.id}
                className="group relative overflow-hidden rounded-card border border-hairline bg-surface transition-colors hover:bg-app"
              >
                <button
                  type="button"
                  onClick={() => setViewingScript(item)}
                  className="block w-full p-4 pr-10 text-left"
                >
                  <p className="truncate text-sm font-semibold text-heading">{parsed.title ?? item.prompt}</p>
                  <p className="mt-1 line-clamp-2 text-sm text-body">{parsed.script || item.content}</p>
                </button>

                <div className="flex items-center gap-1.5 border-t border-hairline px-4 py-2.5 text-xs text-body">
                  <Clock className="h-3.5 w-3.5" />
                  Updated {formatRelativeTime(item.updated_at ?? item.created_at)}
                </div>

                <div className="absolute right-2 top-2.5">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      setOpenMenuId((current) => (current === item.id ? null : item.id));
                    }}
                    aria-label="Script options"
                    className="rounded-full p-1.5 text-body opacity-0 transition-opacity hover:bg-surface hover:text-heading group-hover:opacity-100"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </button>

                  {openMenuId === item.id && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setOpenMenuId(null)} />
                      <div className="absolute right-0 top-9 z-50 w-36 overflow-hidden rounded-xl border border-hairline bg-surface py-1 shadow-card-hover">
                        <button
                          type="button"
                          onClick={() => {
                            handleCopyHistoryItem(item.id, item.content);
                            setOpenMenuId(null);
                          }}
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-heading hover:bg-app"
                        >
                          {copiedHistoryId === item.id ? (
                            <Check className="h-3.5 w-3.5 text-success" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                          Copy
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setDeletingScript(item);
                            setOpenMenuId(null);
                          }}
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })}
          </div>
        )}
      </div>

      {!isLoadingHistory && filteredHistory.length > RECENT_LIMIT && (
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={() => setShowAllHistory((value) => !value)}
            className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-heading transition-colors hover:bg-app dark:border-zinc-800"
          >
            {showAllHistory ? "Show less" : "History"}
            <ChevronRight className={cn("h-4 w-4 transition-transform", showAllHistory && "rotate-90")} />
          </button>
        </div>
      )}

      {viewingScript && (
        <ScriptEditorModal
          script={viewingScript}
          onClose={() => setViewingScript(null)}
          onSaved={(updated) => {
            setHistory((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
            setViewingScript(updated);
            setGeneratedScript((prev) => (prev?.id === updated.id ? updated : prev));
          }}
        />
      )}
      </div>

      <TopUpModal isOpen={showTopUp} onClose={() => setShowTopUp(false)} />

      <ConfirmDialog
        isOpen={deletingScript !== null}
        onClose={() => setDeletingScript(null)}
        onConfirm={() => deletingScript && handleDeleteScript(deletingScript)}
        title="Delete this script?"
        description="This can't be undone -- the script and any edits will be permanently removed."
        confirmLabel="Delete"
        danger
      />
    </div>
  );
}

export default function ScriptWriterPage() {
  return (
    <Suspense fallback={null}>
      <ScriptWriterPageInner />
    </Suspense>
  );
}
