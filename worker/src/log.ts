// One JSON object per line: Railway indexes the fields, so renders can be
// searched by job, project, event or duration (e.g. @event:job.failed).

export type LogLevel = "info" | "warn" | "error";

export function log(event: string, fields: Record<string, unknown> = {}, level: LogLevel = "info") {
  const line = JSON.stringify({ level, event, ...fields });
  if (level === "error") console.error(line);
  else console.log(line);
}

export const errorText = (error: unknown) =>
  (error instanceof Error ? `${error.name}: ${error.message}` : String(error)).slice(0, 500);
