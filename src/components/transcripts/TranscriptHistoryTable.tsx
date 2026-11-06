"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Download, Eye, FileText, Loader2, MoreHorizontal, Search, Trash2, X } from "lucide-react";
import type { TranscriptRow, TranscriptRowStatus } from "@/lib/types";
import type { TranscriptPlatform } from "@/lib/transcript-platform";
import { Checkbox } from "@/components/ui/Checkbox";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  TRANSCRIPT_PLATFORMS,
  TRANSCRIPT_PLATFORM_ORDER,
  TranscriptPlatformMark,
  displayUrl,
  formatCreated,
  formatDuration,
} from "@/components/transcripts/platform";
import { cn } from "@/lib/utils";

type PlatformFilterValue = "all" | TranscriptPlatform;
type StatusFilterValue = "all" | TranscriptRowStatus;

const STATUS_LABEL: Record<TranscriptRowStatus, string> = {
  complete: "Complete",
  processing: "Extracting",
  queued: "Queued",
  failed: "Failed",
};

const STATUS_OPTIONS: { value: StatusFilterValue; label: string }[] = [
  { value: "all", label: "All" },
  ...(["complete", "processing", "queued", "failed"] as const).map((value) => ({ value, label: STATUS_LABEL[value] })),
];

const PLATFORM_OPTIONS: { value: PlatformFilterValue; label: string }[] = [
  { value: "all", label: "All" },
  ...TRANSCRIPT_PLATFORM_ORDER.map((value) => ({ value, label: TRANSCRIPT_PLATFORMS[value].label })),
];

// One column template for the header and every row, so checkboxes, covers,
// lengths and dates line up. Length and date fold into the meta line on phones.
const ROW_GRID =
  "grid grid-cols-[16px_minmax(0,1fr)_32px] items-center gap-x-4 sm:grid-cols-[16px_minmax(0,1fr)_56px_120px_32px]";

const QUIET_BUTTON =
  "inline-flex h-8 items-center gap-1.5 rounded-lg border border-hairline bg-surface px-3 text-[13px] font-medium text-heading outline-none transition-colors hover:bg-(--app-fill) focus-visible:ring-2 focus-visible:ring-primary/40 disabled:pointer-events-none disabled:opacity-50";

const MENU_SURFACE =
  "rounded-xl border border-hairline bg-surface p-1 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_12px_32px_-12px_rgba(16,24,40,0.2)] dark:shadow-[0_16px_40px_-12px_rgba(0,0,0,0.7)]";

const MENU_ITEM =
  "flex h-8 w-full items-center gap-2 rounded-lg px-2.5 text-left text-[13px] font-medium text-body outline-none transition-colors hover:bg-(--app-fill) hover:text-heading focus-visible:bg-(--app-fill) disabled:pointer-events-none disabled:opacity-40";

