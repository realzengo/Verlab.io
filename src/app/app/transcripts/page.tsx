"use client";

import { useState, type FormEvent } from "react";
import { TRANSCRIPTS } from "@/lib/mock-data";
import { LinkInput } from "@/components/ui/LinkInput";
import { TranscriptView } from "@/components/features/TranscriptView";

export default function TranscriptsPage() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeId, setActiveId] = useState(TRANSCRIPTS[0]?.id ?? null);

  const active = TRANSCRIPTS.find((t) => t.id === activeId) ?? null;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!url.trim()) return;
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setActiveId(TRANSCRIPTS[0]?.id ?? null);
      setUrl("");
    }, 700);
  };

  return (
    <div className="flex flex-col gap-6 pt-2">
      <div>
        <h2 className="text-lg font-semibold text-heading">Transcripts</h2>
        <p className="mt-1 text-sm text-body">
          Paste a TikTok, Reels, or Shorts link to pull a clean, timestamped transcript.
        </p>
      </div>

      <LinkInput
        value={url}
        onChange={setUrl}
        onSubmit={handleSubmit}
        placeholder="Paste a TikTok, Reels, or Shorts link..."
        submitLabel="Extract"
        loading={loading}
        className="max-w-2xl"
      />

      {active && <TranscriptView transcript={active} />}

      {TRANSCRIPTS.length > 1 && (
        <div>
          <span className="text-[11px] font-semibold uppercase tracking-wide text-body">Recent</span>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {TRANSCRIPTS.map((transcript) => (
              <button key={transcript.id} type="button" onClick={() => setActiveId(transcript.id)} className="text-left">
                <TranscriptView transcript={transcript} variant="compact" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
