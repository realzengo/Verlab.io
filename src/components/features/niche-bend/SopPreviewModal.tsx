"use client";

import { Fragment, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Copy, FileDown, Loader2, X } from "lucide-react";
import { pollStatus } from "@/lib/api/niche-bend";
import type { NicheBendSopResult } from "@/lib/types";
import { buildSopDocxBlob } from "@/lib/niche-bend/export-docx";
import { formatSopAsMarkdown } from "@/lib/niche-bend/markdown";
import { slugifySopTitle } from "@/lib/niche-bend/sop-blocks";
import { downloadBlob } from "@/lib/utils";

function renderInline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  return parts.map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={i} className="font-semibold text-heading">
        {part.slice(2, -2)}
      </strong>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    )
  );
}

function SopDocument({ markdown }: { markdown: string }) {
  // The title, subtitle, and one-line promise are already shown in the
  // modal header/banner above — start the body at the first real section.
  const lines = markdown.split("\n");
  const firstSectionIndex = lines.findIndex((line) => line.startsWith("## "));
  const bodyLines = firstSectionIndex === -1 ? lines : lines.slice(firstSectionIndex);

  const elements: React.ReactNode[] = [];
  let listBuffer: string[] = [];

  const flushList = (key: string) => {
    if (listBuffer.length === 0) return;
    elements.push(
      <ul key={key} className="my-2 flex flex-col gap-1.5">
        {listBuffer.map((item, i) => (
          <li key={i} className="flex gap-2 text-sm leading-relaxed text-body">
            <span className="mt-0.5 shrink-0 text-primary">→</span>
            <span>{renderInline(item)}</span>
          </li>
        ))}
      </ul>
    );
    listBuffer = [];
  };

  bodyLines.forEach((raw, i) => {
    const line = raw.trim();
    const key = `l-${i}`;

    if (line.startsWith("### ")) {
      flushList(`ul-${key}`);
      elements.push(
        <h3 key={key} className="mt-4 text-sm font-bold text-heading">
          {line.slice(4)}
        </h3>
      );
    } else if (line.startsWith("## ")) {
      flushList(`ul-${key}`);
      elements.push(
        <h2 key={key} className="mt-6 border-t border-hairline pt-5 text-base font-semibold text-heading first:mt-0 first:border-0 first:pt-0">
          {line.slice(3)}
        </h2>
      );
    } else if (line.startsWith("# ")) {
      flushList(`ul-${key}`);
      elements.push(
        <h1 key={key} className="text-xl font-bold text-heading">
          {line.slice(2)}
        </h1>
      );
    } else if (line.startsWith("- ")) {
      listBuffer.push(line.slice(2));
    } else if (line.startsWith("_") && line.endsWith("_") && line.length > 1) {
      flushList(`ul-${key}`);
      elements.push(
        <p key={key} className="text-sm italic text-subtle">
          {line.slice(1, -1)}
        </p>
      );
    } else if (line === "") {
      flushList(`ul-${key}`);
    } else {
      flushList(`ul-${key}`);
      elements.push(
        <p key={key} className="text-sm leading-relaxed text-body">
          {renderInline(line)}
        </p>
      );
    }
  });
  flushList("ul-end");

  return <div className="flex flex-col gap-1.5">{elements}</div>;
}

export function SopPreviewModal({ jobId, onClose }: { jobId: string | null; onClose: () => void }) {
  const [result, setResult] = useState<{ jobId: string; sop: NicheBendSopResult | null } | null>(null);
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState(false);

  useEffect(() => {
    if (!jobId) return;
    let cancelled = false;
    pollStatus(jobId)
      .then((status) => {
        if (cancelled) return;
        setResult({ jobId, sop: status.sop ?? null });
      })
      .catch(() => {
        if (!cancelled) setResult({ jobId, sop: null });
      });
    return () => {
      cancelled = true;
    };
  }, [jobId]);

  const sop = jobId && result?.jobId === jobId ? result.sop : null;
  const loading = jobId !== null && result?.jobId !== jobId;
  const error = jobId !== null && result?.jobId === jobId && result.sop === null;

  useEffect(() => {
    if (!jobId) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [jobId, onClose]);

  if (!jobId || typeof document === "undefined") return null;

  const handleCopy = async () => {
    if (!sop) return;
    await navigator.clipboard.writeText(formatSopAsMarkdown(sop));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleDownload = async () => {
    if (!sop) return;
    setDownloading(true);
    setDownloadError(false);
    try {
      const blob = await buildSopDocxBlob(sop);
      downloadBlob(blob, `${slugifySopTitle(sop.content.title)}.docx`);
    } catch {
      setDownloadError(true);
      setTimeout(() => setDownloadError(false), 2000);
    } finally {
      setDownloading(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-hairline bg-surface shadow-card-hover"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-hairline p-5">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold text-heading">{sop?.content.title ?? "SOP"}</h2>
            {sop?.content.subtitle && <p className="mt-0.5 truncate text-sm text-body">{sop.content.subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-body hover:bg-app hover:text-heading"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {error && <p className="text-sm text-danger">Couldn&rsquo;t load this SOP. It may have been deleted.</p>}
          {loading && (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-subtle">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading SOP…
            </div>
          )}
          {sop && (
            <>
              <p className="mb-5 rounded-card border border-accent-line bg-accent px-4 py-3 text-sm font-medium leading-relaxed text-primary">
                {sop.content.onelinePromise}
              </p>
              <SopDocument markdown={formatSopAsMarkdown(sop)} />
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-hairline p-4">
          <div className="relative">
            <button
              type="button"
              onClick={handleDownload}
              disabled={!sop || downloading}
              className="inline-flex items-center gap-1.5 rounded-full border border-hairline bg-surface px-4 py-2 text-sm font-semibold text-heading transition-colors hover:bg-app disabled:opacity-50"
            >
              {downloading ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> : <FileDown className="h-4 w-4 shrink-0" />}
              Download DOCX
            </button>
            {downloadError && (
              <span className="absolute bottom-full left-1/2 mb-2 w-max -translate-x-1/2 rounded-chip bg-danger px-2.5 py-1 text-xs font-semibold text-white">
                Download failed
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={handleCopy}
            disabled={!sop}
            className="inline-flex items-center gap-1.5 rounded-full bg-btn-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-btn-primary-hover disabled:opacity-50"
          >
            {copied ? <Check className="h-4 w-4 shrink-0" /> : <Copy className="h-4 w-4 shrink-0" />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