function downloadTxt(row: TranscriptRow) {
  if (!row.lines?.length) return;
  const text = row.lines.map((line) => `[${line.timestamp}] ${line.text}`).join("\n");
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${(row.title || "transcript").replace(/[\\/:*?"<>|]+/g, " ").trim()}.txt`;
  link.click();
  URL.revokeObjectURL(url);
}

function useDismiss(open: boolean, onClose: () => void, refs: React.RefObject<HTMLElement | null>[]) {
  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: MouseEvent) {
      if (refs.some((ref) => ref.current?.contains(event.target as Node))) return;
      onClose();
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose, refs]);
}

function FilterMenu<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const refs = useMemo(() => [ref], []);
  useDismiss(open, () => setOpen(false), refs);
  const current = options.find((option) => option.value === value);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(QUIET_BUTTON, "h-9 gap-1 px-3", open && "bg-(--app-fill)")}
      >
        <span className="text-body">{label}</span>
        {value !== "all" && current && <span className="text-heading">· {current.label}</span>}
        <ChevronDown className="ml-0.5 h-3.5 w-3.5 text-subtle" />
      </button>
      {open && (
        <div role="listbox" aria-label={label} className={cn(MENU_SURFACE, "animate-menu-pop absolute left-0 z-20 mt-1.5 w-44 [transform-origin:top_left]")}>
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={option.value === value}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
              className={cn(MENU_ITEM, "justify-between")}
            >
              {option.label}
              {option.value === value && <Check className="h-3.5 w-3.5 text-heading" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Cover({ row }: { row: TranscriptRow }) {
  const [failed, setFailed] = useState(false);
  const pending = row.status === "queued" || row.status === "processing";

  return (
    <div className="relative flex h-14 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md bg-(--app-fill-strong)">
      {row.cover_url && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={row.cover_url}
          alt=""
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover"
        />
      ) : pending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin text-subtle" />
      ) : (
        <FileText className="h-3.5 w-3.5 text-subtle" />
      )}
      <span className="pointer-events-none absolute inset-0 rounded-[inherit] ring-1 ring-inset ring-black/5 dark:ring-white/10" />
    </div>
  );
}

// Rendered through a portal: the list clips its rounded corners, which would
// otherwise cut the menu off. Opens below the trigger, or above it when the
// row sits near the bottom of the viewport.
const ROW_MENU_HEIGHT = 124;

function RowMenu({ row, onOpen, onDelete }: { row: TranscriptRow; onOpen: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  const [style, setStyle] = useState<CSSProperties | null>(null);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const refs = useMemo(() => [anchorRef, menuRef], []);
  useDismiss(open, () => setOpen(false), refs);

  useLayoutEffect(() => {
    if (!open || !anchorRef.current) return;
    function update() {
      const rect = anchorRef.current!.getBoundingClientRect();
      const flip = rect.bottom + ROW_MENU_HEIGHT + 8 > window.innerHeight;
      setStyle({
        position: "fixed",
        right: window.innerWidth - rect.right,
        zIndex: 60,
        ...(flip ? { bottom: window.innerHeight - rect.top + 4 } : { top: rect.bottom + 4 }),
      });
    }
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open]);

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="More actions"
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(
          "relative z-10 flex h-8 w-8 items-center justify-center rounded-lg text-subtle outline-none transition-colors hover:bg-(--app-fill-strong) hover:text-heading focus-visible:ring-2 focus-visible:ring-primary/40",
          open && "bg-(--app-fill-strong) text-heading"
        )}
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open &&
        style &&
        createPortal(
          <div ref={menuRef} role="menu" style={style} className={cn(MENU_SURFACE, "w-48")}>
            <button
              type="button"
              role="menuitem"
              disabled={row.status !== "complete"}
              onClick={() => {
                onOpen();
                setOpen(false);
              }}
              className={MENU_ITEM}
            >
              <Eye className="h-4 w-4 text-subtle" />
              View transcript
            </button>
            <button
              type="button"
              role="menuitem"
              disabled={!row.lines?.length}
              onClick={() => {
                downloadTxt(row);
                setOpen(false);
              }}
              className={MENU_ITEM}
            >
              <Download className="h-4 w-4 text-subtle" />
              Download .txt
            </button>
            <div role="separator" className="-mx-1 my-1 h-px bg-hairline" />
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                onDelete();
                setOpen(false);
              }}
              className={cn(MENU_ITEM, "text-danger hover:bg-danger-tint hover:text-danger")}
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </button>
          </div>,
          document.body
        )}
    </>
  );
}

function StatusMeta({ row }: { row: TranscriptRow }) {
  if (row.status === "complete") return null;
  if (row.status === "failed") {
    return (
      <>
        <span aria-hidden>·</span>
        <span className="min-w-0 truncate text-danger" title={row.error_message ?? undefined}>
          {row.error_message ? `Failed: ${row.error_message}` : "Failed"}
        </span>
      </>
    );
  }
  return (
    <>
      <span aria-hidden>·</span>
      <span className="shrink-0 text-body">{STATUS_LABEL[row.status]}</span>
    </>
  );
}

