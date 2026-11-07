"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Captions,
  Check,
  ChevronDown,
  Clapperboard,
  Copy,
  Loader2,
  Move,
  Pause,
  Pencil,
  Play,
  RotateCw,
  ScanFace,
  Scaling,
  Type,
  Upload,
  X,
} from "lucide-react";
import { PlasticButton } from "@/components/ui/plastic-button";
import { Switch } from "@/components/ui/Switch";
import { Segmented, useMediaQuery } from "@/components/clipping/parts";
import type { ClipWorkspace, SourceState, TrackState } from "@/components/clipping/useClipWorkspace";
import {
  CAPTION_FONTS,
  CAPTION_PRESET_Y,
  HOOK_PRESET_Y,
  OUTPUT_SIZES,
  captionTakesColor,
  planFor,
  usesTracking,
  createFramePainter,
  cropAspectFor,
  fontsFor,
  hookHighlight,
  isLight,
  keepRanges,
  loadCaptionFonts,
  prepareCaptions,
  rangesDuration,
  wordKey,
  type CaptionFont,
  type CaptionBox,
  type CaptionPosition,
  type CaptionTemplate,
  type ClipEditSettings,
  type ClipSource,
  type FramePlacement,
  type HookMotion,
  type HookStyle,
} from "@/lib/client/clip-render";
import { ALL_LAYOUTS, LAYOUTS, sceneAt, type LayoutId } from "@/lib/client/clip-layouts";
import { cameraPath, centerAt, type CameraMode } from "@/lib/client/clip-reframe";
import { loadWaveform, type Waveform } from "@/lib/client/clip-waveform";
import {
  formatClock,
  isRtlText,
  type ClipAspect,
  type ClipMoment,
  type ClipProject,
  type TranscriptWord,
} from "@/lib/clips";
import { cn } from "@/lib/utils";
// Caption and hook typefaces (Open Sauce One comes from the root layout).
import "@fontsource/montserrat/latin-700.css";
import "@fontsource/montserrat/latin-800.css";
import "@fontsource/montserrat/latin-900.css";
import "@fontsource/poppins/latin-700.css";
import "@fontsource/poppins/latin-800.css";
import "@fontsource/poppins/latin-900.css";
import "@fontsource/inter/latin-700.css";
import "@fontsource/inter/latin-800.css";
import "@fontsource/inter/latin-900.css";
import "@fontsource/anton/latin-400.css";
import "@fontsource/bebas-neue/latin-400.css";
import "@fontsource/luckiest-guy/latin-400.css";
import "./montserrat-arabic.css";

const MIN_CLIP_SECONDS = 5;
const TRIM_STEP = 0.5;
const BACKGROUND_MAX_BYTES = 300 * 1024 * 1024;

// The preview canvas's resolution; the stage decides how big it shows.
const PREVIEW_SIZES: Record<ClipAspect, { width: number; height: number }> = {
  "9:16": { width: 720, height: 1280 },
  "1:1": { width: 960, height: 960 },
  "16:9": { width: 1280, height: 720 },
};

const SURFACE =
  "border border-hairline bg-surface shadow-[0_1px_2px_rgba(16,24,40,0.04),0_12px_32px_-18px_rgba(16,24,40,0.14)] dark:bg-white/[0.03] dark:shadow-none";
/** An editor canvas: a quiet fill with a fine dot grid. */
const STAGE_BACKDROP =
  "bg-[#F6F6F7] bg-[radial-gradient(rgba(16,24,40,0.09)_1px,transparent_1px)] [background-size:18px_18px] dark:bg-black/20 dark:bg-[radial-gradient(rgba(255,255,255,0.06)_1px,transparent_1px)]";

type SettingsTab = "captions" | "hook" | "video";

const SETTINGS_TABS: { value: SettingsTab; label: string; icon: typeof Captions }[] = [
  { value: "captions", label: "Captions", icon: Captions },
  { value: "hook", label: "Hook", icon: Type },
  { value: "video", label: "Video", icon: Clapperboard },
];

/** Phones get the editor as a full-screen view, like a native editing app. */
const PHONE = "(max-width: 767px)";

type Point = { x: number; y: number };

/**
 * Where TikTok, Reels and Shorts lay their own buttons and text over a 9:16
 * video, as fractions of the frame. Captions kept clear of these stay readable.
 */
const APP_UI_ZONES = [
  { x: 0, y: 0, w: 1, h: 0.09 }, // tabs and search
  { x: 0.86, y: 0.42, w: 0.14, h: 0.38 }, // like, comment and share
  { x: 0, y: 0.8, w: 1, h: 0.2 }, // name, description and sound
];
const SAFE_ZONE_FILL =
  "bg-black/25 bg-[repeating-linear-gradient(135deg,rgba(255,255,255,0.16)_0_2px,transparent_2px_7px)]";
/** What can be moved around the frame. */
type Movable = "caption" | "hook";
/** How near the center lines a dragged caption or hook snaps onto them. */
const SNAP = 0.025;

const positionOf = (settings: ClipEditSettings, what: Movable) =>
  what === "caption" ? settings.captionPosition : settings.hookPosition;

/** Its custom spot, or null while a preset (which moves with the layout) places it. */
function customSpot(settings: ClipEditSettings, what: Movable): Point | null {
  if (positionOf(settings, what) !== "custom") return null;
  return what === "caption" ? { x: settings.captionX, y: settings.captionY } : { x: settings.hookX, y: settings.hookY };
}

/** The settings that move it to (x, y): kept off the very edges, and onto the center lines when close. */
function moveTo(what: Movable, x: number, y: number, snap: boolean) {
  const snapX = snap && Math.abs(x - 0.5) < SNAP;
  const snapY = snap && Math.abs(y - 0.5) < SNAP;
  const round = (v: number, min: number, max: number) => Math.round(Math.min(max, Math.max(min, v)) * 1000) / 1000;
  const to = { x: snapX ? 0.5 : round(x, 0.05, 0.95), y: snapY ? 0.5 : round(y, 0.04, 0.96) };
  const patch: Partial<ClipEditSettings> =
    what === "caption"
      ? { captionPosition: "custom", captionX: to.x, captionY: to.y }
      : { hookPosition: "custom", hookX: to.x, hookY: to.y };
  return { patch, snapX, snapY };
}

/** How small and big the captions and hook can be made (multiples of their style's own size). */
const SIZE_MIN = 0.6;
const SIZE_MAX = 1.6;

const sizeOf = (settings: ClipEditSettings, what: Movable) =>
  what === "caption" ? settings.captionSize : settings.hookSize;

/** The settings that make it `size`: held within the limits, and onto 100% when close. */
function resizeTo(what: Movable, size: number): Partial<ClipEditSettings> {
  const held = Math.min(SIZE_MAX, Math.max(SIZE_MIN, size));
  const next = Math.abs(held - 1) < 0.04 ? 1 : Math.round(held * 100) / 100;
  return what === "caption" ? { captionSize: next } : { hookSize: next };
}

/** The step an arrow key moves things by (Shift for bigger ones), or null for other keys. */
function nudgeFor(event: React.KeyboardEvent): Point | null {
  const step = event.shiftKey ? 0.05 : 0.01;
  const moves: Record<string, Point> = {
    ArrowLeft: { x: -step, y: 0 },
    ArrowRight: { x: step, y: 0 },
    ArrowUp: { x: 0, y: -step },
    ArrowDown: { x: 0, y: step },
  };
  return moves[event.key] ?? null;
}

/** Whether a box (fractions of the frame) sits mostly behind the apps' own buttons and text. */
function behindAppUi(box: { x: number; y: number; width: number; height: number }): boolean {
  const area = box.width * box.height;
  return APP_UI_ZONES.some((zone) => {
    const w = Math.min(box.x + box.width, zone.x + zone.w) - Math.max(box.x, zone.x);
    const h = Math.min(box.y + box.height, zone.y + zone.h) - Math.max(box.y, zone.y);
    return w > 0 && h > 0 && (w * h) / area > 0.2;
  });
}

