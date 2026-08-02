// Shared parsing/formatting for the model's "---\nTITLE: ...\n\nSCRIPT:\n...\n\n
// METRICS:\n- ...\n---" envelope (see buildSystemPrompt / buildEditSystemPrompt
// in lib/server/script-generation.ts). Used by both the Scriptwriter page
// (history previews) and the script editor modal (line-by-line segments),
// so parsing and re-serializing stay a single source of truth.

// A row from the `scripts` table, as returned by /api/scripts and
// /api/scripts/[id] -- shared between the Scriptwriter page's history list
// and the script editor modal so both work off the same shape.
export interface ScriptRecord {
  id: string;
  prompt: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface ParsedScript {
  title: string | null;
  script: string;
  metrics: { label: string; value: string }[];
}

// Models frequently wrap the section markers in markdown bold ("**SCRIPT:**"
// instead of "SCRIPT:") despite the system prompt spelling out plain-text
// markers -- match that optional "**" (or "###" header) padding around the
// keyword itself, otherwise the SCRIPT->METRICS boundary never matches and
// the entire METRICS block plus any trailing commentary silently gets
// swallowed into the script body shown to the user.
const MARKER = (name: string) => `#{0,3}\\s*\\*{0,2}${name}:\\*{0,2}`;

export function parseScriptOutput(raw: string): ParsedScript {
  // Split on every run of 3+ dashes and keep the LAST chunk that actually
  // contains a SCRIPT: marker, not just the first "---...---" pair. Guards
  // against: (1) a model prepending a refusal/caveat paragraph before its
  // real output, which would otherwise get treated as part of the script,
  // and (2) already-corrupted historical data where a bad parse got
  // re-serialized (via buildScriptOutput) with a second envelope nested
  // inside the first -- the chunk between the INNER dash pair is always the
  // clean one in that case, and a naive first-pair/last-pair match on
  // consecutive "-{3,}" runs would consume that inner delimiter as a
  // boundary rather than surfacing it as its own chunk.
  const trimmed = raw.trim();
  const scriptMarkerPattern = new RegExp(`${MARKER("SCRIPT")}`, "i");
  const chunks = trimmed
    .split(/-{3,}/)
    .map((chunk) => chunk.trim())
    .filter(Boolean);
  const withScriptMarker = chunks.filter((chunk) => scriptMarkerPattern.test(chunk));
  const cleaned =
    withScriptMarker[withScriptMarker.length - 1] ?? chunks[chunks.length - 1] ?? trimmed;

  const titleMatch = cleaned.match(new RegExp(`${MARKER("TITLE")}\\s*(.+)`, "i"));
  const scriptMatch = cleaned.match(
    new RegExp(`${MARKER("SCRIPT")}\\s*([\\s\\S]*?)(?=\\n{1,2}${MARKER("METRICS")}|$)`, "i")
  );
  const metricsMatch = cleaned.match(new RegExp(`${MARKER("METRICS")}\\s*([\\s\\S]*)`, "i"));

  // Strip ALL asterisks, not just trailing ones -- a model that double-bolds
  // ("**TITLE:** **My Title**") otherwise leaves "**" stuck to the front of
  // the captured title text.
  const title = titleMatch?.[1]?.replace(/\*/g, "").trim() || null;
  const script = (scriptMatch?.[1] ?? (title ? "" : cleaned)).trim();

  const metrics: { label: string; value: string }[] = [];
  if (metricsMatch) {
    for (const rawLine of metricsMatch[1].split("\n")) {
      // Strip markdown emphasis before matching -- "- **Word Count:** 98
      // words" is otherwise parsed with the asterisks stuck to the label/value.
      const line = rawLine.replace(/\*/g, "");
      const match = line.match(/^-\s*([^:]+):\s*(.+)$/);
      if (match) metrics.push({ label: match[1].trim(), value: match[2].trim() });
    }
  }

  return { title, script, metrics };
}

// Re-serializes an edited script back into the same envelope so history
// previews and future edit-chat passes keep parsing it correctly. Word
// Count is always recomputed from the live script text (it drifts as the
// user edits); any other metrics are carried over unchanged.
export function buildScriptOutput(parsed: ParsedScript): string {
  const words = countWords(parsed.script);
  const metrics = parsed.metrics.filter((m) => m.label !== "Word Count");
  const metricLines = [`- Word Count: ${words} words`, ...metrics.map((m) => `- ${m.label}: ${m.value}`)];

  const lines = ["---"];
  if (parsed.title) lines.push(`TITLE: ${parsed.title}`, "");
  lines.push("SCRIPT:", parsed.script, "", "METRICS:", ...metricLines, "---");
  return lines.join("\n");
}

// Splits a script's body into editable line-by-line segments, always at
// sentence boundaries -- matching the competitor's one-sentence-per-row
// editor. Explicit line breaks the model already put in (structural beats)
// are respected as hard boundaries first, then each resulting line is
// further split into its individual sentences, so a beat containing two
// sentences still becomes two rows rather than one long one.
export function splitIntoSegments(script: string): string[] {
  const lines = script
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const source = lines.length > 0 ? lines : [script.trim()];

  const segments: string[] = [];
  for (const line of source) {
    const sentences = line
      .split(/(?<=[.!?])\s+(?=[A-Z0-9"“])/)
      .map((sentence) => sentence.trim())
      .filter(Boolean);
    segments.push(...(sentences.length > 0 ? sentences : [line]));
  }

  return segments;
}

export function joinSegments(segments: string[]): string {
  return segments
    .map((segment) => segment.trim())
    .filter(Boolean)
    .join(" ");
}

export function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

// Average spoken pace for short-form video voiceover (~200 wpm) -- used to
// estimate runtime under the word count, matching the competitor's
// "174 words · 53s" style readout.
const WORDS_PER_SECOND = 3.3;

export function estimateDurationLabel(words: number): string {
  const seconds = Math.max(1, Math.round(words / WORDS_PER_SECOND));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}m ${remainder}s`;
}

// "Updated 44 mins ago" style relative timestamp for the history list --
// falls back to a plain date once it's old enough that a relative label
// stops being useful.
export function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffMin = Math.round(diffMs / 60000);

  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin} min${diffMin === 1 ? "" : "s"} ago`;

  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hour${diffHr === 1 ? "" : "s"} ago`;

  const diffDay = Math.round(diffHr / 24);
  if (diffDay < 30) return `${diffDay} day${diffDay === 1 ? "" : "s"} ago`;

  return new Date(iso).toLocaleDateString();
}