function SkeletonRows() {
  return (
    <div className="divide-y divide-hairline">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className={cn(ROW_GRID, "px-4 py-3")}>
          <Skeleton className="h-4 w-4 rounded-[5px]" />
          <div className="flex min-w-0 items-center gap-3">
            <Skeleton className="h-14 w-8 shrink-0 rounded-md" />
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <Skeleton className={cn("h-3.5 rounded-full", ["w-3/5", "w-2/5", "w-1/2", "w-1/3"][i])} />
              <Skeleton className="h-3 w-20 rounded-full" />
            </div>
          </div>
          <Skeleton className="ml-auto hidden h-3 w-8 rounded-full sm:block" />
          <Skeleton className="hidden h-3 w-24 rounded-full sm:block" />
          <span />
        </div>
      ))}
    </div>
  );
}

export function TranscriptHistoryTable({
  rows,
  isLoading = false,
  onOpenRow,
  onDeleteRows,
  onExportAll,
}: {
  rows: TranscriptRow[];
  isLoading?: boolean;
  onOpenRow: (row: TranscriptRow) => void;
  onDeleteRows: (ids: string[]) => void | Promise<void>;
  onExportAll: () => void;
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilterValue>("all");
  const [platformFilter, setPlatformFilter] = useState<PlatformFilterValue>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [pendingDeleteIds, setPendingDeleteIds] = useState<string[] | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (statusFilter !== "all" && row.status !== statusFilter) return false;
      if (platformFilter !== "all" && row.platform !== platformFilter) return false;
      if (q && !`${row.title ?? ""} ${row.source_url}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, search, statusFilter, platformFilter]);

  const allSelected = filtered.length > 0 && filtered.every((row) => selected.has(row.id));
  const someSelected = filtered.some((row) => selected.has(row.id));
  const isFiltered = search.trim() !== "" || statusFilter !== "all" || platformFilter !== "all";

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

  function exportSelected() {
    const selectedRows = filtered.filter((row) => selected.has(row.id) && row.lines?.length);
    selectedRows.forEach((row, index) => setTimeout(() => downloadTxt(row), index * 150));
  }

  function clearFilters() {
    setSearch("");
    setStatusFilter("all");
    setPlatformFilter("all");
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

  const hasRows = !isLoading && rows.length > 0;

  return (
    <section className="flex min-w-0 flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[17px] font-medium tracking-[-0.01em] text-heading">History</h2>
        {hasRows && (
          <button type="button" onClick={onExportAll} className={QUIET_BUTTON}>
            <Download className="h-3.5 w-3.5 text-subtle" />
            Export all
          </button>
        )}
      </div>

      {hasRows && (
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex h-9 w-full min-w-0 items-center gap-2 rounded-lg border border-hairline bg-surface px-3 transition-[border-color,box-shadow] focus-within:border-primary/50 focus-within:ring-4 focus-within:ring-primary/10 sm:w-auto sm:max-w-64 sm:flex-1">
            <Search className="h-4 w-4 shrink-0 text-subtle" />
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search"
              aria-label="Search transcripts"
              className="w-full min-w-0 bg-transparent text-[14px] text-heading outline-none placeholder:text-subtle"
            />
          </label>
          <FilterMenu label="Status" value={statusFilter} options={STATUS_OPTIONS} onChange={setStatusFilter} />
          <FilterMenu label="Platform" value={platformFilter} options={PLATFORM_OPTIONS} onChange={setPlatformFilter} />

          {/* The count and the selection actions share one slot, so the
              toolbar never grows a second row when something is selected. */}
          <div className="ml-auto flex h-9 items-center gap-1.5">
            {selected.size > 0 ? (
              <>
                <span className="mr-1 text-[13px] font-medium tabular-nums text-heading">{selected.size} selected</span>
                <button type="button" onClick={exportSelected} className={QUIET_BUTTON}>
                  <Download className="h-3.5 w-3.5 text-subtle" />
                  Download
                </button>
                <button
                  type="button"
                  disabled={deleting}
                  onClick={() => setPendingDeleteIds(Array.from(selected))}
                  className={cn(QUIET_BUTTON, "text-danger")}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </button>
                <button
                  type="button"
                  onClick={() => setSelected(new Set())}
                  aria-label="Clear selection"
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-subtle transition-colors hover:bg-(--app-fill) hover:text-heading"
                >
                  <X className="h-4 w-4" />
                </button>
              </>
            ) : (
              <span className="text-[13px] tabular-nums text-subtle">
                {isFiltered ? `${filtered.length} of ${rows.length}` : `${rows.length} ${rows.length === 1 ? "transcript" : "transcripts"}`}
              </span>
            )}
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-hairline bg-surface">
        {isLoading ? (
          <SkeletonRows />
        ) : rows.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <p className="text-[14px] font-medium text-heading">No transcripts yet</p>
            <p className="mt-1 text-[13px] text-subtle">Paste a link above and your first one will appear here</p>
          </div>
        ) : (
          <>
            <div className={cn(ROW_GRID, "h-10 border-b border-hairline px-4 text-[12px] text-subtle")}>
              <Checkbox
                checked={allSelected}
                indeterminate={!allSelected && someSelected}
                onChange={toggleSelectAll}
                aria-label="Select all transcripts"
              />
              <span>Video</span>
              <span className="hidden text-right sm:block">Length</span>
              <span className="hidden sm:block">Created</span>
              <span />
            </div>

            {filtered.length === 0 ? (
              <div className="px-6 py-14 text-center">
                <p className="text-[14px] font-medium text-heading">Nothing matches these filters</p>
                <button
                  type="button"
                  onClick={clearFilters}
                  className="mt-1 text-[13px] font-medium text-primary underline-offset-4 hover:underline"
                >
                  Clear filters
                </button>
              </div>
            ) : (
              <ul className="divide-y divide-hairline">
                {filtered.map((row) => {
                  const isComplete = row.status === "complete";
                  const isSelected = selected.has(row.id);
                  const duration = formatDuration(row.duration_seconds);

                  return (
                    <li
                      key={row.id}
                      className={cn(
                        ROW_GRID,
                        "relative px-4 py-3 transition-colors",
                        isSelected ? "bg-(--app-fill)" : isComplete && "hover:bg-(--app-fill)"
                      )}
                    >
                      <div className="relative z-10 flex">
                        <Checkbox
                          checked={isSelected}
                          onChange={() => toggleRow(row.id)}
                          aria-label={`Select ${row.title ?? "transcript"}`}
                        />
                      </div>

                      <div className="flex min-w-0 items-center gap-3">
                        <Cover row={row} />
                        <div className="min-w-0">
                          {/* The title is the row's link: its ::after covers the
                              whole row, so the row opens on click while the
                              checkbox and menu (z-10) stay on top. */}
                          <button
                            type="button"
                            disabled={!isComplete}
                            onClick={() => onOpenRow(row)}
                            className="block max-w-full truncate text-left text-[14px] font-medium leading-5 text-heading outline-none after:absolute after:inset-0 after:rounded-[inherit] focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-primary/40 disabled:cursor-default"
                          >
                            {row.title ?? displayUrl(row.source_url)}
                          </button>
                          <p className="mt-1 flex min-w-0 items-center gap-1.5 overflow-hidden whitespace-nowrap text-[13px] leading-5 text-subtle">
                            <TranscriptPlatformMark platform={row.platform} className="h-3.5 w-3.5 shrink-0" />
                            <span className="shrink-0">{TRANSCRIPT_PLATFORMS[row.platform].label}</span>
                            <StatusMeta row={row} />
                            {isComplete && <span className="truncate sm:hidden">· {formatCreated(row.created_at)}</span>}
                          </p>
                        </div>
                      </div>

                      <span className="hidden text-right font-mono text-[12px] tabular-nums text-body sm:block">
                        {duration ?? <span className="text-subtle">—</span>}
                      </span>
                      <span className="hidden text-[13px] tabular-nums text-subtle sm:block">
                        {formatCreated(row.created_at)}
                      </span>

                      <div className="flex justify-end">
                        <RowMenu row={row} onOpen={() => onOpenRow(row)} onDelete={() => setPendingDeleteIds([row.id])} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}
      </div>

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
    </section>
  );
}
