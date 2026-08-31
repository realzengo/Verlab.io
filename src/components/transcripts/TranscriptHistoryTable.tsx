"use client";

import { useMemo, useRef, useState, useEffect, useLayoutEffect, forwardRef } from "react";
import type { ComponentType, CSSProperties } from "react";
import { createPortal } from "react-dom";
import type { LucideIcon } from "lucide-react";
import {
  Bookmark,
  Check,
  ChevronDown,
  Download,
  Eye,
  ListFilter,
  MoreVertical,
  PlayCircle,
  Search,
  Smartphone,
  Trash2,
  X,
} from "lucide-react";
import type { TranscriptRow, TranscriptRowStatus } from "@/lib/types";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { Table, TableHead, TableRow, TableHeaderCell, TableCell } from "@/components/ui/Table";
import { TikTokIcon, InstagramIcon, YouTubeIcon } from "@/components/landing/PlatformIcons";
import { cn, formatDate, formatNumber } from "@/lib/utils";

type PlatformFilterValue = "all" | TranscriptRow["platform"];
type StatusFilterValue = "all" | TranscriptRowStatus;

const STATUS_META: Record<TranscriptRowStatus, { label: string; variant: "success" | "warning" | "danger" | "default" }> = {
  complete: { label: "Complete", variant: "success" },
  processing: { label: "Processing", variant: "warning" },
  queued: { label: "Queued", variant: "default" },
  failed: { label: "Failed", variant: "danger" },
};

const PLATFORM_META = {
  tiktok: { label: "TikTok", icon: TikTokIcon },
  reels: { label: "Reels", icon: InstagramIcon },
  shorts: { label: "Shorts", icon: YouTubeIcon },
} satisfies Record<TranscriptRow["platform"], { label: string; icon: ComponentType<{ className?: string }> }>;

const STATUS_OPTIONS: { value: StatusFilterValue; label: string }[] = [
  { value: "all", label: "All" },
  { value: "complete", label: STATUS_META.complete.label },
  { value: "processing", label: STATUS_META.processing.label },
  { value: "queued", label: STATUS_META.queued.label },
  { value: "failed", label: STATUS_META.failed.label },
];

const PLATFORM_OPTIONS: { value: PlatformFilterValue; label: string }[] = [
  { value: "all", label: "All" },
  { value: "tiktok", label: PLATFORM_META.tiktok.label },
  { value: "reels", label: PLATFORM_META.reels.label },
  { value: "shorts", label: PLATFORM_META.shorts.label },
];

interface PlaceholderMeta {
  handle: string;
  views: number;
  bookmarked: boolean;
}

function hashSeed(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return hash;
}

