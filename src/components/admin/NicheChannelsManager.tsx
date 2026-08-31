"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { EyeOff, Loader2, Plus, RefreshCw, Sparkles, X, Zap } from "lucide-react";
import type {
  AdminNicheChannel,
  FacelessCategory,
  FacelessClassification,
  FacelessComplexity,
  NicheBendPlatform,
} from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Table, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/Table";
import { cn, formatDate } from "@/lib/utils";
import { NAME_MAX, URL_MAX, isSafeFreeText, isValidName, isValidUrl } from "@/lib/validation";

const REASONING_MAX = 2000;

const inputClass =
  "w-full rounded-lg border border-hairline bg-surface px-3 py-2 text-sm text-heading outline-none placeholder:text-subtle focus:border-primary";
const labelClass = "mb-1.5 block text-xs font-medium text-body";

const FACELESS_CATEGORIES: FacelessCategory[] = [
  "2D Animation",
  "3D Animation",
  "Whiteboard",
  "Stock Footage",
  "AI Pictures",
  "Screen Recording",
  "Documentary",
];
const COMPLEXITY_LEVELS: FacelessComplexity[] = ["EASY", "MEDIUM", "HARD", "LEGENDARY"];

interface IngestFormState {
  url: string;
  platform: NicheBendPlatform;
  niche: string;
  videoType: "shorts" | "long-form";
}

const EMPTY_INGEST_FORM: IngestFormState = { url: "", platform: "youtube", niche: "", videoType: "shorts" };

interface PreviewState {
  channelId: string;
  channelTitle: string;
  classification: FacelessClassification;
}

interface BatchProgress {
  classified: number;
  failed: number;
  total: number;
}

interface BatchEvent {
  type: "start" | "progress" | "done";
  channelId?: string;
  channelTitle?: string;
  ok?: boolean;
  classification?: FacelessClassification;
  error?: string;
  classified?: number;
  failed?: number;
  total: number;
}

interface DiscoverySyncProgress {
  ingestedCount: number;
}

function statusOf(channel: AdminNicheChannel): { label: string; variant: "success" | "warning" | "danger" | "default" } {
  if (channel.isFaceless == null) return { label: "Unverified", variant: "default" };
  if (channel.isFaceless && (channel.facelessConfidence ?? 0) >= 85) {
    return { label: `Faceless · ${channel.facelessConfidence}%`, variant: "success" };
  }
  if (channel.isFaceless) return { label: `Faceless · ${channel.facelessConfidence}% (low)`, variant: "warning" };
  return { label: "Not faceless", variant: "danger" };
}

