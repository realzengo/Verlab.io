"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Maximize, Minimize, Pause, Play, Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";

// Verlab's own player for finished clips, in place of the browser's
// controls: a frosted play button while paused, and a slim bar (Verlab-blue
// scrubber, mono timecode, sound, full screen) that fades out while it plays.

const HIDE_AFTER_MS = 2200;

/** m:ss, or h:mm:ss past an hour. */
function clock(seconds: number): string {
  const total = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

const BAR_BUTTON =
  "flex shrink-0 items-center justify-center rounded-full text-white outline-none transition-colors hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-white/70";

export function ClipVideo({
  src,
  autoPlay = false,
  compact = false,
  fit = "cover",
  className,
  label = "Clip",
}: {
  src: string;
  autoPlay?: boolean;
  /** Small tiles: a smaller play button and bar, the current time only. */
  compact?: boolean;
  fit?: "cover" | "contain";
  className?: string;
  label?: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const fillRef = useRef<HTMLDivElement>(null);
  const bufferRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(0);
  const [active, setActive] = useState(true);
  const [scrubbing, setScrubbing] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  // The scrubber is painted straight onto the DOM every frame (smooth, no
  // re-render); only the whole-second timecode goes through state.
  const paint = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    const ratio = video.duration ? Math.min(1, video.currentTime / video.duration) : 0;
    if (fillRef.current) fillRef.current.style.transform = `scaleX(${ratio})`;
    if (thumbRef.current) thumbRef.current.style.left = `${ratio * 100}%`;
    if (bufferRef.current && video.duration && video.buffered.length) {
      const end = video.buffered.end(video.buffered.length - 1);
      bufferRef.current.style.transform = `scaleX(${Math.min(1, end / video.duration)})`;
    }
    setCurrent(Math.floor(video.currentTime));
  }, []);

  useEffect(() => {
    if (!playing) return;
    let frame = requestAnimationFrame(function tick() {
      paint();
      frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [playing, paint]);

  // The metadata can land before hydration attaches onDurationChange.
  useEffect(() => {
    const video = videoRef.current;
    if (video && video.readyState >= 1 && Number.isFinite(video.duration)) {
      setDuration(video.duration);
      paint();
    }
  }, [src, paint]);

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === rootRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, []);

  /** Shows the bar, and hides it again after a moment if the clip is playing. */
  const wake = useCallback(() => {
    setActive(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setActive(false), HIDE_AFTER_MS);
  }, []);

  const toggle = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) void video.play().catch(() => {});
    else video.pause();
    wake();
  };

  const seekTo = (clientX: number) => {
    const video = videoRef.current;
    const track = trackRef.current;
    if (!video || !track || !video.duration) return;
    const rect = track.getBoundingClientRect();
    video.currentTime = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)) * video.duration;
    paint();
  };

  const onScrubStart = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    setScrubbing(true);
    seekTo(event.clientX);
  };

  const toggleFullscreen = () => {
    const root = rootRef.current;
    const video = videoRef.current as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null;
    if (document.fullscreenElement) void document.exitFullscreen();
    else if (root?.requestFullscreen) void root.requestFullscreen().catch(() => {});
    // iPhone Safari only lets the video element itself go full screen.
    else video?.webkitEnterFullscreen?.();
  };

  const shown = !playing || active || scrubbing;

  return (
    <div
      ref={rootRef}
      onPointerMove={wake}
      onPointerLeave={() => playing && setActive(false)}
      className={cn("group/player relative overflow-hidden bg-black", !shown && "cursor-none", className)}
    >
      <video
        ref={videoRef}
        src={src}
        autoPlay={autoPlay}
        playsInline
        preload="metadata"
        aria-label={label}
        onPlay={() => {
          setPlaying(true);
          wake();
        }}
        onPause={() => {
          setPlaying(false);
          paint();
        }}
        onDurationChange={(event) => {
          const { duration } = event.currentTarget;
          setDuration(Number.isFinite(duration) ? duration : 0);
          paint();
        }}
        onProgress={paint}
        onSeeked={paint}
        onVolumeChange={(event) => setMuted(event.currentTarget.muted)}
        className={cn("h-full w-full", fullscreen || fit === "contain" ? "object-contain" : "object-cover")}
      />

      {/* The whole picture plays and pauses */}
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? "Pause" : "Play"}
        className="absolute inset-0 outline-none"
      >
        <span
          className={cn(
            "pointer-events-none absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_12px_32px_-10px_rgba(0,0,0,0.6)] ring-1 ring-white/20 backdrop-blur-xl transition-[opacity,transform] duration-200 ease-out",
            compact ? "h-11 w-11" : "h-16 w-16",
            playing ? "scale-90 opacity-0" : "scale-100 opacity-100"
          )}
        >
          <Play className={cn("fill-white", compact ? "ml-0.5 h-4 w-4" : "ml-1 h-6 w-6")} strokeWidth={0} />
        </span>
      </button>

      {/* The bar */}
      <div
        className={cn(
          "absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent transition-opacity duration-200",
          compact ? "px-2 pb-1.5 pt-8" : "px-3 pb-2.5 pt-12",
          shown ? "opacity-100" : "pointer-events-none opacity-0"
        )}
      >
        <div
          ref={trackRef}
          role="slider"
          tabIndex={0}
          aria-label="Seek"
          aria-valuemin={0}
          aria-valuemax={Math.round(duration)}
          aria-valuenow={current}
          aria-valuetext={`${clock(current)} of ${clock(duration)}`}
          onPointerDown={onScrubStart}
          onPointerMove={(event) => scrubbing && seekTo(event.clientX)}
          onPointerUp={() => setScrubbing(false)}
          onPointerCancel={() => setScrubbing(false)}
          onKeyDown={(event) => {
            const video = videoRef.current;
            if (!video) return;
            const step = event.key === "ArrowRight" ? 5 : event.key === "ArrowLeft" ? -5 : 0;
            if (!step) return;
            event.preventDefault();
            video.currentTime = Math.min(video.duration || 0, Math.max(0, video.currentTime + step));
            paint();
            wake();
          }}
          className="group/track relative flex h-4 cursor-pointer touch-none items-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-white/70"
        >
          <div
            className={cn(
              "relative h-1 w-full overflow-hidden rounded-full bg-white/25 transition-transform duration-150 group-hover/track:scale-y-150",
              scrubbing && "scale-y-150"
            )}
          >
            <div ref={bufferRef} className="absolute inset-0 origin-left bg-white/30" style={{ transform: "scaleX(0)" }} />
            <div ref={fillRef} className="absolute inset-0 origin-left bg-[#335cff]" style={{ transform: "scaleX(0)" }} />
          </div>
          <div
            ref={thumbRef}
            className={cn(
              "pointer-events-none absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_0_0_0.5px_rgba(0,0,0,0.2),0_1px_4px_rgba(0,0,0,0.45)] transition-[opacity,transform] duration-150",
              scrubbing
                ? "scale-110 opacity-100"
                : "scale-75 opacity-0 group-hover/track:scale-100 group-hover/track:opacity-100 [@media(hover:none)]:scale-100 [@media(hover:none)]:opacity-100"
            )}
            style={{ left: 0 }}
          />
        </div>

        <div className={cn("flex items-center", compact ? "mt-0.5 gap-0.5" : "mt-1 gap-1")}>
          <button
            type="button"
            onClick={toggle}
            aria-label={playing ? "Pause" : "Play"}
            className={cn(BAR_BUTTON, compact ? "h-7 w-7" : "h-8 w-8")}
          >
            {playing ? (
              <Pause className={cn("fill-white", compact ? "h-3.5 w-3.5" : "h-4 w-4")} strokeWidth={0} />
            ) : (
              <Play className={cn("ml-px fill-white", compact ? "h-3.5 w-3.5" : "h-4 w-4")} strokeWidth={0} />
            )}
          </button>
          <span
            className={cn(
              "min-w-0 truncate pl-1 font-mono tabular-nums text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.4)]",
              compact ? "text-[11px]" : "text-[12px]"
            )}
          >
            {clock(current)}
            {!compact && <span className="text-white/55"> / {clock(duration)}</span>}
          </span>
          <span className="flex-1" />
          <button
            type="button"
            onClick={() => {
              const video = videoRef.current;
              if (video) video.muted = !video.muted;
              wake();
            }}
            aria-label={muted ? "Unmute" : "Mute"}
            className={cn(BAR_BUTTON, compact ? "h-7 w-7" : "h-8 w-8")}
          >
            {muted ? (
              <VolumeX className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} strokeWidth={2} />
            ) : (
              <Volume2 className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} strokeWidth={2} />
            )}
          </button>
          <button
            type="button"
            onClick={toggleFullscreen}
            aria-label={fullscreen ? "Exit full screen" : "Full screen"}
            className={cn(BAR_BUTTON, compact ? "h-7 w-7" : "h-8 w-8")}
          >
            {fullscreen ? (
              <Minimize className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} strokeWidth={2} />
            ) : (
              <Maximize className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} strokeWidth={2} />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
