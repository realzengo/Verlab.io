"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { ArrowRight, Copy, Loader2, Minus, Pause, Play, Plus, RotateCw, ScanFace, Upload, X } from "lucide-react";
import { PlasticButton } from "@/components/ui/plastic-button";
import { Switch } from "@/components/ui/Switch";
import { Segmented } from "@/components/clipping/parts";
import type { ClipWorkspace, SourceState, TrackState } from "@/components/clipping/useClipWorkspace";
import {
  createFramePainter,
  keepRanges,
  loadCaptionFonts,
  prepareCaptions,
  rangesDuration,
  type CaptionPosition,
  type CaptionTemplate,
  type ClipEditSettings,
  type ClipLayout,
} from "@/lib/client/clip-render";
import { centerAt } from "@/lib/client/clip-reframe";
import { formatClock, type ClipAspect, type ClipMoment, type ClipProject, type TranscriptWord } from "@/lib/clips";
import { cn } from "@/lib/utils";

const MIN_CLIP_SECONDS = 5;
const TRIM_STEP = 0.5;
const BACKGROUND_MAX_BYTES = 300 * 1024 * 1024;

const PREVIEW_SIZES: Record<ClipAspect, { width: number; height: number; aspect: string; maxWidth: string }> = {
  "9:16": { width: 540, height: 960, aspect: "aspect-[9/16]", maxWidth: "max-w-[300px] sm:max-w-[340px]" },
  "1:1": { width: 720, height: 720, aspect: "aspect-square", maxWidth: "max-w-[420px]" },
  "16:9": { width: 960, height: 540, aspect: "aspect-video", maxWidth: "max-w-[560px]" },
};

