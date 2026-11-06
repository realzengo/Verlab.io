"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Loader2, Mic, Upload, X } from "lucide-react";
import { formatClock, VoiceRecorder } from "@/components/features/voiceover-generator/VoiceRecorder";
import type { ProcessedRecording } from "@/lib/client/voice-recording";
import { getVoiceCloneCost } from "@/lib/config/pricing";
import {
  CLONE_CONSENT_TEXT,
  CLONE_DEFAULT_LANGUAGE,
  CLONE_DEFAULT_PREVIEW_TEXT,
  CLONE_LANGUAGES,
  CLONE_PREVIEW_TEXT_MAX,
  CLONE_SAMPLE_EXTENSIONS,
  CLONE_SAMPLE_MAX_BYTES,
  CLONE_SAMPLE_MAX_SECONDS,
  CLONE_SAMPLE_MIN_SECONDS,
  CLONE_SAMPLE_TYPES,
  type CloneGender,
  type CloneLanguage,
  type VoiceCloneSummary,
} from "@/lib/config/voices";
import { createClient as createBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { isValidName, NAME_MAX } from "@/lib/validation";

const CLONE_COST = getVoiceCloneCost();
const SAMPLE_BUCKET = "voice-clone-uploads";
const ACCEPT = ".wav,.mp3,.mpeg,.mpga,.m4a,audio/wav,audio/x-wav,audio/mpeg,audio/mp4,audio/x-m4a";

type Stage = "idle" | "uploading" | "cloning";
type SampleSource = "record" | "upload";

interface Sample {
  file: File;
  durationSeconds: number | null;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isAcceptedFile(file: File): boolean {
  if (CLONE_SAMPLE_TYPES[file.type.toLowerCase()]) return true;
  const ext = file.name.split(".").pop()?.toLowerCase();
  return Boolean(ext && CLONE_SAMPLE_EXTENSIONS[ext]);
}

// The browser's own decoder reads the length from the file's header. Null
// when it can't (an M4A some browsers won't open) -- the server and MiniMax
// still enforce the limits, so the form just doesn't pre-check it then.
function readAudioDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const audio = new Audio();
    const done = (value: number | null) => {
      URL.revokeObjectURL(url);
      resolve(value);
    };
    const timer = setTimeout(() => done(null), 8000);
    audio.preload = "metadata";
    audio.onloadedmetadata = () => {
      clearTimeout(timer);
      done(Number.isFinite(audio.duration) ? audio.duration : null);
    };
    audio.onerror = () => {
      clearTimeout(timer);
      done(null);
    };
    audio.src = url;
  });
}

const LABEL = "block text-sm font-medium text-heading";
const FIELD =
  "w-full rounded-xl border border-hairline bg-surface px-4 text-[15px] text-heading outline-none transition-colors placeholder:text-subtle focus:border-primary/50 focus:ring-2 focus:ring-primary/15 disabled:opacity-60";

interface CloneVoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (voiceClone: VoiceCloneSummary) => void;
}

