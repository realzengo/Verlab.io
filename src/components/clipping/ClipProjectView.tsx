"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import useSWR from "swr";
import NumberFlow from "@number-flow/react";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, Loader2, Play } from "lucide-react";
import { PlasticButton } from "@/components/ui/plastic-button";
import { Skeleton } from "@/components/ui/Skeleton";
import { MobileActionBar, ScoreChip, fetchJson } from "@/components/clipping/parts";
import { ClipEditor } from "@/components/clipping/ClipEditor";
import { ClipResults, SavedClips } from "@/components/clipping/ClipResults";
import { useClipWorkspace } from "@/components/clipping/useClipWorkspace";
import { rendersFor } from "@/components/clipping/renderQueue";
import {
  formatClipOffset,
  formatClock,
  isClipProjectWorking,
  type ClipMoment,
  type ClipProject,
  type ClipScoreBreakdown,
} from "@/lib/clips";
import { cn } from "@/lib/utils";

type Step = "choose" | "edit" | "post";

const STEPS: { id: "video" | Step; label: string }[] = [
  { id: "video", label: "Video" },
  { id: "choose", label: "Choose clips" },
  { id: "edit", label: "Edit" },
  { id: "post", label: "Download" },
];

const POLL_MS = 3000;

export function ClipProjectView({ projectId, onBack }: { projectId: string; onBack: () => void }) {
  const { data, error } = useSWR<{ project: ClipProject }>(`/api/clips/${projectId}`, fetchJson, {
    refreshInterval: (latest) => (latest && isClipProjectWorking(latest.project.status) ? POLL_MS : 0),
    revalidateOnFocus: false,
  });
  const project = data?.project;

  if (error && !project) {
    return (
      <div className="flex flex-col items-center gap-4 pt-24 text-center">
        <p className="text-sm text-danger">{error.message}</p>
        <button
          type="button"
          onClick={onBack}
          className="text-sm font-medium text-heading underline underline-offset-4"
        >
          Back to Clipping
        </button>
      </div>
    );
  }
  if (!project) return <ProjectSkeleton />;
  return <ProjectWorkspace key={project.id} project={project} onBack={onBack} />;
}

/* Quiet premium surfaces: a solid fill, a hairline edge and one soft
   shadow; controls inside them sit on the app's neutral fill. */
const SURFACE =
  "border border-hairline bg-surface shadow-[0_1px_2px_rgba(16,24,40,0.04),0_12px_32px_-18px_rgba(16,24,40,0.14)] dark:bg-white/[0.03] dark:shadow-none";
const CHIP = "bg-(--app-fill)";
const LINE = "border-hairline";
const SPLIT = "grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_380px] 2xl:grid-cols-[minmax(0,1fr)_420px]";
const PANEL = cn(
  "relative flex flex-col overflow-hidden rounded-[24px] xl:sticky xl:top-6 xl:max-h-[calc(100dvh-3rem)]",
  SURFACE
);

/** A 16:9 screen. */
function Screen({ children, ref }: { children: ReactNode; ref?: React.Ref<HTMLDivElement> }) {
  return (
    <div
      ref={ref}
      className="relative aspect-video scroll-mt-4 overflow-hidden rounded-[18px] bg-black shadow-[0_12px_32px_-18px_rgba(16,24,40,0.35)] ring-1 ring-black/5 sm:rounded-[22px] dark:ring-white/10"
    >
      {children}
    </div>
  );
}

