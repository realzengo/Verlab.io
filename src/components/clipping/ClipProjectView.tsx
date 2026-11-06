"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import NumberFlow from "@number-flow/react";
import { ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react";
import { PlasticButton } from "@/components/ui/plastic-button";
import { Skeleton } from "@/components/ui/Skeleton";
import { BracketFrame, ScorePill, fetchJson } from "@/components/clipping/parts";
import { ClipEditor } from "@/components/clipping/ClipEditor";
import { ClipResults, SavedClips } from "@/components/clipping/ClipResults";
import { useClipWorkspace } from "@/components/clipping/useClipWorkspace";
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
  { id: "choose", label: "Choose the clip" },
  { id: "edit", label: "Edit" },
  { id: "post", label: "Post" },
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

function ProjectWorkspace({ project, onBack }: { project: ClipProject; onBack: () => void }) {
  const [step, setStep] = useState<Step>("choose");
  const [selected, setSelected] = useState<string[]>([]);
  const workspace = useClipWorkspace(project);
  const clips = useMemo(() => project.clips ?? [], [project.clips]);
  const selectedClips = clips.filter((clip) => selected.includes(clip.id));

  // Finished renders live only in this tab; warn before they're lost.
  const hasRenders = Object.values(workspace.renders).some((r) => r.status !== "error");
  useEffect(() => {
    if (!hasRenders) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [hasRenders]);

  const goTo = (target: "video" | Step) => {
    if (target === "video") onBack();
    else if (target === "choose" || selectedClips.length) setStep(target);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const reachable = (id: "video" | Step) =>
    id === "video" ||
    id === "choose" ||
    (selectedClips.length > 0 && project.status === "ready" && (id === "edit" || hasRenders));

  return (
    <div className="mx-auto flex w-full max-w-[1240px] gap-10 pb-20 pt-2 xl:gap-14">
      {/* Step rail */}
      <aside className="hidden w-52 shrink-0 lg:block">
        <div className="sticky top-6 flex min-h-[70vh] flex-col">
          <div className="flex items-center gap-3">
            <BackButton onClick={onBack} />
            <span className="inline-flex h-9 items-center rounded-full bg-(--app-fill-strong) px-4 text-[15px] font-medium text-heading">
              Clip
            </span>
          </div>
          <div className="mt-[22vh]">
            <p className="text-[13px] text-subtle">In a few steps, you will have this:</p>
            <ol className="mt-5 flex flex-col gap-3">
              {STEPS.map((item) => {
                const current = item.id === step;
                const canGo = !current && reachable(item.id);
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      disabled={!canGo}
                      onClick={() => goTo(item.id)}
                      aria-current={current ? "step" : undefined}
                      className={cn(
                        "flex items-center gap-2.5 text-left outline-none transition-colors focus-visible:underline",
                        current
                          ? "text-[24px] font-semibold tracking-[-0.02em] text-heading"
                          : "pl-[18px] text-[18px] font-medium text-heading/25 dark:text-white/25",
                        canGo && "hover:text-heading/60 dark:hover:text-white/60"
                      )}
                    >
                      {current && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-heading" />}
                      {item.label}
                    </button>
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
      </aside>

      <main className="min-w-0 flex-1">
        {/* Phone: back + where you are */}
        <div className="mb-5 flex items-center gap-3 lg:hidden">
          <BackButton onClick={step === "choose" ? onBack : () => goTo(step === "post" ? "edit" : "choose")} />
          <span className="text-[15px] font-semibold text-heading">{STEPS.find((s) => s.id === step)?.label}</span>
          <span className="ml-auto font-mono text-xs text-subtle">
            {STEPS.findIndex((s) => s.id === step) + 1}/{STEPS.length}
          </span>
        </div>

        <header className="flex items-center justify-between gap-6">
          <div className="flex min-w-0 items-center gap-4">
            {project.thumbnailUrl && (
              // eslint-disable-next-line @next/next/no-img-element -- remote YouTube thumbnail
              <img
                src={project.thumbnailUrl}
                alt=""
                className="hidden h-[72px] w-32 shrink-0 rounded-xl object-cover sm:block"
              />
            )}
            <div className="min-w-0">
              <p className="text-[13px] text-subtle">
                Video <span className="font-mono">· {formatClock(project.durationSeconds)}</span>
              </p>
              <p className="mt-0.5 line-clamp-2 text-[15px] font-medium leading-snug text-heading">{project.title}</p>
              {project.channelTitle && (
                <p className="mt-0.5 truncate text-[13px] text-subtle">{project.channelTitle}</p>
              )}
            </div>
          </div>
          {project.status === "ready" && (
            <div className="flex shrink-0 items-center gap-3">
              <NumberFlow
                value={selected.length}
                className="text-[52px] font-semibold leading-none tracking-[-0.05em] text-heading tabular-nums sm:text-[76px]"
              />
              <span className="text-[14px] font-medium leading-tight text-heading sm:text-[17px]">
                selected
                <br />
                clips
              </span>
            </div>
          )}
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
              onExport={() => {
                workspace.exportClips(selectedClips.map((clip) => clip.id));
                goTo("post");
              }}
            />
          ) : (
            <ClipResults project={project} clips={selectedClips} workspace={workspace} onEdit={() => goTo("edit")} />
          )}
        </div>
      </main>
    </div>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Back"
      className="flex h-9 w-9 items-center justify-center rounded-full text-heading outline-none transition-colors hover:bg-(--app-fill) focus-visible:ring-2 focus-visible:ring-primary/40"
    >
      <ArrowLeft className="h-5 w-5" strokeWidth={1.75} />
    </button>
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
      {/* Sized by the window's height on desktop so the clip strip stays in view. */}
      <div className="mx-auto w-full lg:max-w-[max(560px,calc((100dvh-400px)*16/9))]">
        <BracketFrame>
          <div className="relative aspect-video overflow-hidden rounded-2xl bg-black">
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
                <span className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/30" />
                <span className="absolute left-1/2 top-1/2 flex h-14 w-20 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-2xl bg-[#FF0033] shadow-lg transition-transform duration-300 group-hover:scale-105">
                  <span className="ml-1 h-0 w-0 border-y-[11px] border-l-[18px] border-y-transparent border-l-white" />
                </span>
              </button>
            )}
            <ScorePill score={preview.score} className="pointer-events-none absolute left-4 top-4" />
          </div>
        </BracketFrame>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="font-mono text-[13px] text-subtle">
              {formatClock(preview.start)} – {formatClock(preview.end)} · {Math.round(preview.end - preview.start)}s
            </p>
            <h3 className="mt-1 text-[17px] font-semibold leading-snug text-heading">{preview.title}</h3>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-subtle">{preview.reason}</p>
            {preview.scores && <ScoreBreakdown scores={preview.scores} />}
          </div>
          <button
            type="button"
            onClick={() => {
              onToggle(preview.id);
              setHint(false);
            }}
            aria-pressed={isSelected}
            className={cn(
              "inline-flex h-9 shrink-0 items-center gap-1.5 self-start rounded-full border px-4 text-[13px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/40",
              isSelected
                ? "border-transparent bg-primary text-white"
                : "border-hairline text-heading hover:bg-(--app-fill)"
            )}
          >
            {isSelected && <Check className="h-3.5 w-3.5" strokeWidth={2.5} />}
            {isSelected ? "Selected" : "Select this clip"}
          </button>
        </div>
      </div>

      <h4 className="mt-10 text-[17px] font-semibold text-heading">Viral clips detected :</h4>
      <div className="mt-4 flex flex-col gap-5 xl:flex-row xl:items-start">
        <div className="-mx-1 flex min-w-0 flex-1 gap-4 overflow-x-auto px-1 pb-2 [scrollbar-width:thin]">
          {clips.map((clip) => {
            const active = clip.id === preview.id;
            const checked = selected.includes(clip.id);
            return (
              <div key={clip.id} className="relative w-40 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setPreviewId(clip.id);
                    setPlaying(true);
                  }}
                  aria-label={`Preview “${clip.title}”`}
                  className={cn(
                    "relative block aspect-video w-full overflow-hidden rounded-xl outline-none ring-2 ring-offset-2 ring-offset-app transition-shadow focus-visible:ring-primary/60",
                    active ? "ring-heading dark:ring-white" : "ring-transparent"
                  )}
                >
                  {project.thumbnailUrl && (
                    // eslint-disable-next-line @next/next/no-img-element -- remote YouTube thumbnail
                    <img src={project.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                  )}
                  <span className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-transparent" />
                  <span className="absolute right-2 top-1 text-[22px] font-bold tabular-nums text-white [text-shadow:0_1px_8px_rgba(0,0,0,0.55)]">
                    {clip.score}
                  </span>
                  {checked && <span className="absolute inset-0 bg-primary/20" />}
                </button>
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
                    "absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded-full border-2 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-white",
                    checked
                      ? "border-primary bg-primary text-white"
                      : "border-white/90 bg-black/25 text-transparent hover:bg-black/40",
                    hint && !checked && "animate-pulse border-primary"
                  )}
                >
                  <Check className="h-3.5 w-3.5" strokeWidth={3} />
                </button>
                <p className="mt-2 text-center font-mono text-[13px] text-heading">{formatClipOffset(clip.start)}</p>
              </div>
            );
          })}
        </div>
        <div className="flex shrink-0 flex-col items-stretch gap-2 xl:items-end">
          <PlasticButton
            className="h-14 rounded-[20px] px-8 text-[17px]"
            text={selected.length > 1 ? `Create ${selected.length} videos` : "Create video"}
            trailing={<ArrowRight className="h-5 w-5" strokeWidth={2} />}
            onClick={() => {
              if (!selected.length) setHint(true);
              else onContinue();
            }}
          />
          <p className={cn("text-center text-[13px] xl:text-right", hint ? "text-danger" : "text-subtle")}>
            {hint ? "Tick at least one clip first" : `${clips.length} moments found`}
          </p>
        </div>
      </div>

      <SavedClips project={project} />
    </div>
  );
}

