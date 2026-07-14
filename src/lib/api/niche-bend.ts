import type {
  NicheBendJobStatusResponse,
  NicheBendPlatform,
  NicheBendVideo,
  NicheBendVideoType,
} from "@/lib/types";

export class NicheBendApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "NicheBendApiError";
    this.status = status;
  }
}

async function parseErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const body = (await response.json()) as { error?: string };
    return body.error ?? fallback;
  } catch {
    return fallback;
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
    throw new NicheBendApiError(
      await parseErrorMessage(response, "Could not start the analysis"),
      response.status
    );
  }

  return response.json();
}

export async function pollStatus(
  jobId: string,
  opts?: { signal?: AbortSignal }
): Promise<NicheBendJobStatusResponse> {
  const response = await fetch(`/api/niche-bend/status/${jobId}`, { signal: opts?.signal });

  if (!response.ok) {
    throw new NicheBendApiError(await parseErrorMessage(response, "Could not check job status"), response.status);
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
    throw new NicheBendApiError(await parseErrorMessage(response, "Could not generate the SOP"), response.status);
  }

  return response.json();
}

export function pollStatusUntilSettled(
  jobId: string,
  onUpdate: (status: NicheBendJobStatusResponse) => void,
  opts?: { intervalMs?: number }
): () => void {
  const intervalMs = opts?.intervalMs ?? 1200;
  let cancelled = false;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const SETTLED: NicheBendJobStatusResponse["status"][] = ["ready", "sop_ready", "failed"];

  const tick = async () => {
    if (cancelled) return;
    try {
      const status = await pollStatus(jobId);
      if (cancelled) return;
      onUpdate(status);
      if (!SETTLED.includes(status.status)) {
        timeoutId = setTimeout(tick, intervalMs);
      }
    } catch {
      if (!cancelled) {
        timeoutId = setTimeout(tick, intervalMs);
      }
    }
  };

  tick();

  return () => {
    cancelled = true;
    if (timeoutId) clearTimeout(timeoutId);
  };
}
