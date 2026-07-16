import { google } from "@ai-sdk/google";

// Reads GOOGLE_GENERATIVE_AI_API_KEY from the environment automatically.
// Both gemini-1.5-flash and a pinned gemini-2.5-flash were rejected by the
// API (retired / "no longer available to new users") within the same day —
// Google is retiring dated flash versions quickly right now, so this uses
// the floating "-latest" alias instead of a pinned version to avoid pinning
// to something that gets retired again.
export const NICHE_BEND_MODEL = "gemini-flash-latest";

export const geminiModel = google(NICHE_BEND_MODEL);

// Output ceiling for the current flash-tier model. Requests below ask for
// more (matching the token budgets the Claude version used) but get clamped
// here.
export const GEMINI_MAX_OUTPUT_TOKENS = 65536;
