"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Mic, Pause, Play, RotateCcw, Upload, X } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { PlasticButton } from "@/components/ui/plastic-button";
import { getVoiceCloneCost } from "@/lib/config/pricing";
import { isValidName, NAME_MAX } from "@/lib/validation";

const VOICE_CLONE_CREDIT_COST = getVoiceCloneCost();

export interface VoiceCloneSummary {
  id: string;
  name: string;
  created_at: string;
}

interface AddVoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (voiceClone: VoiceCloneSummary) => void;
}

const MAX_RECORD_SECONDS = 5 * 60;
const MIN_SAMPLE_SECONDS = 10;

interface AudioSample {
  blob: Blob;
  fileName: string;
  sizeBytes: number;
  /** Only known for a browser recording (we control the timer); an uploaded file's duration isn't checked client-side -- see AddVoiceModal's own module comment. */
  durationSeconds?: number;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatClock(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// Encodes a decoded AudioBuffer as 16-bit PCM WAV bytes. Needed because
// MediaRecorder only produces webm/ogg in-browser, but the cloning backend
// (Replicate's minimax/voice-cloning) only accepts MP3, M4A, or WAV -- see
// /api/voice-clones/route.ts's ALLOWED_MIME_TYPES.
function audioBufferToWav(buffer: AudioBuffer): ArrayBuffer {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = buffer.length * blockAlign;
  const arrayBuffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(arrayBuffer);

  function writeString(offset: number, value: string) {
    for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i));
  }

  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bytesPerSample * 8, true);
  writeString(36, "data");
  view.setUint32(40, dataSize, true);

  const channelData: Float32Array[] = [];
  for (let channel = 0; channel < numChannels; channel++) channelData.push(buffer.getChannelData(channel));

  let offset = 44;
  for (let frame = 0; frame < buffer.length; frame++) {
    for (let channel = 0; channel < numChannels; channel++) {
      const sample = Math.max(-1, Math.min(1, channelData[channel][frame]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }

  return arrayBuffer;
}

async function recordingBlobToWav(blob: Blob): Promise<Blob> {
  const arrayBuffer = await blob.arrayBuffer();
  const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const audioContext = new AudioContextClass();
  try {
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    return new Blob([audioBufferToWav(audioBuffer)], { type: "audio/wav" });
  } finally {
    void audioContext.close();
  }
}

export function AddVoiceModal({ isOpen, onClose, onCreated }: AddVoiceModalProps) {
  const [name, setName] = useState("");
  const [sample, setSample] = useState<AudioSample | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessingRecording, setIsProcessingRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [isPlayingSample, setIsPlayingSample] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sampleUrlRef = useRef<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // Mirrors recordSeconds state -- recorder.onstop is a closure fixed at
  // MediaRecorder creation time, so it can't read the latest state value
  // directly (it would always see the 0 captured when recording started).
  const recordSecondsRef = useRef(0);

  useEffect(() => {
    return () => {
      if (recordIntervalRef.current) clearInterval(recordIntervalRef.current);
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
      if (sampleUrlRef.current) URL.revokeObjectURL(sampleUrlRef.current);
    };
  }, []);

  if (!isOpen) return null;

  function resetAndClose() {
    audioRef.current?.pause();
    if (recordIntervalRef.current) clearInterval(recordIntervalRef.current);
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    if (sampleUrlRef.current) URL.revokeObjectURL(sampleUrlRef.current);
    sampleUrlRef.current = null;
    setName("");
    setSample(null);
    setIsRecording(false);
    setRecordSeconds(0);
    setIsPlayingSample(false);
    setError("");
    onClose();
  }

  function setSampleAndUrl(next: AudioSample) {
    if (sampleUrlRef.current) URL.revokeObjectURL(sampleUrlRef.current);
    sampleUrlRef.current = URL.createObjectURL(next.blob);
    setSample(next);
  }

  function handleFilePicked(file: File | undefined) {
    if (!file) return;
    setError("");
    setSampleAndUrl({ blob: file, fileName: file.name, sizeBytes: file.size });
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const recordedSeconds = recordSecondsRef.current;
        const rawBlob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        stream.getTracks().forEach((track) => track.stop());
        setIsProcessingRecording(true);
        recordingBlobToWav(rawBlob)
          .then((wavBlob) => {
            setSampleAndUrl({ blob: wavBlob, fileName: "recording.wav", sizeBytes: wavBlob.size, durationSeconds: recordedSeconds });
          })
          .catch(() => setError("Could not process that recording. Try again or upload a file instead."))
          .finally(() => setIsProcessingRecording(false));
      };

      recorder.start();
      setError("");
      setIsRecording(true);
      setRecordSeconds(0);
      recordSecondsRef.current = 0;
      recordIntervalRef.current = setInterval(() => {
        setRecordSeconds((seconds) => {
          const next = seconds + 1;
          recordSecondsRef.current = next;
          if (next >= MAX_RECORD_SECONDS) {
            recorder.stop();
            setIsRecording(false);
            if (recordIntervalRef.current) clearInterval(recordIntervalRef.current);
          }
          return next;
        });
      }, 1000);
    } catch {
      setError("Couldn't access your microphone. Check your browser's permission settings.");
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
    if (recordIntervalRef.current) clearInterval(recordIntervalRef.current);
  }

  function toggleSamplePlayback() {
    if (!sampleUrlRef.current) return;
    if (isPlayingSample) {
      audioRef.current?.pause();
      setIsPlayingSample(false);
      return;
    }
    if (audioRef.current) {
      audioRef.current.src = sampleUrlRef.current;
      void audioRef.current.play();
      setIsPlayingSample(true);
    }
  }

  function removeSample() {
    audioRef.current?.pause();
    setIsPlayingSample(false);
    if (sampleUrlRef.current) URL.revokeObjectURL(sampleUrlRef.current);
    sampleUrlRef.current = null;
    setSample(null);
    setRecordSeconds(0);
  }

  async function handleSubmit() {
    if (!isValidName(name)) {
      setError("Give this voice a name first.");
      return;
    }
    if (!sample) {
      setError("Upload or record a sample first.");
      return;
    }
    if (sample.durationSeconds !== undefined && sample.durationSeconds < MIN_SAMPLE_SECONDS) {
      setError(`Recording is too short -- record at least ${MIN_SAMPLE_SECONDS} seconds.`);
      return;
    }
    setError("");
    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("name", name.trim());
      formData.append("file", sample.blob, sample.fileName);
      const response = await fetch("/api/voice-clones", { method: "POST", body: formData, signal: AbortSignal.timeout(150_000) });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error ?? `Could not clone that voice (${response.status})`);
      onCreated(data.voiceClone);
      resetAndClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not clone that voice.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm" onClick={resetAndClose}>
      <div className="w-full max-w-md rounded-3xl bg-surface shadow-card-hover" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 px-6 pt-6">
          <div>
            <h2 className="text-lg font-semibold text-heading">Add a voice</h2>
            <p className="mt-1 text-sm text-subtle">Upload or record a sample and we&apos;ll build a matching voice.</p>
          </div>
          <button type="button" onClick={resetAndClose} aria-label="Close" className="shrink-0 text-subtle hover:text-heading">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 px-6 pb-6 pt-5">
          <audio ref={audioRef} onEnded={() => setIsPlayingSample(false)} className="hidden" />

          <div>
            <label className="mb-1.5 block text-sm font-medium text-heading">Name</label>
            <input
              value={name}
              onChange={(event) => setName(event.target.value.slice(0, NAME_MAX))}
              placeholder="My voice"
              className="w-full rounded-xl border border-hairline bg-surface px-3.5 py-2.5 text-sm text-heading shadow-card outline-none placeholder:text-subtle transition-colors focus:border-primary/50 focus:ring-2 focus:ring-primary/15"
            />
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="block text-sm font-medium text-heading">Audio</label>
              <Badge>
                {VOICE_CLONE_CREDIT_COST} credit{VOICE_CLONE_CREDIT_COST === 1 ? "" : "s"}
              </Badge>
            </div>

            {isRecording ? (
              <div className="rounded-2xl border border-hairline bg-app px-4 py-6 text-center dark:bg-white/[0.03]">
                <p className="flex items-center justify-center gap-2 text-lg font-semibold text-heading">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-danger" />
                  {formatClock(recordSeconds)} <span className="text-sm font-normal text-subtle">/ {formatClock(MAX_RECORD_SECONDS)}</span>
                </p>
                <button
                  type="button"
                  onClick={stopRecording}
                  aria-label="Stop recording"
                  className="mx-auto mt-4 flex h-14 w-14 items-center justify-center rounded-full bg-danger text-white shadow-card-hover transition-transform hover:scale-105 active:scale-95"
                >
                  <span className="h-4 w-4 rounded-sm bg-white" />
                </button>
                <p className="mt-4 text-xs text-subtle">Record at least {MIN_SAMPLE_SECONDS} seconds. 1 to 2 minutes is ideal.</p>
              </div>
            ) : isProcessingRecording ? (
              <div className="rounded-2xl border border-hairline bg-app px-4 py-6 text-center text-sm text-subtle dark:bg-white/[0.03]">
                Processing recording…
              </div>
            ) : sample ? (
              <div className="flex items-center gap-3 rounded-2xl border border-hairline bg-app px-4 py-3 dark:bg-white/[0.03]">
                <button
                  type="button"
                  onClick={toggleSamplePlayback}
                  aria-label={isPlayingSample ? "Pause" : "Play"}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-white transition-transform hover:scale-105 active:scale-95"
                >
                  {isPlayingSample ? <Pause className="h-3.5 w-3.5" fill="currentColor" /> : <Play className="h-3.5 w-3.5" fill="currentColor" />}
                </button>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-heading">{sample.fileName}</p>
                  <p className="text-xs text-subtle">{formatFileSize(sample.sizeBytes)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    removeSample();
                    void startRecording();
                  }}
                  className="flex shrink-0 items-center gap-1 text-xs font-medium text-subtle hover:text-primary"
                >
                  <RotateCcw className="h-3.5 w-3.5" /> Re-record
                </button>
                <button type="button" onClick={removeSample} aria-label="Remove sample" className="shrink-0 text-subtle hover:text-danger">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="space-y-2.5">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex w-full items-center gap-3 rounded-2xl border-2 border-dashed border-hairline bg-app px-4 py-4 text-left transition-colors hover:border-primary/40 dark:bg-white/[0.02]"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface text-heading shadow-card">
                    <Upload className="h-4 w-4" />
                  </span>
                  <span>
                    <span className="block text-sm font-medium text-heading">Upload audio</span>
                    <span className="block text-xs text-subtle">MP3, WAV, or M4A, up to 20 MB</span>
                  </span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="audio/mpeg,audio/mp3,audio/mp4,audio/x-m4a,audio/wav,audio/x-wav,.mp3,.wav,.m4a"
                  className="hidden"
                  onChange={(event) => handleFilePicked(event.target.files?.[0])}
                />

                <div className="flex items-center gap-3 text-xs text-subtle">
                  <span className="h-px flex-1 bg-hairline" /> or <span className="h-px flex-1 bg-hairline" />
                </div>

                <button
                  type="button"
                  onClick={() => void startRecording()}
                  className="flex w-full items-center gap-3 rounded-2xl border border-hairline bg-surface px-4 py-4 text-left shadow-card transition-colors hover:border-primary/40"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-app text-heading dark:bg-white/5">
                    <Mic className="h-4 w-4" />
                  </span>
                  <span>
                    <span className="block text-sm font-medium text-heading">Record now</span>
                    <span className="block text-xs text-subtle">1 to 2 minutes is ideal, up to 5 minutes</span>
                  </span>
                </button>
              </div>
            )}

            {!sample && !isRecording && !isProcessingRecording && (
              <p className="mt-2.5 text-xs text-subtle">1 to 2 minutes of clean speech gives the best clone.</p>
            )}
          </div>

          {error && (
            <p className="rounded-lg bg-danger-tint px-3 py-2 text-xs font-medium text-danger" role="alert">
              {error}
            </p>
          )}

          <PlasticButton
            text={`Clone voice · ${VOICE_CLONE_CREDIT_COST} credits`}
            loading={isSubmitting}
            loadingText="Cloning voice…"
            disabled={!sample || !name.trim() || isRecording || isProcessingRecording}
            onClick={handleSubmit}
            className="w-full justify-center py-3"
          />
        </div>
      </div>
    </div>,
    document.body
  );
}
