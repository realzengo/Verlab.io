import type { NicheBendResult } from "@/lib/types";

/**
 * The /api/bend route trusts the LLM's JSON output as NicheBendResult without
 * runtime validation, and the model doesn't always match that shape exactly
 * (e.g. `structure`/`scripts` entries sometimes come back as nested objects
 * instead of strings). Coerce whatever comes back into displayable strings
 * so the UI never crashes on a shape mismatch.
 */
function toDisplayString(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(toDisplayString).join("\n");
  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .map(([key, val]) => `${key}: ${toDisplayString(val)}`)
      .join("\n");
  }
  return String(value ?? "");
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(toDisplayString);
}

export function normalizeBendResult(raw: unknown): NicheBendResult {
  const data = (raw ?? {}) as Record<string, unknown>;
  const sop = (data.sop ?? {}) as Record<string, unknown>;

  return {
    analysis: toDisplayString(data.analysis),
    sop: {
      hookFormula: toDisplayString(sop.hookFormula),
      structure: toStringArray(sop.structure),
      pacing: toDisplayString(sop.pacing),
      dos: toStringArray(sop.dos),
      donts: toStringArray(sop.donts),
    },
    scriptIdeas: toStringArray(data.scriptIdeas),
    scripts: toStringArray(data.scripts),
  };
}
