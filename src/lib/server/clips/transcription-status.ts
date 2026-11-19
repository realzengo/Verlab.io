import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { logActivity } from "@/lib/server/usage";
import { WHISPERX_VERSION } from "@/lib/server/clips/transcribe";

// WhisperX runs on Replicate, paid from a prepaid balance. When the balance
// runs out, Replicate refuses every new transcription (402 "Insufficient
// credit"), so every new clipping project would be charged, fail ~20s later
// with a generic error and be refunded (2026-11-19, the user's 1h53m xQc
// video, twice). This module:
//   - records the outage once in activity_log (the admin feed; the status
//     card shows it as critical until it's over),
//   - lets Create refuse up front, without charging, while it lasts,
//   - notices the recovery the moment credit is back, with a probe that
//     runs nothing (a create with an invalid input: 402 while out of credit,
//     a 4xx input error otherwise).

const ACTOR = "replicate";
const OUT_MESSAGE = "Replicate is out of credit: new clipping projects can't be transcribed";
const BACK_MESSAGE = "Replicate credit is back: clipping transcribes again";
/** An outage this recent is re-checked (probed) before anyone is charged. */
const WATCH_MS = 6 * 60 * 60 * 1000;
/** One outage entry per this long, however many projects run into it. */
const LOG_EVERY_MS = 10 * 60 * 1000;

/** What users see while transcription is down: not their video's fault. */
export const TRANSCRIPTION_DOWN_MESSAGE = "Clipping is briefly unavailable on our side. Try again in a few minutes.";

/** Replicate's answer when the account's balance is used up. */
export function isOutOfCredit(error: unknown): boolean {
  const status =
    (error as { response?: { status?: number } } | null)?.response?.status ??
    (error as { status?: number } | null)?.status;
  const message = error instanceof Error ? error.message : String(error);
  return status === 402 || /insufficient credit/i.test(message);
}

async function latestState(): Promise<{ down: boolean; at: number } | null> {
  const { data } = await createAdminClient()
    .from("activity_log")
    .select("message, created_at")
    .eq("actor", ACTOR)
    .in("message", [OUT_MESSAGE, BACK_MESSAGE])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ message: string; created_at: string }>();
  return data ? { down: data.message === OUT_MESSAGE, at: Date.parse(data.created_at) } : null;
}

/** Notes that Replicate refused a transcription for lack of credit (at most once every 10 minutes). */
export async function recordOutOfCredit(): Promise<void> {
  console.error(`[clips] ${OUT_MESSAGE}`);
  const latest = await latestState().catch(() => null);
  if (latest?.down && Date.now() - latest.at < LOG_EVERY_MS) return;
  await logActivity({ type: "system", message: OUT_MESSAGE, actor: ACTOR });
}

/** true: credit is there; false: still out; null: couldn't tell. Starts nothing. */
async function probeCredit(): Promise<boolean | null> {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) return null;
  try {
    const response = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ version: WHISPERX_VERSION, input: { audio_file: 0 } }),
      signal: AbortSignal.timeout(8000),
    });
    if (response.status === 402) return false;
    if (response.ok) {
      // The input was somehow accepted: stop it before it spends anything.
      const created = (await response.json().catch(() => null)) as { id?: string } | null;
      if (created?.id) {
        await fetch(`https://api.replicate.com/v1/predictions/${created.id}/cancel`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => {});
      }
      return true;
    }
    return response.status >= 400 && response.status < 500 && response.status !== 429 ? true : null;
  } catch {
    return null;
  }
}

/**
 * Whether a new clipping project can be transcribed. Free unless an outage
 * was recorded in the last few hours; then it asks Replicate (and logs the
 * recovery when credit is back). Unsure answers let the project try.
 */
export async function transcriptionAvailable(): Promise<boolean> {
  const latest = await latestState().catch(() => null);
  if (!latest?.down || Date.now() - latest.at > WATCH_MS) return true;
  const credit = await probeCredit();
  if (credit === false) return false;
  if (credit === true) await logActivity({ type: "system", message: BACK_MESSAGE, actor: ACTOR });
  return true;
}

/**
 * For the admin status card: an outage recorded in the last day and not yet
 * over. Asks Replicate too, so a top-up clears the card without waiting for
 * someone to start a project.
 */
export async function transcriptionOutage(): Promise<{ since: string } | null> {
  const latest = await latestState();
  if (!latest?.down || Date.now() - latest.at > 24 * 60 * 60 * 1000) return null;
  const credit = await probeCredit();
  if (credit === true) {
    await logActivity({ type: "system", message: BACK_MESSAGE, actor: ACTOR });
    return null;
  }
  return { since: new Date(latest.at).toISOString() };
}