const SCORE_PARTS: { key: keyof ClipScoreBreakdown; label: string }[] = [
  { key: "hook", label: "Hook" },
  { key: "flow", label: "Flow" },
  { key: "value", label: "Value" },
  { key: "trend", label: "Trend" },
];

/** OpusClip-style virality breakdown: four labelled bars, one accent. */
function ScoreBreakdown({ scores }: { scores: ClipScoreBreakdown }) {
  return (
    <dl className="mt-4 grid max-w-xl grid-cols-2 gap-x-6 gap-y-2.5 sm:grid-cols-4">
      {SCORE_PARTS.map(({ key, label }) => (
        <div key={key} className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between">
            <dt className="text-[12px] text-subtle">{label}</dt>
            <dd className="font-mono text-[12px] font-medium tabular-nums text-heading">{scores[key]}</dd>
          </div>
          <div className="h-1 overflow-hidden rounded-full bg-(--app-fill-strong)">
            <div className="h-full rounded-full bg-primary" style={{ width: `${scores[key]}%` }} />
          </div>
        </div>
      ))}
    </dl>
  );
}

const STAGES = [
  { status: "queued", label: "Fetching the audio" },
  { status: "transcribing", label: "Transcribing every word" },
  { status: "finding", label: "Finding the viral moments" },
] as const;

