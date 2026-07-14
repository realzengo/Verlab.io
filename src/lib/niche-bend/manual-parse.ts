import type { NicheBendVideo } from "@/lib/types";

const VIEWS_SUFFIX_PATTERN = /^(.*?)[\s—-]+([\d.,]+\s*[kKmM]?)\s*views?$/i;

export function parseManualVideos(raw: string): NicheBendVideo[] {
  const lines = raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const videos: NicheBendVideo[] = [];

  for (const line of lines) {
    if (videos.length >= 10) break;

    const suffixMatch = line.match(VIEWS_SUFFIX_PATTERN);
    if (suffixMatch) {
      videos.push({ title: suffixMatch[1].trim(), views: suffixMatch[2].trim() });
      continue;
    }

    const delimiterMatch = line.match(/^(.*?)[\s]*(?:—|-)[\s]*([^—-]+)$/);
    if (delimiterMatch && /\d/.test(delimiterMatch[2])) {
      videos.push({ title: delimiterMatch[1].trim(), views: delimiterMatch[2].trim() });
      continue;
    }

    videos.push({ title: line, views: "—" });
  }

  return videos;
}