export function ClipEditor({
  project,
  clips,
  workspace,
  onExport,
}: {
  project: ClipProject;
  clips: ClipMoment[];
  workspace: ClipWorkspace;
  onExport: () => void;
}) {
  const [activeId, setActiveId] = useState(clips[0]?.id);
  const [applied, setApplied] = useState(false);
  const active = clips.find((clip) => clip.id === activeId) ?? clips[0];
  const { requestSource } = workspace;

  // Coming back to Edit (or a clip that never started) re-requests its cut;
  // already-fetched ones resolve from the cache.
  useEffect(() => {
    for (const clip of clips) requestSource(clip);
  }, [clips, requestSource]);

  if (!active) return null;
  const settings = workspace.settingsFor(active);
  const source = workspace.sources[active.id];

  return (
    <div>
      {clips.length > 1 && (
        <div role="tablist" aria-label="Selected clips" className="-mx-1 mb-6 flex gap-2 overflow-x-auto px-1 pb-1">
          {clips.map((clip, index) => {
            const state = workspace.sources[clip.id]?.status;
            const current = clip.id === active.id;
            return (
              <button
                key={clip.id}
                type="button"
                role="tab"
                aria-selected={current}
                onClick={() => setActiveId(clip.id)}
                className={cn(
                  "flex h-9 max-w-60 shrink-0 items-center gap-2 rounded-full border px-3.5 text-[13px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/40",
                  current
                    ? "border-transparent bg-heading text-surface dark:bg-white dark:text-[#0B0D12]"
                    : "border-hairline text-body hover:bg-(--app-fill)"
                )}
              >
                <span className="font-mono text-[11px] opacity-60">{String(index + 1).padStart(2, "0")}</span>
                <span className="truncate">{workspace.settingsFor(clip).title || clip.title}</span>
                {state === "loading" && <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin opacity-60" />}
                {state === "error" && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-danger" />}
              </button>
            );
          })}
        </div>
      )}

      <div className="flex flex-col items-center gap-8 lg:flex-row lg:items-start lg:justify-center">
        <div className="flex w-full justify-center lg:sticky lg:top-6 lg:w-auto">
          <ClipPreview
            key={`${active.id}-${settings.aspect}`}
            clip={active}
            source={source}
            track={workspace.tracks[active.id]}
            background={workspace.background?.url ?? null}
            settings={settings}
            words={project.transcript ?? []}
            thumbnailUrl={project.thumbnailUrl}
            onRetry={() => workspace.retrySource(active)}
          />
        </div>

        <div className="w-full max-w-md lg:w-[400px] lg:shrink-0">
          <ClipSettingsPanel
            clip={active}
            settings={settings}
            source={source}
            track={workspace.tracks[active.id]}
            words={project.transcript ?? []}
            background={workspace.background}
            onBackground={workspace.setBackground}
            onChange={(patch) => {
              setApplied(false);
              workspace.updateSettings(active, patch);
            }}
          />
          {clips.length > 1 && (
            <button
              type="button"
              onClick={() => {
                workspace.applyStyleToAll(active, clips);
                setApplied(true);
              }}
              className="mt-3 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-full border border-hairline text-[13px] font-medium text-heading transition-colors hover:bg-(--app-fill)"
            >
              <Copy className="h-3.5 w-3.5" />
              {applied ? "Style applied to all clips" : `Apply this style to all ${clips.length} clips`}
            </button>
          )}
          <PlasticButton
            className="mt-4 h-12 w-full rounded-[18px] text-[15px]"
            text={clips.length > 1 ? `Export ${clips.length} clips` : "Export clip"}
            trailing={<ArrowRight className="h-4 w-4" strokeWidth={2} />}
            onClick={onExport}
          />
          <p className="mt-3 text-center text-[13px] text-subtle">
            Rendered in your browser in full HD and saved to your clips.
          </p>
        </div>
      </div>
    </div>
  );
}

function Row({ label, children, hint }: { label: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="flex flex-col gap-2.5 px-4 py-3.5 sm:px-5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[13px] font-medium text-heading">{label}</span>
        {hint && <span className="text-[12px] text-subtle">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="flex min-w-0 flex-col">
        <span className="text-[13px] text-heading">{label}</span>
        <span className="text-[12px] leading-snug text-subtle">{description}</span>
      </span>
      <Switch checked={checked} onCheckedChange={onChange} size="sm" label={label} />
    </div>
  );
}

function StepButton({
  onClick,
  disabled,
  label,
  icon: Icon,
}: {
  onClick: () => void;
  disabled: boolean;
  label: string;
  icon: typeof Plus;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="flex h-7 w-7 items-center justify-center rounded-md text-heading outline-none transition-colors hover:bg-(--app-fill-strong) focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-30"
    >
      <Icon className="h-3.5 w-3.5" strokeWidth={2} />
    </button>
  );
}

const INPUT =
  "h-9 w-full rounded-lg border border-hairline bg-transparent px-3 text-sm text-heading outline-none transition-[border-color,box-shadow] focus:border-primary/50 focus:ring-4 focus:ring-primary/10";

// Swatches for the template picker: CSS stand-ins for what the painter draws.
const STROKE: CSSProperties = { WebkitTextStroke: "3px #000", paintOrder: "stroke fill" };
const TEMPLATE_SWATCHES: { value: CaptionTemplate; label: string; sample: ReactNode }[] = [
  {
    value: "hormozi",
    label: "Hormozi",
    sample: (
      <span className="font-black uppercase text-white" style={STROKE}>
        <span className="text-[#FFE14D]">Go</span> <span className="text-[#4ADE80]">viral</span>
      </span>
    ),
  },
  {
    value: "karaoke",
    label: "Karaoke",
    sample: (
      <span className="font-black uppercase text-white" style={STROKE}>
        Go <span className="rounded-md bg-primary px-1">viral</span>
      </span>
    ),
  },
  {
    value: "beast",
    label: "Beast",
    sample: (
      <span className="text-[15px] font-black uppercase text-white [text-shadow:0_3px_0_#000]" style={STROKE}>
        Go <span className="text-[#FFE14D]">viral</span>
      </span>
    ),
  },
  {
    value: "neon",
    label: "Neon",
    sample: (
      <span className="font-extrabold uppercase text-white [text-shadow:0_0_8px_#22D3EE,0_0_16px_#22D3EE]">
        Go <span className="text-[#F472B6] [text-shadow:0_0_8px_#F472B6]">viral</span>
      </span>
    ),
  },
  {
    value: "clean",
    label: "Clean",
    sample: <span className="rounded-md bg-black/70 px-1.5 py-0.5 font-bold text-white">Go viral</span>,
  },
  {
    value: "minimal",
    label: "Minimal",
    sample: (
      <span className="font-semibold text-white [text-shadow:0_1px_6px_rgba(0,0,0,0.8)]">
        Go <span className="opacity-50">viral</span>
      </span>
    ),
  },
  { value: "off", label: "Off", sample: <span className="text-[12px] font-medium text-white/60">No captions</span> },
];

function ClipSettingsPanel({
  clip,
  settings,
  source,
  track,
  words,
  background,
  onBackground,
  onChange,
}: {
  clip: ClipMoment;
  settings: ClipEditSettings;
  source: SourceState | undefined;
  track: TrackState | undefined;
  words: TranscriptWord[];
  background: ClipWorkspace["background"];
  onBackground: (file: File | null) => void;
  onChange: (patch: Partial<ClipEditSettings>) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [backgroundError, setBackgroundError] = useState<string | null>(null);
  const from = source?.from ?? clip.start;
  const to = source?.to ?? clip.end;
  const length = settings.end - settings.start;
  const kept = useMemo(
    () => rangesDuration(keepRanges(words, settings.start, settings.end, true)),
    [words, settings.start, settings.end]
  );
  const cropped = settings.layout !== "fit";

  const nudge = (edge: "start" | "end", delta: number) => {
    if (edge === "start") {
      onChange({ start: Math.min(settings.end - MIN_CLIP_SECONDS, Math.max(from, settings.start + delta)) });
    } else {
      onChange({ end: Math.max(settings.start + MIN_CLIP_SECONDS, Math.min(to, settings.end + delta)) });
    }
  };

  const trackHint =
    track?.status === "running" || track?.status === "waiting"
      ? `Tracking faces ${Math.round((track.progress ?? 0) * 100)}%`
      : track?.status === "error"
        ? "Tracking unavailable"
        : track?.status === "ready"
          ? "Following the speaker"
          : null;

  return (
    <div className="divide-y divide-hairline overflow-hidden rounded-2xl border border-hairline bg-surface dark:bg-white/[0.02]">
      <Row label="Hook title" hint={settings.layout === "fit" ? "Headline above the video" : "First 3 seconds"}>
        <ToggleRow
          label="Show a hook"
          description="Big text that stops the scroll."
          checked={settings.hookTitle}
          onChange={(hookTitle) => onChange({ hookTitle })}
        />
        {settings.hookTitle && (
          <input
            value={settings.hookText}
            maxLength={80}
            onChange={(event) => onChange({ hookText: event.target.value })}
            placeholder="He lost everything in 24 hours"
            aria-label="Hook text"
            className={INPUT}
          />
        )}
      </Row>

      <Row label="Format">
        <Segmented<ClipAspect>
          label="Aspect ratio"
          value={settings.aspect}
          onChange={(aspect) =>
            onChange({
              aspect,
              ...(aspect === "16:9" && settings.layout === "split" ? { layout: "fit" as const } : {}),
            })
          }
          options={[
            { value: "9:16", label: "9:16" },
            { value: "1:1", label: "1:1" },
            { value: "16:9", label: "16:9" },
          ]}
        />
        <Segmented<ClipLayout>
          label="Layout"
          value={settings.layout}
          onChange={(layout) =>
            onChange({ layout, captionPosition: layout === "split" ? "middle" : settings.captionPosition })
          }
          options={[
            { value: "fill", label: "Fill" },
            { value: "fit", label: "Fit + blur" },
            ...(settings.aspect === "16:9" ? [] : [{ value: "split" as const, label: "Split screen" }]),
          ]}
        />
      </Row>

      {cropped && (
        <Row label="Framing" hint={settings.reframe === "auto" ? trackHint : null}>
          <Segmented<ClipEditSettings["reframe"]>
            label="Framing"
            value={settings.reframe}
            onChange={(reframe) => onChange({ reframe })}
            options={[
              { value: "auto", label: "AI reframe" },
              { value: "manual", label: "Manual" },
            ]}
          />
          {settings.reframe === "manual" && (
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={settings.focusX}
              onChange={(event) => onChange({ focusX: Number(event.target.value) })}
              aria-label="Horizontal framing"
              className="voiceover-range"
              style={{ "--fill": `${settings.focusX * 100}%` } as CSSProperties}
            />
          )}
        </Row>
      )}

      {settings.layout === "split" && (
        <Row label="Bottom video" hint="Gameplay or satisfying loops">
          <input
            ref={fileRef}
            type="file"
            accept="video/mp4,video/quicktime,video/webm"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (!file) return;
              if (file.size > BACKGROUND_MAX_BYTES) {
                setBackgroundError("Pick a video under 300 MB.");
                return;
              }
              setBackgroundError(null);
              onBackground(file);
            }}
          />
          {background ? (
            <div className="flex items-center gap-2 rounded-lg bg-(--app-fill) py-1.5 pl-3 pr-1.5">
              <span className="min-w-0 flex-1 truncate text-[13px] text-heading">{background.name}</span>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="h-7 rounded-md px-2.5 text-[12px] font-medium text-heading hover:bg-(--app-fill-strong)"
              >
                Change
              </button>
              <button
                type="button"
                onClick={() => onBackground(null)}
                aria-label="Remove bottom video"
                className="flex h-7 w-7 items-center justify-center rounded-md text-subtle hover:bg-(--app-fill-strong) hover:text-heading"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex h-10 items-center justify-center gap-2 rounded-lg border border-dashed border-hairline text-[13px] font-medium text-heading transition-colors hover:bg-(--app-fill)"
            >
              <Upload className="h-4 w-4" /> Upload a video
            </button>
          )}
          <p className={cn("text-[12px] leading-snug", backgroundError ? "text-danger" : "text-subtle")}>
            {backgroundError ?? "Plays muted under your clip, on a loop. Without one, a blurred copy fills the space."}
          </p>
        </Row>
      )}

      <Row label="Captions">
        <div role="radiogroup" aria-label="Caption style" className="grid grid-cols-3 gap-2">
          {TEMPLATE_SWATCHES.map((swatch) => {
            const selected = settings.captions === swatch.value;
            return (
              <button
                key={swatch.value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => onChange({ captions: swatch.value })}
                className={cn(
                  "flex flex-col items-center gap-1.5 rounded-xl p-1.5 outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-primary/50",
                  selected ? "ring-2 ring-primary" : "ring-1 ring-hairline hover:ring-heading/30"
                )}
              >
                <span className="flex h-12 w-full items-center justify-center overflow-hidden rounded-lg bg-[radial-gradient(120%_120%_at_30%_20%,#3a3f4b,#121318)] px-1 text-[13px] leading-none">
                  {swatch.sample}
                </span>
                <span className={cn("text-[12px] font-medium", selected ? "text-heading" : "text-subtle")}>
                  {swatch.label}
                </span>
              </button>
            );
          })}
        </div>
        {settings.captions !== "off" && (
          <>
            <Segmented<CaptionPosition>
              label="Caption position"
              value={settings.captionPosition}
              onChange={(captionPosition) => onChange({ captionPosition })}
              options={[
                { value: "top", label: "Top" },
                { value: "middle", label: "Middle" },
                { value: "bottom", label: "Bottom" },
              ]}
            />
            <ToggleRow
              label="Emojis"
              description={
                clip.emojis?.length
                  ? `Pops ${clip.emojis.map((e) => e.emoji).join(" ")} on key words.`
                  : "None picked for this clip."
              }
              checked={settings.emojis}
              onChange={(emojis) => onChange({ emojis })}
            />
          </>
        )}
      </Row>

      <Row label="Jump cuts">
        <ToggleRow
          label="Remove pauses"
          description={
            length - kept > 0.5
              ? `Cuts silences and "um"s: ${length.toFixed(0)}s becomes ${kept.toFixed(0)}s.`
              : "This clip has almost no dead air."
          }
          checked={settings.removePauses}
          onChange={(removePauses) => onChange({ removePauses })}
        />
      </Row>

      <Row label="Trim" hint={<span className="font-mono">{length.toFixed(1)}s</span>}>
        <div className="grid grid-cols-2 gap-2">
          {(["start", "end"] as const).map((edge) => {
            const value = settings[edge];
            return (
              <div key={edge} className="flex items-center justify-between rounded-lg bg-(--app-fill) px-1 py-1">
                <StepButton
                  icon={Minus}
                  label={`${edge === "start" ? "Start" : "End"} earlier`}
                  onClick={() => nudge(edge, -TRIM_STEP)}
                  disabled={edge === "start" ? value <= from + 0.01 : value <= settings.start + MIN_CLIP_SECONDS + 0.01}
                />
                <span className="flex flex-col items-center leading-tight">
                  <span className="text-[11px] text-subtle">{edge === "start" ? "Start" : "End"}</span>
                  <span className="font-mono text-[13px] text-heading">{formatClock(value)}</span>
                </span>
                <StepButton
                  icon={Plus}
                  label={`${edge === "start" ? "Start" : "End"} later`}
                  onClick={() => nudge(edge, TRIM_STEP)}
                  disabled={edge === "start" ? value >= settings.end - MIN_CLIP_SECONDS - 0.01 : value >= to - 0.01}
                />
              </div>
            );
          })}
        </div>
      </Row>

      <Row label="Post title" hint="Also the file name">
        <input
          value={settings.title}
          maxLength={90}
          onChange={(event) => onChange({ title: event.target.value })}
          aria-label="Post title"
          className={INPUT}
        />
      </Row>
    </div>
  );
}

function useElapsed(since: number | undefined, running: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [running]);
  return since ? Math.max(0, Math.floor((now - since) / 1000)) : 0;
}

/** Seconds of kept footage before source time `t` (the output timeline). */
function outputTimeAt(ranges: [number, number][], t: number): number {
  let total = 0;
  for (const [a, b] of ranges) {
    if (t <= a) break;
    total += Math.min(t, b) - a;
  }
  return total;
}

/**
 * The live preview: the source plays in a hidden <video> (the split screen's
 * bottom video in another), and the shared painter draws every frame --
 * reframe, captions, hook and jump cuts included.
 */
function ClipPreview({
  clip,
  source,
  track,
  background,
  settings,
  words,
  thumbnailUrl,
  onRetry,
}: {
  clip: ClipMoment;
  source: SourceState | undefined;
  track: TrackState | undefined;
  background: string | null;
  settings: ClipEditSettings;
  words: TranscriptWord[];
  thumbnailUrl: string | null;
  onRetry: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const backgroundRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const painterRef = useRef<ReturnType<typeof createFramePainter> | null>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(settings.start);
  const ready = source?.status === "ready" && Boolean(source.url);
  const offset = source?.source?.offset ?? 0;
  const size = PREVIEW_SIZES[settings.aspect];
  const { start, end, captions: template, removePauses } = settings;
  const captions = useMemo(
    () => prepareCaptions(words, { start, end, captions: template }, clip),
    [words, start, end, template, clip]
  );
  const ranges = useMemo(() => keepRanges(words, start, end, removePauses), [words, start, end, removePauses]);
  const outputLength = rangesDuration(ranges);
  const elapsed = useElapsed(source?.startedAt, source?.status === "loading");
  const path = track?.track;

  const latest = useRef({ settings, captions, offset, ranges, path });
  const paint = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2 || !video.videoWidth) return;
    painterRef.current ??= createFramePainter(canvas);
    const { settings: s, captions: c, offset: o, ranges: r, path: p } = latest.current;
    const bg = backgroundRef.current;
    const t = video.currentTime + o;
    painterRef.current({
      source: video,
      sourceWidth: video.videoWidth,
      sourceHeight: video.videoHeight,
      settings: s,
      captions: c,
      time: t,
      clipTime: outputTimeAt(r, t),
      center: centerAt(p, t),
      background: bg && bg.readyState >= 2 ? { image: bg, width: bg.videoWidth, height: bg.videoHeight } : null,
    });
  }, []);

  useEffect(() => {
    latest.current = { settings, captions, offset, ranges, path };
    paint();
  }, [settings, captions, offset, ranges, path, paint]);

  useEffect(() => {
    void loadCaptionFonts().then(paint);
  }, [paint]);

  // A trim moves the playhead back into the clip.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !ready) return;
    const local = video.currentTime + offset;
    if (local < start || local > end) video.currentTime = Math.max(0, start - offset);
  }, [start, end, offset, ready]);

  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    let shown = -1;
    const step = () => {
      const video = videoRef.current;
      if (!video) return;
      const { offset: o, ranges: r } = latest.current;
      const t = video.currentTime + o;
      // Jump cuts: skip the gaps, loop at the end.
      if (r.length && !r.some(([a, b]) => t >= a - 0.02 && t < b)) {
        const next = r.find(([a]) => a > t);
        video.currentTime = Math.max(0, (next ?? r[0])[0] - o);
      }
      paint();
      const rounded = Math.round(t * 10) / 10;
      if (rounded !== shown) {
        shown = rounded;
        setTime(rounded);
      }
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [playing, paint]);

  const toggle = () => {
    const video = videoRef.current;
    if (!video || !ready) return;
    if (video.paused) {
      void video
        .play()
        .then(() => {
          setPlaying(true);
          void backgroundRef.current?.play().catch(() => {});
        })
        .catch(() => setPlaying(false));
    } else {
      video.pause();
      backgroundRef.current?.pause();
      setPlaying(false);
    }
  };

  const reframing = settings.layout !== "fit" && settings.reframe === "auto";
  const clamped = Math.min(end, Math.max(start, time));

  return (
    <div className={cn("flex w-full shrink-0 flex-col", size.maxWidth)}>
      <div
        className={cn(
          "relative w-full overflow-hidden rounded-[28px] bg-black shadow-[0_0_0_1px_rgba(16,24,40,0.08),0_30px_60px_-30px_rgba(16,24,40,0.45)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.08)]",
          size.aspect
        )}
      >
        {ready ? (
          <>
            <video
              ref={videoRef}
              src={source!.url}
              playsInline
              preload="auto"
              onLoadedData={(event) => {
                event.currentTarget.currentTime = Math.max(0, start - offset);
              }}
              onSeeked={paint}
              onPause={() => setPlaying(false)}
              className="pointer-events-none absolute h-px w-px opacity-0"
            />
            {background && settings.layout === "split" && (
              <video
                ref={backgroundRef}
                src={background}
                muted
                loop
                playsInline
                preload="auto"
                onLoadedData={paint}
                className="pointer-events-none absolute h-px w-px opacity-0"
              />
            )}
            <canvas
              ref={canvasRef}
              width={size.width}
              height={size.height}
              onClick={toggle}
              className="absolute inset-0 h-full w-full cursor-pointer"
            />
            {!playing && (
              <button
                type="button"
                onClick={toggle}
                aria-label="Play preview"
                className="absolute left-1/2 top-1/2 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-md transition-transform hover:scale-105"
              >
                <Play className="ml-0.5 h-6 w-6 fill-white" />
              </button>
            )}
            {reframing && track && track.status !== "error" && (
              <span className="pointer-events-none absolute bottom-3 right-3 inline-flex h-7 items-center gap-1.5 rounded-full bg-black/55 px-2.5 text-[11px] font-medium text-white backdrop-blur-md">
                {track.status === "ready" ? (
                  <ScanFace className="h-3.5 w-3.5" />
                ) : (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                )}
                {track.status === "ready" ? "AI reframe" : `Tracking ${Math.round(track.progress * 100)}%`}
              </span>
            )}
          </>
        ) : (
          <>
            {thumbnailUrl && (
              // eslint-disable-next-line @next/next/no-img-element -- remote YouTube thumbnail
              <img
                src={thumbnailUrl}
                alt=""
                className="absolute inset-0 h-full w-full object-cover opacity-50 blur-[2px]"
              />
            )}
            <div className="absolute inset-x-5 top-1/2 -translate-y-1/2 rounded-2xl bg-black/60 p-4 text-center text-white backdrop-blur-xl">
              {source?.status === "error" ? (
                <>
                  <p className="text-[13px] leading-relaxed">{source.error}</p>
                  <button
                    type="button"
                    onClick={onRetry}
                    className="mt-3 inline-flex h-8 items-center gap-1.5 rounded-full bg-white px-3.5 text-[13px] font-medium text-[#0B0D12]"
                  >
                    <RotateCw className="h-3.5 w-3.5" /> Try again
                  </button>
                </>
              ) : (
                <>
                  <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                  <p className="mt-2.5 text-[13px] font-medium">Cutting this clip from the video</p>
                  {/* The server reads the video from the start to reach the clip; show where it is. */}
                  {source && source.from > 20 ? (
                    <>
                      <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/15">
                        <div
                          className="h-full rounded-full bg-white transition-[width] duration-500"
                          style={{ width: `${Math.min(100, ((source.reached ?? 0) / source.from) * 100)}%` }}
                        />
                      </div>
                      <p className="mt-2 font-mono text-[12px] text-white/60">
                        {formatClock(Math.min(source.reached ?? 0, source.from))} of {formatClock(source.from)}
                      </p>
                    </>
                  ) : (
                    <p className="mt-1 font-mono text-[12px] text-white/60">{formatClock(elapsed)}</p>
                  )}
                  <p className="mt-2 text-[12px] leading-relaxed text-white/60">
                    Clips later in the video take longer to reach.
                  </p>
                </>
              )}
            </div>
          </>
        )}
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={toggle}
          disabled={!ready}
          aria-label={playing ? "Pause" : "Play"}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-heading outline-none transition-colors hover:bg-(--app-fill) focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-40"
        >
          {playing ? <Pause className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current" />}
        </button>
        <input
          type="range"
          min={start}
          max={end}
          step={0.05}
          value={clamped}
          disabled={!ready}
          onChange={(event) => {
            const value = Number(event.target.value);
            setTime(value);
            if (videoRef.current) videoRef.current.currentTime = Math.max(0, value - offset);
          }}
          aria-label="Seek"
          className="voiceover-range flex-1"
          style={{ "--fill": `${((clamped - start) / (end - start)) * 100}%` } as CSSProperties}
        />
        <span className="shrink-0 font-mono text-[12px] tabular-nums text-subtle">
          {formatClock(outputTimeAt(ranges, clamped))} / {formatClock(outputLength)}
        </span>
      </div>
    </div>
  );
}
