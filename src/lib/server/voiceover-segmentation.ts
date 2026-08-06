// Splits a script into TTS segments. "All at Once" is trivial (the whole
// script is one segment); "Line by Line" is the real logic here -- it
// splits on newlines first (a writer's own line breaks are the strongest
// signal of an intended pause), then further splits any resulting line that
// still contains multiple sentences on sentence-ending punctuation
// (., !, ?), so a paragraph typed as one block still comes out as one
// segment per sentence.
const SENTENCE_END = /(?<=[.!?])\s+(?=[A-Z0-9"'])/;

export function splitScriptIntoLines(script: string): string[] {
  return script
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => line.split(SENTENCE_END))
    .map((segment) => segment.trim())
    .filter(Boolean);
}

export function splitScript(script: string, mode: "line_by_line" | "all_at_once"): string[] {
  const trimmed = script.trim();
  if (!trimmed) return [];
  if (mode === "all_at_once") return [trimmed];
  const lines = splitScriptIntoLines(trimmed);
  return lines.length > 0 ? lines : [trimmed];
}
