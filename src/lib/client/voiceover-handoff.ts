// Hands a script off from the Script Writer to the Voiceover Generator when
// the user clicks "Generate Voiceover" -- sessionStorage rather than a URL
// query param since scripts can run up to 5000 chars, past what's safe to
// round-trip through a URL across browsers/proxies.
export const VOICEOVER_HANDOFF_KEY = "clypa:voiceover-handoff";

export interface VoiceoverHandoff {
  title: string;
  script: string;
}

export function writeVoiceoverHandoff(handoff: VoiceoverHandoff): void {
  sessionStorage.setItem(VOICEOVER_HANDOFF_KEY, JSON.stringify(handoff));
}

// Read-once: clears the key immediately so a manual visit to the voiceover
// page later in the session doesn't unexpectedly reload a stale script.
export function consumeVoiceoverHandoff(): VoiceoverHandoff | null {
  const raw = sessionStorage.getItem(VOICEOVER_HANDOFF_KEY);
  if (!raw) return null;
  sessionStorage.removeItem(VOICEOVER_HANDOFF_KEY);
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed?.script !== "string") return null;
    return { title: typeof parsed.title === "string" ? parsed.title : "", script: parsed.script };
  } catch {
    return null;
  }
}
