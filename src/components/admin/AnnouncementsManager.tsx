"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { Database, Megaphone, Pencil, Plus, Trash2 } from "lucide-react";
import {
  ANNOUNCEMENT_CTA_LABEL_MAX,
  ANNOUNCEMENT_CTA_HREF_MAX,
  ANNOUNCEMENT_MESSAGE_MAX,
  isAnnouncementExpired,
  safeCtaHref,
  type AdminAnnouncement,
  type Announcement,
  type AnnouncementKind,
} from "@/lib/announcements";
import { AnnouncementBar } from "@/components/dashboard/AnnouncementBanner";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DatePicker } from "@/components/ui/DatePicker";
import { Switch } from "@/components/ui/Switch";
import { Table, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/Table";
import { PageHeader } from "@/components/admin/PageHeader";
import { Callout, Panel } from "@/components/admin/Panel";
import { Pagination, usePagination } from "@/components/admin/Pagination";
import { AdminSelect } from "@/components/admin/AdminSelect";
import {
  ADMIN_BUTTON,
  ADMIN_FIELD,
  ADMIN_HINT,
  ADMIN_LABEL,
  AdminConfirmDialog,
  AdminDialog,
  AdminDialogBody,
  AdminDialogFooter,
} from "@/components/admin/AdminDialog";
import { cn, formatDate } from "@/lib/utils";

const KIND_OPTIONS: { value: AnnouncementKind; label: string }[] = [
  { value: "update", label: "Product update" },
  { value: "promo", label: "Offer or discount" },
];

interface FormState {
  kind: AnnouncementKind;
  message: string;
  ctaLabel: string;
  ctaHref: string;
  /** YYYY-MM-DD in the admin's time zone; "" = no end. */
  endsOn: string;
  isActive: boolean;
}

const EMPTY_FORM: FormState = { kind: "update", message: "", ctaLabel: "", ctaHref: "", endsOn: "", isActive: true };

type DialogState = { mode: "create" } | { mode: "edit"; target: AdminAnnouncement } | null;

function toLocalDate(iso: string): string {
  const date = new Date(iso);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

// An end date means "through that day", so it runs to the last millisecond of it.
function endOfLocalDay(day: string): string {
  const [year, month, date] = day.split("-").map(Number);
  return new Date(year, month - 1, date, 23, 59, 59, 999).toISOString();
}

function isLive(announcement: AdminAnnouncement): boolean {
  return announcement.isActive && !isAnnouncementExpired(announcement);
}

/** The one users see first: the newest live row. */
function showingIdOf(announcements: AdminAnnouncement[]): string | null {
  let showing: AdminAnnouncement | null = null;
  for (const announcement of announcements) {
    if (!isLive(announcement)) continue;
    if (!showing || Date.parse(announcement.createdAt) > Date.parse(showing.createdAt)) showing = announcement;
  }
  return showing?.id ?? null;
}

function statusOf(announcement: AdminAnnouncement, showingId: string | null): { label: string; variant: "success" | "default" | "neutral" | "warning" } {
  if (!announcement.isActive) return { label: "Off", variant: "neutral" };
  if (isAnnouncementExpired(announcement)) return { label: "Ended", variant: "warning" };
  if (announcement.id === showingId) return { label: "Showing", variant: "success" };
  return { label: "Next up", variant: "default" };
}

function linkLabel(href: string): string {
  try {
    const url = new URL(href);
    return `${url.host}${url.pathname === "/" ? "" : url.pathname}`;
  } catch {
    return href;
  }
}

export function AnnouncementsManager({
  initialAnnouncements,
  tableMissing = false,
}: {
  initialAnnouncements: AdminAnnouncement[];
  /** The migration hasn't been applied, so nothing can be saved yet. */
  tableMissing?: boolean;
}) {
  const [announcements, setAnnouncements] = useState(initialAnnouncements);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminAnnouncement | null>(null);
  const { pageItems, pagerProps, setPage } = usePagination(announcements, 10);
  const showingId = showingIdOf(announcements);

  const preview: Announcement = {
    id: "preview",
    kind: form.kind,
    message: form.message.trim() || "Your message shows here",
    ctaLabel: form.ctaLabel.trim() || null,
    ctaHref: form.ctaHref.trim() || null,
    expiresAt: null,
  };

  function openCreate() {
    setForm(EMPTY_FORM);
    setError(null);
    setDialog({ mode: "create" });
  }

  function openEdit(target: AdminAnnouncement) {
    setForm({
      kind: target.kind,
      message: target.message,
      ctaLabel: target.ctaLabel ?? "",
      ctaHref: target.ctaHref ?? "",
      endsOn: target.expiresAt ? toLocalDate(target.expiresAt) : "",
      isActive: target.isActive,
    });
    setError(null);
    setDialog({ mode: "edit", target });
  }

  function upsertLocal(saved: AdminAnnouncement) {
    setAnnouncements((prev) => (prev.some((a) => a.id === saved.id) ? prev.map((a) => (a.id === saved.id ? saved : a)) : [saved, ...prev]));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!dialog) return;

    const message = form.message.trim();
    const ctaLabel = form.ctaLabel.trim();
    const ctaHref = form.ctaHref.trim();
    const original = dialog.mode === "edit" ? dialog.target.expiresAt : null;
    // Keep a stored end time as-is (it may have been set to the minute in the
    // table editor) unless the date itself changed.
    const expiresAt = !form.endsOn ? null : original && toLocalDate(original) === form.endsOn ? original : endOfLocalDay(form.endsOn);

    if (!message) return setError("Write a message");
    if (ctaLabel && !ctaHref) return setError("Add a link for the button, or clear its text");
    if (ctaHref && !safeCtaHref(ctaHref)) return setError("Link must be a path in the app like /clipping, or a full https:// URL");
    if (expiresAt && expiresAt !== original && Date.parse(expiresAt) <= Date.now()) return setError("That end date has already passed");

    setSubmitting(true);
    setError(null);

    const res = await fetch(dialog.mode === "edit" ? `/api/admin/announcements/${dialog.target.id}` : "/api/admin/announcements", {
      method: dialog.mode === "edit" ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: form.kind,
        message,
        ctaLabel: ctaLabel || null,
        ctaHref: ctaHref || null,
        expiresAt,
        isActive: form.isActive,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setSubmitting(false);

    if (!res.ok) {
      setError(data.error ?? "Couldn't save the announcement");
      return;
    }

    upsertLocal(data.announcement as AdminAnnouncement);
    if (dialog.mode === "create") setPage(1);
    setDialog(null);
  }

  async function toggleActive(target: AdminAnnouncement) {
    const isActive = !target.isActive;
    setTogglingId(target.id);
    upsertLocal({ ...target, isActive });

    const res = await fetch(`/api/admin/announcements/${target.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive }),
    });
    setTogglingId(null);

    if (res.ok) {
      const data = await res.json();
      upsertLocal(data.announcement as AdminAnnouncement);
    } else {
      upsertLocal(target);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    const res = await fetch(`/api/admin/announcements/${target.id}`, { method: "DELETE" });
    if (res.ok) {
      setAnnouncements((prev) => prev.filter((a) => a.id !== target.id));
    }
  }

  return (
    <>
      <PageHeader
        title="Announcements"
        description="Product updates and offers, in a bar across the top of the app. The newest live one shows first; closing it shows the next."
      >
        <Button icon={Plus} onClick={openCreate}>
          New announcement
        </Button>
      </PageHeader>

      {tableMissing && (
        <Callout icon={<Database className="h-4 w-4" />} title="One setup step left: the announcements table doesn't exist yet">
          Apply <code className="font-mono text-[12px]">supabase/migrations/20261119140000_announcements.sql</code> to the database, then
          reload this page. Until then nothing can be saved and the app shows no bar.
        </Callout>
      )}

      <Panel flush>
        {announcements.length === 0 ? (
          <p className="px-5 py-12 text-center text-[13px] text-subtle">No announcements yet. Post one to show a bar at the top of the app.</p>
        ) : (
          <>
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Announcement</TableHeaderCell>
                  <TableHeaderCell>Button</TableHeaderCell>
                  <TableHeaderCell>Ends</TableHeaderCell>
                  <TableHeaderCell>Status</TableHeaderCell>
                  <TableHeaderCell>Live</TableHeaderCell>
                  <TableHeaderCell className="text-right">Actions</TableHeaderCell>
                </TableRow>
              </TableHead>
              <tbody>
                {pageItems.map((announcement) => {
                  const status = statusOf(announcement, showingId);
                  return (
                    <TableRow key={announcement.id}>
                      <TableCell className="min-w-[260px] max-w-[440px]">
                        <div className="flex items-start gap-2.5">
                          <Badge variant={announcement.kind === "promo" ? "default" : "neutral"} className="mt-px shrink-0">
                            {announcement.kind === "promo" ? "Offer" : "Update"}
                          </Badge>
                          <p className="line-clamp-2 text-heading">{announcement.message}</p>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[220px]">
                        {announcement.ctaHref ? (
                          <div className="min-w-0">
                            <p className="truncate font-medium text-heading">{announcement.ctaLabel || "Learn more"}</p>
                            <p className="truncate font-mono text-[12px] text-subtle">{linkLabel(announcement.ctaHref)}</p>
                          </div>
                        ) : (
                          <span className="text-subtle">None</span>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-body">
                        {announcement.expiresAt ? formatDate(announcement.expiresAt) : <span className="text-subtle">No end date</span>}
                      </TableCell>
                      <TableCell>
                        <Badge variant={status.variant}>{status.label}</Badge>
                      </TableCell>
                      <TableCell>
                        <Switch
                          size="sm"
                          checked={announcement.isActive}
                          onChange={() => toggleActive(announcement)}
                          disabled={togglingId === announcement.id}
                          label={announcement.isActive ? "Turn off announcement" : "Turn on announcement"}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-3">
                          <button
                            type="button"
                            onClick={() => openEdit(announcement)}
                            aria-label="Edit announcement"
                            className="text-subtle transition-colors hover:text-heading"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(announcement)}
                            aria-label="Delete announcement"
                            className="text-subtle transition-colors hover:text-danger"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </tbody>
            </Table>
            <Pagination {...pagerProps} noun="announcements" />
          </>
        )}
      </Panel>

      <AdminDialog
        open={dialog != null}
        onClose={() => setDialog(null)}
        title={dialog?.mode === "edit" ? "Edit announcement" : "New announcement"}
        description="Shows at the top of the app until it ends, you turn it off, or someone closes it"
        icon={Megaphone}
        size="md"
      >
        <form onSubmit={handleSubmit}>
          <AdminDialogBody>
            <div>
              <span className={ADMIN_LABEL}>Type</span>
              <AdminSelect label="Type" value={form.kind} onChange={(kind) => setForm((prev) => ({ ...prev, kind }))} options={KIND_OPTIONS} />
            </div>

            <div>
              <label htmlFor="announcement-message" className={ADMIN_LABEL}>
                Message
              </label>
              <textarea
                id="announcement-message"
                rows={3}
                required
                maxLength={ANNOUNCEMENT_MESSAGE_MAX}
                value={form.message}
                onChange={(event) => setForm((prev) => ({ ...prev, message: event.target.value }))}
                className={cn(ADMIN_FIELD, "h-auto resize-none py-2 leading-5")}
                placeholder={form.kind === "promo" ? "30% off yearly plans until Sunday" : "Clips now render on our servers, 3x faster"}
              />
              <p className={cn(ADMIN_HINT, "text-right tabular-nums")}>
                {form.message.length}/{ANNOUNCEMENT_MESSAGE_MAX}
              </p>
            </div>

            <div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
                <div>
                  <label htmlFor="announcement-cta-label" className={ADMIN_LABEL}>
                    Button text <span className="font-normal text-subtle">· optional</span>
                  </label>
                  <input
                    id="announcement-cta-label"
                    type="text"
                    maxLength={ANNOUNCEMENT_CTA_LABEL_MAX}
                    value={form.ctaLabel}
                    onChange={(event) => setForm((prev) => ({ ...prev, ctaLabel: event.target.value }))}
                    className={ADMIN_FIELD}
                    placeholder="Learn more"
                  />
                </div>
                <div>
                  <label htmlFor="announcement-cta-href" className={ADMIN_LABEL}>
                    Link <span className="font-normal text-subtle">· optional</span>
                  </label>
                  <input
                    id="announcement-cta-href"
                    type="text"
                    inputMode="url"
                    maxLength={ANNOUNCEMENT_CTA_HREF_MAX}
                    value={form.ctaHref}
                    onChange={(event) => setForm((prev) => ({ ...prev, ctaHref: event.target.value }))}
                    className={ADMIN_FIELD}
                    placeholder="/clipping or https://…"
                  />
                </div>
              </div>
              <p className={ADMIN_HINT}>A page in the app like /clipping, or a full https:// link (opens in a new tab).</p>
            </div>

            <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2">
              <div>
                <span className={ADMIN_LABEL}>
                  Ends <span className="font-normal text-subtle">· optional</span>
                </span>
                <DatePicker value={form.endsOn} onChange={(endsOn) => setForm((prev) => ({ ...prev, endsOn }))} placeholder="No end date" />
                <p className={ADMIN_HINT}>Hidden once this day is over, in your time zone.</p>
              </div>
              <div>
                <span className={ADMIN_LABEL}>Live</span>
                <div className="flex h-[38px] items-center gap-3">
                  <Switch
                    size="sm"
                    checked={form.isActive}
                    onChange={() => setForm((prev) => ({ ...prev, isActive: !prev.isActive }))}
                    label="Show in the app"
                  />
                  <span className="text-[13px] text-body">{form.isActive ? "Shows in the app" : "Saved, not shown"}</span>
                </div>
              </div>
            </div>

            <div>
              <span className={ADMIN_LABEL}>Preview</span>
              <div inert className="overflow-hidden rounded-[10px] shadow-[0_0_0_1px_var(--color-hairline)]">
                <AnnouncementBar announcement={preview} onDismiss={() => {}} />
              </div>
            </div>

            {error && <p className="text-[13px] text-danger">{error}</p>}
          </AdminDialogBody>

          <AdminDialogFooter note={dialog?.mode === "edit" ? "People who closed it won't see edits" : undefined}>
            <button type="button" onClick={() => setDialog(null)} className={ADMIN_BUTTON.secondary}>
              Cancel
            </button>
            <button type="submit" disabled={submitting} className={ADMIN_BUTTON.primary}>
              {submitting ? "Saving…" : dialog?.mode === "edit" ? "Save changes" : "Post announcement"}
            </button>
          </AdminDialogFooter>
        </form>
      </AdminDialog>

      <AdminConfirmDialog
        isOpen={deleteTarget != null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete announcement"
        description="It disappears from the app right away. This can't be undone; turn it off instead to keep it."
        confirmLabel="Delete"
        danger
        icon={Trash2}
      />
    </>
  );
}
