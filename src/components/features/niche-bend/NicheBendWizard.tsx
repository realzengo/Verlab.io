"use client";

import { useEffect, useReducer, useRef } from "react";
import { analyzeChannel, generateSop, pollStatus, pollStatusUntilSettled } from "@/lib/api/niche-bend";
import { detectPlatform } from "@/lib/niche-bend/platform";
import { clearPersistedWizardRef, readPersistedWizardRef, writePersistedWizardRef } from "@/lib/niche-bend/storage";
import type {
  NicheBendCandidate,
  NicheBendChannelAnalysis,
  NicheBendJobStatus,
  NicheBendJobStatusResponse,
  NicheBendPlatform,
  NicheBendSopResult,
  NicheBendVideo,
  NicheBendVideoType,
} from "@/lib/types";
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
  selectedCandidateId: 1 | 2 | 3 | null;
  sopSubmitting: boolean;
  sopError: string | null;
  sop: NicheBendSopResult | null;
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
  | { type: "REGEN_START" }
  | { type: "REGEN_JOB_CREATED"; jobId: string }
  | { type: "REGEN_STATUS_UPDATE"; status: NicheBendJobStatusResponse }
  | { type: "SOP_SUBMIT_START" }
  | { type: "SOP_READY"; status: NicheBendJobStatusResponse }
  | { type: "SOP_SUBMIT_FAILED"; message: string }
  | { type: "RESET" }
  | { type: "HYDRATE"; status: NicheBendJobStatusResponse; selectedCandidateId: 1 | 2 | 3 | null }
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
  selectedCandidateId: null,
  sopSubmitting: false,
  sopError: null,
  sop: null,
  manualSubmitting: false,
};

const IN_PROGRESS_STATUSES: NicheBendJobStatus[] = [
  "opening_channel",
  "reading_videos",
  "identifying_format",
  "generating_bends",
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

    case "SOP_SUBMIT_START":
      return { ...state, sopSubmitting: true, sopError: null };

    case "SOP_READY":
      return { ...state, sop: action.status.sop ?? state.sop, step: 3, sopSubmitting: false };

    case "SOP_SUBMIT_FAILED":
      return { ...state, sopSubmitting: false, sopError: action.message };

    case "GO_TO_STEP":
      if (action.step >= state.step) return state;
      return { ...state, step: action.step };

    case "RESET":
      return { ...INITIAL_STATE };

    case "HYDRATE": {
      const s = action.status;
      let step: 1 | 2 | 3 = 1;
      let analyzeState: AnalyzeState = "polling";
      if (s.status === "sop_ready") {
        step = 3;
        analyzeState = "idle";
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
        selectedCandidateId: action.selectedCandidateId,
      };
    }

    default:
      return state;
  }
}

export function NicheBendWizard() {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);
  const cancelPollRef = useRef<(() => void) | null>(null);

  const stopPolling = () => {
    cancelPollRef.current?.();
    cancelPollRef.current = null;
  };

  // Resume an in-flight or completed job after a refresh.
  useEffect(() => {
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
      dispatch({ type: "REGEN_STATUS_UPDATE", status: { jobId: state.jobId ?? "", status: "failed", statusText: "", progress: 0 } });
    }
  };

  const handleGenerateSop = async () => {
    if (!state.jobId || state.selectedCandidateId === null) return;
    dispatch({ type: "SOP_SUBMIT_START" });

    try {
      const status = await generateSop({ jobId: state.jobId, chosenBend: state.selectedCandidateId });
      dispatch({ type: "SOP_READY", status });
    } catch (error) {
      dispatch({
        type: "SOP_SUBMIT_FAILED",
        message: error instanceof Error ? error.message : "Could not generate the SOP.",
      });
    }
  };

  const handleReset = () => {
    stopPolling();
    clearPersistedWizardRef();
    dispatch({ type: "RESET" });
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
          status={state.status}
          errorMessage={state.errorMessage}
          onSubmit={() => startAnalyze()}
          onRetry={() => startAnalyze()}
          onShowManualFallback={() => dispatch({ type: "SHOW_MANUAL_FALLBACK" })}
          onManualSubmit={(videos) => startAnalyze(videos)}
          manualSubmitting={state.manualSubmitting}
        />
      )}

      {state.step === 2 && state.analysis && (
        <StepChooseBend
          analysis={state.analysis}
          candidates={state.candidates}
          candidatesRegenerating={state.candidatesRegenerating}
          selectedCandidateId={state.selectedCandidateId}
          onSelect={(id) => dispatch({ type: "SELECT_CANDIDATE", id })}
          onRegenerate={handleRegenerate}
          onGenerateSop={handleGenerateSop}
          sopSubmitting={state.sopSubmitting}
          sopError={state.sopError}
        />
      )}

      {state.step === 3 && state.sop && <StepSop sop={state.sop} onReset={handleReset} />}
    </div>
  );
}