function ProjectWorkspace({ project, onBack }: { project: ClipProject; onBack: () => void }) {
  // Coming back to a project whose clips this tab rendered (or is still
  // rendering) opens on them; otherwise it starts at Choose.
  const [selected, setSelected] = useState<string[]>(() => {
    const ids = new Set((project.clips ?? []).map((clip) => clip.id));
    return rendersFor(project.id)
      .map((entry) => entry.clip.id)
      .filter((id) => ids.has(id));
  });
  const [step, setStep] = useState<Step>(() => (selected.length ? "post" : "choose"));
  const workspace = useClipWorkspace(project);
  const clips = useMemo(() => project.clips ?? [], [project.clips]);
  const selectedClips = clips.filter((clip) => selected.includes(clip.id));

  // The render queue warns before a tab close would lose a render.
  const hasRenders = Object.values(workspace.renders).some((r) => r.status !== "error");

  const goTo = (target: "video" | Step) => {
    if (target === "video") onBack();
    else if (target === "choose" || selectedClips.length) setStep(target);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const reachable = (id: "video" | Step) =>
    id === "video" ||
    id === "choose" ||
    (selectedClips.length > 0 && project.status === "ready" && (id === "edit" || hasRenders));

  const stepIndex = STEPS.findIndex((s) => s.id === step);

  return (
    <div
      className={cn(
        "relative mx-auto w-full max-w-[1680px] pb-20 pt-1",
        step === "choose" && project.status === "ready" && "max-lg:pb-32"
      )}
    >
      <div className="relative">
        {/* The video, and a segmented control for the steps */}
        <header className="border-b border-hairline pb-4 sm:pb-5">
          <div className="flex items-center gap-3 sm:gap-3.5">
            <BackButton onClick={step === "choose" ? onBack : () => goTo(step === "post" ? "edit" : "choose")} />
            {project.thumbnailUrl && (
              // eslint-disable-next-line @next/next/no-img-element -- remote YouTube thumbnail
              <img
                src={project.thumbnailUrl}
                alt=""
                className="hidden h-12 w-[86px] shrink-0 rounded-[10px] object-cover ring-1 ring-black/5 sm:block dark:ring-white/10"
              />
            )}
            <div className="relative min-w-0 flex-1">
              <p className="truncate text-[15px] font-semibold leading-snug tracking-[-0.01em] text-heading">
                {project.title}
              </p>
              <p className="mt-0.5 truncate text-[13px] text-subtle">
                {project.channelTitle && <>{project.channelTitle} · </>}
                <span className="tabular-nums">{formatClock(project.durationSeconds)}</span>
              </p>
            </div>
            <ol
              aria-label="Steps"
              className="ml-auto hidden shrink-0 items-center rounded-full bg-(--app-fill) p-1 lg:flex"
            >
              {STEPS.map((item, index) => {
                const current = item.id === step;
                const done = index < stepIndex;
                const canGo = !current && reachable(item.id);
                return (
                  <li key={item.id} className="relative">
                    {current && (
                      <motion.span
                        layoutId="clip-step-thumb"
                        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                        className="absolute inset-0 rounded-full bg-surface shadow-[0_1px_2px_rgba(16,24,40,0.1),0_0_0_0.5px_rgba(16,24,40,0.06)] dark:bg-white/[0.12] dark:shadow-none"
                      />
                    )}
                    <button
                      type="button"
                      disabled={!canGo}
                      onClick={() => goTo(item.id)}
                      aria-current={current ? "step" : undefined}
                      className={cn(
                        "relative flex h-8 items-center gap-1.5 rounded-full px-4 text-[13px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/40",
                        current ? "text-heading" : done ? "text-body" : "text-subtle/70",
                        canGo && "hover:text-heading"
                      )}
                    >
                      {done && <Check className="h-3 w-3" strokeWidth={3} />}
                      {item.label}
                    </button>
                  </li>
                );
              })}
            </ol>
          </div>
          <PhoneSteps index={stepIndex} />
        </header>

        <div className="mt-6">
          {project.status === "failed" ? (
            <FailedState project={project} onBack={onBack} />
          ) : project.status !== "ready" ? (
            <ProcessingState project={project} />
          ) : step === "choose" ? (
            <ChooseStep
              project={project}
              clips={clips}
              selected={selected}
              onToggle={(id) =>
                setSelected((current) => (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]))
              }
              onContinue={() => {
                // Start cutting the selected clips while the user looks at the editor.
                for (const clip of selectedClips) workspace.requestSource(clip);
                goTo("edit");
              }}
            />
          ) : step === "edit" ? (
            <ClipEditor
              project={project}
              clips={selectedClips}
              workspace={workspace}
              onBack={() => goTo("choose")}
              onExport={() => {
                workspace.exportClips(selectedClips.map((clip) => clip.id));
                goTo("post");
              }}
            />
          ) : (
            <ClipResults project={project} clips={selectedClips} workspace={workspace} onEdit={() => goTo("edit")} />
          )}
        </div>
      </div>
    </div>
  );
}