export function NicheChannelsManager({ initialChannels }: { initialChannels: AdminNicheChannel[] }) {
  const [channels, setChannels] = useState(initialChannels);

  const [isIngestOpen, setIsIngestOpen] = useState(false);
  const [ingestForm, setIngestForm] = useState<IngestFormState>(EMPTY_INGEST_FORM);
  const [ingestSubmitting, setIngestSubmitting] = useState(false);
  const [ingestError, setIngestError] = useState<string | null>(null);

  const [classifyingId, setClassifyingId] = useState<string | null>(null);
  const [classifyError, setClassifyError] = useState<{ id: string; message: string } | null>(null);
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [approving, setApproving] = useState(false);
  const [approveError, setApproveError] = useState<string | null>(null);

  const [batchRunning, setBatchRunning] = useState(false);
  const [batchProgress, setBatchProgress] = useState<BatchProgress | null>(null);
  const [batchError, setBatchError] = useState<string | null>(null);

  const [tiktokSyncRunning, setTiktokSyncRunning] = useState(false);
  const [tiktokSyncProgress, setTiktokSyncProgress] = useState<DiscoverySyncProgress | null>(null);
  const [tiktokSyncError, setTiktokSyncError] = useState<string | null>(null);

  const [youtubeSyncRunning, setYoutubeSyncRunning] = useState(false);
  const [youtubeSyncProgress, setYoutubeSyncProgress] = useState<DiscoverySyncProgress | null>(null);
  const [youtubeSyncError, setYoutubeSyncError] = useState<string | null>(null);

  function openIngestModal() {
    setIngestForm(EMPTY_INGEST_FORM);
    setIngestError(null);
    setIsIngestOpen(true);
  }

  async function handleIngestSubmit(event: FormEvent) {
    event.preventDefault();
    if (!isValidUrl(ingestForm.url, URL_MAX)) {
      setIngestError("A valid channel URL is required");
      return;
    }
    if (ingestForm.niche.trim() && !isValidName(ingestForm.niche.trim(), NAME_MAX)) {
      setIngestError("Niche contains invalid characters or is too long");
      return;
    }

    setIngestSubmitting(true);
    setIngestError(null);

    const res = await fetch("/api/admin/niche-channels", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: ingestForm.url.trim(),
        platform: ingestForm.platform,
        niche: ingestForm.niche.trim() || undefined,
        videoType: ingestForm.videoType,
      }),
    });
    const data = await res.json();
    setIngestSubmitting(false);

    if (!res.ok) {
      setIngestError(data.error ?? "Failed to ingest channel");
      return;
    }

    setChannels((prev) => [
      {
        id: data.channelId,
        platform: ingestForm.platform,
        channelUrl: ingestForm.url.trim(),
        channelTitle: data.channelTitle,
        avatarUrl: null,
        subscriberCount: 0,
        totalViews: 0,
        niche: ingestForm.niche.trim() || null,
        isFaceless: null,
        facelessConfidence: null,
        facelessCategory: null,
        complexity: null,
        viralVelocityScore: null,
        verifiedAt: null,
        createdAt: new Date().toISOString(),
      },
      ...prev,
    ]);
    setIsIngestOpen(false);
  }

  async function handleClassify(channel: AdminNicheChannel) {
    setClassifyingId(channel.id);
    setClassifyError(null);

    const res = await fetch(`/api/admin/niche-channels/${channel.id}/classify`, { method: "POST" });
    const data = await res.json();
    setClassifyingId(null);

    if (!res.ok) {
      setClassifyError({ id: channel.id, message: data.error ?? "Classification failed" });
      return;
    }

    setPreview({ channelId: channel.id, channelTitle: channel.channelTitle, classification: data.classification });
    setApproveError(null);
  }

  function updatePreviewField<K extends keyof FacelessClassification>(key: K, value: FacelessClassification[K]) {
    setPreview((prev) => (prev ? { ...prev, classification: { ...prev.classification, [key]: value } } : prev));
  }

  async function handleApprove() {
    if (!preview) return;
    if (!isSafeFreeText(preview.classification.reasoning, REASONING_MAX)) {
      setApproveError(`Reasoning must be ${REASONING_MAX} characters or fewer and contain no HTML or control characters`);
      return;
    }
    setApproving(true);
    setApproveError(null);

    const res = await fetch(`/api/admin/niche-channels/${preview.channelId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(preview.classification),
    });
    const data = await res.json();
    setApproving(false);

    if (!res.ok) {
      setApproveError(data.error ?? "Failed to save classification");
      return;
    }

    const { classification } = preview;
    setChannels((prev) =>
      prev.map((c) =>
        c.id === preview.channelId
          ? {
              ...c,
              isFaceless: classification.is_faceless,
              facelessConfidence: classification.confidence_score,
              facelessCategory: classification.faceless_category,
              complexity: classification.complexity,
              viralVelocityScore: classification.viral_velocity_score,
              verifiedAt: new Date().toISOString(),
            }
          : c
      )
    );
    setPreview(null);
  }

  // Runs the classifier over every unclassified channel in one request
  // (verified_at IS NULL, capped at 25 per run server-side -- see
  // BATCH_LIMIT in the route). The route streams one NDJSON line per
  // channel as it finishes, which is read here incrementally so the
  // "Classified X/Y" counter updates live instead of jumping once at the end.
  async function handleBatchClassify() {
    setBatchRunning(true);
    setBatchError(null);
    setBatchProgress(null);

    try {
      const res = await fetch("/api/admin/niches/batch-classify", { method: "POST" });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Batch classification failed to start");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;
          const event: BatchEvent = JSON.parse(line);

          setBatchProgress({ classified: event.classified ?? 0, failed: event.failed ?? 0, total: event.total });

          if (event.type === "progress" && event.ok && event.channelId && event.classification) {
            const classification = event.classification;
            const channelId = event.channelId;
            setChannels((prev) =>
              prev.map((c) =>
                c.id === channelId
                  ? {
                      ...c,
                      isFaceless: classification.is_faceless,
                      facelessConfidence: classification.confidence_score,
                      facelessCategory: classification.faceless_category,
                      complexity: classification.complexity,
                      viralVelocityScore: classification.viral_velocity_score,
                      verifiedAt: new Date().toISOString(),
                    }
                  : c
              )
            );
          }
        }
      }
    } catch (err) {
      setBatchError(err instanceof Error ? err.message : "Batch classification failed");
    } finally {
      setBatchRunning(false);
    }
  }

  // Shared by both platform syncs -- discovers real trending channels (no
  // guessed URLs; see faceless-tiktok-discovery.ts / faceless-youtube-discovery.ts)
  // and upserts them raw/unclassified (no Gemini pass -- see the route
  // comments), then refetches the full channel list so newly discovered rows
  // (not just updates to ones already on screen) show up.
  async function runDiscoverySync(
    endpoint: string,
    label: string,
    setRunning: (v: boolean) => void,
    setProgress: (v: DiscoverySyncProgress | null) => void,
    setError: (v: string | null) => void
  ) {
    setRunning(true);
    setError(null);
    setProgress(null);

    try {
      const res = await fetch(endpoint, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error ?? `${label} sync failed`);
      }

      setProgress({ ingestedCount: data.ingestedCount ?? 0 });

      const listRes = await fetch("/api/admin/niche-channels");
      if (listRes.ok) {
        const listData = await listRes.json();
        setChannels(listData.channels ?? []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : `${label} sync failed`);
    } finally {
      setRunning(false);
    }
  }

  const handleSyncTikTok = () =>
    runDiscoverySync("/api/admin/niches/ingest-tiktok", "TikTok", setTiktokSyncRunning, setTiktokSyncProgress, setTiktokSyncError);
  const handleSyncYoutube = () =>
    runDiscoverySync("/api/admin/niches/ingest-youtube", "YouTube", setYoutubeSyncRunning, setYoutubeSyncProgress, setYoutubeSyncError);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-heading">Niche Channels</h2>
          <p className="text-xs text-body">
            Ingest channels -- raw, unclassified, visible on Niche Finder immediately. Classify manually below if you
            want a faceless verdict on a channel.
          </p>
          {batchRunning && batchProgress && (
            <p className="mt-1 text-xs font-medium text-primary">
              Classified {batchProgress.classified}/{batchProgress.total} channels
              {batchProgress.failed > 0 ? ` · ${batchProgress.failed} failed` : ""}…
            </p>
          )}
          {!batchRunning && batchProgress && (
            <p className="mt-1 text-xs font-medium text-body">
              Done. Classified {batchProgress.classified}/{batchProgress.total} channels
              {batchProgress.failed > 0 ? ` (${batchProgress.failed} failed)` : ""}.
            </p>
          )}
          {batchError && <p className="mt-1 text-xs text-danger">{batchError}</p>}
          {tiktokSyncRunning && <p className="mt-1 text-xs font-medium text-primary">Syncing TikTok trends…</p>}
          {!tiktokSyncRunning && tiktokSyncProgress && (
            <p className="mt-1 text-xs font-medium text-body">
              Done. Ingested {tiktokSyncProgress.ingestedCount} TikTok channels (raw, unclassified).
            </p>
          )}
          {tiktokSyncError && <p className="mt-1 text-xs text-danger">{tiktokSyncError}</p>}
          {youtubeSyncRunning && <p className="mt-1 text-xs font-medium text-primary">Syncing YouTube trends…</p>}
          {!youtubeSyncRunning && youtubeSyncProgress && (
            <p className="mt-1 text-xs font-medium text-body">
              Done. Ingested {youtubeSyncProgress.ingestedCount} YouTube channels (raw, unclassified).
            </p>
          )}
          {youtubeSyncError && <p className="mt-1 text-xs text-danger">{youtubeSyncError}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            icon={tiktokSyncRunning ? Loader2 : RefreshCw}
            onClick={handleSyncTikTok}
            disabled={tiktokSyncRunning}
            className={tiktokSyncRunning ? "[&_svg]:animate-spin" : undefined}
          >
            {tiktokSyncRunning ? "Syncing…" : "Sync Real TikTok Trends"}
          </Button>
          <Button
            variant="secondary"
            icon={youtubeSyncRunning ? Loader2 : RefreshCw}
            onClick={handleSyncYoutube}
            disabled={youtubeSyncRunning}
            className={youtubeSyncRunning ? "[&_svg]:animate-spin" : undefined}
          >
            {youtubeSyncRunning ? "Syncing…" : "Sync Real YouTube Trends"}
          </Button>
          <Button
            variant="secondary"
            icon={batchRunning ? Loader2 : Zap}
            onClick={handleBatchClassify}
            disabled={batchRunning}
            className={batchRunning ? "[&_svg]:animate-spin" : undefined}
          >
            {batchRunning ? "Classifying…" : "Run Faceless Classifier on All Channels"}
          </Button>
          <Button icon={Plus} onClick={openIngestModal}>
            Ingest Channel
          </Button>
        </div>
      </div>

      <Card>
        {channels.length === 0 ? (
          <EmptyState icon={EyeOff} title="No channels yet" description="Ingest a channel URL to start classifying it." />
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Channel</TableHeaderCell>
                <TableHeaderCell>Platform</TableHeaderCell>
                <TableHeaderCell>Niche</TableHeaderCell>
                <TableHeaderCell>Status</TableHeaderCell>
                <TableHeaderCell>Complexity</TableHeaderCell>
                <TableHeaderCell>Viral velocity</TableHeaderCell>
                <TableHeaderCell>Ingested</TableHeaderCell>
                <TableHeaderCell className="text-right">Actions</TableHeaderCell>
              </TableRow>
            </TableHead>
            <tbody>
              {channels.map((channel) => {
                const status = statusOf(channel);
                const isClassifying = classifyingId === channel.id;
                return (
                  <TableRow key={channel.id}>
                    <TableCell className="max-w-[220px]">
                      <a
                        href={channel.channelUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="truncate font-semibold text-heading hover:text-primary hover:underline"
                        title={channel.channelTitle}
                      >
                        {channel.channelTitle}
                      </a>
                    </TableCell>
                    <TableCell className="text-body capitalize">{channel.platform}</TableCell>
                    <TableCell className="text-body">{channel.niche ?? "N/A"}</TableCell>
                    <TableCell>
                      <Badge variant={status.variant}>{status.label}</Badge>
                      {classifyError?.id === channel.id && <p className="mt-1 text-[11px] text-danger">{classifyError.message}</p>}
                    </TableCell>
                    <TableCell className="text-body">{channel.complexity ?? "N/A"}</TableCell>
                    <TableCell className="tabular-nums text-body">
                      {channel.viralVelocityScore != null ? `${channel.viralVelocityScore}/100` : "N/A"}
                    </TableCell>
                    <TableCell className="text-body">{formatDate(channel.createdAt)}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="secondary"
                        size="sm"
                        icon={isClassifying ? Loader2 : Sparkles}
                        disabled={isClassifying}
                        onClick={() => handleClassify(channel)}
                        className={isClassifying ? "[&_svg]:animate-spin" : undefined}
                      >
                        {isClassifying ? "Classifying…" : "Auto-Classify with AI"}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>

      {isIngestOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm" onClick={() => setIsIngestOpen(false)}>
          <div className="w-full max-w-sm rounded-xl bg-surface shadow-card-hover" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-hairline p-5">
              <h2 className="text-lg font-semibold text-heading">Ingest channel</h2>
              <button type="button" onClick={() => setIsIngestOpen(false)} aria-label="Close" className="text-body hover:text-heading">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleIngestSubmit}>
              <div className="flex flex-col gap-4 p-5">
                <div>
                  <label className={labelClass}>Channel URL</label>
                  <input
                    type="url"
                    required
                    maxLength={URL_MAX}
                    value={ingestForm.url}
                    onChange={(event) => setIngestForm((prev) => ({ ...prev, url: event.target.value }))}
                    className={inputClass}
                    placeholder="https://youtube.com/@channel"
                  />
                </div>
                <div>
                  <label className={labelClass}>Platform</label>
                  <select
                    value={ingestForm.platform}
                    onChange={(event) => setIngestForm((prev) => ({ ...prev, platform: event.target.value as NicheBendPlatform }))}
                    className={inputClass}
                  >
                    <option value="youtube">YouTube</option>
                    <option value="tiktok">TikTok</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Video type</label>
                  <select
                    value={ingestForm.videoType}
                    onChange={(event) =>
                      setIngestForm((prev) => ({ ...prev, videoType: event.target.value as IngestFormState["videoType"] }))
                    }
                    className={inputClass}
                  >
                    <option value="shorts">Shorts</option>
                    <option value="long-form">Long-form</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Niche (optional)</label>
                  <input
                    type="text"
                    maxLength={NAME_MAX}
                    value={ingestForm.niche}
                    onChange={(event) => setIngestForm((prev) => ({ ...prev, niche: event.target.value }))}
                    className={inputClass}
                    placeholder="e.g. Medical Malpractice"
                  />
                </div>
                {ingestError && <p className="text-xs text-danger">{ingestError}</p>}
              </div>

              <div className="flex justify-end gap-3 border-t border-hairline p-5">
                <button
                  type="button"
                  onClick={() => setIsIngestOpen(false)}
                  className="rounded-md border border-hairline bg-surface px-4 py-2 text-sm font-medium text-body hover:bg-app"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={ingestSubmitting}
                  className="rounded-md bg-btn-primary px-4 py-2 text-sm font-medium text-white hover:bg-btn-primary-hover disabled:opacity-50"
                >
                  {ingestSubmitting ? "Ingesting…" : "Ingest"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm" onClick={() => setPreview(null)}>
          <div className="w-full max-w-lg rounded-xl bg-surface shadow-card-hover" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-hairline p-5">
              <div>
                <h2 className="text-lg font-semibold text-heading">Classification preview</h2>
                <p className="text-xs text-body">{preview.channelTitle}</p>
              </div>
              <button type="button" onClick={() => setPreview(null)} aria-label="Close" className="text-body hover:text-heading">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex flex-col gap-4 p-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Is faceless?</label>
                  <select
                    value={preview.classification.is_faceless ? "true" : "false"}
                    onChange={(event) => updatePreviewField("is_faceless", event.target.value === "true")}
                    className={inputClass}
                  >
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Confidence score</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={preview.classification.confidence_score}
                    onChange={(event) => updatePreviewField("confidence_score", Number(event.target.value))}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Category</label>
                  <select
                    value={preview.classification.faceless_category}
                    onChange={(event) => updatePreviewField("faceless_category", event.target.value as FacelessCategory)}
                    className={inputClass}
                  >
                    {FACELESS_CATEGORIES.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Complexity</label>
                  <select
                    value={preview.classification.complexity}
                    onChange={(event) => updatePreviewField("complexity", event.target.value as FacelessComplexity)}
                    className={inputClass}
                  >
                    {COMPLEXITY_LEVELS.map((level) => (
                      <option key={level} value={level}>
                        {level}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className={labelClass}>Viral velocity score</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={preview.classification.viral_velocity_score}
                    onChange={(event) => updatePreviewField("viral_velocity_score", Number(event.target.value))}
                    className={inputClass}
                  />
                </div>
              </div>
              <div>
                <label className={labelClass}>Reasoning</label>
                <textarea
                  value={preview.classification.reasoning}
                  onChange={(event) => updatePreviewField("reasoning", event.target.value)}
                  rows={4}
                  maxLength={REASONING_MAX}
                  className={cn(inputClass, "resize-none")}
                />
              </div>
              {approveError && <p className="text-xs text-danger">{approveError}</p>}
            </div>

            <div className="flex justify-end gap-3 border-t border-hairline p-5">
              <button
                type="button"
                onClick={() => setPreview(null)}
                className="rounded-md border border-hairline bg-surface px-4 py-2 text-sm font-medium text-body hover:bg-app"
              >
                Discard
              </button>
              <button
                type="button"
                onClick={handleApprove}
                disabled={approving}
                className="rounded-md bg-btn-primary px-4 py-2 text-sm font-medium text-white hover:bg-btn-primary-hover disabled:opacity-50"
              >
                {approving ? "Saving…" : "Approve & Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
