"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import { ChevronDown, CircleCheck, Loader2, Mic, MicOff, Pause, Play, RotateCcw, Shuffle, Square, TriangleAlert } from "lucide-react";
import { cloneScriptsFor } from "@/lib/config/clone-scripts";
import { CLONE_SAMPLE_MAX_SECONDS, CLONE_SAMPLE_MIN_SECONDS, type CloneLanguage } from "@/lib/config/voices";
import {
  isRecordingSupported,
  meterLevel,
  pickRecorderType,
  processRecording,
  RECORDING_CONSTRAINTS,
  type ProcessedRecording,
  type RecordingIssue,
} from "@/lib/client/voice-recording";
import { cn } from "@/lib/utils";

const LIVE_BARS = 48;
const SILENT_LEVEL = 5 / 60; // -55 dBFS on meterLevel's -60..0 scale
const SILENT_AFTER_SECONDS = 3;
const CLIP_PEAK = 0.99;
const CLIP_HINT_MS = 1500;
const GOOD_LENGTH_SECONDS = 30;

const ISSUE_MESSAGES: Record<RecordingIssue, string> = {
  sparse: "We barely heard any speech in this take. Check the right microphone is selected, then re-record.",
  clipping: "Parts of this take are distorted. Move back from the mic or speak a little softer, then re-record.",
  noisy: "There's noticeable background noise. Keep “Reduce background noise” on, or re-record somewhere quieter.",
  quiet: "This take is quiet. Moving closer to the mic will give a closer clone.",
};

type Phase = "ready" | "requesting" | "recording" | "processing";
type LiveHint = "silent" | "clipping" | null;

interface MicDevice {
  id: string;
  label: string;
}

// Everything one take holds open, released together by teardown().
interface Session {
  stream: MediaStream;
  context: AudioContext;
  recorder: MediaRecorder | null;
  chunks: Blob[];
  frame: number;
  maxTimer: ReturnType<typeof setTimeout> | null;
  discard: boolean;
}

export function formatClock(totalSeconds: number): string {
  const total = Math.round(totalSeconds);
  return `${Math.floor(total / 60)}:${(total % 60).toString().padStart(2, "0")}`;
}

function teardown(session: Session) {
  cancelAnimationFrame(session.frame);
  if (session.maxTimer) clearTimeout(session.maxTimer);
  session.stream.getTracks().forEach((track) => track.stop());
  if (session.context.state !== "closed") void session.context.close().catch(() => {});
}

function errorName(error: unknown): string {
  return error && typeof error === "object" && "name" in error && typeof error.name === "string" ? error.name : "";
}

function micErrorMessage(error: unknown): string {
  switch (errorName(error)) {
    case "NotAllowedError":
    case "SecurityError":
      return "Microphone access is blocked. Allow it in your browser's site settings, then try again.";
    case "NotFoundError":
      return "No microphone was found. Connect one, then try again.";
    case "OverconstrainedError":
      return "That microphone isn't connected anymore. Pick another one and try again.";
    case "NotReadableError":
    case "AbortError":
      return "Your microphone is busy in another app. Close it there, then try again.";
    default:
      return "We couldn't start your microphone. Please try again.";
  }
}

// Chrome appends USB vendor:product ids, e.g. "Yeti Stereo Microphone (046d:0ab7)".
function cleanDeviceLabel(label: string): string {
  return label.replace(/\s*\([0-9a-f]{4}:[0-9a-f]{4}\)\s*$/i, "");
}

interface VoiceRecorderProps {
  value: ProcessedRecording | null;
  onChange: (value: ProcessedRecording | null) => void;
  /** True from the moment the mic is requested until a take is ready (or abandoned). */
  onBusyChange: (busy: boolean) => void;
  onUseUpload: () => void;
  disabled: boolean;
  language: CloneLanguage;
}

