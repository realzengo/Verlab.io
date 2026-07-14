const STORAGE_KEY = "clypa:niche-bend:wizard";

export interface PersistedWizardRef {
  jobId: string;
  selectedCandidateId: 1 | 2 | 3 | null;
}

export function readPersistedWizardRef(): PersistedWizardRef | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedWizardRef;
    if (!parsed.jobId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writePersistedWizardRef(ref: PersistedWizardRef): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(ref));
}

export function clearPersistedWizardRef(): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(STORAGE_KEY);
}
