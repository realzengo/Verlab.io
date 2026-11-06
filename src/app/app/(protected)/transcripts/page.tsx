"use client";

import { useEffect, useRef, useState } from "react";
import useSWR from "swr";
import { ArrowRight, Link2 } from "lucide-react";
import type { TranscriptRow } from "@/lib/types";
import { BEZEL_FIELD, BEZEL_FIELD_ROW, INK_TITLE } from "@/components/brand/BrandKit";
import { PlasticButton } from "@/components/ui/plastic-button";
import { TranscriptHistoryTable } from "@/components/transcripts/TranscriptHistoryTable";
import { TranscriptReader, transcriptText } from "@/components/transcripts/TranscriptReader";
import { ExtractionDialog } from "@/components/transcripts/ExtractionDialog";
import { ExportModal } from "@/components/transcripts/ExportModal";
import { LinkFieldNote } from "@/components/transcripts/LinkFieldNote";
import {
  TRANSCRIPT_PLATFORMS,
  TRANSCRIPT_PLATFORM_ORDER,
  TranscriptPlatformMark,
} from "@/components/transcripts/platform";
import { detectTranscriptPlatform } from "@/lib/transcript-platform";
import { exportTranscripts } from "@/lib/transcript-export";
import { pollUntilSettled } from "@/lib/polling";
import { isValidUrl } from "@/lib/validation";

type PageView = "history" | "result";

type TranscriptsResponse = { transcripts: TranscriptRow[] };

// Simulated progress for the extraction popup: jumps quickly at first, then
// eases off — never reaching the cap on its own so it doesn't look "done"
// before the real job actually finishes (which snaps it to 100 immediately).
const POPUP_PROGRESS_CAP = 92;
const POPUP_PROGRESS_TIME_CONSTANT_MS = 3_500;
const POPUP_PROGRESS_TICK_MS = 150;

function firstUrl(input: string): string | null {
  const line = input
    .split(/\s+/)
    .map((s) => s.trim())
    .find(Boolean);
  return line ?? null;
}