function useElapsedSeconds(since: string): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  return Math.max(0, Math.floor((now - new Date(since).getTime()) / 1000));
}

function ProcessingState({ project }: { project: ClipProject }) {
  const elapsed = useElapsedSeconds(project.createdAt);
  const activeIndex = STAGES.findIndex((stage) => stage.status === project.status);
  // WhisperX runs at roughly 30x real time, plus fetching and the LLM pass.
  const estimateMinutes = Math.max(1, Math.round((project.durationSeconds / 30 + 75) / 60));

  return (
    <div>
      <BracketFrame>
        <div className="relative aspect-video overflow-hidden rounded-2xl bg-black">
          {project.thumbnailUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- remote YouTube thumbnail
            <img
              src={project.thumbnailUrl}
              alt=""
              className="h-full w-full scale-105 object-cover opacity-40 blur-[3px]"
            />
          )}
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="w-full max-w-sm rounded-2xl bg-black/60 p-5 text-white shadow-2xl ring-1 ring-white/10 backdrop-blur-xl sm:p-6">
              <ol className="flex flex-col gap-3.5" aria-live="polite">
                {STAGES.map((stage, index) => {
                  const done = index < activeIndex;
                  const active = index === activeIndex;
                  return (
                    <li
                      key={stage.status}
                      className={cn("flex items-center gap-3 text-[15px]", !done && !active && "text-white/40")}
                    >
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                        {done ? (
                          <Check className="h-4 w-4 text-white" strokeWidth={2.5} />
                        ) : active ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <span className="h-1.5 w-1.5 rounded-full bg-white/40" />
                        )}
                      </span>
                      <span className={cn(active && "font-medium")}>{stage.label}</span>
                    </li>
                  );
                })}
              </ol>
              <div className="mt-5 border-t border-white/10 pt-4 text-[13px] leading-relaxed text-white/60">
                <p>
                  <span className="font-mono text-white/80">{formatClock(elapsed)}</span> · usually about{" "}
                  {estimateMinutes} min for a {Math.round(project.durationSeconds / 60)}-minute video
                </p>
                <p className="mt-1">You can leave this page. Your clips will be here when you come back.</p>
              </div>
            </div>
          </div>
        </div>
      </BracketFrame>

      <h4 className="mt-10 text-[17px] font-semibold text-heading">Viral clips detected :</h4>
      <div className="mt-4 flex gap-4 overflow-hidden">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="w-40 shrink-0">
            <Skeleton className="aspect-video w-full rounded-xl" />
            <Skeleton className="mx-auto mt-2.5 h-3 w-12 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

function FailedState({ project, onBack }: { project: ClipProject; onBack: () => void }) {
  return (
    <BracketFrame>
      <div className="flex aspect-video flex-col items-center justify-center gap-4 rounded-2xl bg-(--app-fill) p-6 text-center">
        <p className="max-w-md text-[15px] text-heading">
          {project.errorMessage ?? "Something went wrong with this video."}
        </p>
        <button
          type="button"
          onClick={onBack}
          className="inline-flex h-9 items-center rounded-full border border-hairline px-4 text-[13px] font-medium text-heading transition-colors hover:bg-(--app-fill-strong)"
        >
          Try another video
        </button>
      </div>
    </BracketFrame>
  );
}

function ProjectSkeleton() {
  return (
    <div role="status" aria-label="Loading" className="mx-auto flex w-full max-w-[1240px] gap-10 pb-20 pt-2 xl:gap-14">
      <div className="hidden w-52 shrink-0 lg:block">
        <Skeleton className="h-9 w-28 rounded-full" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-4">
          <Skeleton className="h-[72px] w-32 rounded-xl" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-3 w-24 rounded-full" />
            <Skeleton className="h-4 w-2/3 rounded-full" />
          </div>
        </div>
        <Skeleton className="mt-8 aspect-video w-full rounded-2xl" />
      </div>
    </div>
  );
}