export function ClipEditor({
  project,
  clips,
  workspace,
  onBack,
  onExport,
}: {
  project: ClipProject;
  clips: ClipMoment[];
  workspace: ClipWorkspace;
  onBack: () => void;
  onExport: () => void;
}) {
  const [activeId, setActiveId] = useState(clips[0]?.id);
  const [applied, setApplied] = useState(false);
  const [tab, setTab] = useState<SettingsTab>("captions");
  // Phones: the settings open as a sheet over the lower part of the screen.
  const [sheet, setSheet] = useState(false);
  const phone = useMediaQuery(PHONE);
  // The full-screen editor covers the page; the page under it stays put.
  useEffect(() => {
    if (!phone) return;
    const root = document.documentElement;
    const before = root.style.overflow;
    root.style.overflow = "hidden";
    return () => {
      root.style.overflow = before;
    };
  }, [phone]);
  // Where the preview last put the captions and hook (presets move with the
  // layout), and which position pad is in use, so the preview shows what moves.
  const [anchors, setAnchors] = useState<Record<Movable, Point | null> & { key: string }>({
    key: "",
    caption: null,
    hook: null,
  });
  const [placing, setPlacing] = useState<Movable | null>(null);
  const active = clips.find((clip) => clip.id === activeId) ?? clips[0];
  const previewKey = active ? `${active.id}-${workspace.settingsFor(active).aspect}` : "";
  const onAnchor = useCallback(
    (what: Movable, point: Point | null) =>
      setAnchors((current) => ({
        ...(current.key === previewKey ? current : { caption: null, hook: null }),
        key: previewKey,
        [what]: point,
      })),
    [previewKey]
  );
  const { requestSource } = workspace;

  // Coming back to Edit (or a clip that never started) re-requests its cut;
  // already-fetched ones resolve from the cache.
  useEffect(() => {
    for (const clip of clips) requestSource(clip);
  }, [clips, requestSource]);

  if (!active) return null;
  const settings = workspace.settingsFor(active);
  const source = workspace.sources[active.id];
  const output = OUTPUT_SIZES[settings.aspect];
  const change = (patch: Partial<ClipEditSettings>) => {
    setApplied(false);
    workspace.updateSettings(active, patch);
  };

  const applyToAll = clips.length > 1 && (
    <button
      type="button"
      onClick={() => {
        workspace.applyStyleToAll(active, clips);
        setApplied(true);
      }}
      className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-full border border-hairline text-[13px] font-medium text-heading transition-colors hover:bg-(--app-fill) md:h-9"
    >
      {applied ? <Check className="h-3.5 w-3.5" strokeWidth={2.5} /> : <Copy className="h-3.5 w-3.5" />}
      {applied ? "Style applied to all clips" : `Apply this style to all ${clips.length} clips`}
    </button>
  );

  return (
    <div
      className={cn(
        "grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_400px] 2xl:grid-cols-[minmax(0,1fr)_420px]",
        "max-md:fixed max-md:inset-0 max-md:z-50 max-md:flex max-md:flex-col max-md:items-stretch max-md:gap-0 max-md:bg-app"
      )}
    >
      {/* Phones: the editor's own top bar (the page header is under this view) */}
      <div className="flex items-center gap-1.5 border-b border-hairline bg-surface pb-2 pl-1.5 pr-3 pt-[max(8px,env(safe-area-inset-top))] md:hidden">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to clips"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-heading outline-none transition-[transform,background-color] active:scale-95 active:bg-(--app-fill) focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          <ArrowLeft className="h-5 w-5" strokeWidth={2} />
        </button>
        <input
          value={settings.title}
          dir="auto"
          maxLength={90}
          onChange={(event) => change({ title: event.target.value })}
          placeholder="Name this clip"
          aria-label="Post title"
          className="h-10 min-w-0 flex-1 truncate rounded-[10px] bg-transparent px-2 text-[16px] font-semibold tracking-[-0.01em] text-heading outline-none transition-colors placeholder:text-subtle/60 focus:bg-(--app-fill)"
        />
        <PlasticButton
          className="mb-1 h-10 shrink-0 rounded-[14px] px-4"
          text={clips.length > 1 ? `Export ${clips.length}` : "Export"}
          trailing={<ArrowRight className="h-4 w-4" strokeWidth={2} />}
          onClick={onExport}
        />
      </div>

      {/* The stage: which clip, its name, the preview and the timeline */}
      <section
        className={cn(
          "flex h-[min(82dvh,780px)] min-h-[520px] flex-col overflow-hidden rounded-[24px] xl:sticky xl:top-6 xl:h-[calc(100dvh-190px)]",
          SURFACE,
          "max-md:h-auto max-md:min-h-0 max-md:flex-1 max-md:rounded-none max-md:border-0 max-md:shadow-none"
        )}
      >
        <div
          className={cn(
            "flex items-center gap-3 border-b border-hairline px-3 py-2.5 sm:px-4",
            // Phones show the title in the top bar, so this row is only the clip switcher there
            // (hidden while the settings sheet is up, to keep the preview big).
            clips.length > 1 && !sheet ? "max-md:justify-center max-md:py-2" : "max-md:hidden"
          )}
        >
          {clips.length > 1 && (
            <div
              role="tablist"
              aria-label="Selected clips"
              className="flex shrink-0 items-center gap-0.5 rounded-full bg-(--app-fill) p-1"
            >
              {clips.map((clip, index) => {
                const state = workspace.sources[clip.id]?.status;
                const current = clip.id === active.id;
                return (
                  <button
                    key={clip.id}
                    type="button"
                    role="tab"
                    aria-selected={current}
                    aria-label={workspace.settingsFor(clip).title || clip.title}
                    title={workspace.settingsFor(clip).title || clip.title}
                    onClick={() => setActiveId(clip.id)}
                    className={cn(
                      "relative flex h-8 min-w-10 items-center justify-center rounded-full px-2.5 font-mono text-[12px] outline-none md:h-7 md:min-w-9 transition-colors focus-visible:ring-2 focus-visible:ring-primary/40",
                      current
                        ? "bg-surface text-heading shadow-[0_1px_2px_rgba(16,24,40,0.1),0_0_0_0.5px_rgba(16,24,40,0.06)] dark:bg-white/[0.12] dark:shadow-none"
                        : "text-subtle hover:text-heading"
                    )}
                  >
                    {String(index + 1).padStart(2, "0")}
                    {state === "loading" && <Loader2 className="ml-1 h-3 w-3 animate-spin opacity-60" />}
                    {state === "error" && <span className="ml-1 h-1.5 w-1.5 rounded-full bg-danger" />}
                  </button>
                );
              })}
            </div>
          )}
          <label className="group flex min-w-0 flex-1 items-center gap-1.5 rounded-[10px] px-2 py-1 transition-colors focus-within:bg-(--app-fill) hover:bg-(--app-fill) max-md:hidden">
            <input
              value={settings.title}
              dir="auto"
              maxLength={90}
              onChange={(event) => change({ title: event.target.value })}
              placeholder="Name this clip"
              aria-label="Post title"
              title="Post title, also the file name"
              className="min-w-0 flex-1 truncate bg-transparent text-[15px] font-semibold tracking-[-0.01em] text-heading outline-none placeholder:text-subtle/60"
            />
            <Pencil className="h-3.5 w-3.5 shrink-0 text-subtle opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-0" />
          </label>
          <span className="hidden shrink-0 rounded-full bg-(--app-fill) px-2.5 py-1 text-[12px] font-medium tabular-nums text-subtle sm:inline">
            {settings.aspect} · {output.width}×{output.height}
          </span>
        </div>

        <ClipPreview
          key={previewKey}
          clip={active}
          source={source}
          track={workspace.tracks[active.id]}
          background={workspace.background?.url ?? null}
          settings={settings}
          words={project.transcript ?? []}
          thumbnailUrl={project.thumbnailUrl}
          focus={tab === "hook" ? "hook" : "caption"}
          placing={placing}
          compact={sheet}
          onAnchor={onAnchor}
          onRetry={() => workspace.retrySource(active)}
          onChange={change}
        />
      </section>

      {/* Settings, by tab, with the export pinned at the foot */}
      <aside
        className={cn(
          "flex flex-col overflow-hidden rounded-[24px] xl:sticky xl:top-6 xl:h-[calc(100dvh-190px)] xl:min-h-[520px]",
          SURFACE,
          "max-md:shrink-0",
          sheet
            ? "max-md:relative max-md:z-10 max-md:-mt-3 max-md:h-[min(46dvh,460px)] max-md:rounded-b-none max-md:rounded-t-[22px] max-md:border-x-0 max-md:border-b-0 max-md:shadow-[0_-16px_40px_-20px_rgba(16,24,40,0.35)]"
            : "max-md:rounded-none max-md:border-x-0 max-md:border-b-0 max-md:shadow-none"
        )}
      >
        <div className={cn("border-b border-hairline p-3", !sheet && "max-md:hidden")}>
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <Segmented<SettingsTab>
                label="Settings"
                value={tab}
                onChange={setTab}
                options={SETTINGS_TABS.map(({ value, label }) => ({ value, label }))}
              />
            </div>
            <button
              type="button"
              onClick={() => setSheet(false)}
              aria-label="Close settings"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-(--app-fill) text-heading outline-none transition-transform active:scale-90 focus-visible:ring-2 focus-visible:ring-primary/40 md:hidden"
            >
              <ChevronDown className="h-[18px] w-[18px]" strokeWidth={2} />
            </button>
          </div>
        </div>
        <div
          className={cn(
            "min-h-0 flex-1 xl:overflow-y-auto xl:[scrollbar-width:thin]",
            "max-md:overflow-y-auto max-md:overscroll-contain max-md:pb-[env(safe-area-inset-bottom)]",
            !sheet && "max-md:hidden"
          )}
        >
          <ClipSettingsPanel
            tab={tab}
            thumbnailUrl={project.thumbnailUrl}
            clip={active}
            settings={settings}
            track={workspace.tracks[active.id]}
            words={project.transcript ?? []}
            background={workspace.background}
            onBackground={workspace.setBackground}
            anchors={anchors.key === previewKey ? anchors : { caption: null, hook: null }}
            onPlacing={setPlacing}
            onChange={change}
          />
          {applyToAll && <div className="border-t border-hairline px-5 py-4 md:hidden">{applyToAll}</div>}
        </div>
        <div className="border-t border-hairline p-4 max-md:hidden">
          {applyToAll && <div className="mb-3">{applyToAll}</div>}
          <PlasticButton
            className="h-12 w-full rounded-[18px] text-[15px]"
            text={clips.length > 1 ? `Export ${clips.length} clips` : "Export clip"}
            trailing={<ArrowRight className="h-4 w-4" strokeWidth={2} />}
            onClick={onExport}
          />
          <p className="mt-2.5 text-center text-[12px] text-subtle">Rendered in your browser in full HD.</p>
        </div>
        {/* Phones: a tab bar at the foot; each tab opens the settings sheet */}
        <nav
          aria-label="Edit"
          className={
            sheet ? "hidden" : "grid grid-cols-3 px-2 pb-[max(6px,env(safe-area-inset-bottom))] pt-1.5 md:hidden"
          }
        >
          {SETTINGS_TABS.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                setTab(value);
                setSheet(true);
              }}
              className="flex flex-col items-center gap-1 rounded-[14px] py-2 text-[11px] font-medium text-body outline-none transition-[background-color,transform] active:scale-95 active:bg-(--app-fill) focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              <Icon className="h-[22px] w-[22px] text-heading" strokeWidth={1.75} />
              {label}
            </button>
          ))}
        </nav>
      </aside>
    </div>
  );
}