/** Phones and tablets: the steps as a segmented progress bar, with the current one named. */
function PhoneSteps({ index }: { index: number }) {
  return (
    <div className="mt-3.5 flex items-center gap-3 lg:hidden">
      <ol aria-label="Steps" className="flex flex-1 gap-1">
        {STEPS.map((item, i) => (
          <li
            key={item.id}
            aria-current={i === index ? "step" : undefined}
            className="h-1 flex-1 overflow-hidden rounded-full bg-(--app-fill-strong)"
          >
            <span
              className={cn(
                "block h-full origin-left rounded-full bg-primary transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
                i <= index ? "scale-x-100" : "scale-x-0"
              )}
            />
            <span className="sr-only">{item.label}</span>
          </li>
        ))}
      </ol>
      <span className="shrink-0 text-[12px] font-medium text-heading">
        {STEPS[index].label}
        <span className="tabular-nums text-subtle">
          {" "}
          · {index + 1}/{STEPS.length}
        </span>
      </span>
    </div>
  );
}

export function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Back"
      className={cn(
        "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-hairline bg-surface text-heading outline-none transition-[transform,background-color] hover:bg-(--app-fill) active:scale-95 focus-visible:ring-2 focus-visible:ring-primary/40 dark:bg-transparent"
      )}
    >
      <ArrowLeft className="h-[18px] w-[18px]" strokeWidth={2} />
    </button>
  );
}

function PanelHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className={cn("flex items-center justify-between gap-3 border-b px-5 py-4", LINE)}>
      <h2 className="text-[17px] font-semibold tracking-[-0.01em] text-heading">{title}</h2>
      {children}
    </div>
  );
}