export function VoiceRecorder({ value, onChange, onBusyChange, onUseUpload, disabled, language }: VoiceRecorderProps) {
  const [supported] = useState(isRecordingSupported);
  const [phase, setPhase] = useState<Phase>("ready");
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [liveHint, setLiveHint] = useState<LiveHint>(null);
  const [scriptIndex, setScriptIndex] = useState(0);
  const [devices, setDevices] = useState<MicDevice[]>([]);
  const [deviceId, setDeviceId] = useState("");
  const session = useRef<Session | null>(null);
  const mounted = useRef(false);
  const bars = useRef<(HTMLSpanElement | null)[]>([]);

  const busy = phase !== "ready";
  useEffect(() => {
    if (!busy) return;
    onBusyChange(true);
    return () => onBusyChange(false);
  }, [busy, onBusyChange]);

  // Closing the form mid-take throws the take away and frees the mic.
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      const current = session.current;
      if (!current) return;
      current.discard = true;
      if (current.recorder && current.recorder.state !== "inactive") current.recorder.stop();
      teardown(current);
      session.current = null;
    };
  }, []);

  // Labels only come back once the mic has been allowed, so the picker shows
  // up after the first take (or straight away for a returning user).
  const refreshDevices = useCallback(() => {
    navigator.mediaDevices.enumerateDevices().then(
      (all) => {
        const inputs = all.filter((device) => device.kind === "audioinput" && device.label && device.deviceId !== "default" && device.deviceId !== "communications");
        setDevices(inputs.map((device) => ({ id: device.deviceId, label: cleanDeviceLabel(device.label) })));
        setDeviceId((current) => (current && !inputs.some((device) => device.deviceId === current) ? "" : current));
      },
      () => {}
    );
  }, []);

  useEffect(() => {
    if (!supported) return;
    refreshDevices();
    navigator.mediaDevices.addEventListener("devicechange", refreshDevices);
    return () => navigator.mediaDevices.removeEventListener("devicechange", refreshDevices);
  }, [supported, refreshDevices]);

  function stop() {
    const current = session.current;
    if (!current) return;
    if (current.recorder && current.recorder.state !== "inactive") current.recorder.stop();
    teardown(current);
    setPhase("processing");
  }

  async function finish(current: Session, type: string) {
    teardown(current);
    if (session.current === current) session.current = null;
    if (current.discard || !mounted.current) return;
    setPhase("processing");
    try {
      const take = await processRecording(new Blob(current.chunks, { type }));
      if (!mounted.current) return;
      if (take.durationSeconds < CLONE_SAMPLE_MIN_SECONDS) {
        setError(`That take came out at ${Math.floor(take.durationSeconds)} seconds once silence was trimmed. Record at least ${CLONE_SAMPLE_MIN_SECONDS}.`);
      } else {
        onChange(take);
      }
    } catch (err) {
      console.error("[voice-recorder] Processing the take failed:", err);
      if (mounted.current) setError("We couldn't process that recording. Please try again.");
    } finally {
      if (mounted.current) setPhase("ready");
    }
  }

  function startMeter(current: Session, startedAt: number) {
    const { context, stream } = current;
    const analyser = context.createAnalyser();
    analyser.fftSize = 2048;
    // Routed to the speakers at zero gain: Safari only runs an analyser
    // that's connected through to the destination.
    const mute = context.createGain();
    mute.gain.value = 0;
    context.createMediaStreamSource(stream).connect(analyser);
    analyser.connect(mute).connect(context.destination);
    void context.resume().catch(() => {});

    const samples = new Float32Array(analyser.fftSize);
    const levels = new Array<number>(LIVE_BARS).fill(0);
    let lastBar = 0;
    let lastSecond = -1;
    let heard = false;
    let clipUntil = 0;
    let hint: LiveHint = null;

    // Drawn straight onto the bars, so the meter never re-renders the form.
    const tick = (now: number) => {
      analyser.getFloatTimeDomainData(samples);
      const { level, peak } = meterLevel(samples);
      if (level > SILENT_LEVEL) heard = true;
      if (peak >= CLIP_PEAK) clipUntil = now + CLIP_HINT_MS;
      if (now - lastBar >= 50) {
        lastBar = now;
        levels.shift();
        levels.push(level);
        bars.current.forEach((bar, index) => {
          if (bar) bar.style.transform = `scaleY(${Math.max(0.08, levels[index])})`;
        });
      }
      const seconds = Math.max(0, Math.floor((now - startedAt) / 1000));
      if (seconds !== lastSecond) {
        lastSecond = seconds;
        setElapsed(seconds);
      }
      const nextHint: LiveHint = now < clipUntil ? "clipping" : !heard && seconds >= SILENT_AFTER_SECONDS ? "silent" : null;
      if (nextHint !== hint) {
        hint = nextHint;
        setLiveHint(nextHint);
      }
      current.frame = requestAnimationFrame(tick);
    };
    current.frame = requestAnimationFrame(tick);
  }

  async function start() {
    if (phase !== "ready" || disabled) return;
    setError(null);
    setLiveHint(null);
    setElapsed(0);
    // Made inside the click, so autoplay rules let it run once the mic is allowed.
    const AudioContextCtor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const context = new AudioContextCtor();
    setPhase("requesting");

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: deviceId ? { ...RECORDING_CONSTRAINTS, deviceId: { exact: deviceId } } : RECORDING_CONSTRAINTS,
      });
    } catch (err) {
      void context.close().catch(() => {});
      if (!mounted.current) return;
      if (errorName(err) === "OverconstrainedError") setDeviceId("");
      setError(micErrorMessage(err));
      setPhase("ready");
      return;
    }

    const current: Session = { stream, context, recorder: null, chunks: [], frame: 0, maxTimer: null, discard: false };
    if (!mounted.current) {
      teardown(current);
      return;
    }
    session.current = current;
    refreshDevices();

    try {
      const type = pickRecorderType();
      const recorder = new MediaRecorder(stream, { ...(type && { mimeType: type }), audioBitsPerSecond: 128_000 });
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) current.chunks.push(event.data);
      };
      recorder.onstop = () => void finish(current, recorder.mimeType || type);
      recorder.onerror = () => {
        current.discard = true;
        teardown(current);
        if (session.current === current) session.current = null;
        if (!mounted.current) return;
        setError("Recording stopped unexpectedly. Please try again.");
        setPhase("ready");
      };
      current.recorder = recorder;
      recorder.start();
    } catch (err) {
      console.error("[voice-recorder] MediaRecorder failed to start:", err);
      teardown(current);
      session.current = null;
      setError("This browser can't record audio here. Upload a file instead.");
      setPhase("ready");
      return;
    }

    // A mic that's unplugged mid-take ends the take with what was captured.
    stream.getAudioTracks()[0]?.addEventListener("ended", stop);
    current.maxTimer = setTimeout(stop, CLONE_SAMPLE_MAX_SECONDS * 1000);
    startMeter(current, performance.now());
    setPhase("recording");
  }

  if (!supported) {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-hairline px-4 py-3.5">
        <MicOff className="mt-0.5 h-4 w-4 shrink-0 text-subtle" />
        <p className="text-sm leading-relaxed text-subtle">
          Recording needs microphone access, which this browser doesn&apos;t offer here.{" "}
          <button type="button" onClick={onUseUpload} className="font-medium text-primary hover:underline">
            Upload a file instead
          </button>
        </p>
      </div>
    );
  }

  if (value) {
    return <TakePlayer take={value} disabled={disabled} onDiscard={() => onChange(null)} />;
  }

  const scripts = cloneScriptsFor(language);
  let hint: { text: string; tone: "subtle" | "warning" | "danger" };
  if (error) hint = { text: error, tone: "danger" };
  else if (phase === "requesting") hint = { text: "Allow microphone access when your browser asks.", tone: "subtle" };
  else if (phase === "processing") hint = { text: "Trimming silence and checking your levels…", tone: "subtle" };
  else if (phase === "recording" && liveHint === "silent") hint = { text: "We can't hear anything. Check your microphone is connected and selected.", tone: "warning" };
  else if (phase === "recording" && liveHint === "clipping") hint = { text: "Too loud. Move back from the mic a little.", tone: "warning" };
  else if (phase === "recording" && elapsed < CLONE_SAMPLE_MIN_SECONDS) hint = { text: `Keep going, ${CLONE_SAMPLE_MIN_SECONDS - elapsed}s to the ${CLONE_SAMPLE_MIN_SECONDS}-second minimum.`, tone: "subtle" };
  else if (phase === "recording" && elapsed < GOOD_LENGTH_SECONDS) hint = { text: "Good. Keep reading, 30 seconds or more gives a closer match.", tone: "subtle" };
  else if (phase === "recording" && elapsed >= CLONE_SAMPLE_MAX_SECONDS - 30) hint = { text: `Recording stops automatically at ${formatClock(CLONE_SAMPLE_MAX_SECONDS)}.`, tone: "subtle" };
  else if (phase === "recording") hint = { text: "Sounding good. Stop whenever you're ready.", tone: "subtle" };
  else hint = { text: "Read in the tone you want your clone to have. 30 seconds to 2 minutes in a quiet room works best.", tone: "subtle" };

  return (
    <div>
      <div className={cn("overflow-hidden rounded-xl border transition-colors", phase === "recording" ? "border-danger/40" : "border-hairline")}>
        <div className="px-4 pb-4 pt-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[13px] font-medium text-subtle">Read this aloud</span>
            <button
              type="button"
              onClick={() => setScriptIndex((index) => (index + 1) % scripts.scripts.length)}
              disabled={disabled}
              className="-mr-1.5 inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[13px] font-medium text-subtle transition-colors hover:text-heading disabled:opacity-50"
            >
              <Shuffle className="h-3.5 w-3.5" />
              Another script
            </button>
          </div>
          <p lang={scripts.lang} dir={scripts.dir} className="mt-1.5 text-[15px] leading-relaxed text-body">
            {scripts.scripts[scriptIndex]}
          </p>
        </div>

        <div className="flex min-h-14 items-center gap-3 border-t border-hairline bg-(--app-fill) px-3 py-2.5">
          {phase === "recording" ? (
            <>
              <span className="relative ml-1 flex h-2.5 w-2.5 shrink-0" aria-hidden>
                <span className="absolute inset-0 animate-ping rounded-full bg-danger/60" />
                <span className="relative h-2.5 w-2.5 rounded-full bg-danger" />
              </span>
              <div className="flex h-8 min-w-0 flex-1 items-center gap-[2px]" aria-hidden>
                {Array.from({ length: LIVE_BARS }, (_, index) => (
                  <span
                    key={index}
                    ref={(element) => {
                      bars.current[index] = element;
                    }}
                    className="h-full flex-1 origin-center scale-y-[0.08] rounded-full bg-primary transition-transform duration-75"
                  />
                ))}
              </div>
              <span className="shrink-0 text-sm font-medium tabular-nums text-heading" aria-live="off">
                {formatClock(elapsed)}
                <span className="text-subtle"> / {formatClock(CLONE_SAMPLE_MAX_SECONDS)}</span>
              </span>
              <button
                type="button"
                onClick={stop}
                className="inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border border-hairline bg-surface px-3 text-sm font-medium text-heading transition-colors hover:bg-(--app-fill-strong)"
              >
                <Square className="h-3 w-3 fill-danger text-danger" />
                Stop
              </button>
            </>
          ) : phase === "ready" ? (
            <>
              <button
                type="button"
                onClick={() => void start()}
                disabled={disabled}
                className="inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border border-hairline bg-surface px-3.5 text-sm font-medium text-heading transition-colors hover:bg-(--app-fill-strong) disabled:opacity-50"
              >
                <span className="h-2.5 w-2.5 rounded-full bg-danger" aria-hidden />
                Start recording
              </button>
              {devices.length > 1 && (
                <div className="relative ml-auto min-w-0">
                  <Mic className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-subtle" />
                  <select
                    value={deviceId}
                    onChange={(event) => setDeviceId(event.target.value)}
                    disabled={disabled}
                    aria-label="Microphone"
                    className="h-9 w-full max-w-56 cursor-pointer appearance-none truncate rounded-lg border border-hairline bg-surface pl-8 pr-8 text-[13px] text-heading outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/15 disabled:opacity-50"
                  >
                    <option value="">System default</option>
                    {devices.map((device) => (
                      <option key={device.id} value={device.id}>
                        {device.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-subtle" />
                </div>
              )}
            </>
          ) : (
            <span className="ml-1 inline-flex items-center gap-2 text-sm text-subtle">
              <Loader2 className="h-4 w-4 animate-spin" />
              {phase === "requesting" ? "Waiting for your microphone…" : "Preparing your take…"}
            </span>
          )}
        </div>
      </div>
      <p
        className={cn("mt-2 text-[13px]", hint.tone === "danger" ? "font-medium text-danger" : hint.tone === "warning" ? "font-medium text-warning" : "text-subtle")}
        role={hint.tone === "subtle" ? undefined : "alert"}
      >
        {hint.text}
      </p>
    </div>
  );
}

interface TakePlayerProps {
  take: ProcessedRecording;
  disabled: boolean;
  onDiscard: () => void;
}

function TakePlayer({ take, disabled, onDiscard }: TakePlayerProps) {
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const progressRef = useRef<HTMLDivElement | null>(null);
  const duration = take.durationSeconds;

  const paint = useCallback(
    (seconds: number) => {
      if (progressRef.current) progressRef.current.style.clipPath = `inset(0 ${100 - Math.min(100, (seconds / duration) * 100)}% 0 0)`;
    },
    [duration]
  );

  // Set imperatively (not via src=) so the object URL is made and revoked
  // by the same effect run.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const url = URL.createObjectURL(take.file);
    audio.src = url;
    return () => {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      URL.revokeObjectURL(url);
    };
  }, [take.file]);

  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    const tick = () => {
      if (audioRef.current) paint(audioRef.current.currentTime);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, paint]);

  function toggle() {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) void audio.play().catch(() => {});
    else audio.pause();
  }

  function seekTo(seconds: number) {
    const audio = audioRef.current;
    if (!audio) return;
    const clamped = Math.min(duration, Math.max(0, seconds));
    audio.currentTime = clamped;
    setPosition(clamped);
    paint(clamped);
  }

  function handleWaveClick(event: MouseEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    seekTo(((event.clientX - rect.left) / rect.width) * duration);
  }

  function handleWaveKey(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowLeft") seekTo(position - 5);
    else if (event.key === "ArrowRight") seekTo(position + 5);
    else if (event.key === "Home") seekTo(0);
    else if (event.key === "End") seekTo(duration);
    else return;
    event.preventDefault();
  }

  const bars = take.waveform.map((height, index) => <span key={index} className="flex-1 rounded-full bg-current" style={{ height: `${height * 100}%` }} />);

  return (
    <div>
      <div className="flex items-center gap-3 rounded-xl border border-hairline px-3 py-2.5">
        <audio
          ref={audioRef}
          preload="auto"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onTimeUpdate={(event) => setPosition(event.currentTarget.currentTime)}
          onEnded={() => seekTo(0)}
        />
        <button
          type="button"
          onClick={toggle}
          aria-label={playing ? "Pause recording" : "Play recording"}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-btn-primary text-white transition-colors hover:bg-btn-primary-hover"
        >
          {playing ? <Pause className="h-4 w-4 fill-current" /> : <Play className="ml-0.5 h-4 w-4 fill-current" />}
        </button>
        <div
          role="slider"
          tabIndex={0}
          aria-label="Seek"
          aria-valuemin={0}
          aria-valuemax={Math.round(duration)}
          aria-valuenow={Math.round(position)}
          aria-valuetext={formatClock(position)}
          onClick={handleWaveClick}
          onKeyDown={handleWaveKey}
          className="relative h-9 min-w-0 flex-1 cursor-pointer rounded outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
        >
          <div className="absolute inset-0 flex items-center gap-[2px] text-primary/25">{bars}</div>
          <div ref={progressRef} className="absolute inset-0 flex items-center gap-[2px] text-primary" style={{ clipPath: "inset(0 100% 0 0)" }}>
            {bars}
          </div>
        </div>
        <span className="shrink-0 text-[13px] tabular-nums text-subtle">
          {formatClock(position)} / {formatClock(duration)}
        </span>
      </div>
      <div className="mt-2 flex items-start justify-between gap-4">
        <p className={cn("flex items-start gap-1.5 text-[13px]", take.issue ? "font-medium text-warning" : "text-success")}>
          {take.issue ? <TriangleAlert className="mt-px h-3.5 w-3.5 shrink-0" /> : <CircleCheck className="mt-px h-3.5 w-3.5 shrink-0" />}
          {take.issue ? ISSUE_MESSAGES[take.issue] : "Clear take, ready to clone."}
        </p>
        <button
          type="button"
          onClick={onDiscard}
          disabled={disabled}
          className="inline-flex shrink-0 items-center gap-1.5 text-[13px] font-medium text-subtle transition-colors hover:text-heading disabled:opacity-50"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Re-record
        </button>
      </div>
    </div>
  );
}
