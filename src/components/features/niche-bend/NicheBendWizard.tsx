"use client";

import { useEffect, useReducer, useRef } from "react";
import {
  analyzeChannel,
  generateSop,
  pollStatus,
  pollStatusUntilSettled,
  regenerateCandidate,
  setBendSaved,
} from "@/lib/api/niche-bend";
import { detectPlatform } from "@/lib/niche-bend/platform";
import { clearPersistedWizardRef, readPersistedWizardRef, writePersistedWizardRef } from "@/lib/niche-bend/storage";
import type {
  NicheBendCandidate,
  NicheBendChannelAnalysis,
  NicheBendHistoryItem,
  NicheBendJobStatus,
  NicheBendJobStatusResponse,
  NicheBendPlatform,
  NicheBendSopResult,
  NicheBendVideo,
  NicheBendVideoType,
} from "@/lib/types";
import { BendHistory } from "./BendHistory";
import { Stepper } from "./Stepper";
import { StepAnalyze, type AnalyzeState } from "./StepAnalyze";
import { StepChooseBend } from "./StepChooseBend";
import { StepSop } from "./StepSop";

interface WizardState {
  step: 1 | 2 | 3;
  jobId: string | null;
  sourceUrl: string;
  platform: NicheBendPlatform | null;
  videoType: NicheBendVideoType;
  analyzeState: AnalyzeState;
  status: NicheBendJobStatus | null;
  errorMessage: string | null;
  analysis: NicheBendChannelAnalysis | null;
  candidates: NicheBendCandidate[] | null;
  candidatesRegenerating: boolean;
  regeneratingCandidateId: 1 | 2 | 3 | null;
  savedCandidateIds: (1 | 2 | 3)[];
  selectedCandidateId: 1 | 2 | 3 | null;
  sopSubmitting: boolean;
  sopError: string | null;
  sop: NicheBendSopResult | null;
  saved: boolean;
  savingToggle: boolean;
  manualSubmitting: boolean;
}

type WizardAction =
  | { type: "SET_URL"; url: string }
  | { type: "SET_VIDEO_TYPE"; videoType: NicheBendVideoType }
  | { type: "SUBMIT_ANALYZE_START" }
  | { type: "JOB_CREATED"; jobId: string }
  | { type: "ANALYZE_REQUEST_FAILED"; message: string }
  | { type: "STATUS_UPDATE"; status: NicheBendJobStatusResponse }
  | { type: "SHOW_MANUAL_FALLBACK" }
  | { type: "MANUAL_SUBMIT_START" }
  | { type: "SELECT_CANDIDATE"; id: 1 | 2 | 3 }
  | { type: "TOGGLE_SAVED"; id: 1 | 2 | 3 }
  | { type: "REGEN_START" }
  | { type: "REGEN_JOB_CREATED"; jobId: string }
  | { type: "REGEN_STATUS_UPDATE"; status: NicheBendJobStatusResponse }
  | { type: "REGEN_ONE_START"; id: 1 | 2 | 3 }
  | { type: "REGEN_ONE_DONE"; candidates: NicheBendCandidate[] }
  | { type: "REGEN_ONE_FAILED" }
  | { type: "SOP_SUBMIT_START" }
  | { type: "SOP_READY"; status: NicheBendJobStatusResponse }
  | { type: "SOP_POLL_UPDATE"; status: NicheBendJobStatusResponse }
  | { type: "SOP_SUBMIT_FAILED"; message: string }
  | { type: "SAVE_TOGGLE_START" }
  | { type: "SAVE_TOGGLE_DONE"; saved: boolean }
  | { type: "SAVE_TOGGLE_FAILED" }
  | { type: "RESET" }
  | {
      type: "HYDRATE";
      status: NicheBendJobStatusResponse;
      selectedCandidateId: 1 | 2 | 3 | null;
      sourceUrl?: string;
      platform?: NicheBendPlatform;
    }
  | { type: "GO_TO_STEP"; step: 1 | 2 | 3 };

const INITIAL_STATE: WizardState = {
  step: 1,
  jobId: null,
  sourceUrl: "",
  platform: null,
  videoType: "long-form",
  analyzeState: "idle",
  status: null,
  errorMessage: null,
  analysis: null,
  candidates: null,
  candidatesRegenerating: false,
  regeneratingCandidateId: null,
  savedCandidateIds: [],
  selectedCandidateId: null,
  sopSubmitting: false,
  sopError: null,
  sop: null,
  saved: false,
  savingToggle: false,
  manualSubmitting: false,
};

const IN_PROGRESS_STATUSES: NicheBendJobStatus[] = [
  "opening_channel",
  "reading_videos",
  "identifying_format",
  "generating_bends",
  "generating_sop",
];

function reducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case "SET_URL":
      return { ...state, sourceUrl: action.url, platform: detectPlatform(action.url) };

    case "SET_VIDEO_TYPE":
      return { ...state, videoType: action.videoType };

    case "SUBMIT_ANALYZE_START":
      return { ...state, analyzeState: "submitting", errorMessage: null };

    case "JOB_CREATED":
      return { ...state, jobId: action.jobId, analyzeState: "polling", status: null, manualSubmitting: false };

    case "ANALYZE_REQUEST_FAILED":
      return { ...state, analyzeState: "error", errorMessage: action.message, manualSubmitting: false };

    case "STATUS_UPDATE": {
      const s = action.status;
      if (s.status === "failed") {
        return {
          ...state,
          analyzeState: "error",
          status: s.status,
          errorMessage: s.error?.message ?? "Something went wrong.",
        };
      }
      if (s.status === "ready" || s.status === "sop_ready") {
        return {
          ...state,
          step: s.status === "sop_ready" ? 3 : 2,
          analyzeState: "idle",
          status: s.status,
          analysis: s.analysis ?? state.analysis,
          candidates: s.candidates ?? state.candidates,
          sop: s.sop ?? state.sop,
          saved: s.saved,
          sopSubmitting: false,
          // "ready" carrying an error means a resumed background SOP
          // generation (see startSopGeneration) reverted here after failing.
          sopError: s.status === "ready" ? (s.error?.message ?? null) : state.sopError,
        };
      }
      return { ...state, status: s.status };
    }

    case "SHOW_MANUAL_FALLBACK":
      return { ...state, analyzeState: "manual-fallback", errorMessage: null };

    case "MANUAL_SUBMIT_START":
      return { ...state, manualSubmitting: true };

    case "SELECT_CANDIDATE":
      return { ...state, selectedCandidateId: action.id, sopError: null };

    case "TOGGLE_SAVED": {
      const isSaved = state.savedCandidateIds.includes(action.id);
      return {
        ...state,
        savedCandidateIds: isSaved
          ? state.savedCandidateIds.filter((id) => id !== action.id)
          : [...state.savedCandidateIds, action.id],
      };
    }

    case "REGEN_START":
      return { ...state, candidatesRegenerating: true, selectedCandidateId: null };

    case "REGEN_JOB_CREATED":
      return { ...state, jobId: action.jobId };

    case "REGEN_STATUS_UPDATE": {
      const s = action.status;
      if (s.status === "ready" || s.status === "sop_ready") {
        return { ...state, candidates: s.candidates ?? state.candidates, candidatesRegenerating: false };
      }
      return state;
    }

    case "REGEN_ONE_START":
      return {
        ...state,
        regeneratingCandidateId: action.id,
        selectedCandidateId: state.selectedCandidateId === action.id ? null : state.selectedCandidateId,
        savedCandidateIds: state.savedCandidateIds.filter((id) => id !== action.id),
      };

    case "REGEN_ONE_DONE":
      return { ...state, candidates: action.candidates, regeneratingCandidateId: null };

    case "REGEN_ONE_FAILED":
      return { ...state, regeneratingCandidateId: null };

    case "SOP_SUBMIT_START":
      return { ...state, sopSubmitting: true, sopError: null };

    case "SOP_READY":
      return { ...state, sop: action.status.sop ?? state.sop, saved: action.status.saved, step: 3, sopSubmitting: false };

    case "SOP_POLL_UPDATE": {
      const s = action.status;
      if (s.status === "sop_ready") {
        return { ...state, sop: s.sop ?? state.sop, saved: s.saved, step: 3, sopSubmitting: false };
      }
      if (s.status === "generating_sop") {
        return state;
      }
      // Anything else (background generation reverted the job to "ready"
      // after a failure) means the SOP attempt itself failed.
      return {
        ...state,
        sopSubmitting: false,
        sopError: s.error?.message ?? "Could not generate the SOP.",
      };
    }

    case "SOP_SUBMIT_FAILED":
      return { ...state, sopSubmitting: false, sopError: action.message };

    case "SAVE_TOGGLE_START":
      return { ...state, savingToggle: true };

    case "SAVE_TOGGLE_DONE":
      return { ...state, saved: action.saved, savingToggle: false };

    case "SAVE_TOGGLE_FAILED":
      return { ...state, savingToggle: false };

    case "GO_TO_STEP":
      if (action.step >= state.step) return state;
      return { ...state, step: action.step };

    case "RESET":
      return { ...INITIAL_STATE };

    case "HYDRATE": {
      const s = action.status;
      let step: 1 | 2 | 3 = 1;
      let analyzeState: AnalyzeState = "polling";
      let sopSubmitting = false;
      if (s.status === "sop_ready") {
        step = 3;
        analyzeState = "idle";
      } else if (s.status === "generating_sop") {
        step = 2;
        analyzeState = "idle";
        sopSubmitting = true;
      } else if (s.status === "ready") {
        step = 2;
        analyzeState = "idle";
      } else if (s.status === "failed") {
        step = 1;
        analyzeState = "error";
      }
      return {
        ...state,
        jobId: s.jobId,
        step,
        analyzeState,
        status: s.status,
        errorMessage: s.error?.message ?? null,
        analysis: s.analysis ?? null,
        candidates: s.candidates ?? null,
        sop: s.sop ?? null,
        saved: s.saved,
        sopSubmitting,
        selectedCandidateId: action.selectedCandidateId,
        sourceUrl: action.sourceUrl ?? state.sourceUrl,
        platform: action.platform ?? state.platform,
      };
    }

    default:
      return state;
  }
}