function Row({
  label,
  children,
  hint,
  action,
}: {
  label: string;
  children?: ReactNode;
  hint?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 px-5 py-[18px]">
      <div className="flex min-h-6 items-center justify-between gap-3">
        <span className="text-[13px] font-semibold tracking-[-0.005em] text-heading">{label}</span>
        {action ?? (hint && <span className="text-[12px] text-subtle">{hint}</span>)}
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

const INPUT =
  "h-11 w-full rounded-[10px] border border-hairline bg-surface px-3.5 text-[16px] text-heading md:h-10 md:text-[14px] outline-none transition-[border-color,box-shadow] placeholder:text-subtle/60 focus:border-primary/50 focus:ring-4 focus:ring-primary/10 dark:bg-transparent";

// Swatches for the template picker: CSS stand-ins for what the painter draws.
// The animated ones play their motion while hovered or selected (clip-swatch-* in globals.css).
const STROKE: CSSProperties = {
  WebkitTextStroke: "3px #000",
  paintOrder: "stroke fill",
};
const family = (font: CaptionFont): CSSProperties => ({
  fontFamily: `${CAPTION_FONTS[font].family}, sans-serif`,
});
const TEMPLATE_SWATCHES: {
  value: Exclude<CaptionTemplate, "off">;
  label: string;
  group: "Animated" | "Classic";
  sample: ReactNode;
}[] = [
  {
    value: "pop",
    label: "Pop",
    group: "Animated",
    sample: (
      <span
        className="clip-swatch-pop inline-block text-[16px] font-black uppercase text-white"
        style={{ ...STROKE, ...family("montserrat") }}
      >
        Viral
      </span>
    ),
  },
  {
    value: "drop",
    label: "Drop",
    group: "Animated",
    sample: (
      <span className="text-[17px] uppercase text-white" style={{ ...STROKE, ...family("anton") }}>
        Go <span className="clip-swatch-drop inline-block text-[#FFE14D]">viral</span>
      </span>
    ),
  },
  {
    value: "slide",
    label: "Slide",
    group: "Animated",
    sample: (
      <span className="font-extrabold text-white" style={family("poppins")}>
        go <span className="clip-swatch-slide inline-block rounded-[5px] bg-primary px-1">viral</span>
      </span>
    ),
  },
  {
    value: "reveal",
    label: "Reveal",
    group: "Animated",
    sample: (
      <span className="font-extrabold text-white" style={family("inter")}>
        {["go", "viral", "now"].map((word, i) => (
          <span
            key={word}
            className={cn("clip-swatch-rise inline-block", i > 0 && "ml-[0.28em]", i === 1 && "text-[#FFE14D]")}
            style={{ animationDelay: `${i * 0.18}s` }}
          >
            {word}
          </span>
        ))}
      </span>
    ),
  },
  {
    value: "aurora",
    label: "Aurora",
    group: "Animated",
    sample: (
      <span
        className="clip-swatch-aurora inline-block bg-[linear-gradient(90deg,#7DD3FC,#A78BFA,#F472B6,#7DD3FC)] bg-[length:200%_100%] bg-clip-text font-extrabold uppercase text-transparent [filter:drop-shadow(0_0_6px_rgba(167,139,250,0.9))]"
        style={family("poppins")}
      >
        Go viral
      </span>
    ),
  },
  {
    value: "deep",
    label: "Deep",
    group: "Animated",
    sample: (
      <span
        className="font-black uppercase text-white [text-shadow:1px_1px_0_#111827,2px_2px_0_#111827,3px_3px_0_#111827,4px_4px_0_#111827,5px_5px_0_#111827]"
        style={family("montserrat")}
      >
        Go <span className="text-[#FFE14D]">viral</span>
      </span>
    ),
  },
  {
    value: "hormozi",
    label: "Hormozi",
    group: "Classic",
    sample: (
      <span className="font-black uppercase text-white" style={STROKE}>
        <span className="text-[#FFE14D]">Go</span> <span className="text-[#4ADE80]">viral</span>
      </span>
    ),
  },
  {
    value: "karaoke",
    label: "Karaoke",
    group: "Classic",
    sample: (
      <span className="font-black uppercase text-white" style={STROKE}>
        Go <span className="rounded-md bg-primary px-1">viral</span>
      </span>
    ),
  },
  {
    value: "beast",
    label: "Beast",
    group: "Classic",
    sample: (
      <span className="text-[15px] font-black uppercase text-white [text-shadow:0_3px_0_#000]" style={STROKE}>
        Go <span className="text-[#FFE14D]">viral</span>
      </span>
    ),
  },
  {
    value: "neon",
    label: "Neon",
    group: "Classic",
    sample: (
      <span className="font-extrabold uppercase text-white [text-shadow:0_0_8px_#22D3EE,0_0_16px_#22D3EE]">
        Go <span className="text-[#F472B6] [text-shadow:0_0_8px_#F472B6]">viral</span>
      </span>
    ),
  },
  {
    value: "clean",
    label: "Clean",
    group: "Classic",
    sample: <span className="rounded-md bg-black/70 px-1.5 py-0.5 font-bold text-white">Go viral</span>,
  },
  {
    value: "minimal",
    label: "Minimal",
    group: "Classic",
    sample: (
      <span className="font-semibold text-white [text-shadow:0_1px_6px_rgba(0,0,0,0.8)]">
        Go <span className="opacity-50">viral</span>
      </span>
    ),
  },
];

const SWATCH_BACKDROP = "bg-[radial-gradient(120%_120%_at_30%_20%,#3a3f4b,#121318)]";
const FONT_IDS = Object.keys(CAPTION_FONTS) as CaptionFont[];
const CAPTION_COLORS = ["#FFE14D", "#4ADE80", "#335CFF", "#22D3EE", "#F472B6", "#FF5C5C", "#FFFFFF"];
const HOOK_LOOK_SWATCHES: { value: HookStyle; label: string; chip: string }[] = [
  { value: "card", label: "Card", chip: "bg-white text-[#0B0D12]" },
  {
    value: "dark",
    label: "Dark",
    chip: "bg-[#0B0D12]/90 text-white ring-1 ring-white/15",
  },
  { value: "brand", label: "Brand", chip: "bg-primary text-white" },
  {
    value: "outline",
    label: "Outline",
    chip: "text-white [paint-order:stroke_fill] [-webkit-text-stroke:2px_#000]",
  },
];

/** A sub-control inside a settings row: small label, optional value on the right. */
function Field({ label, value, children }: { label: string; value?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[12px] font-medium text-subtle">{label}</span>
        {value !== undefined && <span className="text-[12px] tabular-nums text-subtle">{value}</span>}
      </div>
      {children}
    </div>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(event) => onChange(Number(event.target.value))}
      aria-label={label}
      className="voiceover-range"
      style={{ "--fill": `${((value - min) / (max - min)) * 100}%` } as CSSProperties}
    />
  );
}

const HOOK_MOTIONS: { value: HookMotion; label: string }[] = [
  { value: "pop", label: "Pop" },
  { value: "drop", label: "Drop" },
  { value: "fade", label: "Fade" },
  { value: "words", label: "Words" },
];
/** The swatch classes that play each entrance while hovered or selected (clip-swatch-* in globals.css). */
const MOTION_SWATCH: Record<Exclude<HookMotion, "words">, string> = {
  pop: "clip-swatch-pop",
  drop: "clip-swatch-drop",
  fade: "clip-swatch-fade",
};

/** A tiny hook in a look, its second word highlighted as the painter would, optionally playing an entrance. */
function HookChip({ style, color, motion }: { style: HookStyle; color: string; motion?: HookMotion }) {
  const look = HOOK_LOOK_SWATCHES.find((l) => l.value === style)!;
  const highlight = hookHighlight(style, color);
  const words = ["Go", "viral"];
  return (
    <span
      className={cn(
        "inline-block rounded-[5px] px-1.5 py-0.5 text-[11px] font-extrabold leading-none",
        look.chip,
        motion && motion !== "words" && MOTION_SWATCH[motion]
      )}
    >
      {words.map((word, i) => (
        <span
          key={word}
          className={cn(
            "inline-block",
            i > 0 && "ml-[0.28em]",
            i > 0 && highlight.marker && "rounded-[3px] px-[3px]",
            motion === "words" && "clip-swatch-rise"
          )}
          style={{
            ...(motion === "words" ? { animationDelay: `${i * 0.18}s` } : {}),
            ...(i > 0
              ? highlight.marker
                ? { backgroundColor: highlight.color, color: isLight(highlight.color) ? "#0B0D12" : "#FFFFFF" }
                : { color: highlight.color }
              : {}),
          }}
        >
          {word}
        </span>
      ))}
    </span>
  );
}

/** The hook's words as chips, set in its font: tap one to highlight it (every copy of it). */
function HookWordPicker({
  settings,
  onChange,
}: {
  settings: ClipEditSettings;
  onChange: (patch: Partial<ClipEditSettings>) => void;
}) {
  const emphasis = settings.hookEmphasis;
  const highlight = hookHighlight(settings.hookStyle, settings.hookColor);
  const font = CAPTION_FONTS[settings.hookFont];
  const words = settings.hookText
    .split(/\s+/)
    .filter(Boolean)
    .map((text, index) => ({ text, index, key: wordKey(text) }))
    .filter((word) => word.key);
  return (
    <div
      role="group"
      aria-label="Highlight words"
      dir={isRtlText(settings.hookText) ? "rtl" : "ltr"}
      className="flex flex-wrap gap-1.5"
    >
      {words.map((word) => {
        const on = emphasis.includes(word.key);
        return (
          <button
            key={word.index}
            type="button"
            aria-pressed={on}
            onClick={() =>
              onChange({ hookEmphasis: on ? emphasis.filter((k) => k !== word.key) : [...emphasis, word.key] })
            }
            style={{
              fontFamily: `${font.family}, sans-serif`,
              fontWeight: font.weights[font.weights.length - 1],
              ...(on
                ? { backgroundColor: highlight.color, color: isLight(highlight.color) ? "#0B0D12" : "#FFFFFF" }
                : {}),
            }}
            className={cn(
              "h-8 rounded-[9px] px-2.5 text-[13px] outline-none transition-[background-color,color,transform] focus-visible:ring-2 focus-visible:ring-primary/40 active:scale-95",
              on
                ? "shadow-[inset_0_0_0_1px_rgba(0,0,0,0.08)]"
                : "bg-(--app-fill) text-heading hover:bg-(--app-fill-strong)"
            )}
          >
            {settings.hookUpper ? word.text.toUpperCase() : word.text}
          </button>
        );
      })}
    </div>
  );
}

/** A highlight color: the template's (or look's) own, or one of the swatches. */
function ColorChoice({
  label,
  autoLabel,
  value,
  onChange,
}: {
  label: string;
  autoLabel: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        role="radio"
        aria-checked={value === "auto"}
        onClick={() => onChange("auto")}
        className={cn(
          "h-7 rounded-full px-3 text-[12px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/40",
          value === "auto"
            ? "bg-heading text-surface dark:bg-white dark:text-[#0B0D12]"
            : "bg-(--app-fill) text-heading hover:bg-(--app-fill-strong)"
        )}
      >
        {autoLabel}
      </button>
      {CAPTION_COLORS.map((color) => {
        const selected = value === color;
        return (
          <button
            key={color}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={`${label} ${color}`}
            onClick={() => onChange(color)}
            style={{ backgroundColor: color }}
            className={cn(
              "h-7 w-7 rounded-full shadow-[inset_0_0_0_1px_rgba(0,0,0,0.12)] outline-none ring-offset-2 ring-offset-surface transition-shadow focus-visible:ring-2 focus-visible:ring-primary/50 dark:ring-offset-[#18181b]",
              selected && "ring-2 ring-heading dark:ring-white"
            )}
          />
        );
      })}
    </div>
  );
}

/** Font choices, each name set in its own face. */
function FontPicker<T extends CaptionFont | "auto">({
  label,
  value,
  onChange,
  withAuto,
}: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  withAuto?: boolean;
}) {
  const options = [...(withAuto ? (["auto"] as const) : []), ...FONT_IDS] as T[];
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5">
      {options.map((id) => {
        const selected = id === value;
        const font = id === "auto" ? null : CAPTION_FONTS[id as CaptionFont];
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(id)}
            style={
              font
                ? {
                    fontFamily: `${font.family}, sans-serif`,
                    fontWeight: font.weights[font.weights.length - 1],
                  }
                : undefined
            }
            className={cn(
              "h-8 rounded-full px-3 text-[13px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/40",
              !font && "font-medium",
              selected
                ? "bg-heading text-surface dark:bg-white dark:text-[#0B0D12]"
                : "bg-(--app-fill) text-heading hover:bg-(--app-fill-strong)"
            )}
          >
            {font ? font.label : "Template"}
          </button>
        );
      })}
    </div>
  );
}

type LayoutChoice = LayoutId | "auto";

// Each choice's card: a still of the layout at work (people, a screen, a game),
// drawn with the panel split the export uses.
const LAYOUT_ART = "/tools/art/clipping/layouts";

/** What each choice does, under the picker. */
const LAYOUT_NOTES: Record<LayoutChoice, string> = {
  auto: "The AI picks the best layout for each shot from who is on screen.",
  fill: "Fills the frame and follows the speaker, cutting to whoever talks.",
  fit: "The whole frame, over a blur of itself.",
  split: "Two people, one per panel. Shots with fewer use Fill.",
  three: "Three people: one on top, two below. Shots with fewer use Fill.",
  four: "Four people in a grid. Shots with fewer use Fill.",
  screen: "The speaker's webcam on top, their whole screen below.",
  gameplay: "The streamer's webcam on top, the game below.",
};

/** The layout as one choice: a fixed layout, or Auto (the AI picks per shot). */
const choiceOf = (layouts: LayoutId[]): LayoutChoice => (layouts.length === 1 ? layouts[0] : "auto");