function ChooseStep({
  project,
  clips,
  selected,
  onToggle,
  onContinue,
}: {
  project: ClipProject;
  clips: ClipMoment[];
  selected: string[];
  onToggle: (id: string) => void;
  onContinue: () => void;
}) {
  const best = useMemo(() => [...clips].sort((a, b) => b.score - a.score)[0], [clips]);
  const [previewId, setPreviewId] = useState(best?.id);
  const [playing, setPlaying] = useState(false);
  const [hint, setHint] = useState(false);
  const screenRef = useRef<HTMLDivElement>(null);
  const preview = clips.find((clip) => clip.id === previewId) ?? best;
  if (!preview) return null;
  const isSelected = selected.includes(preview.id);

  const embed = new URLSearchParams({
    start: String(Math.floor(preview.start)),
    end: String(Math.ceil(preview.end)),
    autoplay: "1",
    rel: "0",
    modestbranding: "1",
    playsinline: "1",
  });

  return (
    <div>
      <div className={SPLIT}>
        <div className="flex min-w-0 flex-col gap-5">
          <Screen ref={screenRef}>
            {playing ? (
              <iframe
                key={preview.id}
                src={`https://www.youtube-nocookie.com/embed/${project.videoId}?${embed}`}
                title={preview.title}
                allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                allowFullScreen
                className="absolute inset-0 h-full w-full"
              />
            ) : (
              <button
                type="button"
                onClick={() => setPlaying(true)}
                aria-label={`Play “${preview.title}”`}
                className="group absolute inset-0"
              >
                {project.thumbnailUrl && (
                  // eslint-disable-next-line @next/next/no-img-element -- remote YouTube thumbnail
                  <img src={project.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                )}
                <span className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-black/25" />
                {/* a frosted play button, like Apple TV's */}
                <span className="absolute left-1/2 top-1/2 flex h-[72px] w-[72px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.4),0_10px_30px_-8px_rgba(0,0,0,0.5)] ring-1 ring-white/30 backdrop-blur-xl transition-colors duration-200 group-hover:bg-white/30">
                  <Play className="ml-1 h-7 w-7 fill-white text-white" strokeWidth={0} />
                </span>
              </button>
            )}
            <ScoreChip score={preview.score} size="md" className="pointer-events-none absolute left-4 top-4" />
          </Screen>

          <section className={cn("relative rounded-[22px] p-4 sm:rounded-[24px] sm:p-6", SURFACE)}>
            <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="font-mono text-[12px] tabular-nums text-subtle">
                  {formatClock(preview.start)} – {formatClock(preview.end)}
                  <span className="text-subtle/60"> · </span>
                  {Math.round(preview.end - preview.start)}s
                </p>
                <h3
                  dir="auto"
                  className="mt-2 text-[19px] font-semibold leading-snug tracking-[-0.02em] text-heading sm:text-[22px]"
                >
                  {preview.title}
                </h3>
                <p className="mt-1.5 max-w-3xl text-[14px] leading-relaxed text-subtle">{preview.reason}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  onToggle(preview.id);
                  setHint(false);
                }}
                aria-pressed={isSelected}
                className={cn(
                  "inline-flex h-11 shrink-0 items-center justify-center gap-1.5 self-stretch rounded-full px-5 text-[14px] font-medium outline-none sm:h-10 sm:self-start transition-[transform,background-color] active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-primary/40",
                  isSelected
                    ? "bg-primary text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2)] hover:bg-primary/90"
                    : "border border-hairline bg-surface text-heading hover:bg-(--app-fill) dark:bg-transparent"
                )}
              >
                {isSelected && <Check className="h-4 w-4" strokeWidth={2.5} />}
                {isSelected ? "Selected" : "Select this clip"}
              </button>
            </div>
            {preview.scores && <ScoreBreakdown scores={preview.scores} />}
          </section>
        </div>

        <aside className={PANEL}>
          <PanelHeader title="Viral clips">
            <span className={cn("inline-flex h-7 items-center gap-1 rounded-full px-3 text-[12px] text-subtle", CHIP)}>
              <NumberFlow value={selected.length} className="font-semibold tabular-nums text-heading" /> of{" "}
              {clips.length} selected
            </span>
          </PanelHeader>
          <ul className="relative min-h-0 flex-1 overflow-y-auto p-2 [scrollbar-width:thin]">
            {clips.map((clip) => {
              const active = clip.id === preview.id;
              const checked = selected.includes(clip.id);
              const top = clip.id === best?.id;
              return (
                <li
                  key={clip.id}
                  className={cn(
                    "flex items-center gap-1 rounded-[18px] pr-3 transition-colors",
                    active ? "bg-(--app-fill)" : "hover:bg-(--app-fill)/60"
                  )}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setPreviewId(clip.id);
                      setPlaying(true);
                      // Stacked (below xl), the player is above the list: bring it back into view.
                      if (window.matchMedia("(max-width: 1279px)").matches) {
                        screenRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                      }
                    }}
                    aria-current={active ? "true" : undefined}
                    aria-label={`Preview “${clip.title}”`}
                    className="flex min-w-0 flex-1 items-center gap-3 rounded-[18px] p-2.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                  >
                    <span
                      className={cn(
                        "flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] text-[15px] font-semibold tabular-nums",
                        top ? "bg-primary text-white" : "bg-(--app-fill-strong) text-heading"
                      )}
                    >
                      {clip.score}
                    </span>
                    <span className="min-w-0">
                      <span
                        dir="auto"
                        className="block truncate text-[14px] font-medium tracking-[-0.005em] text-heading"
                      >
                        {clip.title}
                      </span>
                      <span className="mt-0.5 block text-[12px] tabular-nums text-subtle">
                        {formatClipOffset(clip.start)} · {Math.round(clip.end - clip.start)}s
                      </span>
                    </span>
                  </button>
                  {/* iOS-style selection circle */}
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={checked}
                    aria-label={`Select “${clip.title}”`}
                    onClick={() => {
                      onToggle(clip.id);
                      setHint(false);
                    }}
                    className={cn(
                      "relative flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full outline-none transition-[transform,background-color] before:absolute before:-inset-3 before:content-[''] active:scale-90 focus-visible:ring-2 focus-visible:ring-primary/40",
                      checked
                        ? "bg-primary text-white"
                        : "text-transparent ring-[1.5px] ring-inset ring-black/20 hover:ring-black/40 dark:ring-white/25 dark:hover:ring-white/45",
                      hint && !checked && "ring-primary"
                    )}
                  >
                    <Check className="h-3 w-3" strokeWidth={3.5} />
                  </button>
                </li>
              );
            })}
          </ul>
          <div className={cn("relative border-t p-4 max-lg:hidden", LINE)}>
            <PlasticButton
              className="h-12 w-full rounded-[18px] text-[15px]"
              text={selected.length > 1 ? `Create ${selected.length} videos` : "Create video"}
              trailing={<ArrowRight className="h-4 w-4" strokeWidth={2} />}
              onClick={() => {
                if (!selected.length) setHint(true);
                else onContinue();
              }}
            />
            <p className={cn("mt-2.5 text-center text-[13px]", hint ? "text-danger" : "text-subtle")}>
              {hint ? "Tick at least one clip first" : `${clips.length} moments found`}
            </p>
          </div>
        </aside>
      </div>

      <SavedClips project={project} />

      <MobileActionBar>
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1 text-[15px] font-semibold tracking-[-0.01em] text-heading">
              <NumberFlow value={selected.length} className="tabular-nums" /> selected
            </p>
            <p className={cn("truncate text-[12px]", hint ? "text-danger" : "text-subtle")}>
              {hint ? "Tick at least one clip first" : `of ${clips.length} moments found`}
            </p>
          </div>
          <PlasticButton
            className="h-12 shrink-0 rounded-[16px] px-5 text-[15px]"
            text={selected.length > 1 ? `Create ${selected.length} videos` : "Create video"}
            trailing={<ArrowRight className="h-4 w-4" strokeWidth={2} />}
            onClick={() => {
              if (!selected.length) setHint(true);
              else onContinue();
            }}
          />
        </div>
      </MobileActionBar>
    </div>
  );
}

