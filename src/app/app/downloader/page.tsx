"use client";

import { useEffect, useState } from "react";
import { Download, Link as LinkIcon, Loader2, Music, Video } from "lucide-react";
import type { DownloadFormat, DownloadPlatform } from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { cn, formatDate } from "@/lib/utils";

interface DownloadRow {
  id: string;
  source_url: string;
  platform: DownloadPlatform;
  format: DownloadFormat;
  status: "queued" | "processing" | "complete" | "failed";
  title: string | null;
  file_path: string | null;
  created_at: string;
}

const FORMAT_OPTIONS: { value: DownloadFormat; label: string; icon: typeof Video }[] = [
  { value: "mp4", label: "Video (MP4)", icon: Video },
  { value: "mp3", label: "Audio (MP3)", icon: Music },
];

const PLATFORM_LABEL: Record<string, string> = {
  tiktok: "TikTok",
  youtube: "YouTube",
  instagram: "Instagram",
};

function formatDownloadedAt(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const time = date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  if (isSameDay(date, now)) return `Today at ${time}`;

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (isSameDay(date, yesterday)) return `Yesterday at ${time}`;

  return formatDate(iso);
}

export default function DownloaderPage() {
  const [url, setUrl] = useState("");
  const [format, setFormat] = useState<DownloadFormat>("mp4");
  const [downloads, setDownloads] = useState<DownloadRow[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDownloads();
  }, []);

  async function fetchDownloads() {
    const res = await fetch("/api/downloads");
    if (res.ok) {
      const data = await res.json();
      setDownloads(data.downloads);
    }
  }

  function pollUntilSettled(id: string) {
    const interval = setInterval(async () => {
      const res = await fetch(`/api/downloads/status/${id}`);
      if (!res.ok) return;
      const { download } = await res.json();
      setDownloads((prev) => prev.map((d) => (d.id === id ? download : d)));
      if (download.status === "complete" || download.status === "failed") {
        clearInterval(interval);
      }
    }, 1500);
  }

  async function handleDownload() {
    if (!url.trim()) return;
    setSubmitting(true);
    setError(null);

    const res = await fetch("/api/downloads/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: url.trim(), format }),
    });
    const data = await res.json();
    setSubmitting(false);

    if (!res.ok) {
      setError(data.error ?? "Could not start download");
      return;
    }

    setUrl("");
    await fetchDownloads();
    pollUntilSettled(data.id);
  }

  return (
    <div className="flex flex-col gap-6 pt-2">
      <div>
        <h2 className="text-lg font-semibold text-heading">Downloader</h2>
        <p className="mt-1 text-sm text-body">
          Download high-quality videos or MP3 audio from TikTok, YouTube, & Instagram.
        </p>
      </div>

      <Card className="flex flex-col gap-4 !p-4 sm:!p-6">
        <div className="relative">
          <LinkIcon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-body" />
          <input
            type="text"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="Paste video link here (TikTok, YouTube, Instagram)..."
            className="w-full rounded-card-sm border border-hairline bg-app py-3 pl-11 pr-4 text-[13px] text-heading placeholder:text-body focus:outline-none focus:ring-2 focus:ring-primary/30 sm:text-sm"
          />
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}

        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="grid grid-cols-2 gap-2 sm:flex sm:w-auto sm:items-center">
            {FORMAT_OPTIONS.map((option) => {
              const active = format === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setFormat(option.value)}
                  className={cn(
                    "flex items-center justify-center gap-2 rounded-full border px-4 py-2.5 text-[13px] font-medium transition-colors sm:justify-start sm:py-2 sm:text-sm",
                    active
                      ? "border-primary bg-accent text-primary"
                      : "border-hairline bg-surface text-body hover:bg-app"
                  )}
                >
                  <option.icon className="h-4 w-4 shrink-0" />
                  {option.label}
                </button>
              );
            })}
          </div>

          <Button
            variant="primary"
            icon={submitting ? Loader2 : Download}
            disabled={!url.trim() || submitting}
            onClick={handleDownload}
            className="w-full sm:w-auto"
          >
            {submitting ? "Starting…" : "Download"}
          </Button>
        </div>
      </Card>

      <div className="flex flex-col gap-3">
        <h3 className="text-lg font-medium text-heading">Recent Downloads</h3>

        {downloads.length === 0 ? (
          <Card className="py-10 text-center text-sm text-body">No downloads yet.</Card>
        ) : (
          <Card padded={false}>
            {downloads.map((item, index) => (
              <div
                key={item.id}
                className={cn(
                  "flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:gap-4 sm:px-6",
                  index !== downloads.length - 1 && "border-b border-hairline"
                )}
              >
                <div className="flex min-w-0 items-center gap-3 sm:flex-1 sm:gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-chip bg-accent text-primary sm:h-11 sm:w-11">
                    {item.format === "mp4" ? <Video className="h-4.5 w-4.5 sm:h-5 sm:w-5" /> : <Music className="h-4.5 w-4.5 sm:h-5 sm:w-5" />}
                  </div>

                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <p className="truncate text-[13px] font-medium text-heading sm:text-sm">
                      {item.title ?? item.source_url}
                    </p>
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-body sm:gap-2 sm:text-xs">
                      <Badge>{PLATFORM_LABEL[item.platform]}</Badge>
                      {item.status !== "complete" && (
                        <Badge variant={item.status === "failed" ? "danger" : "warning"}>{item.status}</Badge>
                      )}
                      <span className="truncate">
                        {item.format.toUpperCase()} &middot; {formatDownloadedAt(item.created_at)}
                      </span>
                    </div>
                  </div>
                </div>

                {item.status === "complete" && item.file_path ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={Download}
                    href={item.file_path}
                    target="_blank"
                    className="w-full shrink-0 sm:w-auto"
                  >
                    Download
                  </Button>
                ) : (
                  <Button variant="secondary" size="sm" icon={Download} disabled className="w-full shrink-0 sm:w-auto">
                    Download
                  </Button>
                )}
              </div>
            ))}
          </Card>
        )}
      </div>
    </div>
  );
}
