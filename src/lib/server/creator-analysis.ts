import type { ModelMessage } from "ai";
import { generateScriptText } from "@/lib/server/script-generation";

export interface CreatorVideoTranscript {
  title: string;
  views: string;
  text: string;
}

// Reuses generate-script's model-fallback loop (generateScriptText) rather
// than duplicating the Gemini->Claude candidate list -- this call is just a
// different system prompt over the same "one buffered LLM call" shape.
function buildCreatorAnalysisPrompt(channelName: string, videos: CreatorVideoTranscript[]): string {
  const videoBlocks = videos
    .map(
      (video, index) =>
        `<VIDEO index="${index + 1}" views="${video.views}">
<TITLE>${video.title}</TITLE>
<TRANSCRIPT>${video.text || "(no speech detected)"}</TRANSCRIPT>
</VIDEO>`
    )
    .join("\n\n");

  return `You are a short-form video analyst. You've been given the real transcripts of ${channelName}'s top-performing videos. Write ONE tight paragraph (120-180 words) breaking down their actual content strategy, grounded specifically in what's said in these transcripts -- not generic advice.

Cover, in prose (no headers/bullets): how they open/hook viewers in the first line, their pacing and sentence rhythm, their point of view and tone, and any recurring structural device (e.g. a reveal, a list, a direct address to camera) you can actually observe repeating across these transcripts. Quote or closely paraphrase a real line if it illustrates a point well. If the videos don't share an obvious pattern, say so honestly rather than inventing one.

${videoBlocks}`;
}

export async function analyzeCreatorTranscripts(channelName: string, videos: CreatorVideoTranscript[]): Promise<string> {
  const systemPrompt = buildCreatorAnalysisPrompt(channelName, videos);
  const messages: ModelMessage[] = [{ role: "user", content: "Write the analysis paragraph now." }];
  return generateScriptText(systemPrompt, messages);
}