const SCORE_PARTS: { key: keyof ClipScoreBreakdown; label: string }[] = [
  { key: "hook", label: "Hook" },
  { key: "flow", label: "Flow" },
  { key: "value", label: "Value" },
  { key: "trend", label: "Trend" },
];

/** OpusClip-style virality breakdown: one ruled strip, four columns. */
function ScoreBreakdown({ scores }: { scores: ClipScoreBreakdown }) {
  return (
    <dl className="relative mt-5 grid grid-cols-4 border-t border-hairline pt-4 sm:mt-6 sm:pt-5">
      {SCORE_PARTS.map(({ key, label }, index) => (
        <div key={key} className={cn("min-w-0 px-3 sm:px-5", index === 0 ? "pl-0 sm:pl-0" : "border-l border-hairline")}>
          <dt className="text-[12px] text-subtle">{label}</dt>
          <dd className="mt-1 text-[20px] font-semibold leading-none tabular-nums tracking-[-0.02em] text-heading sm:text-[24px]">
            {scores[key]}
          </dd>
          <div className="mt-3 h-[3px] overflow-hidden rounded-full bg-(--app-fill-strong)">
            <div className="h-full rounded-full bg-heading/80" style={{ width: `${scores[key]}%` }} />
          </div>
        </div>
      ))}
    </dl>
  );
}

export const STAGES = [
  { status: "queued", label: "Fetching the audio", detail: "Pulling the soundtrack from YouTube" },
  { status: "transcribing", label: "Transcribing every word", detail: "Word-level timing for the captions" },
  { status: "finding", label: "Finding the viral moments", detail: "Scoring hook, flow, value and trend" },
] as const;

export function useElapsedSeconds(since: string): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  return Math.max(0, Math.floor((now - new Date(since).getTime()) / 1000));
}