function LayoutPicker({
  value,
  onChange,
  disabled,
}: {
  value: LayoutId[];
  onChange: (value: LayoutId[]) => void;
  disabled?: boolean;
}) {
  const current = choiceOf(value);
  const choices: { id: LayoutChoice; label: string }[] = [...LAYOUTS, { id: "auto", label: "Auto" }];
  return (
    <div
      role="radiogroup"
      aria-label="Layout"
      className={cn("grid grid-cols-4 gap-x-2 gap-y-3", disabled && "pointer-events-none opacity-45")}
    >
      {choices.map((choice) => {
        const on = choice.id === current;
        return (
          <button
            key={choice.id}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(choice.id === "auto" ? [...ALL_LAYOUTS] : [choice.id])}
            className="group flex min-w-0 flex-col items-center gap-1.5 outline-none"
          >
            <span
              className={cn(
                "relative aspect-[3/4] w-full overflow-hidden rounded-[11px] bg-zinc-800 ring-offset-2 ring-offset-surface transition-shadow group-focus-visible:ring-2 group-focus-visible:ring-primary/50 dark:ring-offset-[#18181b]",
                on
                  ? "ring-2 ring-primary"
                  : "ring-1 ring-black/10 group-hover:ring-black/30 dark:ring-white/10 dark:group-hover:ring-white/30"
              )}
            >
              <Image src={`${LAYOUT_ART}/${choice.id}.webp`} alt="" fill sizes="120px" className="object-cover" />
              {on && (
                <span className="absolute right-1 top-1 flex h-[18px] w-[18px] items-center justify-center rounded-full bg-primary text-white shadow-[0_1px_3px_rgba(0,0,0,0.3)]">
                  <Check className="h-2.5 w-2.5" strokeWidth={3.5} />
                </span>
              )}
            </span>
            <span className={cn("max-w-full truncate text-[11.5px] font-medium", on ? "text-heading" : "text-subtle")}>
              {choice.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

const POSITION_PRESETS: { value: Exclude<CaptionPosition, "custom">; label: string }[] = [
  { value: "top", label: "Top" },
  { value: "middle", label: "Middle" },
  { value: "bottom", label: "Bottom" },
];
const PAD_SIZES: Record<ClipAspect, { width: number; height: number }> = {
  "9:16": { width: 92, height: 164 },
  "1:1": { width: 128, height: 128 },
  "16:9": { width: 136, height: 77 },
};
/** The markers' widths on the pad, as fractions of it. */
const PAD_MARKER: Record<Movable, number> = { caption: 0.46, hook: 0.6 };
/** The hook's marker in each look: its box, and the ink of its words. */
const HOOK_MARKERS: Record<HookStyle, { box: string; ink: string }> = {
  card: { box: "bg-white", ink: "bg-[#0B0D12]" },
  dark: { box: "bg-[#0B0D12]", ink: "bg-white" },
  brand: { box: "bg-primary", ink: "bg-white" },
  outline: { box: "bg-black/30", ink: "bg-white" },
};

/** A frame with a bar where the preset puts the captions. */
function PresetGlyph({ at }: { at: Exclude<CaptionPosition, "custom"> }) {
  return (
    <span className="relative h-4 w-[11px] shrink-0 rounded-[3px] border-[1.5px] border-current">
      <span
        className={cn(
          "absolute inset-x-[1.5px] h-[2px] rounded-full bg-current",
          at === "top" ? "top-[2px]" : at === "middle" ? "top-1/2 -translate-y-1/2" : "bottom-[2px]"
        )}
      />
    </span>
  );
}

/**
 * Where the captions or the hook sit: a small frame to drag them around in
 * (the apps' own buttons hatched, snapping to the center lines), beside the
 * presets. Using it lights the same guides up on the preview.
 */
function PlacementPad({
  what,
  settings,
  anchor,
  thumbnail,
  onPlacing,
  onChange,
}: {
  what: Movable;
  settings: ClipEditSettings;
  anchor: Point | null;
  thumbnail: string | null;
  onPlacing: (placing: Movable | null) => void;
  onChange: (patch: Partial<ClipEditSettings>) => void;
}) {
  const [snap, setSnap] = useState<{ x: boolean; y: boolean } | null>(null);
  const using = useRef({ hover: false, focus: false, drag: false });
  const mark = (patch: Partial<typeof using.current>) => {
    Object.assign(using.current, patch);
    const u = using.current;
    onPlacing(u.hover || u.focus || u.drag ? what : null);
  };
  useEffect(() => () => onPlacing(null), [onPlacing]);

  const position = positionOf(settings, what);
  const presetY = what === "caption" ? CAPTION_PRESET_Y : HOOK_PRESET_Y;
  const spot: Point = customSpot(settings, what) ??
    anchor ?? { x: 0.5, y: presetY[position === "custom" ? "top" : position] };
  const setPosition = (value: CaptionPosition) =>
    onChange(what === "caption" ? { captionPosition: value } : { hookPosition: value });
  const size = PAD_SIZES[settings.aspect];
  const markerWidth = PAD_MARKER[what];
  const half = markerWidth / 2;
  const noun = what === "caption" ? "captions" : "hook";

  const drag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    const pad = event.currentTarget;
    pad.setPointerCapture(event.pointerId);
    pad.focus({ preventScroll: true });
    const rect = pad.getBoundingClientRect();
    const at = (e: { clientX: number; clientY: number }) => ({
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    });
    // Grabbing the marker moves it from where it was grabbed; anywhere else, it jumps there.
    const start = at(event);
    const grip = (event.target as HTMLElement).closest("[data-marker]")
      ? { x: start.x - spot.x, y: start.y - spot.y }
      : { x: 0, y: 0 };
    const apply = (e: { clientX: number; clientY: number }) => {
      const p = at(e);
      const next = moveTo(what, p.x - grip.x, p.y - grip.y, true);
      setSnap({ x: next.snapX, y: next.snapY });
      onChange(next.patch);
    };
    mark({ drag: true });
    if (!grip.x && !grip.y) apply(event);
    const up = () => {
      pad.removeEventListener("pointermove", apply);
      pad.removeEventListener("pointerup", up);
      pad.removeEventListener("pointercancel", up);
      setSnap(null);
      mark({ drag: false });
    };
    pad.addEventListener("pointermove", apply);
    pad.addEventListener("pointerup", up);
    pad.addEventListener("pointercancel", up);
  };

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-start gap-4">
        <div
          role="slider"
          tabIndex={0}
          aria-label={what === "caption" ? "Caption position" : "Hook position"}
          aria-orientation="vertical"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(spot.y * 100)}
          aria-valuetext={`${Math.round(spot.x * 100)}% across, ${Math.round(spot.y * 100)}% down`}
          onPointerDown={drag}
          onPointerEnter={() => mark({ hover: true })}
          onPointerLeave={() => mark({ hover: false })}
          onFocus={() => mark({ focus: true })}
          onBlur={() => mark({ focus: false })}
          onKeyDown={(event) => {
            const step = nudgeFor(event);
            if (!step) return;
            event.preventDefault();
            onChange(moveTo(what, spot.x + step.x, spot.y + step.y, false).patch);
          }}
          style={{ width: size.width, height: size.height }}
          className="relative shrink-0 cursor-crosshair touch-none overflow-hidden rounded-[12px] bg-[#16181D] shadow-[0_1px_2px_rgba(16,24,40,0.12)] outline-none ring-1 ring-black/10 transition-shadow focus-visible:ring-2 focus-visible:ring-primary/60 dark:ring-white/10"
        >
          {thumbnail && (
            <span
              className="pointer-events-none absolute inset-0 bg-cover bg-center opacity-45"
              style={{ backgroundImage: `url(${thumbnail})` }}
            />
          )}
          {settings.aspect === "9:16" &&
            APP_UI_ZONES.map((zone, i) => (
              <span
                key={i}
                className={cn("pointer-events-none absolute", SAFE_ZONE_FILL)}
                style={{
                  left: `${zone.x * 100}%`,
                  top: `${zone.y * 100}%`,
                  width: `${zone.w * 100}%`,
                  height: `${zone.h * 100}%`,
                }}
              />
            ))}
          {/* the center lines, lit while the marker is snapped to them */}
          <span
            className={cn(
              "pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2 transition-colors",
              snap?.x ? "bg-primary" : "bg-white/[0.12]"
            )}
          />
          <span
            className={cn(
              "pointer-events-none absolute inset-x-0 top-1/2 h-px -translate-y-1/2 transition-colors",
              snap?.y ? "bg-primary" : "bg-white/[0.12]"
            )}
          />
          <span
            data-marker
            className={cn(
              "absolute flex -translate-x-1/2 -translate-y-1/2 cursor-grab items-center gap-[3px] ring-1 active:cursor-grabbing",
              what === "caption"
                ? "h-[14px] rounded-[5px] bg-black/60 px-[5px] backdrop-blur-sm"
                : cn(
                    "h-[17px] rounded-[5px] px-[6px] shadow-[0_2px_6px_rgba(0,0,0,0.35)]",
                    HOOK_MARKERS[settings.hookStyle].box
                  ),
              position === "custom" ? "ring-primary" : "ring-white/35",
              !snap && "transition-[left,top] duration-200 ease-out"
            )}
            style={{
              left: `${Math.min(1 - half, Math.max(half, spot.x)) * 100}%`,
              top: `${spot.y * 100}%`,
              width: `${markerWidth * 100}%`,
            }}
          >
            {what === "caption" ? (
              <>
                <span className="h-[4px] flex-1 rounded-full bg-white" />
                <span
                  className="h-[4px] flex-1 rounded-full"
                  style={{ backgroundColor: settings.captionColor === "auto" ? "#FFE14D" : settings.captionColor }}
                />
                <span className="h-[4px] flex-1 rounded-full bg-white" />
              </>
            ) : (
              <>
                <span className={cn("h-[4px] flex-1 rounded-full", HOOK_MARKERS[settings.hookStyle].ink)} />
                <span
                  className="h-[4px] flex-1 rounded-full"
                  style={{ backgroundColor: hookHighlight(settings.hookStyle, settings.hookColor).color }}
                />
                <span className={cn("h-[4px] flex-1 rounded-full", HOOK_MARKERS[settings.hookStyle].ink)} />
              </>
            )}
          </span>
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-2.5">
          <div
            role="radiogroup"
            aria-label={what === "caption" ? "Caption position presets" : "Hook position presets"}
            className="flex flex-col gap-[3px] rounded-[10px] bg-(--app-fill) p-[3px]"
          >
            {POSITION_PRESETS.map((preset) => {
              const on = position === preset.value;
              return (
                <button
                  key={preset.value}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setPosition(preset.value)}
                  className={cn(
                    "flex h-8 items-center gap-2.5 rounded-[8px] px-2.5 text-[13px] font-medium outline-none transition-[color,background-color,box-shadow] focus-visible:ring-2 focus-visible:ring-primary/40",
                    on
                      ? "bg-surface text-heading shadow-[0_1px_2px_rgba(16,24,40,0.1),0_0_0_0.5px_rgba(16,24,40,0.06)] dark:bg-white/[0.1] dark:shadow-none"
                      : "text-subtle hover:text-heading"
                  )}
                >
                  <PresetGlyph at={preset.value} />
                  {preset.label}
                </button>
              );
            })}
          </div>
          <div className="flex h-7 items-center justify-between gap-2 pl-1">
            <span className="flex gap-2.5 font-mono text-[11.5px] tabular-nums text-subtle">
              <span>
                X <span className="text-heading">{Math.round(spot.x * 100)}</span>
              </span>
              <span>
                Y <span className="text-heading">{Math.round(spot.y * 100)}</span>
              </span>
            </span>
            {position === "custom" && (
              <button
                type="button"
                onClick={() => setPosition(what === "caption" ? "bottom" : "top")}
                className="inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-[12px] font-medium text-heading transition-colors hover:bg-(--app-fill)"
              >
                <RotateCw className="h-3 w-3" /> Reset
              </button>
            )}
          </div>
        </div>
      </div>
      <p className="text-[12px] leading-snug text-subtle">
        Drag the {noun} on the preview or in the frame, or a corner on the preview to resize.
        <span className="[@media(pointer:coarse)]:hidden"> Arrow keys nudge, Shift for bigger steps.</span>
        {settings.aspect === "9:16" && " Hatched areas sit under the app's buttons."}
      </p>
    </div>
  );
}

function ClipSettingsPanel({
  tab,
  thumbnailUrl,
  clip,
  settings,
  track,
  words,
  background,
  onBackground,
  anchors,
  onPlacing,
  onChange,
}: {
  tab: SettingsTab;
  thumbnailUrl: string | null;
  clip: ClipMoment;
  settings: ClipEditSettings;
  track: TrackState | undefined;
  words: TranscriptWord[];
  background: ClipWorkspace["background"];
  onBackground: (file: File | null) => void;
  anchors: Record<Movable, Point | null>;
  onPlacing: (placing: Movable | null) => void;
  onChange: (patch: Partial<ClipEditSettings>) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [backgroundError, setBackgroundError] = useState<string | null>(null);
  // The style to bring back when captions are switched on again.
  const [lastCaptions, setLastCaptions] = useState<Exclude<CaptionTemplate, "off">>(
    settings.captions === "off" ? "hormozi" : settings.captions
  );
  const captionsOn = settings.captions !== "off";
  const length = settings.end - settings.start;
  const kept = useMemo(
    () => rangesDuration(keepRanges(words, settings.start, settings.end, true)),
    [words, settings.start, settings.end]
  );

  const found = track?.track;
  const { aspect, reframe, layouts, camera, bottomVideo } = settings;
  const plan = useMemo(
    () => planFor(found, { aspect, reframe, layouts, camera, bottomVideo }),
    [found, aspect, reframe, layouts, camera, bottomVideo]
  );
  const layoutHint =
    track?.status === "running" || track?.status === "waiting"
      ? `Finding faces ${Math.round((track.progress ?? 0) * 100)}%`
      : track?.status === "error"
        ? "Face tracking unavailable"
        : plan?.used.length && (layouts.length > 1 || plan.used.some((id) => id !== layouts[0]))
          ? `${layouts.length > 1 ? "AI picked" : "Used"} ${plan.used.map((id) => LAYOUTS.find((l) => l.id === id)?.label).join(", ")}`
          : found && !found.faces
            ? "No faces found"
            : null;

  return (
    <div className="divide-y divide-hairline">
      {tab === "hook" && (
        <>
          <Row
            label="Hook title"
            hint={settings.hookSeconds > 0 ? `First ${settings.hookSeconds} seconds` : "Whole clip"}
          >
            <ToggleRow
              label="Show a hook"
              description="Big text that stops the scroll."
              checked={settings.hookTitle}
              onChange={(hookTitle) => onChange({ hookTitle })}
            />
            {settings.hookTitle && (
              <>
                <input
                  value={settings.hookText}
                  dir="auto"
                  maxLength={80}
                  onChange={(event) => onChange({ hookText: event.target.value })}
                  placeholder="He lost everything in 24 hours"
                  aria-label="Hook text"
                  className={INPUT}
                />
                {settings.hookText.trim() && (
                  <Field label="Highlight words" value="Tap to color">
                    <HookWordPicker settings={settings} onChange={onChange} />
                  </Field>
                )}
                <Field label="Highlight color">
                  <ColorChoice
                    label="Hook highlight color"
                    autoLabel="Auto"
                    value={settings.hookColor}
                    onChange={(hookColor) => onChange({ hookColor })}
                  />
                </Field>
              </>
            )}
          </Row>

          {settings.hookTitle && (
            <>
              <Row label="Look">
                <Field label="Style">
                  <div role="radiogroup" aria-label="Hook style" className="grid grid-cols-4 gap-2">
                    {HOOK_LOOK_SWATCHES.map((look) => {
                      const selected = settings.hookStyle === look.value;
                      return (
                        <button
                          key={look.value}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          onClick={() => onChange({ hookStyle: look.value })}
                          className="group flex flex-col items-center gap-1.5 outline-none"
                        >
                          <span
                            className={cn(
                              "flex h-11 w-full items-center justify-center rounded-[10px] ring-offset-2 ring-offset-surface transition-shadow group-focus-visible:ring-2 group-focus-visible:ring-primary/50 dark:ring-offset-[#18181b]",
                              SWATCH_BACKDROP,
                              selected
                                ? "ring-2 ring-primary"
                                : "ring-1 ring-black/5 group-hover:ring-black/20 dark:ring-white/10 dark:group-hover:ring-white/25"
                            )}
                          >
                            <HookChip style={look.value} color={settings.hookColor} />
                          </span>
                          <span className={cn("text-[12px] font-medium", selected ? "text-heading" : "text-subtle")}>
                            {look.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </Field>
                <Field label="Font">
                  <FontPicker
                    label="Hook font"
                    value={settings.hookFont}
                    onChange={(hookFont) => onChange({ hookFont })}
                  />
                </Field>
                <Field label="Size" value={`${Math.round(settings.hookSize * 100)}%`}>
                  <Slider
                    label="Hook size"
                    value={settings.hookSize}
                    min={SIZE_MIN}
                    max={SIZE_MAX}
                    step={0.01}
                    onChange={(hookSize) => onChange({ hookSize })}
                  />
                </Field>
                <Field label="Case">
                  <Segmented<string>
                    label="Hook case"
                    value={settings.hookUpper ? "caps" : "typed"}
                    onChange={(value) => onChange({ hookUpper: value === "caps" })}
                    options={[
                      { value: "typed", label: "As typed" },
                      { value: "caps", label: "ALL CAPS" },
                    ]}
                  />
                </Field>
              </Row>

              <Row label="Animation">
                <Field label="Entrance">
                  <div role="radiogroup" aria-label="Hook entrance" className="grid grid-cols-4 gap-2">
                    {HOOK_MOTIONS.map((motion) => {
                      const selected = settings.hookMotion === motion.value;
                      return (
                        <button
                          key={motion.value}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          onClick={() => onChange({ hookMotion: motion.value })}
                          className="clip-swatch group flex flex-col items-center gap-1.5 outline-none"
                        >
                          <span
                            className={cn(
                              "flex h-11 w-full items-center justify-center overflow-hidden rounded-[10px] ring-offset-2 ring-offset-surface transition-shadow group-focus-visible:ring-2 group-focus-visible:ring-primary/50 dark:ring-offset-[#18181b]",
                              SWATCH_BACKDROP,
                              selected
                                ? "ring-2 ring-primary"
                                : "ring-1 ring-black/5 group-hover:ring-black/20 dark:ring-white/10 dark:group-hover:ring-white/25"
                            )}
                          >
                            <HookChip style={settings.hookStyle} color={settings.hookColor} motion={motion.value} />
                          </span>
                          <span className={cn("text-[12px] font-medium", selected ? "text-heading" : "text-subtle")}>
                            {motion.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </Field>
                <Field label="On screen">
                  <Segmented<string>
                    label="Hook duration"
                    value={String(settings.hookSeconds)}
                    onChange={(value) => onChange({ hookSeconds: Number(value) })}
                    options={[
                      { value: "2", label: "2s" },
                      { value: "3", label: "3s" },
                      { value: "5", label: "5s" },
                      { value: "8", label: "8s" },
                      { value: "0", label: "Always" },
                    ]}
                  />
                </Field>
              </Row>

              <Row label="Position">
                <PlacementPad
                  what="hook"
                  settings={settings}
                  anchor={anchors.hook}
                  thumbnail={thumbnailUrl}
                  onPlacing={onPlacing}
                  onChange={onChange}
                />
              </Row>
            </>
          )}
        </>
      )}

      {tab === "video" && (
        <>
          <Row label="Format">
            <Segmented<ClipAspect>
              label="Aspect ratio"
              value={settings.aspect}
              onChange={(aspect) => onChange({ aspect })}
              options={[
                { value: "9:16", label: "9:16" },
                { value: "1:1", label: "1:1" },
                { value: "16:9", label: "16:9" },
              ]}
            />
          </Row>

          <Row label="Layout" hint={settings.reframe === "auto" && settings.aspect !== "16:9" ? layoutHint : null}>
            {settings.aspect === "16:9" ? (
              <p className="text-[12px] leading-snug text-subtle">Landscape keeps the whole frame.</p>
            ) : (
              <>
                <Segmented<ClipEditSettings["reframe"]>
                  label="Framing"
                  value={settings.reframe}
                  onChange={(reframe) => onChange({ reframe })}
                  options={[
                    { value: "auto", label: "AI framing" },
                    { value: "manual", label: "Manual crop" },
                  ]}
                />
                {settings.reframe === "auto" ? (
                  <>
                    <Field label="Pick one">
                      <LayoutPicker
                        value={settings.layouts}
                        onChange={(layouts) => onChange({ layouts })}
                        disabled={settings.bottomVideo}
                      />
                      <p className="text-[12px] leading-snug text-subtle">
                        {settings.bottomVideo
                          ? "Off while the bottom video is on: the clip fills the top half."
                          : LAYOUT_NOTES[choiceOf(settings.layouts)]}
                      </p>
                    </Field>
                    <Field label="Camera">
                      <Segmented<CameraMode>
                        label="Camera"
                        value={settings.camera}
                        onChange={(camera) => onChange({ camera })}
                        options={[
                          { value: "smooth", label: "Smooth" },
                          { value: "follow", label: "Follow" },
                        ]}
                      />
                      <p className="text-[12px] leading-snug text-subtle">
                        {settings.camera === "smooth"
                          ? "Holds still and pans like a camera operator. Cuts to whoever is speaking."
                          : "Stays locked on each person as they move. Cuts to whoever is speaking."}
                      </p>
                    </Field>
                  </>
                ) : (
                  <Field label="Position" value={`${Math.round(settings.focusX * 100)}%`}>
                    <Slider
                      label="Horizontal framing"
                      value={settings.focusX}
                      min={0}
                      max={1}
                      step={0.01}
                      onChange={(focusX) => onChange({ focusX })}
                    />
                  </Field>
                )}
              </>
            )}
          </Row>

          {settings.aspect !== "16:9" && (
            <Row
              label="Bottom video"
              action={
                <Switch
                  checked={settings.bottomVideo}
                  onCheckedChange={(bottomVideo) =>
                    onChange({ bottomVideo, ...(bottomVideo ? { captionPosition: "middle" as const } : {}) })
                  }
                  size="sm"
                  label="Bottom video"
                />
              }
            >
              {!settings.bottomVideo ? (
                <p className="text-[12px] leading-snug text-subtle">
                  Your clip on top, gameplay or a satisfying loop below.
                </p>
              ) : (
                <>
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
                    <div className="flex items-center gap-2 rounded-[10px] bg-(--app-fill) py-1.5 pl-3 pr-1.5">
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
                      className="flex h-10 items-center justify-center gap-2 rounded-[10px] border border-dashed border-hairline text-[13px] font-medium text-heading transition-colors hover:bg-(--app-fill)"
                    >
                      <Upload className="h-4 w-4" /> Upload a video
                    </button>
                  )}
                  <p className={cn("text-[12px] leading-snug", backgroundError ? "text-danger" : "text-subtle")}>
                    {backgroundError ??
                      "Plays muted under your clip, on a loop. Without one, a blurred copy fills the space."}
                  </p>
                </>
              )}
            </Row>
          )}
        </>
      )}

      {tab === "captions" && (
        <Row
          label="Captions"
          action={
            <Switch
              checked={captionsOn}
              onCheckedChange={(on) => onChange({ captions: on ? lastCaptions : "off" })}
              size="sm"
              label="Captions"
            />
          }
        >
          {captionsOn ? (
            <>
              {(["Animated", "Classic"] as const).map((group) => (
                <Field key={group} label={group}>
                  <div
                    role="radiogroup"
                    aria-label={`${group} caption styles`}
                    className="grid grid-cols-3 gap-x-2.5 gap-y-3"
                  >
                    {TEMPLATE_SWATCHES.filter((swatch) => swatch.group === group).map((swatch) => {
                      const selected = settings.captions === swatch.value;
                      return (
                        <button
                          key={swatch.value}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          onClick={() => {
                            setLastCaptions(swatch.value);
                            onChange({ captions: swatch.value });
                          }}
                          className="clip-swatch group flex flex-col items-center gap-2 outline-none"
                        >
                          <span
                            className={cn(
                              "flex h-[52px] w-full items-center justify-center overflow-hidden rounded-[12px] px-1 text-[13px] leading-none ring-offset-2 ring-offset-surface transition-shadow group-focus-visible:ring-2 group-focus-visible:ring-primary/50 dark:ring-offset-[#18181b]",
                              SWATCH_BACKDROP,
                              selected
                                ? "ring-2 ring-primary"
                                : "ring-1 ring-black/5 group-hover:ring-black/20 dark:ring-white/10 dark:group-hover:ring-white/25"
                            )}
                          >
                            {swatch.sample}
                          </span>
                          <span className={cn("text-[12px] font-medium", selected ? "text-heading" : "text-subtle")}>
                            {swatch.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </Field>
              ))}
              <Field label="Font">
                <FontPicker
                  label="Caption font"
                  value={settings.captionFont}
                  onChange={(captionFont) => onChange({ captionFont })}
                  withAuto
                />
              </Field>
              <Field label="Size" value={`${Math.round(settings.captionSize * 100)}%`}>
                <Slider
                  label="Caption size"
                  value={settings.captionSize}
                  min={SIZE_MIN}
                  max={SIZE_MAX}
                  step={0.01}
                  onChange={(captionSize) => onChange({ captionSize })}
                />
              </Field>
              <Field label="Words at a time">
                <Segmented<string>
                  label="Words at a time"
                  value={String(settings.captionWords)}
                  onChange={(value) => onChange({ captionWords: Number(value) })}
                  options={[
                    { value: "0", label: "Auto" },
                    { value: "1", label: "One" },
                    { value: "2", label: "Two" },
                    { value: "3", label: "Three" },
                  ]}
                />
              </Field>
              {captionTakesColor(settings.captions) && (
                <Field label="Highlight">
                  <ColorChoice
                    label="Highlight color"
                    autoLabel="Template"
                    value={settings.captionColor}
                    onChange={(captionColor) => onChange({ captionColor })}
                  />
                </Field>
              )}
              <Field label="Position">
                <PlacementPad
                  what="caption"
                  settings={settings}
                  anchor={anchors.caption}
                  thumbnail={thumbnailUrl}
                  onPlacing={onPlacing}
                  onChange={onChange}
                />
              </Field>
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
          ) : (
            <p className="text-[12px] leading-snug text-subtle">No captions on this clip.</p>
          )}
        </Row>
      )}

      {tab === "video" && (
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
      )}
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
  focus,
  placing,
  compact,
  onAnchor,
  onRetry,
  onChange,
}: {
  clip: ClipMoment;
  source: SourceState | undefined;
  track: TrackState | undefined;
  background: string | null;
  settings: ClipEditSettings;
  words: TranscriptWord[];
  thumbnailUrl: string | null;
  /** The one the open settings tab is about: its handle shows whenever the stage is hovered. */
  focus: Movable;
  /** Its position pad is in use: show it (even when not on screen now) and the app's safe zones. */
  placing: Movable | null;
  /** Phones, with the settings sheet open: just the picture, no transport. */
  compact: boolean;
  onAnchor: (what: Movable, anchor: Point | null) => void;
  onRetry: () => void;
  onChange: (patch: Partial<ClipEditSettings>) => void;
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
  const {
    start,
    end,
    captions: template,
    captionWords,
    removePauses,
    aspect,
    layouts,
    reframe,
    bottomVideo,
    camera,
  } = settings;
  const captions = useMemo(
    () => prepareCaptions(words, { start, end, captions: template, captionWords }, clip),
    [words, start, end, template, captionWords, clip]
  );
  const ranges = useMemo(() => keepRanges(words, start, end, removePauses), [words, start, end, removePauses]);
  const outputLength = rangesDuration(ranges);
  const waveform = useWaveform(source?.source);
  const elapsed = useElapsed(source?.startedAt, source?.status === "loading");
  const subject = track?.track;
  const path = useMemo(
    () => (subject ? cameraPath(subject, cropAspectFor({ aspect, bottomVideo }), camera) : null),
    [subject, aspect, bottomVideo, camera]
  );
  const plan = useMemo(
    () => planFor(subject, { aspect, reframe, layouts, camera, bottomVideo }),
    [subject, aspect, reframe, layouts, camera, bottomVideo]
  );
  const [liveLayout, setLiveLayout] = useState<LayoutId | null>(null);

  // Moving the captions and the hook: handles the painter places over them
  // each frame, dragged (or nudged with the arrow keys) to a custom spot.
  const captionHandle = useRef<HTMLDivElement>(null);
  const hookHandle = useRef<HTMLDivElement>(null);
  const placement = useRef<FramePlacement | null>(null);
  const reported = useRef<Record<Movable, Point | null>>({ caption: null, hook: null });
  const hovering = useRef(false);
  /** What's being dragged or resized, read by the painter. */
  const draggingRef = useRef<Movable | null>(null);
  const [dragging, setDragging] = useState<Movable | null>(null);
  const [resizing, setResizing] = useState<Movable | null>(null);
  const [snap, setSnap] = useState({ x: false, y: false });
  const [captionCovered, setCaptionCovered] = useState(false);
  const [hookCovered, setHookCovered] = useState(false);
  // No hover on a touch screen: a paused preview shows what can be moved instead.
  const touch = useMediaQuery("(pointer: coarse)");

  const latest = useRef({ settings, captions, offset, ranges, path, plan, placing, focus, touch, onAnchor });
  const paint = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2 || !video.videoWidth) return;
    painterRef.current ??= createFramePainter(canvas);
    const {
      settings: s,
      captions: c,
      offset: o,
      ranges: r,
      path: p,
      plan: l,
      placing: pl,
      focus: f,
      touch: tt,
      onAnchor: report,
    } = latest.current;
    const bg = backgroundRef.current;
    const t = video.currentTime + o;
    const scene = sceneAt(l, t);
    setLiveLayout(scene?.layout ?? null);
    const paused = video.paused;
    const wants = (what: Movable) =>
      pl === what || draggingRef.current === what || (f === what && (hovering.current || tt) && paused);
    const placed = painterRef.current({
      source: video,
      sourceWidth: video.videoWidth,
      sourceHeight: video.videoHeight,
      settings: s,
      captions: c,
      time: t,
      clipTime: outputTimeAt(r, t),
      center: centerAt(p, t),
      scene,
      background: bg && bg.readyState >= 2 ? { image: bg, width: bg.videoWidth, height: bg.videoHeight } : null,
      // Something to grab between lines and past the hook's time, unless it's playing untouched.
      placingCaption: wants("caption"),
      placingHook: wants("hook"),
    });
    placement.current = placed;
    const frame = (box: CaptionBox | null | undefined): Box | null =>
      box
        ? {
            x: box.x / canvas.width,
            y: box.y / canvas.height,
            width: box.width / canvas.width,
            height: box.height / canvas.height,
          }
        : null;
    const captionBox = frame(placed.caption.box);
    const hookBox = frame(placed.hook?.box);
    placeHandle(captionHandle.current, captionBox);
    placeHandle(hookHandle.current, hookBox);
    const vertical = s.aspect === "9:16";
    setCaptionCovered(Boolean(vertical && captionBox && behindAppUi(captionBox)));
    setHookCovered(Boolean(vertical && hookBox && behindAppUi(hookBox)));
    for (const [what, anchor] of [
      ["caption", placed.caption.anchor],
      ["hook", placed.hook?.anchor ?? null],
    ] as const) {
      const last = reported.current[what];
      const moved =
        anchor && last ? Math.abs(anchor.x - last.x) > 0.001 || Math.abs(anchor.y - last.y) > 0.001 : anchor !== last;
      if (moved) {
        reported.current[what] = anchor;
        report(what, anchor);
      }
    }
  }, []);

  useEffect(() => {
    latest.current = { settings, captions, offset, ranges, path, plan, placing, focus, touch, onAnchor };
    paint();
  }, [settings, captions, offset, ranges, path, plan, placing, focus, touch, onAnchor, paint]);

  const fontKey = fontsFor(settings, words).join();
  useEffect(() => {
    void loadCaptionFonts(fontKey.split(",") as CaptionFont[]).then(paint);
  }, [fontKey, paint]);

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

  /** Where it is now, as fractions of the frame: its custom spot, or where the preset put it. */
  const centerOf = (what: Movable): Point | null =>
    customSpot(settings, what) ??
    (what === "caption" ? placement.current?.caption.anchor : placement.current?.hook?.anchor) ??
    null;

  /** Arrow keys move it; + and - resize it. */
  const onHandleKey = (what: Movable, event: React.KeyboardEvent) => {
    const grow = event.key === "+" || event.key === "=" ? 0.05 : event.key === "-" || event.key === "_" ? -0.05 : 0;
    if (grow) {
      event.preventDefault();
      onChange(resizeTo(what, sizeOf(settings, what) + grow));
      return;
    }
    const step = nudgeFor(event);
    const from = centerOf(what);
    if (!step || !from) return;
    event.preventDefault();
    onChange(moveTo(what, from.x + step.x, from.y + step.y, false).patch);
  };

  /**
   * A corner grip: the size follows the pointer's distance from the box's
   * pivot (pulling any corner away grows it, toward shrinks it), one update
   * per frame.
   */
  const startResize = (what: Movable, event: React.PointerEvent<HTMLElement>) => {
    const placed = what === "caption" ? placement.current?.caption : placement.current?.hook;
    const box = placed?.box;
    const canvas = canvasRef.current;
    if (!placed || !box || !canvas || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const grip = event.currentTarget;
    grip.setPointerCapture(event.pointerId);
    // Measured from the point that stays put (the center, or a Top hook's top edge), so the grip stays under the pointer.
    const rect = canvas.getBoundingClientRect();
    const cx = rect.left + ((box.x + box.width * placed.pivot.x) / canvas.width) * rect.width;
    const cy = rect.top + ((box.y + box.height * placed.pivot.y) / canvas.height) * rect.height;
    const reach = Math.max(12, Math.hypot(event.clientX - cx, event.clientY - cy));
    const from = sizeOf(settings, what);
    draggingRef.current = what;
    setResizing(what);
    let pending: number | null = null;
    let frame = 0;
    const flush = () => {
      frame = 0;
      if (pending !== null) onChange(resizeTo(what, pending));
      pending = null;
    };
    const move = (e: PointerEvent) => {
      pending = (from * Math.hypot(e.clientX - cx, e.clientY - cy)) / reach;
      frame ||= requestAnimationFrame(flush);
    };
    const up = () => {
      grip.removeEventListener("pointermove", move);
      grip.removeEventListener("pointerup", up);
      grip.removeEventListener("pointercancel", up);
      cancelAnimationFrame(frame);
      flush();
      draggingRef.current = null;
      setResizing(null);
      paint();
    };
    grip.addEventListener("pointermove", move);
    grip.addEventListener("pointerup", up);
    grip.addEventListener("pointercancel", up);
  };

  const startDrag = (what: Movable, event: React.PointerEvent<HTMLDivElement>) => {
    const box = what === "caption" ? placement.current?.caption.box : placement.current?.hook?.box;
    const canvas = canvasRef.current;
    if (!box || !canvas || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const handle = event.currentTarget;
    handle.setPointerCapture(event.pointerId);
    handle.focus({ preventScroll: true });
    const rect = canvas.getBoundingClientRect();
    // From where it's drawn (an anchor near an edge draws pushed inside), so it doesn't jump.
    const fromX = (box.x + box.width / 2) / canvas.width;
    const fromY = (box.y + box.height / 2) / canvas.height;
    const { clientX, clientY } = event;
    let moved = false;
    const move = (e: PointerEvent) => {
      const dx = e.clientX - clientX;
      const dy = e.clientY - clientY;
      if (!moved && Math.hypot(dx, dy) < 3) return;
      if (!moved) {
        moved = true;
        draggingRef.current = what;
        setDragging(what);
      }
      const next = moveTo(what, fromX + dx / rect.width, fromY + dy / rect.height, true);
      setSnap({ x: next.snapX, y: next.snapY });
      onChange(next.patch);
    };
    const up = () => {
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", up);
      handle.removeEventListener("pointercancel", up);
      draggingRef.current = null;
      setDragging(null);
      setSnap({ x: false, y: false });
      paint();
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", up);
    handle.addEventListener("pointercancel", up);
  };

  const moving = dragging ?? resizing ?? placing;
  const showZones = settings.aspect === "9:16" && moving !== null;
  const hasHook = settings.hookTitle && Boolean(settings.hookText.trim());
  /** Each handle: always outlined while placed, on stage hover when it's the tab's, else on its own hover. */
  const handleVisibility = (what: Movable) =>
    placing === what || (touch && focus === what && !playing) ? "shown" : focus === what ? "stage" : "self";
  const reframing = usesTracking(settings) && !settings.bottomVideo;
  const clamped = Math.min(end, Math.max(start, time));
  const areaRef = useRef<HTMLDivElement>(null);
  const box = useFitBox(areaRef, size.width / size.height);
  // A small preview (a phone with the settings sheet up) gets a shorter status card.
  const narrow = box !== null && box.width < 240;
  // The stretch of source the timeline shows: the fetched cut, or the clip itself until it arrives.
  const from = Math.min(source?.from ?? start, start);
  const to = Math.max(source?.to ?? end, end);

  const seek = (value: number) => {
    const t = Math.min(end, Math.max(start, value));
    setTime(t);
    if (videoRef.current) videoRef.current.currentTime = Math.max(0, t - offset);
  };
  const trim = (edge: "start" | "end", value: number) => {
    if (edge === "start")
      onChange({
        start: Math.min(end - MIN_CLIP_SECONDS, Math.max(from, value)),
      });
    else
      onChange({
        end: Math.max(start + MIN_CLIP_SECONDS, Math.min(to, value)),
      });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className={cn("relative min-h-0 flex-1", STAGE_BACKDROP)}>
        <div ref={areaRef} className="absolute inset-0 flex items-center justify-center p-3 md:p-8">
          <div
            className="group/stage relative overflow-hidden rounded-[20px] bg-black shadow-[0_0_0_1px_rgba(16,24,40,0.08),0_24px_60px_-24px_rgba(16,24,40,0.5)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_24px_60px_-24px_rgba(0,0,0,0.8)]"
            style={box ? { width: box.width, height: box.height } : { visibility: "hidden" }}
            onPointerEnter={() => {
              hovering.current = true;
              paint();
            }}
            onPointerLeave={() => {
              hovering.current = false;
              paint();
            }}
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
                {background && settings.bottomVideo && (
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
                {/* where the apps' own buttons and text will sit, while placing captions or the hook */}
                <div
                  aria-hidden
                  className={cn(
                    "pointer-events-none absolute inset-0 transition-opacity duration-200",
                    showZones ? "opacity-100" : "opacity-0"
                  )}
                >
                  {APP_UI_ZONES.map((zone, i) => (
                    <span
                      key={i}
                      className={cn("absolute", SAFE_ZONE_FILL)}
                      style={{
                        left: `${zone.x * 100}%`,
                        top: `${zone.y * 100}%`,
                        width: `${zone.w * 100}%`,
                        height: `${zone.h * 100}%`,
                      }}
                    />
                  ))}
                  {!(moving === "caption" ? captionCovered : moving === "hook" && hookCovered) && (
                    <span className="absolute inset-x-0 bottom-[7%] text-center text-[10px] font-semibold uppercase tracking-[0.12em] text-white/70">
                      App buttons
                    </span>
                  )}
                </div>
                {/* center lines, while what's dragged is snapped to them */}
                {dragging && snap.x && (
                  <span className="pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-primary shadow-[0_0_6px_rgba(51,92,255,0.8)]" />
                )}
                {dragging && snap.y && (
                  <span className="pointer-events-none absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-primary shadow-[0_0_6px_rgba(51,92,255,0.8)]" />
                )}
                {settings.captions !== "off" && (
                  <MoveHandle
                    ref={captionHandle}
                    label="Captions"
                    visibility={handleVisibility("caption")}
                    active={dragging === "caption" ? "move" : resizing === "caption" ? "resize" : null}
                    covered={captionCovered}
                    readout={
                      resizing === "caption"
                        ? `${Math.round(settings.captionSize * 100)}%`
                        : `X ${Math.round(settings.captionX * 100)} · Y ${Math.round(settings.captionY * 100)}`
                    }
                    onPointerDown={(event) => startDrag("caption", event)}
                    onResize={(event) => startResize("caption", event)}
                    onResetSize={() => onChange(resizeTo("caption", 1))}
                    onKeyDown={(event) => onHandleKey("caption", event)}
                  />
                )}
                {hasHook && (
                  <MoveHandle
                    ref={hookHandle}
                    label="Hook"
                    visibility={handleVisibility("hook")}
                    active={dragging === "hook" ? "move" : resizing === "hook" ? "resize" : null}
                    covered={hookCovered}
                    readout={
                      resizing === "hook"
                        ? `${Math.round(settings.hookSize * 100)}%`
                        : `X ${Math.round(settings.hookX * 100)} · Y ${Math.round(settings.hookY * 100)}`
                    }
                    onPointerDown={(event) => startDrag("hook", event)}
                    onResize={(event) => startResize("hook", event)}
                    onResetSize={() => onChange(resizeTo("hook", 1))}
                    onKeyDown={(event) => onHandleKey("hook", event)}
                  />
                )}
                {!playing && !moving && (
                  <button
                    type="button"
                    onClick={toggle}
                    aria-label="Play preview"
                    className="absolute left-1/2 top-1/2 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white ring-1 ring-white/20 backdrop-blur-md transition-transform hover:scale-105"
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
                    {track.status === "ready"
                      ? `AI · ${LAYOUTS.find((l) => l.id === (liveLayout ?? "fill"))?.label}`
                      : `Tracking ${Math.round(track.progress * 100)}%`}
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
                <div
                  className={cn(
                    "absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-black/60 text-center text-white backdrop-blur-xl",
                    narrow ? "w-[calc(100%-1.5rem)] p-3" : "w-[min(320px,calc(100%-2.5rem))] p-4"
                  )}
                >
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
                      <p className="mt-2.5 text-[13px] font-medium">
                        {narrow ? "Cutting this clip" : "Cutting this clip from the video"}
                      </p>
                      {/* The server reads the video from the start to reach the clip; show where it is. */}
                      {source && source.from > 20 ? (
                        <>
                          <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/15">
                            <div
                              className="h-full rounded-full bg-white transition-[width] duration-500"
                              style={{
                                width: `${Math.min(100, ((source.reached ?? 0) / source.from) * 100)}%`,
                              }}
                            />
                          </div>
                          <p className="mt-2 font-mono text-[12px] text-white/60">
                            {formatClock(Math.min(source.reached ?? 0, source.from))} of {formatClock(source.from)}
                          </p>
                        </>
                      ) : (
                        <p className="mt-1 font-mono text-[12px] text-white/60">{formatClock(elapsed)}</p>
                      )}
                      {!narrow && (
                        <p className="mt-2 text-[12px] leading-relaxed text-white/60">
                          Clips later in the video take longer to reach.
                        </p>
                      )}
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div
        className={cn(
          "flex items-center gap-3 border-t border-hairline px-3 py-3 sm:gap-4 sm:px-4",
          compact && "max-md:hidden"
        )}
      >
        <button
          type="button"
          onClick={toggle}
          disabled={!ready}
          aria-label={playing ? "Pause" : "Play"}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-heading text-surface outline-none transition-[transform,opacity] active:scale-95 focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-40 dark:bg-white dark:text-[#0B0D12]"
        >
          {playing ? <Pause className="h-4 w-4 fill-current" /> : <Play className="ml-0.5 h-4 w-4 fill-current" />}
        </button>
        <span className="shrink-0 whitespace-nowrap font-mono text-[12px] tabular-nums text-heading">
          {formatClock(outputTimeAt(ranges, clamped))}
          <span className="text-subtle"> / {formatClock(outputLength)}</span>
        </span>
        <Timeline
          from={from}
          to={to}
          start={start}
          end={end}
          time={clamped}
          words={words}
          waveform={waveform}
          kept={removePauses ? ranges : null}
          disabled={!ready}
          onSeek={seek}
          onTrim={trim}
        />
      </div>
    </div>
  );
}

type Box = { x: number; y: number; width: number; height: number };

/** Puts a drag handle over a box (fractions of the frame), or hides it. */
function placeHandle(handle: HTMLDivElement | null, box: Box | null) {
  if (!handle) return;
  handle.style.display = box ? "" : "none";
  if (!box) return;
  handle.style.left = `${box.x * 100}%`;
  handle.style.top = `${box.y * 100}%`;
  handle.style.width = `${box.width * 100}%`;
  handle.style.height = `${box.height * 100}%`;
  // Near the top, its label goes underneath.
  handle.dataset.flip = box.y < 0.1 ? "true" : "false";
}

/** The corner grips: where each sits, and the resize cursor that points along its diagonal. */
const GRIPS = [
  { at: "-left-[5px] -top-[5px]", cursor: "cursor-nwse-resize" },
  { at: "-right-[5px] -top-[5px]", cursor: "cursor-nesw-resize" },
  { at: "-bottom-[5px] -left-[5px]", cursor: "cursor-nesw-resize" },
  { at: "-bottom-[5px] -right-[5px]", cursor: "cursor-nwse-resize" },
];

/**
 * A handle over the captions or the hook on the preview (which places it
 * every frame): drag it to move, drag a corner grip to resize (double-click
 * one for 100%). A dashed outline, a label on hover, the spot or size while
 * held; amber when it sits under the apps' own buttons.
 */
function MoveHandle({
  ref,
  label,
  visibility,
  active,
  covered,
  readout,
  onPointerDown,
  onResize,
  onResetSize,
  onKeyDown,
}: {
  ref: React.Ref<HTMLDivElement>;
  label: string;
  /** Outlined always (its pad is in use), while the stage is hovered, or only while it is. */
  visibility: "shown" | "stage" | "self";
  /** Being moved or resized right now. */
  active: "move" | "resize" | null;
  covered: boolean;
  readout: string;
  onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void;
  onResize: (event: React.PointerEvent<HTMLElement>) => void;
  onResetSize: () => void;
  onKeyDown: (event: React.KeyboardEvent) => void;
}) {
  const held = active !== null;
  return (
    <div
      ref={ref}
      role="button"
      tabIndex={0}
      aria-roledescription="movable"
      aria-label={`${label}. Drag to move, or drag a corner to resize. Arrow keys move it, plus and minus resize it.`}
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
      className={cn(
        "group/handle absolute touch-none rounded-[14px] border outline-none transition-[opacity,border-color,background-color] duration-150 focus-visible:opacity-100",
        held
          ? cn("border-primary bg-primary/[0.08] opacity-100", active === "move" && "cursor-grabbing")
          : cn(
              "cursor-grab border-dashed shadow-[0_0_0_1px_rgba(0,0,0,0.18)] hover:border-solid hover:bg-white/[0.06] hover:opacity-100",
              covered ? "border-amber-300" : "border-white/80",
              visibility === "shown"
                ? "opacity-100"
                : visibility === "stage"
                  ? "opacity-0 group-hover/stage:opacity-100"
                  : "opacity-0"
            )
      )}
    >
      {GRIPS.map((grip) => (
        <span
          key={grip.at}
          aria-hidden
          onPointerDown={onResize}
          onDoubleClick={(event) => {
            event.stopPropagation();
            onResetSize();
          }}
          className={cn(
            // a 9px square with a 25px reach
            "absolute h-[9px] w-[9px] rounded-[2.5px] transition-[transform,background-color] duration-150 before:absolute before:-inset-2 before:content-[''] hover:scale-[1.35] [@media(pointer:coarse)]:before:-inset-4",
            grip.at,
            grip.cursor,
            // cn() doesn't merge classes, so the held and resting looks are kept apart
            held
              ? "bg-primary shadow-[0_0_0_1.5px_#fff]"
              : "bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.3),0_1px_3px_rgba(0,0,0,0.3)] hover:bg-primary hover:shadow-[0_0_0_1.5px_#fff]",
            active === "resize" && "scale-[1.35]"
          )}
        />
      ))}
      <span
        className={cn(
          "pointer-events-none absolute bottom-full left-1/2 mb-2.5 inline-flex h-6 -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-full bg-black/65 px-2.5 text-[11px] font-medium text-white shadow-[0_4px_14px_rgba(0,0,0,0.25)] ring-1 ring-white/10 backdrop-blur-md transition-opacity group-data-[flip=true]/handle:bottom-auto group-data-[flip=true]/handle:top-full group-data-[flip=true]/handle:mb-0 group-data-[flip=true]/handle:mt-2.5",
          held || (visibility === "shown" && covered)
            ? "opacity-100"
            : "opacity-0 group-hover/handle:opacity-100 group-focus-visible/handle:opacity-100"
        )}
      >
        {held ? (
          <>
            {active === "resize" && <Scaling className="h-3 w-3" />}
            <span className="font-mono tabular-nums">{readout}</span>
          </>
        ) : (
          <>
            <Move className="h-3 w-3" /> Move {label.toLowerCase()}
          </>
        )}
        {covered && (
          <span className="inline-flex items-center gap-1 text-amber-200">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-300" /> Under app buttons
          </span>
        )}
      </span>
    </div>
  );
}

/** The largest box of `ratio` (w/h) that fits inside the element, kept up to date. */
function useFitBox(ref: React.RefObject<HTMLDivElement | null>, ratio: number) {
  const [box, setBox] = useState<{ width: number; height: number } | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      const w = Math.max(0, Math.min(width, height * ratio));
      setBox({ width: Math.floor(w), height: Math.floor(w / ratio) });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, ratio]);
  return box;
}

/** The waveform's bars, in CSS pixels. */
const WAVE_BAR = 2;
const WAVE_STEP = 3.5;
const WAVE_MORPH_MS = 420;

/** A stable 0-1 number for a string, so the stand-in wave looks the same every time. */
function hash01(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return ((h >>> 0) % 1000) / 1000;
}

/**
 * Each bar's height (0-1) across from..to: the audio's loudness, or, until
 * it's decoded (or where it can't be), a wave shaped by when the words are said.
 */
function waveLevels(
  count: number,
  from: number,
  to: number,
  waveform: Waveform | null,
  words: TranscriptWord[]
): Float32Array {
  const levels = new Float32Array(count);
  const span = to - from;
  let w = 0;
  for (let i = 0; i < count; i++) {
    const t0 = from + (i / count) * span;
    const t1 = from + ((i + 1) / count) * span;
    let level = 0;
    if (waveform) {
      const a = Math.max(0, Math.floor((t0 - waveform.start) * waveform.rate));
      const b = Math.min(waveform.levels.length, Math.ceil((t1 - waveform.start) * waveform.rate));
      let max = 0;
      let sum = 0;
      for (let k = a; k < b; k++) {
        max = Math.max(max, waveform.levels[k]);
        sum += waveform.levels[k];
      }
      level = b > a ? 0.65 * max + (0.35 * sum) / (b - a) : 0;
    } else {
      const mid = (t0 + t1) / 2;
      while (w < words.length && words[w][1] < t0) w++;
      for (let k = w; k < words.length && words[k][0] <= t1; k++) {
        const [a, b, text] = words[k];
        const p = Math.min(1, Math.max(0, (mid - a) / Math.max(0.05, b - a)));
        const bump = Math.sin(Math.PI * p) ** 0.6 * (0.5 + 0.45 * hash01(text));
        level = Math.max(level, bump * (0.78 + 0.22 * hash01(`${k}:${i}`)));
      }
    }
    // A floor so silence still reads as a line; a curve so quiet speech still shows.
    levels[i] = 0.06 + 0.94 * Math.min(1, level) ** 0.75;
  }
  return levels;
}

/** Paints the bars: dim outside the clip, ink inside, the played part in a brand trail. */
function paintWave(
  canvas: HTMLCanvasElement,
  levels: Float32Array,
  view: { from: number; to: number; start: number; end: number; time: number; kept: [number, number][] | null }
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const dpr = window.devicePixelRatio || 1;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);
  const ink = getComputedStyle(canvas).color;
  const span = Math.max(0.001, view.to - view.from);
  const xOf = (t: number) => ((t - view.from) / span) * width;
  const trail = ctx.createLinearGradient(xOf(view.start), 0, Math.max(xOf(view.start) + 1, xOf(view.time)), 0);
  trail.addColorStop(0, "rgba(51, 92, 255, 0.55)");
  trail.addColorStop(1, "#4F75FF");
  const room = height - 14;
  const mid = height / 2;
  const count = levels.length;
  for (let i = 0; i < count; i++) {
    const x = i * WAVE_STEP + (WAVE_STEP - WAVE_BAR) / 2;
    const t = view.from + ((i + 0.5) / count) * span;
    const inside = t >= view.start && t <= view.end;
    const dropped = inside && view.kept !== null && !view.kept.some(([a, b]) => t >= a && t < b);
    if (inside && !dropped && t <= view.time) {
      ctx.globalAlpha = 1;
      ctx.fillStyle = trail;
    } else {
      ctx.globalAlpha = !inside ? 0.16 : dropped ? 0.22 : 0.6;
      ctx.fillStyle = ink;
    }
    const h = Math.max(2, levels[i] * room);
    ctx.beginPath();
    ctx.roundRect(x, mid - h / 2, WAVE_BAR, h, WAVE_BAR / 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/** The clip's waveform once its cut's audio is decoded; null until then, or if it can't be. */
function useWaveform(source: ClipSource | undefined): Waveform | null {
  const [loaded, setLoaded] = useState<{ blob: Blob; waveform: Waveform | null } | null>(null);
  useEffect(() => {
    if (!source) return;
    let live = true;
    void loadWaveform(source).then((waveform) => {
      if (live) setLoaded({ blob: source.blob, waveform });
    });
    return () => {
      live = false;
    };
  }, [source]);
  return loaded && source && loaded.blob === source.blob ? loaded.waveform : null;
}

/**
 * The clip on its stretch of source: the audio as a waveform (the part
 * played so far in brand blue), the kept part between two trim handles (cut
 * pauses hatched when jump cuts are on), and the playhead. Drag the handles
 * to trim, the track to scrub; hovering shows the word said there.
 */
function Timeline({
  from,
  to,
  start,
  end,
  time,
  words,
  waveform,
  kept,
  disabled,
  onSeek,
  onTrim,
}: {
  from: number;
  to: number;
  start: number;
  end: number;
  time: number;
  words: TranscriptWord[];
  waveform: Waveform | null;
  kept: [number, number][] | null;
  disabled: boolean;
  onSeek: (time: number) => void;
  onTrim: (edge: "start" | "end", time: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState<number | null>(null);
  const span = Math.max(0.001, to - from);
  const pct = (t: number) => ((Math.min(to, Math.max(from, t)) - from) / span) * 100;
  const timeAt = (clientX: number) => {
    const rect = ref.current!.getBoundingClientRect();
    return from + Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)) * span;
  };
  const track = (event: React.PointerEvent<HTMLElement>, apply: (t: number) => void) => {
    if (disabled) return;
    event.preventDefault();
    event.stopPropagation();
    const target = event.currentTarget;
    target.setPointerCapture(event.pointerId);
    apply(timeAt(event.clientX));
    const move = (e: PointerEvent) => apply(timeAt(e.clientX));
    const up = () => {
      target.removeEventListener("pointermove", move);
      target.removeEventListener("pointerup", up);
      target.removeEventListener("pointercancel", up);
    };
    target.addEventListener("pointermove", move);
    target.addEventListener("pointerup", up);
    target.addEventListener("pointercancel", up);
  };
  const visible = useMemo(() => words.filter((w) => w[1] > from && w[0] < to), [words, from, to]);
  const cuts = useMemo(() => {
    if (!kept) return [];
    const gaps: [number, number][] = [];
    let cursor = start;
    for (const [a, b] of kept) {
      if (a - cursor > 0.05) gaps.push([cursor, a]);
      cursor = b;
    }
    if (end - cursor > 0.05) gaps.push([cursor, end]);
    return gaps;
  }, [kept, start, end]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // The bars' heights, morphed to whenever they change (in from flat at first,
  // then from the stand-in to the real audio), sweeping left to right.
  const target = useMemo(
    () => waveLevels(Math.max(0, Math.floor(width / WAVE_STEP)), from, to, waveform, visible),
    [width, from, to, waveform, visible]
  );
  const shown = useRef<Float32Array>(new Float32Array(0));
  const view = useRef({ from, to, start, end, time, kept });
  useEffect(() => {
    view.current = { from, to, start, end, time, kept };
    const canvas = canvasRef.current;
    if (canvas && shown.current.length) paintWave(canvas, shown.current, view.current);
  }, [from, to, start, end, time, kept]);
  // The bars take their ink from the theme, so a theme switch repaints them.
  useEffect(() => {
    const observer = new MutationObserver(() => {
      const canvas = canvasRef.current;
      if (canvas && shown.current.length) paintWave(canvas, shown.current, view.current);
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const before = shown.current.length === target.length ? shown.current : new Float32Array(target.length);
    const began = performance.now();
    let frame = 0;
    const step = (now: number) => {
      const next = new Float32Array(target.length);
      let done = true;
      for (let i = 0; i < target.length; i++) {
        const delay = (i / Math.max(1, target.length)) * 180;
        const p = Math.min(1, Math.max(0, (now - began - delay) / WAVE_MORPH_MS));
        if (p < 1) done = false;
        const eased = 1 - (1 - p) ** 3;
        next[i] = before[i] + (target[i] - before[i]) * eased;
      }
      shown.current = next;
      paintWave(canvas, next, view.current);
      if (!done) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target]);

  const said =
    hover === null
      ? null
      : (visible.find((w) => hover >= w[0] && hover < w[1]) ??
        visible.find((w) => Math.abs(hover - (w[0] + w[1]) / 2) < 0.25) ??
        null);

  const handle = (edge: "start" | "end") => (
    <span
      role="slider"
      tabIndex={disabled ? -1 : 0}
      aria-label={edge === "start" ? "Clip start" : "Clip end"}
      aria-valuemin={edge === "start" ? from : start + MIN_CLIP_SECONDS}
      aria-valuemax={edge === "start" ? end - MIN_CLIP_SECONDS : to}
      aria-valuenow={edge === "start" ? start : end}
      aria-valuetext={formatClock(edge === "start" ? start : end)}
      onPointerDown={(event) => track(event, (t) => onTrim(edge, Math.round(t * 10) / 10))}
      onKeyDown={(event) => {
        const step = event.shiftKey ? 2 : TRIM_STEP;
        const value = edge === "start" ? start : end;
        if (event.key === "ArrowLeft") onTrim(edge, value - step);
        else if (event.key === "ArrowRight") onTrim(edge, value + step);
        else return;
        event.preventDefault();
      }}
      className={cn(
        "absolute inset-y-0 z-10 flex w-3 cursor-ew-resize touch-none items-center justify-center bg-primary outline-none before:absolute before:inset-y-0 before:-inset-x-1.5 before:content-[''] focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 [@media(pointer:coarse)]:before:-inset-x-3.5",
        edge === "start" ? "-left-px rounded-l-[9px]" : "-right-px rounded-r-[9px]"
      )}
    >
      <span className="h-4 w-[2px] rounded-full bg-white/90" />
    </span>
  );

  return (
    <div
      ref={ref}
      onPointerDown={(event) => track(event, onSeek)}
      onPointerMove={(event) => !disabled && setHover(timeAt(event.clientX))}
      onPointerLeave={() => setHover(null)}
      className={cn(
        "relative h-14 min-w-0 flex-1 touch-none rounded-[10px] bg-(--app-fill)",
        disabled ? "opacity-50" : "cursor-pointer"
      )}
    >
      {/* the audio */}
      <canvas
        ref={canvasRef}
        aria-hidden
        className="pointer-events-none absolute inset-0 h-full w-full text-heading dark:text-white"
      />
      {/* pauses the jump cuts drop */}
      {cuts.map(([a, b]) => (
        <span
          key={a}
          className="pointer-events-none absolute inset-y-0 bg-[repeating-linear-gradient(135deg,rgba(51,92,255,0.18)_0_3px,transparent_3px_6px)]"
          style={{ left: `${pct(a)}%`, width: `${pct(b) - pct(a)}%` }}
        />
      ))}
      {/* the kept part, between the handles */}
      <div
        className="absolute inset-y-0 rounded-[10px] border-y-2 border-primary bg-[linear-gradient(180deg,rgba(51,92,255,0.12),rgba(51,92,255,0.03))] shadow-[0_0_22px_-8px_rgba(51,92,255,0.7)]"
        style={{ left: `${pct(start)}%`, width: `${pct(end) - pct(start)}%` }}
      >
        {handle("start")}
        {handle("end")}
      </div>
      {/* where the pointer is, and the word said there */}
      {hover !== null && (
        <span
          className="pointer-events-none absolute inset-y-1 z-20 w-px -translate-x-1/2 bg-heading/40 dark:bg-white/40"
          style={{ left: `${pct(hover)}%` }}
        >
          <span
            className={cn(
              "absolute -top-9 inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-[7px] bg-[#0B0D12] px-2 text-[11px] text-white shadow-[0_6px_16px_-6px_rgba(0,0,0,0.5)] ring-1 ring-white/10",
              // kept inside the track at its ends
              pct(hover) < 12 ? "left-0" : pct(hover) > 88 ? "right-0" : "left-1/2 -translate-x-1/2"
            )}
          >
            <span className="font-mono tabular-nums text-white/60">
              {hover < start ? "-" : ""}
              {formatClock(Math.abs(hover - start))}
            </span>
            {said && <span className="max-w-[140px] truncate font-semibold">{said[2]}</span>}
          </span>
        </span>
      )}
      {/* the playhead */}
      <span
        className="pointer-events-none absolute -bottom-1 -top-1 z-20 w-[2px] -translate-x-1/2 rounded-full bg-heading shadow-[0_0_0_1px_rgba(255,255,255,0.15)] dark:bg-white dark:shadow-[0_0_10px_rgba(255,255,255,0.45)]"
        style={{ left: `${pct(time)}%` }}
      >
        <span className="absolute -top-1 left-1/2 h-2.5 w-2.5 -translate-x-1/2 rounded-full bg-heading dark:bg-white" />
      </span>
    </div>
  );
}
