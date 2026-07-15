"use client";

import { useState } from "react";
import { Download, Link as LinkIcon, Music, Video } from "lucide-react";
import type { DownloadFormat } from "@/lib/types";
import { RECENT_DOWNLOADS } from "@/lib/mock-data";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { cn, formatDate } from "@/lib/utils";

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

  return (
    <div className="flex flex-col gap-6 pt-2">
      <div>
        <h2 className="text-lg font-semibold text-heading">Downloader</h2>
        <p className="mt-1 text-sm text-body">
          Download high-quality videos or MP3 audio from TikTok, YouTube, & Instagram.
        </p>
      </div>

      <Card className="flex flex-col gap-4">
        <div className="relative">
          <LinkIcon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-body" />
          <input
            type="text"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="Paste video link here (TikTok, YouTube, Instagram)..."
            className="w-full rounded-card-sm border border-hairline bg-app py-3 pl-11 pr-4 text-sm text-heading placeholder:text-body focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {FORMAT_OPTIONS.map((option) => {
              const active = format === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setFormat(option.value)}
                  className={cn(
                    "flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors",
                    active
                      ? "border-primary bg-accent text-primary"
                      : "border-hairline bg-surface text-body hover:bg-app"
                  )}
                >
                  <option.icon className="h-4 w-4" />
                  {option.label}
                </button>
              );
            })}
          </div>

          <Button variant="primary" icon={Download} disabled={!url.trim()}>
            Download
          </Button>
        </div>
      </Card>

      <div className="flex flex-col gap-3">
        <h3 className="text-lg font-medium text-heading">Recent Downloads</h3>

        <Card padded={false}>
          {RECENT_DOWNLOADS.map((item, index) => (
            <div
              key={item.id}
              className={cn(
                "flex items-center gap-4 px-6 py-4",
                index !== RECENT_DOWNLOADS.length - 1 && "border-b border-hairline"
              )}
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-chip bg-accent text-primary">
                {item.format === "mp4" ? <Video className="h-5 w-5" /> : <Music className="h-5 w-5" />}
              </div>

              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <p className="truncate text-sm font-medium text-heading">{item.title}</p>
                <div className="flex items-center gap-2 text-xs text-body">
                  <Badge>{PLATFORM_LABEL[item.platform]}</Badge>
                  <span>
                    {item.format.toUpperCase()} &middot; {formatDownloadedAt(item.createdAt)}
                  </span>
                </div>
              </div>

              <Button variant="secondary" size="sm" icon={Download} className="shrink-0">
                Download Again
              </Button>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}