function ProcessingState({ project }: { project: ClipProject }) {
  const elapsed = useElapsedSeconds(project.createdAt);
  const activeIndex = Math.max(
    0,
    STAGES.findIndex((stage) => stage.status === project.status)
  );
  // WhisperX runs at roughly 30x real time, plus fetching and the LLM pass.
  const estimateMinutes = Math.max(1, Math.round((project.durationSeconds / 30 + 75) / 60));

  return (
    <div className={SPLIT}>
      <Screen>
        {project.thumbnailUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- remote YouTube thumbnail
          <img
            src={project.thumbnailUrl}
            alt=""
            className="h-full w-full scale-105 object-cover opacity-70 blur-[2px]"
          />
        )}
        <span className="absolute inset-0 bg-black/25" />
        {/* a glass HUD over the video */}
        <div className="absolute left-1/2 top-1/2 w-[min(340px,calc(100%-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-[22px] bg-black/30 p-4 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_20px_50px_-20px_rgba(0,0,0,0.7)] ring-1 ring-white/15 backdrop-blur-2xl backdrop-saturate-150 sm:p-5">
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 shrink-0 animate-spin text-white/90" />
            <div className="min-w-0">
              <p className="truncate text-[15px] font-semibold tracking-[-0.01em]">{STAGES[activeIndex].label}</p>
              <p className="text-[12px] text-white/60">
                Step {activeIndex + 1} of {STAGES.length} · <span className="tabular-nums">{formatClock(elapsed)}</span>
              </p>
            </div>
          </div>
          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/20">
            <div
              className="h-full rounded-full bg-white transition-[width] duration-700"
              style={{ width: `${((activeIndex + 0.5) / STAGES.length) * 100}%` }}
            />
          </div>
        </div>
      </Screen>

      <aside className={PANEL}>
        <PanelHeader title="Finding your clips">
          <span
            className={cn(
              "inline-flex h-7 items-center rounded-full px-3 text-[12px] font-medium tabular-nums text-heading",
              CHIP
            )}
          >
            {formatClock(elapsed)}
          </span>
        </PanelHeader>
        <ol className="relative flex flex-col gap-5 px-5 py-5" aria-live="polite">
          {STAGES.map((stage, index) => {
            const done = index < activeIndex;
            const active = index === activeIndex;
            return (
              <li key={stage.status} className="flex gap-3">
                <span
                  className={cn(
                    "mt-px flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                    done
                      ? "bg-heading text-surface dark:bg-white dark:text-[#0B0D12]"
                      : active
                        ? "bg-primary text-white"
                        : "border border-hairline text-subtle"
                  )}
                >
                  {done ? (
                    <Check className="h-3.5 w-3.5" strokeWidth={3} />
                  ) : active ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <span className="text-[12px] font-medium">{index + 1}</span>
                  )}
                </span>
                <span className="min-w-0">
                  <span
                    className={cn("block text-[14px] font-medium", done || active ? "text-heading" : "text-subtle")}
                  >
                    {stage.label}
                  </span>
                  <span className="mt-0.5 block text-[13px] text-subtle">{stage.detail}</span>
                </span>
              </li>
            );
          })}
        </ol>
        <div className={cn("relative border-t px-5 py-4 text-[13px] leading-relaxed text-subtle", LINE)}>
          Usually about {estimateMinutes} min for a {Math.round(project.durationSeconds / 60)}-minute video. You can
          leave this page; your clips will be here when you come back.
        </div>
        {/* where the clips will land */}
        <div className={cn("relative flex flex-col gap-1 border-t p-2", LINE)} aria-hidden>
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="flex items-center gap-3 p-2.5">
              <Skeleton className="h-11 w-11 shrink-0 rounded-[14px]" />
              <div className="flex flex-1 flex-col gap-2">
                <Skeleton className="h-3.5 w-4/5 rounded-full" />
                <Skeleton className="h-3 w-16 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}

function FailedState({ project, onBack }: { project: ClipProject; onBack: () => void }) {
  return (
    <div
      className={cn(
        "relative flex min-h-[320px] flex-col items-center justify-center gap-4 rounded-[24px] p-6 text-center sm:min-h-[420px]",
        SURFACE
      )}
    >
      <p className="relative max-w-md text-[15px] text-heading">
        {project.errorMessage ?? "Something went wrong with this video."}
      </p>
      <button
        type="button"
        onClick={onBack}
        className="relative inline-flex h-10 items-center rounded-full border border-hairline px-5 text-[14px] font-medium text-heading transition-colors hover:bg-(--app-fill)"
      >
        Try another video
      </button>
    </div>
  );
}

function ProjectSkeleton() {
  return (
    <div role="status" aria-label="Loading" className="mx-auto w-full max-w-[1680px] pb-20 pt-1">
      <div className="flex items-center gap-3 border-b border-hairline pb-4 sm:gap-3.5 sm:pb-5">
        <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
        <Skeleton className="hidden h-12 w-[86px] shrink-0 rounded-[10px] sm:block" />
        <div className="flex flex-1 flex-col gap-2">
          <Skeleton className="h-4 w-1/2 rounded-full" />
          <Skeleton className="h-3 w-40 rounded-full" />
        </div>
        <Skeleton className="hidden h-10 w-[360px] rounded-full lg:block" />
      </div>
      <div className="mt-3.5 flex items-center gap-3 lg:hidden">
        <Skeleton className="h-1 flex-1 rounded-full" />
        <Skeleton className="h-3 w-28 rounded-full" />
      </div>
      <div className={cn(SPLIT, "mt-6")}>
        <Skeleton className="aspect-video w-full rounded-[18px] sm:rounded-[22px]" />
        <Skeleton className="h-[420px] w-full rounded-[24px]" />
      </div>
    </div>
  );
}