// Backend doesn't track author handle / views / bookmarks yet — derive stable
// placeholder values from the row id so the columns have something realistic
// to show until those fields exist for real.
function derivePlaceholderMeta(row: TranscriptRow): PlaceholderMeta {
  const seed = hashSeed(row.id);
  const slug = (row.title ?? "creator").toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 14);

  return {
    handle: `@${slug || "creator"}`,
    views: 1_200 + (seed % 480_000),
    bookmarked: seed % 4 === 0,
  };
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return "--:--";
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function useClickOutside<T extends HTMLElement>(active: boolean, onClose: () => void) {
  const ref = useRef<T>(null);

  useEffect(() => {
    if (!active) return;
    function handlePointerDown(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) onClose();
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [active, onClose]);

  return ref;
}

// Menus opened from within the table need to render through a portal, since
// the table's overflow-x-auto scroll container would otherwise clip them.
// "side" opens to the left of the trigger (so it stays fully visible even
// when the row is near the bottom of the viewport); "bottom" drops below it.
function useAnchoredMenu(placement: "side" | "bottom" = "side") {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<CSSProperties | null>(null);

  useLayoutEffect(() => {
    if (!open || !anchorRef.current) {
      setStyle(null);
      return;
    }
    function update() {
      const rect = anchorRef.current!.getBoundingClientRect();
      if (placement === "side") {
        setStyle({
          position: "fixed",
          top: rect.top,
          right: window.innerWidth - rect.left + 8,
          zIndex: 50,
        });
      } else {
        setStyle({
          position: "fixed",
          top: rect.bottom + 8,
          right: window.innerWidth - rect.right,
          zIndex: 50,
        });
      }
    }
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open, placement]);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (anchorRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  return { open, setOpen, anchorRef, menuRef, style };
}

function FilterDropdown<T extends string>({
  label,
  icon: Icon,
  value,
  valueLabel,
  options,
  onChange,
}: {
  label: string;
  icon: LucideIcon;
  value: T;
  valueLabel: string;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useClickOutside<HTMLDivElement>(open, () => setOpen(false));

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-2 rounded-md border border-hairline bg-surface px-3.5 py-1.5 text-xs font-medium text-heading hover:bg-app"
      >
        <Icon className="h-3.5 w-3.5 shrink-0 text-body" />
        {label}: {valueLabel}
        <ChevronDown className="h-3.5 w-3.5 text-body" />
      </button>
      {open && (
        <div className="absolute left-0 z-20 mt-2 w-48 rounded-card-sm border border-hairline bg-surface p-1.5 shadow-card-hover">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
              className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-sm text-heading hover:bg-accent"
            >
              {option.label}
              {option.value === value && <Check className="h-3.5 w-3.5 text-primary" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function CoverThumbnail({ src, alt }: { src: string | null; alt?: string }) {
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(src) && !failed;

  return (
    <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-ink text-white">
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src!}
          alt={alt ?? ""}
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover"
        />
      ) : (
        <PlayCircle className="h-4 w-4 text-white/70" />
      )}
    </div>
  );
}

const IconButton = forwardRef<
  HTMLButtonElement,
  {
    icon: LucideIcon;
    label: string;
    onClick?: () => void;
    disabled?: boolean;
    active?: boolean;
  }
>(function IconButton({ icon: Icon, label, onClick, disabled, active }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      aria-label={label}
      className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-colors disabled:opacity-40 disabled:pointer-events-none",
        active ? "border-transparent bg-accent text-primary" : "border-hairline bg-surface text-body hover:bg-app hover:text-heading"
      )}
    >
      <Icon className={cn("h-4 w-4", active && "fill-current")} />
    </button>
  );
});

function RowMenu({
  onView,
  viewDisabled,
  onExport,
  exportDisabled,
  onDelete,
}: {
  onView: () => void;
  viewDisabled: boolean;
  onExport: () => void;
  exportDisabled: boolean;
  onDelete: () => void;
}) {
  const { open, setOpen, anchorRef, menuRef, style } = useAnchoredMenu();

  return (
    <>
      <IconButton ref={anchorRef} icon={MoreVertical} label="More actions" onClick={() => setOpen((o) => !o)} />
      {open &&
        style &&
        createPortal(
          <div ref={menuRef} style={style} className="w-44 rounded-card-sm border border-hairline bg-surface p-1.5 shadow-card-hover">
            <button
              type="button"
              disabled={viewDisabled}
              onClick={() => {
                onView();
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-heading hover:bg-accent disabled:opacity-40 disabled:pointer-events-none"
            >
              <Eye className="h-3.5 w-3.5" />
              View transcript
            </button>
            <button
              type="button"
              disabled={exportDisabled}
              onClick={() => {
                onExport();
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-heading hover:bg-accent disabled:opacity-40 disabled:pointer-events-none"
            >
              <Download className="h-3.5 w-3.5" />
              Export as .txt
            </button>
            <div className="my-1 border-t border-hairline" />
            <button
              type="button"
              onClick={() => {
                onDelete();
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-danger hover:bg-danger-tint"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </button>
          </div>,
          document.body
        )}
    </>
  );
}

export function TranscriptHistoryTable({
  rows,
  onOpenRow,
  onDeleteRows,
}: {
  rows: TranscriptRow[];
  onOpenRow: (row: TranscriptRow) => void;
  onDeleteRows: (ids: string[]) => void | Promise<void>;
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilterValue>("all");
  const [platformFilter, setPlatformFilter] = useState<PlatformFilterValue>("all");
  const [bookmarkedOnly, setBookmarkedOnly] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bookmarkOverrides, setBookmarkOverrides] = useState<Record<string, boolean>>({});
  const [deleting, setDeleting] = useState(false);
  const [pendingDeleteIds, setPendingDeleteIds] = useState<string[] | null>(null);

  const meta = useMemo(() => {
    const map = new Map<string, PlaceholderMeta>();
    rows.forEach((row) => map.set(row.id, derivePlaceholderMeta(row)));
    return map;
  }, [rows]);

  function bookmarkedFor(row: TranscriptRow): boolean {
    return row.id in bookmarkOverrides ? bookmarkOverrides[row.id] : (meta.get(row.id)?.bookmarked ?? false);
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      const rowMeta = meta.get(row.id);
      if (!rowMeta) return false;
      if (statusFilter !== "all" && row.status !== statusFilter) return false;
      if (platformFilter !== "all" && row.platform !== platformFilter) return false;
      const bookmarked = row.id in bookmarkOverrides ? bookmarkOverrides[row.id] : rowMeta.bookmarked;
      if (bookmarkedOnly && !bookmarked) return false;
      if (q) {
        const haystack = `${row.title ?? ""} ${row.source_url} ${rowMeta.handle}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [rows, meta, search, statusFilter, platformFilter, bookmarkedOnly, bookmarkOverrides]);

  const allSelected = filtered.length > 0 && filtered.every((row) => selected.has(row.id));
  const someSelected = filtered.some((row) => selected.has(row.id));

  function toggleSelectAll() {
    setSelected((prev) => {
      const next = new Set(prev);
      filtered.forEach((row) => (allSelected ? next.delete(row.id) : next.add(row.id)));
      return next;
    });
  }

  function toggleRow(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function exportRow(row: TranscriptRow) {
    if (!row.lines?.length) return;
    const text = row.lines.map((line) => `[${line.timestamp}] ${line.text}`).join("\n");
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const filename = `${(row.title || "transcript").replace(/[\\/:*?"<>|]+/g, " ").trim()}.txt`;
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  function exportSelected() {
    const selectedRows = filtered.filter((row) => selected.has(row.id) && row.lines?.length);
    selectedRows.forEach((row, index) => setTimeout(() => exportRow(row), index * 150));
  }

  function requestDelete(ids: string[]) {
    if (ids.length === 0 || deleting) return;
    setPendingDeleteIds(ids);
  }

  async function confirmDelete() {
    const ids = pendingDeleteIds;
    if (!ids) return;

    setDeleting(true);
    try {
      await onDeleteRows(ids);
      setSelected((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.delete(id));
        return next;
      });
    } finally {
      setDeleting(false);
      setPendingDeleteIds(null);
    }
  }

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex min-w-[200px] flex-1 items-center gap-2 rounded-full border border-hairline bg-surface px-4 py-2 sm:max-w-xs">
          <Search className="h-4 w-4 shrink-0 text-body" />
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search transcripts..."
            className="w-full min-w-0 bg-transparent text-sm text-heading placeholder:text-body focus:outline-none"
          />
        </div>

        <FilterDropdown
          label="Status"
          icon={ListFilter}
          value={statusFilter}
          valueLabel={statusFilter === "all" ? "All" : STATUS_META[statusFilter].label}
          onChange={setStatusFilter}
          options={STATUS_OPTIONS}
        />

        <FilterDropdown
          label="Platform"
          icon={Smartphone}
          value={platformFilter}
          valueLabel={platformFilter === "all" ? "All" : PLATFORM_META[platformFilter].label}
          onChange={setPlatformFilter}
          options={PLATFORM_OPTIONS}
        />

        <button
          type="button"
          aria-pressed={bookmarkedOnly}
          onClick={() => setBookmarkedOnly((v) => !v)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md border px-3.5 py-1.5 text-xs font-medium transition-colors",
            bookmarkedOnly ? "border-primary bg-accent text-primary" : "border-hairline bg-surface text-heading hover:bg-app"
          )}
        >
          <Bookmark className={cn("h-3.5 w-3.5", bookmarkedOnly && "fill-current")} />
          Bookmarked Only
        </button>
      </div>

      <p className="text-xs text-body">
        Showing {filtered.length} of {rows.length} transcripts
      </p>

      {selected.size > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-card-sm border border-primary/20 bg-accent px-4 py-2.5">
          <p className="text-sm font-semibold text-primary">{selected.size} selected</p>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" size="sm" bevel={false} className="shadow-none" icon={Download} onClick={exportSelected}>
              Export
            </Button>
            <Button
              variant="secondary"
              size="sm"
              bevel={false}
              className="shadow-none"
              icon={Trash2}
              disabled={deleting}
              onClick={() => requestDelete(Array.from(selected))}
            >
              Delete
            </Button>
            <Button variant="ghost" size="sm" bevel={false} className="shadow-none" icon={X} onClick={() => setSelected(new Set())}>
              Clear
            </Button>
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState icon={Search} title="No transcripts match" description="Try a different search term or clear the filters." />
      ) : (
        <>
          <div className="flex flex-col gap-2 sm:hidden">
            {filtered.map((row) => {
              const rowMeta = meta.get(row.id);
              if (!rowMeta) return null;
              const platformMeta = PLATFORM_META[row.platform];
              const PlatformIcon = platformMeta.icon;
              const statusMeta = STATUS_META[row.status];
              const isComplete = row.status === "complete";

              return (
                <div
                  key={row.id}
                  onClick={() => {
                    if (isComplete) onOpenRow(row);
                  }}
                  className={cn(
                    "rounded-card border border-hairline bg-surface p-3",
                    isComplete && "active:bg-app/60"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div onClick={(event) => event.stopPropagation()} className="pt-1.5">
                      <Checkbox
                        checked={selected.has(row.id)}
                        onChange={() => toggleRow(row.id)}
                        aria-label={`Select ${row.title ?? "transcript"}`}
                      />
                    </div>
                    <CoverThumbnail src={row.cover_url} alt={row.title ?? ""} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="line-clamp-2 text-sm font-medium text-heading">{row.title ?? row.source_url}</p>
                        <Badge variant={statusMeta.variant} className="shrink-0">
                          <span className="h-1.5 w-1.5 rounded-full bg-current" />
                          {statusMeta.label}
                        </Badge>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-subtle">
                        {rowMeta.handle} · {formatNumber(rowMeta.views)} views
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-body">
                        <span className="inline-flex items-center gap-1">
                          <PlatformIcon className="h-3 w-3" />
                          {platformMeta.label}
                        </span>
                        <span>{formatDuration(row.duration_seconds)}</span>
                        <span>
                          {formatDate(row.created_at)} · {formatTime(row.created_at)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div
                    onClick={(event) => event.stopPropagation()}
                    className="mt-3 flex items-center justify-end gap-1.5 border-t border-hairline pt-2.5"
                  >
                    <IconButton icon={Eye} label="View transcript" disabled={!isComplete} onClick={() => onOpenRow(row)} />
                    <IconButton
                      icon={Bookmark}
                      label={bookmarkedFor(row) ? "Remove bookmark" : "Add bookmark"}
                      active={bookmarkedFor(row)}
                      onClick={() => setBookmarkOverrides((prev) => ({ ...prev, [row.id]: !bookmarkedFor(row) }))}
                    />
                    <RowMenu
                      onView={() => onOpenRow(row)}
                      viewDisabled={!isComplete}
                      onExport={() => exportRow(row)}
                      exportDisabled={!row.lines?.length}
                      onDelete={() => requestDelete([row.id])}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <Table className="hidden min-w-0 sm:block">
          <TableHead>
            <TableRow>
              <TableHeaderCell className="w-10">
                <Checkbox
                  checked={allSelected}
                  indeterminate={!allSelected && someSelected}
                  onChange={toggleSelectAll}
                  aria-label="Select all transcripts"
                />
              </TableHeaderCell>
              <TableHeaderCell>Content</TableHeaderCell>
              <TableHeaderCell>Platform</TableHeaderCell>
              <TableHeaderCell>Date</TableHeaderCell>
              <TableHeaderCell>Duration</TableHeaderCell>
              <TableHeaderCell>Status</TableHeaderCell>
              <TableHeaderCell className="text-right">Actions</TableHeaderCell>
            </TableRow>
          </TableHead>
          <tbody>
            {filtered.map((row) => {
              const rowMeta = meta.get(row.id);
              if (!rowMeta) return null;
              const platformMeta = PLATFORM_META[row.platform];
              const PlatformIcon = platformMeta.icon;
              const statusMeta = STATUS_META[row.status];
              const isComplete = row.status === "complete";

              return (
                <TableRow
                  key={row.id}
                  className={isComplete ? "cursor-pointer transition-colors hover:bg-app/60" : undefined}
                  onClick={() => {
                    if (isComplete) onOpenRow(row);
                  }}
                >
                  <TableCell>
                    <div onClick={(event) => event.stopPropagation()}>
                      <Checkbox
                        checked={selected.has(row.id)}
                        onChange={() => toggleRow(row.id)}
                        aria-label={`Select ${row.title ?? "transcript"}`}
                      />
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <CoverThumbnail src={row.cover_url} alt={row.title ?? ""} />
                      <div className="min-w-0">
                        <p className="line-clamp-2 max-w-[220px] text-sm font-medium text-heading">
                          {row.title ?? row.source_url}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-subtle">
                          {rowMeta.handle} · {formatNumber(rowMeta.views)} views
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1.5 text-sm text-heading">
                      <PlatformIcon className="h-3.5 w-3.5" />
                      {platformMeta.label}
                    </span>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <p className="text-heading">{formatDate(row.created_at)}</p>
                    <p className="mt-0.5 text-xs text-subtle">{formatTime(row.created_at)}</p>
                  </TableCell>
                  <TableCell className="tabular-nums text-body">{formatDuration(row.duration_seconds)}</TableCell>
                  <TableCell>
                    <Badge variant={statusMeta.variant}>
                      <span className="h-1.5 w-1.5 rounded-full bg-current" />
                      {statusMeta.label}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div onClick={(event) => event.stopPropagation()} className="flex items-center justify-end gap-1.5">
                      <IconButton icon={Eye} label="View transcript" disabled={!isComplete} onClick={() => onOpenRow(row)} />
                      <IconButton
                        icon={Bookmark}
                        label={bookmarkedFor(row) ? "Remove bookmark" : "Add bookmark"}
                        active={bookmarkedFor(row)}
                        onClick={() =>
                          setBookmarkOverrides((prev) => ({ ...prev, [row.id]: !bookmarkedFor(row) }))
                        }
                      />
                      <RowMenu
                        onView={() => onOpenRow(row)}
                        viewDisabled={!isComplete}
                        onExport={() => exportRow(row)}
                        exportDisabled={!row.lines?.length}
                        onDelete={() => requestDelete([row.id])}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </tbody>
          </Table>
        </>
      )}

      <ConfirmDialog
        isOpen={pendingDeleteIds !== null}
        onClose={() => setPendingDeleteIds(null)}
        onConfirm={confirmDelete}
        title="Delete transcripts"
        description={
          pendingDeleteIds && pendingDeleteIds.length === 1
            ? "Are you sure you want to delete this transcript? This cannot be undone."
            : `Are you sure you want to delete these ${pendingDeleteIds?.length ?? 0} transcripts? This cannot be undone.`
        }
        confirmLabel={deleting ? "Deleting…" : "Delete"}
        danger
      />
    </div>
  );
}