// Module-scoped, so it resets on a hard page load/refresh but survives the
// wizard unmounting and remounting from client-side navigation within the
// same session (e.g. visiting another page and coming back).
let hasHydratedThisPageLoad = false;

export function NicheBendWizard() {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);
  const cancelPollRef = useRef<(() => void) | null>(null);

  const stopPolling = () => {
    cancelPollRef.current?.();
    cancelPollRef.current = null;
  };

  // Resume an in-flight or completed job after a refresh — but not when the
  // wizard is simply being revisited after navigating to another page in the
  // same session, where we want to start fresh at the "paste link" step.
  useEffect(() => {
    if (hasHydratedThisPageLoad) return;
    hasHydratedThisPageLoad = true;

    const ref = readPersistedWizardRef();
    if (!ref) return;

    let cancelled = false;

    pollStatus(ref.jobId)
      .then((status) => {
        if (cancelled) return;
        dispatch({ type: "HYDRATE", status, selectedCandidateId: ref.selectedCandidateId });
        if (IN_PROGRESS_STATUSES.includes(status.status)) {
          stopPolling();
          cancelPollRef.current = pollStatusUntilSettled(ref.jobId, (update) => {
            dispatch({ type: "STATUS_UPDATE", status: update });
          });
        }
      })
      .catch(() => {
        clearPersistedWizardRef();
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => stopPolling, []);

  useEffect(() => {
    if (!state.jobId) return;
    writePersistedWizardRef({ jobId: state.jobId, selectedCandidateId: state.selectedCandidateId });
  }, [state.jobId, state.selectedCandidateId]);

  // Steps 2 and 3 can be reached after scrolling down on the previous step
  // (e.g. clicking the sticky "Generate my SOP" CTA below the fold) — reset
  // to the top so the new step's heading isn't hidden under the sticky Stepper.
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [state.step]);

  const startAnalyze = async (manualVideos?: NicheBendVideo[]) => {
    if (!manualVideos && !state.platform) return;

    if (manualVideos) {
      dispatch({ type: "MANUAL_SUBMIT_START" });
    } else {
      dispatch({ type: "SUBMIT_ANALYZE_START" });
    }

    try {
      const { jobId } = await analyzeChannel({
        url: state.sourceUrl || undefined,
        platform: state.platform ?? "youtube",
        videoType: state.videoType,
        manualVideos,
      });
      dispatch({ type: "JOB_CREATED", jobId });
      stopPolling();
      cancelPollRef.current = pollStatusUntilSettled(jobId, (update) => {
        dispatch({ type: "STATUS_UPDATE", status: update });
      });
    } catch (error) {
      dispatch({
        type: "ANALYZE_REQUEST_FAILED",
        message: error instanceof Error ? error.message : "Could not start the analysis.",
      });
    }
  };

  const handleRegenerate = async () => {
    if (!state.platform) return;
    dispatch({ type: "REGEN_START" });

    try {
      const { jobId } = await analyzeChannel({
        url: state.sourceUrl || undefined,
        platform: state.platform,
        videoType: state.videoType,
      });
      dispatch({ type: "REGEN_JOB_CREATED", jobId });
      stopPolling();
      cancelPollRef.current = pollStatusUntilSettled(jobId, (update) => {
        dispatch({ type: "REGEN_STATUS_UPDATE", status: update });
      });
    } catch {
      dispatch({
        type: "REGEN_STATUS_UPDATE",
        status: { jobId: state.jobId ?? "", status: "failed", statusText: "", progress: 0, saved: state.saved },
      });
    }
  };

  const handleRegenerateOne = async (id: 1 | 2 | 3) => {
    if (!state.jobId) return;
    dispatch({ type: "REGEN_ONE_START", id });

    try {
      const status = await regenerateCandidate({ jobId: state.jobId, candidateId: id });
      dispatch({ type: "REGEN_ONE_DONE", candidates: status.candidates ?? state.candidates ?? [] });
    } catch {
      dispatch({ type: "REGEN_ONE_FAILED" });
    }
  };

  const handleGenerateSop = async (candidateId?: 1 | 2 | 3) => {
    const id = candidateId ?? state.selectedCandidateId;
    if (!state.jobId || id === null) return;
    if (candidateId !== undefined) dispatch({ type: "SELECT_CANDIDATE", id: candidateId });
    dispatch({ type: "SOP_SUBMIT_START" });

    try {
      const status = await generateSop({ jobId: state.jobId, chosenBend: id });
      if (status.status === "sop_ready") {
        dispatch({ type: "SOP_READY", status });
        return;
      }
      // Generation was kicked off and is continuing server-side (see
      // startSopGeneration) — poll until it lands on "sop_ready" or reverts
      // to "ready" with an error, rather than holding one long request open.
      stopPolling();
      cancelPollRef.current = pollStatusUntilSettled(state.jobId, (update) => {
        dispatch({ type: "SOP_POLL_UPDATE", status: update });
      });
    } catch (error) {
      dispatch({
        type: "SOP_SUBMIT_FAILED",
        message: error instanceof Error ? error.message : "Could not generate the SOP.",
      });
    }
  };

  const handleToggleSaved = async () => {
    if (!state.jobId) return;
    const nextSaved = !state.saved;
    dispatch({ type: "SAVE_TOGGLE_START" });
    try {
      const status = await setBendSaved(state.jobId, nextSaved);
      dispatch({ type: "SAVE_TOGGLE_DONE", saved: status.saved });
    } catch {
      dispatch({ type: "SAVE_TOGGLE_FAILED" });
    }
  };

  const handleReset = () => {
    stopPolling();
    clearPersistedWizardRef();
    dispatch({ type: "RESET" });
  };

  const handleResumeFromHistory = async (item: NicheBendHistoryItem) => {
    stopPolling();
    try {
      const status = await pollStatus(item.jobId);
      dispatch({
        type: "HYDRATE",
        status,
        selectedCandidateId: null,
        sourceUrl: item.sourceUrl,
        platform: item.platform,
      });
      if (IN_PROGRESS_STATUSES.includes(status.status)) {
        cancelPollRef.current = pollStatusUntilSettled(item.jobId, (update) => {
          dispatch({ type: "STATUS_UPDATE", status: update });
        });
      }
    } catch {
      // Job may have been deleted or is no longer reachable — leave the
      // wizard where it is rather than surfacing a disruptive error.
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <Stepper currentStep={state.step} onStepClick={(step) => dispatch({ type: "GO_TO_STEP", step })} />

      {state.step === 1 && (
        <StepAnalyze
          sourceUrl={state.sourceUrl}
          onUrlChange={(url) => dispatch({ type: "SET_URL", url })}
          platform={state.platform}
          videoType={state.videoType}
          onVideoTypeChange={(videoType) => dispatch({ type: "SET_VIDEO_TYPE", videoType })}
          analyzeState={state.analyzeState}
          errorMessage={state.errorMessage}
          onSubmit={() => startAnalyze()}
          onRetry={() => startAnalyze()}
          onShowManualFallback={() => dispatch({ type: "SHOW_MANUAL_FALLBACK" })}
          onManualSubmit={(videos) => startAnalyze(videos)}
          manualSubmitting={state.manualSubmitting}
        />
      )}

      {state.step === 1 && (state.analyzeState === "idle" || state.analyzeState === "error") && (
        <div
          className="animate-bend-in mx-auto flex w-full max-w-5xl flex-col gap-12 border-t border-hairline pt-10"
          style={{ animationDelay: "100ms" }}
        >
          <BendHistory onResume={handleResumeFromHistory} />
        </div>
      )}

      {state.step === 2 && state.analysis && (
        <StepChooseBend
          analysis={state.analysis}
          candidates={state.candidates}
          candidatesRegenerating={state.candidatesRegenerating}
          regeneratingCandidateId={state.regeneratingCandidateId}
          savedCandidateIds={state.savedCandidateIds}
          selectedCandidateId={state.selectedCandidateId}
          onSelect={(id) => dispatch({ type: "SELECT_CANDIDATE", id })}
          onToggleSaved={(id) => dispatch({ type: "TOGGLE_SAVED", id })}
          onRegenerate={handleRegenerate}
          onRegenerateOne={handleRegenerateOne}
          onGenerateSopFor={(id) => handleGenerateSop(id)}
          sopSubmitting={state.sopSubmitting}
          sopError={state.sopError}
        />
      )}

      {state.step === 3 && state.sop && (
        <StepSop
          sop={state.sop}
          onReset={handleReset}
          saved={state.saved}
          savingToggle={state.savingToggle}
          onToggleSaved={handleToggleSaved}
        />
      )}
    </div>
  );
}