export function CloneVoiceModal({ isOpen, onClose, onCreated }: CloneVoiceModalProps) {
  const [name, setName] = useState("");
  const [sampleSource, setSampleSource] = useState<SampleSource>("record");
  const [recording, setRecording] = useState<ProcessedRecording | null>(null);
  const [recorderBusy, setRecorderBusy] = useState(false);
  const [sample, setSample] = useState<Sample | null>(null);
  const [sampleError, setSampleError] = useState<string | null>(null);
  const [isReadingSample, setIsReadingSample] = useState(false);
  const [language, setLanguage] = useState<CloneLanguage>(CLONE_DEFAULT_LANGUAGE);
  const [gender, setGender] = useState<CloneGender>("male");
  const [previewText, setPreviewText] = useState(CLONE_DEFAULT_PREVIEW_TEXT);
  const [noiseReduction, setNoiseReduction] = useState(true);
  const [consent, setConsent] = useState(false);
  const [stage, setStage] = useState<Stage>("idle");
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const ids = useId();

  const isWorking = stage !== "idle";

  function reset() {
    setName("");
    setRecording(null);
    setSample(null);
    setSampleError(null);
    setLanguage(CLONE_DEFAULT_LANGUAGE);
    setGender("male");
    setPreviewText(CLONE_DEFAULT_PREVIEW_TEXT);
    setNoiseReduction(true);
    setConsent(false);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  // Closing is blocked mid-clone: the request is already paid for upstream,
  // and closing would only hide its result. A stray backdrop click or Escape
  // mid-take is ignored too; only the close button throws a take away.
  function requestClose() {
    if (isWorking || recorderBusy) return;
    onClose();
  }

  useEffect(() => {
    if (!isOpen) return;
    // Capture phase, so the voice picker underneath never sees this Escape.
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      if (stage === "idle" && !recorderBusy) onClose();
    }
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [isOpen, stage, recorderBusy, onClose]);

  async function handleFile(file: File | undefined) {
    setSampleError(null);
    setSample(null);
    if (!file) return;
    if (!isAcceptedFile(file)) {
      setSampleError("Choose a WAV, MP3, MPEG, or M4A file.");
      return;
    }
    if (file.size > CLONE_SAMPLE_MAX_BYTES) {
      setSampleError(`That file is ${formatFileSize(file.size)}. Samples must be under 20MB.`);
      return;
    }
    setIsReadingSample(true);
    const durationSeconds = await readAudioDuration(file);
    setIsReadingSample(false);
    if (durationSeconds !== null && durationSeconds < CLONE_SAMPLE_MIN_SECONDS) {
      setSampleError(`That sample is ${Math.round(durationSeconds)} seconds long. It needs at least ${CLONE_SAMPLE_MIN_SECONDS}.`);
      return;
    }
    if (durationSeconds !== null && durationSeconds > CLONE_SAMPLE_MAX_SECONDS + 1) {
      setSampleError(`That sample is ${formatClock(durationSeconds)} long. Keep it under 5 minutes.`);
      return;
    }
    setSample({ file, durationSeconds });
  }

  const trimmedName = name.trim();
  const trimmedPreview = previewText.trim();
  const activeSample: Sample | null = sampleSource === "record" ? recording && { file: recording.file, durationSeconds: recording.durationSeconds } : sample;
  const canSubmit =
    !isWorking && !isReadingSample && !recorderBusy && isValidName(trimmedName) && activeSample !== null && trimmedPreview.length > 0 && consent;

  async function handleSubmit() {
    if (!canSubmit || !activeSample) return;
    setError(null);
    try {
      setStage("uploading");
      const prep = await fetch("/api/voice-clones/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: activeSample.file.name, contentType: activeSample.file.type, size: activeSample.file.size }),
      });
      const prepData = await prep.json().catch(() => null);
      if (!prep.ok) throw new Error(prepData?.error ?? "Could not start the upload.");

      const { path, token, contentType } = prepData as { path: string; token: string; contentType: string };
      const { error: uploadError } = await createBrowserClient().storage.from(SAMPLE_BUCKET).uploadToSignedUrl(path, token, activeSample.file, { contentType });
      if (uploadError) throw new Error("Uploading your sample failed. Check your connection and try again.");

      setStage("cloning");
      const response = await fetch("/api/voice-clones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmedName,
          uploadPath: path,
          source: sampleSource === "record" ? "recording" : "upload",
          language,
          gender,
          previewText: trimmedPreview,
          noiseReduction,
          consent: true,
        }),
        signal: AbortSignal.timeout(200_000),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.voiceClone) {
        throw new Error(response.status === 402 ? `You need ${CLONE_COST} credits to clone a voice.` : (data?.error ?? "We couldn't clone that voice. Please try again."));
      }

      onCreated(data.voiceClone as VoiceCloneSummary);
      reset();
      onClose();
    } catch (err) {
      setError(err instanceof Error && err.name !== "TimeoutError" ? err.message : "Cloning is taking longer than expected. Check the Cloned tab in a minute.");
    } finally {
      setStage("idle");
    }
  }

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onClick={requestClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${ids}-title`}
        className="flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-3xl bg-surface shadow-[0_24px_64px_-16px_rgba(16,24,40,0.3)] dark:ring-1 dark:ring-white/[0.08]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 px-6 pt-6">
          <div>
            <h2 id={`${ids}-title`} className="text-xl font-semibold text-heading">
              Clone a voice
            </h2>
            <p className="mt-1 text-sm text-subtle">Create a reusable cloned voice.</p>
          </div>
          <button
            type="button"
            onClick={() => !isWorking && onClose()}
            disabled={isWorking}
            aria-label="Close"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-hairline text-heading transition-colors hover:bg-(--app-fill) disabled:opacity-40"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 pb-6 pt-5">
          <div>
            <label htmlFor={`${ids}-name`} className={LABEL}>
              Voice name
            </label>
            <input
              id={`${ids}-name`}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="My voice"
              maxLength={NAME_MAX}
              disabled={isWorking}
              className={cn(FIELD, "mt-2 h-12")}
            />
          </div>

          <div>
            <div className="flex items-center justify-between gap-3">
              <span id={`${ids}-sample-label`} className={LABEL}>
                Audio sample
              </span>
              <div role="radiogroup" aria-labelledby={`${ids}-sample-label`} className="inline-flex rounded-lg bg-(--app-fill-strong) p-0.5">
                {(
                  [
                    { value: "record", label: "Record", Icon: Mic },
                    { value: "upload", label: "Upload file", Icon: Upload },
                  ] as const
                ).map(({ value, label, Icon }) => (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={sampleSource === value}
                    onClick={() => setSampleSource(value)}
                    disabled={isWorking || recorderBusy}
                    className={cn(
                      "inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[13px] font-medium transition-colors disabled:cursor-not-allowed",
                      sampleSource === value ? "bg-surface text-heading shadow-[0_1px_2px_rgba(16,24,40,0.08)]" : "text-subtle hover:text-heading disabled:hover:text-subtle"
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-2">
              {sampleSource === "record" ? (
                <VoiceRecorder
                  value={recording}
                  onChange={setRecording}
                  onBusyChange={setRecorderBusy}
                  onUseUpload={() => setSampleSource("upload")}
                  disabled={isWorking}
                  language={language}
                />
              ) : (
                <>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={ACCEPT}
                    className="hidden"
                    aria-labelledby={`${ids}-sample-label`}
                    onChange={(event) => void handleFile(event.target.files?.[0])}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isWorking}
                    className={cn(FIELD, "flex h-12 items-center gap-3 text-left", sampleError && "border-danger/60")}
                  >
                    <span className="shrink-0 rounded-lg bg-(--app-fill-strong) px-2.5 py-1 text-sm font-medium text-heading">Choose file</span>
                    <span className={cn("min-w-0 flex-1 truncate", sample ? "text-heading" : "text-subtle")}>
                      {isReadingSample ? "Reading file…" : sample ? sample.file.name : "No file chosen"}
                    </span>
                    {sample && (
                      <span className="shrink-0 text-xs tabular-nums text-subtle">
                        {[sample.durationSeconds !== null && formatClock(sample.durationSeconds), formatFileSize(sample.file.size)].filter(Boolean).join(" · ")}
                      </span>
                    )}
                  </button>
                  <p className={cn("mt-2 text-[13px]", sampleError ? "font-medium text-danger" : "text-subtle")}>
                    {sampleError ?? "WAV, MP3, MPEG, or M4A · 10 seconds to 5 minutes · maximum 20MB"}
                  </p>
                </>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor={`${ids}-language`} className={LABEL}>
                Language
              </label>
              <div className="relative mt-2">
                <select
                  id={`${ids}-language`}
                  value={language}
                  onChange={(event) => setLanguage(event.target.value as CloneLanguage)}
                  disabled={isWorking}
                  className={cn(FIELD, "h-12 cursor-pointer appearance-none pr-10")}
                >
                  {CLONE_LANGUAGES.map((option) => (
                    <option key={option} value={option}>
                      {option === "Automatic" ? "Detect automatically" : option}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
              </div>
            </div>
            <div>
              <label htmlFor={`${ids}-gender`} className={LABEL}>
                Gender
              </label>
              <div className="relative mt-2">
                <select
                  id={`${ids}-gender`}
                  value={gender}
                  onChange={(event) => setGender(event.target.value as CloneGender)}
                  disabled={isWorking}
                  className={cn(FIELD, "h-12 cursor-pointer appearance-none pr-10")}
                >
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
              </div>
            </div>
          </div>

          <div>
            <label htmlFor={`${ids}-preview`} className={LABEL}>
              Preview text
            </label>
            <textarea
              id={`${ids}-preview`}
              value={previewText}
              onChange={(event) => setPreviewText(event.target.value.slice(0, CLONE_PREVIEW_TEXT_MAX))}
              rows={3}
              maxLength={CLONE_PREVIEW_TEXT_MAX}
              disabled={isWorking}
              className={cn(FIELD, "mt-2 resize-y py-3 leading-relaxed")}
            />
            <p className="mt-1.5 text-right text-[13px] tabular-nums text-subtle">
              {previewText.length} / {CLONE_PREVIEW_TEXT_MAX}
            </p>
          </div>

          <label className="flex cursor-pointer items-center gap-3 text-[15px] text-heading">
            <input
              type="checkbox"
              checked={noiseReduction}
              onChange={(event) => setNoiseReduction(event.target.checked)}
              disabled={isWorking}
              className="h-4 w-4 cursor-pointer rounded accent-primary"
            />
            Reduce background noise in the sample
          </label>

          <label
            className={cn(
              "flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3.5 text-[15px] leading-snug text-heading transition-colors",
              consent ? "border-primary/40 bg-accent/40" : "border-hairline hover:bg-(--app-fill)"
            )}
          >
            <input
              type="checkbox"
              checked={consent}
              onChange={(event) => setConsent(event.target.checked)}
              disabled={isWorking}
              className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded accent-primary"
            />
            {CLONE_CONSENT_TEXT}
          </label>

          {error && (
            <p className="rounded-xl bg-danger-tint px-4 py-2.5 text-sm font-medium text-danger" role="alert">
              {error}
            </p>
          )}

          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={!canSubmit}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-btn-primary text-[15px] font-semibold text-white shadow-[0_1px_2px_rgba(16,24,40,0.15),inset_0_1px_0_rgba(255,255,255,0.18)] transition-colors hover:bg-btn-primary-hover disabled:cursor-not-allowed disabled:opacity-45"
          >
            {isWorking && <Loader2 className="h-4 w-4 animate-spin" />}
            {stage === "uploading"
              ? "Uploading sample…"
              : stage === "cloning"
                ? "Cloning voice… this can take a minute"
                : `Clone voice · ${CLONE_COST.toLocaleString()} credits`}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
