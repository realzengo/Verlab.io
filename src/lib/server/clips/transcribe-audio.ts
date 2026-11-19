// WhisperX's audio, fetched by the render worker (clip_jobs kind 'source',
// worker/src/jobs/source.ts) and stored in our own bucket, so Replicate
// downloads it from Storage in seconds instead of from the video provider.
//
// Why (2026-11-19): handed the provider's mp3 link, WhisperX failed 6 of the
// week's 21 projects. That link is a live transcode (320 kbps, ~370 KB/s, no
// Content-Length, no Range): Replicate's downloader gives up when a server
// takes ~10s to send the first byte or stalls halfway ("Input validation
// error: HTTPSConnectionPool(host='leo3.savenow.to'): Read timed out"), three
// fresh links in a row. And the download was billed as GPU time: most of a
// 2-hour video's ~13-minute prediction.
//
// The worker asks the provider for the audio in 15-minute stretches, several
// at once (each a finished file with a Content-Length, ready in about a
// minute), stitches them at their exact starts into 16 kHz mono (all Whisper
// listens to) and encodes Opus sized under the bucket's 50MB cap.
//
// Shared by the app (projects.ts) and the worker, so nothing here may need Next.

export const TRANSCRIBE_AUDIO_BUCKET = "clip-exports";

/** Beside the project's cuts and exports, so deleting the project removes it too. */
export const transcribeAudioPath = (row: { id: string; user_id: string }) =>
  `${row.user_id}/${row.id}/transcribe-audio.ogg`;

/** Each stretch of audio asked of the provider. */
export const AUDIO_CHUNK_SECONDS = 15 * 60;
export const AUDIO_SAMPLE_RATE = 16_000;

/** Under the bucket's 50MB cap with room for Ogg overhead. */
const AUDIO_MAX_BYTES = 44 * 1024 * 1024;

/** Opus bitrate (kbps) for a video this long: 32 when it fits, never under 12 (still clean speech). */
export function transcribeAudioKbps(durationSeconds: number): number {
  const fits = Math.floor((AUDIO_MAX_BYTES * 8) / Math.max(1, durationSeconds) / 1000);
  return Math.max(12, Math.min(32, fits));
}
