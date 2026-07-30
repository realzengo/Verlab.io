import { notifyCreditsChanged } from "@/lib/client/credits-bus";
import { pollUntilSettled } from "@/lib/polling";
import type {
  NicheBendHistoryItem,
  NicheBendJobStatusResponse,
  NicheBendPlatform,
  NicheBendVideo,
  NicheBendVideoType,
} from "@/lib/types";

export class NicheBendApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "NicheBendApiError";
    this.status = status;
    this.code = code;
  }
}

async function parseError(response: Response, fallback: string): Promise<{ message: string; code?: string }> {
  try {
    const body = (await response.json()) as { error?: string; code?: string };
    return { message: body.error ?? fallback, code: body.code };
  } catch {
    return { message: fallback };
  }
}

export interface AnalyzeChannelPayload {
  url?: string;
  platform: NicheBendPlatform;
  videoType: NicheBendVideoType;
  manualVideos?: NicheBendVideo[];
}

export async function analyzeChannel(payload: AnalyzeChannelPayload): Promise<{ jobId: string }> {
  const response = await fetch("/api/niche-bend/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const { message, code } = await parseError(response, "Could not start the analysis");
    throw new NicheBendApiError(message, response.status, code);
  }

  return response.json();
}

export async function pollStatus(
  jobId: string,
  opts?: { signal?: AbortSignal }
): Promise<NicheBendJobStatusResponse> {
  const response = await fetch(`/api/niche-bend/status/${jobId}`, { signal: opts?.signal });

  if (!response.ok) {
    const { message, code } = await parseError(response, "Could not check job status");
    throw new NicheBendApiError(message, response.status, code);
  }

  return response.json();
}

export interface GenerateSopPayload {
  jobId: string;
  chosenBend: 1 | 2 | 3;
}

export async function generateSop(payload: GenerateSopPayload): Promise<NicheBendJobStatusResponse> {
  const response = await fetch("/api/niche-bend/sop", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const { message, code } = await parseError(response, "Could not generate the SOP");
    throw new NicheBendApiError(message, response.status, code);
  }

  return response.json();
}

export interface RegenerateCandidatePayload {
  jobId: string;
  candidateId: 1 | 2 | 3;
}

export async function regenerateCandidate(
  payload: RegenerateCandidatePayload
): Promise<NicheBendJobStatusResponse> {
  const response = await fetch("/api/niche-bend/regenerate-candidate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const { message, code } = await parseError(response, "Could not regenerate this idea");
    throw new NicheBendApiError(message, response.status, code);
  }

  // This route charges synchronously before regenerating, so the balance
  // has already changed by the time this response resolves.
  notifyCreditsChanged();

  return response.json();
}

export async function fetchBendHistory(limit = 20): Promise<NicheBendHistoryItem[]> {
  const response = await fetch(`/api/niche-bend/history?limit=${limit}`);

  if (!response.ok) {
    const { message, code } = await parseError(response, "Could not load bend history");
    throw new NicheBendApiError(message, response.status, code);
  }

  const body = (await response.json()) as { items: NicheBendHistoryItem[] };
  return body.items;
}

export async function deleteBendHistoryItem(jobId: string): Promise<void> {
  const response = await fetch(`/api/niche-bend/status/${jobId}`, { method: "DELETE" });

  if (!response.ok) {
    const { message, code } = await parseError(response, "Could not delete this bend");
    throw new NicheBendApiError(message, response.status, code);
  }
}

export async function setBendSaved(jobId: string, saved: boolean): Promise<NicheBendJobStatusResponse> {
  const response = await fetch(`/api/niche-bend/status/${jobId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ saved }),
  });

  if (!response.ok) {
    const { message, code } = await parseError(response, "Could not update your library");
    throw new NicheBendApiError(message, response.status, code);
  }

  return response.json();
}

export async function fetchSavedBends(limit = 50): Promise<NicheBendHistoryItem[]> {
  const response = await fetch(`/api/niche-bend/library?limit=${limit}`);

  if (!response.ok) {
    const { message, code } = await parseError(response, "Could not load your library");
    throw new NicheBendApiError(message, response.status, code);
  }

  const body = (await response.json()) as { items: NicheBendHistoryItem[] };
  return body.items;
}

const SETTLED_STATUSES: NicheBendJobStatusResponse["status"][] = ["ready", "sop_ready", "failed"];

export function pollStatusUntilSettled(
  jobId: string,
  onUpdate: (status: NicheBendJobStatusResponse) => void,
  opts?: { intervalMs?: number }
): () => void {
  return pollUntilSettled(
    () => pollStatus(jobId),
    (status) => SETTLED_STATUSES.includes(status.status),
    (status) => {
      onUpdate(status);
      if (SETTLED_STATUSES.includes(status.status) && status.status !== "failed") {
        // "ready" (analyze settled) and "sop_ready" (SOP settled) both mean
        // the background job's charge (see niche-bend-job-store.ts) already
        // succeeded -- "failed" jobs are refunded, not charged, so they're
        // excluded here.
        notifyCreditsChanged();
      }
    },
    { intervalMs: opts?.intervalMs ?? 1200 }
  );
}
