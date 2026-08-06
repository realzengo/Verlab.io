"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Copy,
  FileText,
  Loader2,
  MessageSquare,
  Mic2,
  Pencil,
  Plus,
  Redo2,
  RotateCcw,
  Send,
  Sparkles,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { writeVoiceoverHandoff } from "@/lib/client/voiceover-handoff";
import { notifyCreditsChanged } from "@/lib/client/credits-bus";
import {
  buildScriptOutput,
  countWords,
  estimateDurationLabel,
  joinSegments,
  parseScriptOutput,
  splitIntoSegments,
  type ScriptRecord,
} from "@/lib/script-format";

interface ScriptEditorModalProps {
  script: ScriptRecord;
  onClose: () => void;
  onSaved: (updated: ScriptRecord) => void;
}

interface ChatMessage {
  role: "user" | "assistant" | "error";
  content: string;
}

const QUICK_PROMPTS = ["Tighten the hook", "Make it punchier", "Shorten this script"];

export function ScriptEditorModal({ script, onClose, onSaved }: ScriptEditorModalProps) {
  const router = useRouter();
  const parsedInitial = useMemo(() => parseScriptOutput(script.content), [script.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const [title, setTitle] = useState(parsedInitial.title ?? script.prompt);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [metrics, setMetrics] = useState(parsedInitial.metrics);
  const [viewMode, setViewMode] = useState<"line" | "full">("line");
  const [mobilePane, setMobilePane] = useState<"editor" | "chat">("editor");
  const [segments, setSegments] = useState<string[]>(() => splitIntoSegments(parsedInitial.script));
  const [baselineSegments, setBaselineSegments] = useState<string[]>(segments);
  const [fullText, setFullText] = useState(parsedInitial.script);
  const [undoStack, setUndoStack] = useState<string[][]>([]);
  const [redoStack, setRedoStack] = useState<string[][]>([]);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [copied, setCopied] = useState(false);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isSendingChat, setIsSendingChat] = useState(false);

  const scriptIdRef = useRef(script.id);
  // Seeded from a round-trip through buildScriptOutput (not the raw stored
  // content) so the autosave effect's equality check compares like-for-like
  // -- otherwise incidental formatting/whitespace differences between the
  // model's original output and our re-serialized form would fire a no-op
  // save the instant the modal opens.
  const savedContentRef = useRef(
    buildScriptOutput({ title, script: joinSegments(segments), metrics })
  );
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    chatScrollRef.current?.scrollTo({ top: chatScrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isSendingChat]);

  const currentScript = viewMode === "full" ? fullText : joinSegments(segments);
  const words = countWords(currentScript);
  const duration = estimateDurationLabel(words);

  // Autosaves plain edits (line-by-line or full-editor text) a beat after
  // the user stops typing -- AI-driven edits persist themselves server-side
  // in /api/scripts/edit-chat, so this only fires for manual changes.
  useEffect(() => {
    const rebuilt = buildScriptOutput({ title, script: currentScript, metrics });
    if (rebuilt === savedContentRef.current) return;

    setSaveStatus("saving");
    const timeout = setTimeout(async () => {
      try {
        const response = await fetch(`/api/scripts/${scriptIdRef.current}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: rebuilt }),
        });
        if (!response.ok) return;
        const data = await response.json();
        savedContentRef.current = rebuilt;
        setSaveStatus("saved");
        onSaved(data.script as ScriptRecord);
      } catch {
        // Silently retry on the next edit -- no need to interrupt writing.
      }
    }, 900);

    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentScript, title]);

  function pushUndoSnapshot(previous: string[]) {
    setUndoStack((stack) => [...stack, previous]);
    setRedoStack([]);
  }

  function updateSegment(index: number, value: string) {
    setSegments((prev) => prev.map((segment, i) => (i === index ? value : segment)));
  }

  function commitSegmentEdit(index: number, previousValue: string) {
    if (segments[index] === previousValue) return;
    const snapshot = segments.map((s, i) => (i === index ? previousValue : s));
    pushUndoSnapshot(snapshot);
  }

  function revertSegment(index: number) {
    if (!baselineSegments[index] || segments[index] === baselineSegments[index]) return;
    pushUndoSnapshot(segments);
    updateSegment(index, baselineSegments[index]);
  }

  function deleteSegment(index: number) {
    pushUndoSnapshot(segments);
    setSegments((prev) => prev.filter((_, i) => i !== index));
  }

  function addSegment() {
    pushUndoSnapshot(segments);
    setSegments((prev) => [...prev, ""]);
  }

  function undo() {
    setUndoStack((stack) => {
      if (stack.length === 0) return stack;
      const next = stack[stack.length - 1];
      setRedoStack((redo) => [...redo, segments]);
      setSegments(next);
      return stack.slice(0, -1);
    });
  }

  function redo() {
    setRedoStack((stack) => {
      if (stack.length === 0) return stack;
      const next = stack[stack.length - 1];
      setUndoStack((undoS) => [...undoS, segments]);
      setSegments(next);
      return stack.slice(0, -1);
    });
  }

  function switchToFull() {
    setFullText(joinSegments(segments));
    setViewMode("full");
  }

  function switchToLine() {
    setSegments(splitIntoSegments(fullText));
    setViewMode("line");
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(currentScript);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function handleGenerateVoiceover() {
    writeVoiceoverHandoff({ title, script: currentScript });
    router.push("/app/voiceover-generator");
  }

  async function handleSendChatEdit() {
    const instruction = chatInput.trim();
    if (!instruction || isSendingChat) return;

    setMessages((prev) => [...prev, { role: "user", content: instruction }]);
    setChatInput("");
    setIsSendingChat(true);

    const currentContent = buildScriptOutput({ title, script: joinSegments(segments), metrics });

    try {
      const response = await fetch("/api/scripts/edit-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scriptId: scriptIdRef.current, content: currentContent, instruction }),
      });

      if (!response.ok || !response.body) {
        if (response.status === 402) {
          setMessages((prev) => [
            ...prev,
            { role: "error", content: "You're out of credits. Top up to keep editing with AI." },
          ]);
          return;
        }
        const data = await response.json().catch(() => null);
        throw new Error(data?.error ?? "Couldn't edit the script. Try again.");
      }

      notifyCreditsChanged();

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullResponse = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        fullResponse += decoder.decode(value, { stream: true });
      }

      const revised = parseScriptOutput(fullResponse);
      const revisedSegments = splitIntoSegments(revised.script);
      pushUndoSnapshot(segments);
      setSegments(revisedSegments);
      setBaselineSegments(revisedSegments);
      setFullText(revised.script);
      if (revised.metrics.length > 0) setMetrics(revised.metrics);

      setMessages((prev) => [...prev, { role: "assistant", content: "Updated your script." }]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "error", content: err instanceof Error ? err.message : "Something went wrong. Try again." },
      ]);
    } finally {
      setIsSendingChat(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex h-[100dvh] bg-black/40 md:backdrop-blur-sm" onClick={onClose}>
      <div
        className="m-auto flex h-[100dvh] w-full flex-col overflow-hidden bg-white shadow-2xl dark:bg-zinc-950 md:h-[85vh] md:max-h-[92vh] md:max-w-6xl md:rounded-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        {/* Mobile pane switcher -- desktop shows editor + AI chat side by side,
            but there's no room for both on a phone, so this swaps between them. */}
        <div className="relative flex shrink-0 items-center justify-center border-b border-hairline px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] md:hidden">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute left-4 rounded-full p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="flex rounded-full bg-slate-100 p-1 dark:bg-zinc-900">
            <button
              type="button"
              onClick={() => setMobilePane("editor")}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition-colors",
                mobilePane === "editor"
                  ? "bg-white text-heading shadow-sm dark:bg-zinc-800"
                  : "text-slate-500 dark:text-zinc-400"
              )}
            >
              <FileText className="h-4 w-4" />
              Editor
            </button>
            <button
              type="button"
              onClick={() => setMobilePane("chat")}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition-colors",
                mobilePane === "chat"
                  ? "bg-white text-heading shadow-sm dark:bg-zinc-800"
                  : "text-slate-500 dark:text-zinc-400"
              )}
            >
              <MessageSquare className="h-4 w-4" />
              AI Chat
            </button>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        {/* Left: script editor */}
        <div
          className={cn(
            "min-h-0 min-w-0 flex-1 flex-col md:flex md:border-r md:border-hairline",
            mobilePane === "editor" ? "flex" : "hidden"
          )}
        >
          <div className="flex flex-col gap-3 border-b border-hairline px-4 py-3 md:flex-row md:items-center md:justify-between md:gap-3 md:px-6 md:py-4">
            <div className="flex min-w-0 items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="mr-1 hidden shrink-0 rounded-full p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-300 md:inline-flex"
              >
                <X className="h-4 w-4" />
              </button>
              {isEditingTitle ? (
                <input
                  autoFocus
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  onBlur={() => setIsEditingTitle(false)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      setIsEditingTitle(false);
                    }
                  }}
                  className="min-w-0 flex-1 rounded-md border border-primary bg-transparent px-1.5 py-0.5 text-base font-semibold text-heading outline-none"
                />
              ) : (
                <>
                  <h2 className="truncate text-base font-semibold text-heading">{title}</h2>
                  <button
                    type="button"
                    onClick={() => setIsEditingTitle(true)}
                    aria-label="Edit title"
                    className="shrink-0 rounded-full p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                </>
              )}
            </div>

            <div className="flex shrink-0 items-center justify-between gap-3 md:justify-end">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={undo}
                  disabled={undoStack.length === 0}
                  aria-label="Undo"
                  className="rounded-full p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 disabled:pointer-events-none disabled:opacity-30 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
                >
                  <Undo2 className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={redo}
                  disabled={redoStack.length === 0}
                  aria-label="Redo"
                  className="rounded-full p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 disabled:pointer-events-none disabled:opacity-30 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
                >
                  <Redo2 className="h-4 w-4" />
                </button>
              </div>

              <div className="flex rounded-lg bg-slate-100 p-1 text-xs font-semibold dark:bg-zinc-900">
                <button
                  type="button"
                  onClick={switchToLine}
                  className={cn(
                    "rounded-md px-3 py-1.5 transition-colors",
                    viewMode === "line"
                      ? "bg-white text-heading shadow-sm dark:bg-zinc-800"
                      : "text-slate-500 dark:text-zinc-400"
                  )}
                >
                  Line by line
                </button>
                <button
                  type="button"
                  onClick={switchToFull}
                  className={cn(
                    "rounded-md px-3 py-1.5 transition-colors",
                    viewMode === "full"
                      ? "bg-white text-heading shadow-sm dark:bg-zinc-800"
                      : "text-slate-500 dark:text-zinc-400"
                  )}
                >
                  Full editor
                </button>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4 md:px-6 md:py-5">
            {viewMode === "line" ? (
              <div className="flex flex-col gap-2.5">
                {segments.map((segment, index) => (
                  <SegmentRow
                    key={index}
                    index={index}
                    value={segment}
                    canRevert={baselineSegments[index] !== undefined && segment !== baselineSegments[index]}
                    onChange={(value) => updateSegment(index, value)}
                    onCommit={(previousValue) => commitSegmentEdit(index, previousValue)}
                    onRevert={() => revertSegment(index)}
                    onDelete={() => deleteSegment(index)}
                  />
                ))}

                <button
                  type="button"
                  onClick={addSegment}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-hairline py-3 text-sm font-medium text-body transition-colors hover:border-primary hover:text-primary"
                >
                  <Plus className="h-4 w-4" />
                  Add Segment
                </button>
              </div>
            ) : (
              <textarea
                value={fullText}
                onChange={(event) => setFullText(event.target.value)}
                className="h-full min-h-[300px] w-full resize-none rounded-xl border border-hairline bg-app p-4 text-sm leading-relaxed text-heading outline-none focus:border-primary"
              />
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-hairline px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 md:gap-3 md:px-6 md:py-3.5">
            <span className="flex items-center gap-1.5 text-xs text-body">
              {saveStatus === "saving" ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Saving…
                </>
              ) : saveStatus === "saved" ? (
                <>
                  <Check className="h-3 w-3 text-success" />
                  Saved just now
                </>
              ) : (
                "All changes saved"
              )}
              <span className="mx-1 text-hairline">·</span>
              {words} words
              <span className="mx-1 text-hairline">·</span>
              {duration}
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopy}
                className="flex items-center gap-1.5 rounded-lg border border-hairline px-3 py-1.5 text-xs font-semibold text-heading transition-colors hover:bg-app"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copied" : "Copy"}
              </button>
              <button
                type="button"
                onClick={handleGenerateVoiceover}
                disabled={!currentScript.trim()}
                className="flex items-center gap-1.5 rounded-lg bg-btn-primary px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-btn-primary-hover disabled:pointer-events-none disabled:opacity-40"
              >
                <Mic2 className="h-3.5 w-3.5" />
                Generate Voiceover
              </button>
            </div>
          </div>
        </div>

        {/* Right: Ask AI to edit */}
        <div
          className={cn(
            "min-h-0 w-full flex-1 flex-col md:flex md:max-w-sm md:border-l md:border-hairline",
            mobilePane === "chat" ? "flex" : "hidden md:flex"
          )}
        >
          <div className="relative flex items-center gap-3 overflow-hidden border-b border-hairline bg-gradient-to-br from-accent/70 via-transparent to-transparent px-5 py-4">
            <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-indigo-500 text-white shadow-blue">
              <span className="absolute h-7 w-7 animate-craft-glow rounded-full bg-primary/50 blur-md" />
              <Sparkles className="relative h-4 w-4" />
            </span>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-heading">Ask AI to edit</h3>
              <p className="truncate text-xs text-body/70">Changes apply straight to your script</p>
            </div>
          </div>

          <div ref={chatScrollRef} className="flex-1 overflow-y-auto px-5 py-4">
            {messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
                <span className="relative flex h-16 w-16 items-center justify-center rounded-full bg-accent ring-1 ring-primary/10">
                  <span className="absolute h-12 w-12 animate-craft-glow rounded-full bg-primary/40 blur-xl" />
                  <Sparkles className="relative h-7 w-7 text-primary" />
                </span>
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-heading">Edit with AI</p>
                  <p className="max-w-[240px] text-sm text-body/80">
                    Ask to tighten the hook, shorten a line, or change the tone — it&apos;ll rewrite the script for you.
                  </p>
                </div>
                <div className="flex flex-wrap justify-center gap-1.5">
                  {QUICK_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => {
                        setChatInput(prompt);
                        chatInputRef.current?.focus();
                      }}
                      className="group flex items-center gap-1.5 rounded-full border border-hairline bg-surface px-3 py-1.5 text-xs font-medium text-body shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:border-primary/40 hover:text-primary hover:shadow-[0_4px_14px_-4px_rgba(51,92,255,0.35)]"
                    >
                      <Sparkles className="h-3 w-3 text-primary/50 transition-colors group-hover:text-primary" />
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {messages.map((message, index) => (
                  <div
                    key={index}
                    className={cn(
                      "flex items-end gap-2",
                      message.role === "user" && "flex-row-reverse"
                    )}
                  >
                    {message.role !== "user" && (
                      <span
                        className={cn(
                          "relative mb-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
                          message.role === "error"
                            ? "bg-red-100 text-red-500 dark:bg-red-500/15 dark:text-red-400"
                            : "bg-gradient-to-br from-primary to-indigo-500 text-white"
                        )}
                      >
                        {message.role !== "error" && (
                          <span className="absolute h-5 w-5 animate-craft-glow rounded-full bg-primary/50 blur-sm" />
                        )}
                        <Sparkles className="relative h-3 w-3" />
                      </span>
                    )}
                    <div
                      className={cn(
                        "max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-sm",
                        message.role === "user" && "rounded-br-md bg-btn-primary text-white",
                        message.role === "assistant" && "rounded-bl-md bg-accent text-heading",
                        message.role === "error" &&
                          "rounded-bl-md bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400"
                      )}
                    >
                      {message.content}
                    </div>
                  </div>
                ))}
                {isSendingChat && (
                  <div className="flex items-end gap-2">
                    <span className="relative mb-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-indigo-500 text-white">
                      <span className="absolute h-5 w-5 animate-craft-glow rounded-full bg-primary/50 blur-sm" />
                      <Sparkles className="relative h-3 w-3" />
                    </span>
                    <div className="flex items-center gap-2 rounded-2xl rounded-bl-md bg-accent px-4 py-3 shadow-sm">
                      <span className="text-sm text-body">Updating your script</span>
                      <span className="flex items-center gap-0.5">
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary/70 [animation-delay:-0.3s]" />
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary/70 [animation-delay:-0.15s]" />
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary/70" />
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="border-t border-hairline px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
            <div className="flex items-end gap-1 rounded-2xl border border-hairline bg-app px-3 py-2 shadow-sm transition-all duration-150 focus-within:border-primary/60 focus-within:shadow-[0_0_0_3px_rgba(51,92,255,0.12)]">
              <textarea
                ref={chatInputRef}
                value={chatInput}
                onChange={(event) => setChatInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    handleSendChatEdit();
                  }
                }}
                placeholder="Ask to edit your script…"
                rows={1}
                disabled={isSendingChat}
                className="max-h-24 flex-1 resize-none bg-transparent py-1.5 text-sm text-heading outline-none placeholder:text-slate-400 disabled:opacity-60 dark:placeholder:text-zinc-500"
              />
              <button
                type="button"
                onClick={handleSendChatEdit}
                disabled={!chatInput.trim() || isSendingChat}
                aria-label="Send"
                className="relative shrink-0 rounded-full p-2 text-white transition-all duration-150 active:scale-95 disabled:pointer-events-none disabled:opacity-30"
                style={{
                  background: "linear-gradient(to bottom, #4d70ff, var(--color-primary-hover))",
                  boxShadow:
                    "0 2px 8px 0 rgba(51,92,255,0.35), 0 1.5px 0 0 rgba(255,255,255,0.25) inset, 0 -2px 6px 0 rgba(34,70,214,0.45) inset",
                }}
              >
                <Send className="relative h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}

interface SegmentRowProps {
  index: number;
  value: string;
  canRevert: boolean;
  onChange: (value: string) => void;
  onCommit: (previousValue: string) => void;
  onRevert: () => void;
  onDelete: () => void;
}

function SegmentRow({ index, value, canRevert, onChange, onCommit, onRevert, onDelete }: SegmentRowProps) {
  const focusValueRef = useRef(value);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-grows to fit content -- a plain <input> clips long lines instead
  // of wrapping them, which reads as broken rather than intentionally
  // single-line for a sentence-per-row editor like this.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  return (
    <div className="group flex items-start gap-3">
      <span className="mt-1.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent text-xs font-semibold text-primary">
        {index + 1}
      </span>
      <textarea
        ref={textareaRef}
        rows={1}
        value={value}
        onFocus={() => {
          focusValueRef.current = value;
        }}
        onChange={(event) => onChange(event.target.value)}
        onBlur={() => onCommit(focusValueRef.current)}
        className="min-w-0 flex-1 resize-none overflow-hidden rounded-xl border border-hairline bg-surface px-3.5 py-2.5 text-sm leading-relaxed text-heading outline-none focus:border-primary"
      />
      <button
        type="button"
        onClick={onRevert}
        disabled={!canRevert}
        aria-label="Revert line"
        title="Revert to original"
        className="shrink-0 rounded-full p-1.5 text-slate-400 opacity-100 transition-opacity hover:bg-slate-100 hover:text-slate-600 disabled:pointer-events-none disabled:opacity-0 md:opacity-0 md:group-hover:opacity-100 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
      >
        <RotateCcw className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={onDelete}
        aria-label="Delete line"
        title="Delete line"
        className="shrink-0 cursor-pointer rounded-full p-1.5 text-slate-300 opacity-100 transition-opacity hover:bg-slate-100 hover:text-red-500 md:opacity-0 md:group-hover:opacity-100 dark:text-zinc-600 dark:hover:bg-zinc-800"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