export default function TranscriptsPage() {
  const [view, setView] = useState<PageView>("history");
  // Cached by request URL -- revisiting /transcripts after navigating to
  // another sidebar tab reuses whatever was already fetched instead of
  // re-requesting the whole history from scratch.
  const {
    data: transcriptsData,
    isLoading: isLoadingRows,
    mutate: mutateRows,
  } = useSWR<TranscriptsResponse>("/api/transcripts");
  const rows = transcriptsData?.transcripts ?? [];
  const [linkInput, setLinkInput] = useState("");
  const [activeRow, setActiveRow] = useState<TranscriptRow | null>(null);
  const [copied, setCopied] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [popupOpen, setPopupOpen] = useState(false);
  const [popupProgress, setPopupProgress] = useState(0);
  const pollCancelRef = useRef<(() => void) | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const detected = detectTranscriptPlatform(linkInput);

  useEffect(() => {
    return () => pollCancelRef.current?.();
  }, []);

  // Drives the popup's progress bar while a freshly-submitted job is in
  // flight: fast climb early on, decelerating toward the cap. Real
  // completion (in pollUntilSettled) snaps straight to 100.
  const activeRowId = activeRow?.id;
  const activeRowStatus = activeRow?.status;
  useEffect(() => {
    if (!popupOpen || (activeRowStatus !== "queued" && activeRowStatus !== "processing")) return;

    const start = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - start;
      const eased = POPUP_PROGRESS_CAP * (1 - Math.exp(-elapsed / POPUP_PROGRESS_TIME_CONSTANT_MS));
      setPopupProgress(Math.round(eased));
    }, POPUP_PROGRESS_TICK_MS);

    return () => clearInterval(interval);
  }, [popupOpen, activeRowId, activeRowStatus]);

  function openRow(row: TranscriptRow) {
    setActiveRow(row);
    setPopupOpen(false);
    setView("result");
    window.scrollTo({ top: 0 });
  }

  async function handleDeleteRows(ids: string[]) {
    if (activeRow && ids.includes(activeRow.id)) {
      setActiveRow(null);
      setView("history");
    }
    try {
      await mutateRows(
        async (current) => {
          const res = await fetch("/api/transcripts", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ids }),
          });
          if (!res.ok) throw new Error();
          return current ? { transcripts: current.transcripts.filter((row) => !ids.includes(row.id)) } : current;
        },
        {
          optimisticData: (current) => ({
            transcripts: current?.transcripts.filter((row) => !ids.includes(row.id)) ?? [],
          }),
          rollbackOnError: true,
          revalidate: false,
        }
      );
    } catch {
      setError("Couldn't delete. Try again.");
    }
  }

  function startPolling(id: string) {
    pollCancelRef.current?.();
    pollCancelRef.current = pollUntilSettled(
      async () => {
        const res = await fetch(`/api/transcripts/status/${id}`);
        if (!res.ok) throw new Error("Could not check transcript status");
        const { transcript } = await res.json();
        return transcript as TranscriptRow;
      },
      (transcript) => transcript.status === "complete" || transcript.status === "failed",
      (transcript) => {
        mutateRows(
          (current) =>
            current ? { transcripts: current.transcripts.map((r) => (r.id === id ? transcript : r)) } : current,
          { revalidate: false }
        );
        setActiveRow((prev) => (prev?.id === id ? transcript : prev));
        if (transcript.status === "complete") {
          setPopupProgress(100);
        }
      },
      { intervalMs: 1500 }
    );
  }

  const handleExtract = async () => {
    const url = firstUrl(linkInput);
    if (!url) {
      setError("Paste a video link first");
      inputRef.current?.focus();
      return;
    }

    const platform = detectTranscriptPlatform(url);
    if (!platform) {
      setError("Only TikTok, Instagram and YouTube links work here");
      return;
    }
    if (!isValidUrl(url)) {
      setError("That doesn't look like a valid link");
      return;
    }

    setSubmitting(true);
    setError(null);

    const res = await fetch("/api/transcripts/extract", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    const data = await res.json();
    setSubmitting(false);

    if (!res.ok) {
      setError(data.error ?? "Could not start extraction");
      return;
    }

    setLinkInput("");
    setPopupProgress(0);
    const placeholderRow: TranscriptRow = {
      id: data.id,
      source_url: url,
      platform,
      status: "queued",
      title: null,
      cover_url: null,
      duration_seconds: null,
      video_url: null,
      embed_url: null,
      lines: null,
      error_message: null,
      created_at: new Date().toISOString(),
    };
    setActiveRow(placeholderRow);
    setPopupOpen(true);
    setView("result");
    startPolling(data.id);
    // Prepend locally instead of refetching the whole list -- the server
    // already agrees on the shape (this is exactly what it just created),
    // and startPolling's mutateRows call above will replace it with the
    // real row once the job settles.
    mutateRows(
      (current) => ({ transcripts: [placeholderRow, ...(current?.transcripts ?? [])] }),
      { revalidate: false }
    );
  };

  const handleCopy = async () => {
    if (!activeRow?.lines?.length) return;
    await navigator.clipboard.writeText(transcriptText(activeRow, true));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    // History runs the full content width; the hero centers its own column
    // and the reader stays capped so transcript lines keep a readable length.
    <div className="@container flex w-full flex-col pb-16">
      {view === "result" && activeRow ? (
        <div className="mx-auto w-full max-w-6xl">
          <TranscriptReader key={activeRow.id} row={activeRow} onBack={() => setView("history")} />
        </div>
      ) : (
        <>
          <section className="flex flex-col items-center pt-10 text-center sm:pt-16">
            <h1 className={`${INK_TITLE} text-[44px] leading-[1.02] tracking-[-0.045em] sm:text-[64px]`}>
              Transcripts
            </h1>
            <p className="mt-4 max-w-md text-balance text-base leading-relaxed text-subtle sm:text-[17px]">
              Paste a TikTok, Instagram or YouTube link and get every word it says, timestamped line by line.
            </p>
          </section>

          <div className="relative mx-auto mt-10 w-full max-w-2xl sm:mt-12">
            <LinkFieldNote />
            <form
              onSubmit={(event) => {
                event.preventDefault();
                if (!submitting) handleExtract();
              }}
              className={BEZEL_FIELD}
            >
              <div className={BEZEL_FIELD_ROW}>
                <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                  {detected ? (
                    <TranscriptPlatformMark platform={detected} className="h-[18px] w-[18px]" />
                  ) : (
                    <Link2 className="h-[18px] w-[18px] text-subtle" strokeWidth={1.75} />
                  )}
                </span>
                <input
                  ref={inputRef}
                  type="text"
                  inputMode="url"
                  autoCapitalize="off"
                  autoCorrect="off"
                  value={linkInput}
                  onChange={(event) => {
                    setLinkInput(event.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="Paste a video link"
                  aria-label="Video link"
                  aria-invalid={Boolean(error)}
                  className="h-11 min-w-0 flex-1 bg-transparent text-[15px] text-heading outline-none placeholder:text-subtle"
                />
                {/* mb-1 matches the button's 4px pressed lip (a shadow, outside
                    its box), so the face and lip center in the row together. */}
                <PlasticButton
                  type="submit"
                  className="mb-1 h-11 shrink-0"
                  text="Extract"
                  trailing={<ArrowRight className="h-4 w-4" strokeWidth={2} />}
                  loading={submitting}
                  loadingText="Starting"
                />
              </div>
            </form>

            {/* One line under the field so nothing jumps: what's wrong, the
                detected platform, or which platforms work. */}
            <div className="mt-4 flex min-h-6 flex-wrap items-center justify-center gap-x-3 gap-y-2 text-sm">
              {error ? (
                <p className="text-danger">{error}</p>
              ) : detected ? (
                <span className="flex items-center gap-1.5 font-medium text-heading">
                  <TranscriptPlatformMark platform={detected} className="h-4 w-4" />
                  {TRANSCRIPT_PLATFORMS[detected].label} video
                </span>
              ) : (
                <span className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-subtle">
                  Works with
                  {TRANSCRIPT_PLATFORM_ORDER.map((platform) => (
                    <span key={platform} className="flex items-center gap-1.5 text-heading">
                      <TranscriptPlatformMark platform={platform} className="h-4 w-4" />
                      {TRANSCRIPT_PLATFORMS[platform].label}
                    </span>
                  ))}
                </span>
              )}
            </div>
          </div>

          <div className="mt-14 sm:mt-20">
            <TranscriptHistoryTable
              rows={rows}
              isLoading={isLoadingRows}
              onOpenRow={openRow}
              onDeleteRows={handleDeleteRows}
              onExportAll={() => setExportModalOpen(true)}
            />
          </div>
        </>
      )}

      {popupOpen && activeRow && (
        <ExtractionDialog
          row={activeRow}
          progress={popupProgress}
          copied={copied}
          onCopy={handleCopy}
          onClose={() => setPopupOpen(false)}
          onViewHistory={() => {
            setPopupOpen(false);
            setView("history");
          }}
        />
      )}

      <ExportModal
        isOpen={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        count={rows.length}
        onExport={(format) => exportTranscripts(rows, format)}
      />
    </div>
  );
}
