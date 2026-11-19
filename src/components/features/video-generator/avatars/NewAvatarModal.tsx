"use client";

import { AlertCircle, ImageIcon, Loader2, Upload, UserRound, WandSparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useRef, useState, type DragEvent } from "react";
import { cn } from "@/lib/utils";
import { AvatarDialog, DialogCloseButton } from "./AvatarDialog";

function OptionCard({
  icon: Icon,
  badge: Badge,
  title,
  subtitle,
  dashed = false,
  busy = false,
  disabled = false,
  dragging = false,
  onClick,
  onDragOver,
  onDragLeave,
  onDrop,
}: {
  icon: LucideIcon;
  badge: LucideIcon;
  title: string;
  subtitle: string;
  dashed?: boolean;
  busy?: boolean;
  disabled?: boolean;
  dragging?: boolean;
  onClick: () => void;
  onDragOver?: (event: DragEvent<HTMLButtonElement>) => void;
  onDragLeave?: () => void;
  onDrop?: (event: DragEvent<HTMLButtonElement>) => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy || disabled}
      onDragOver={disabled ? undefined : onDragOver}
      onDragLeave={disabled ? undefined : onDragLeave}
      onDrop={disabled ? undefined : onDrop}
      className={cn(
        "group flex flex-col items-center rounded-2xl border px-6 py-9 text-center outline-none transition-[border-color,background-color,box-shadow] duration-200 focus-visible:ring-[3px] focus-visible:ring-slate-300 disabled:pointer-events-none sm:py-12 dark:focus-visible:ring-white/20",
        disabled && "opacity-50",
        dragging
          ? "border-blue-400 bg-blue-50/60 dark:border-blue-400/60 dark:bg-blue-500/[0.08]"
          : "border-slate-200 bg-slate-50/60 hover:border-slate-300 hover:bg-white hover:shadow-[0_18px_40px_-24px_rgba(15,23,42,0.4)] dark:border-white/[0.08] dark:bg-white/[0.02] dark:hover:border-white/[0.16] dark:hover:bg-white/[0.04]"
      )}
    >
      <span
        className={cn(
          "relative flex h-[88px] w-[88px] items-center justify-center rounded-[22px] border bg-white text-slate-700 transition-transform duration-200 group-hover:-translate-y-0.5 dark:bg-white/[0.04] dark:text-slate-200",
          dashed ? "border-dashed border-slate-300 dark:border-white/[0.18]" : "border-slate-200 dark:border-white/[0.10]"
        )}
      >
        {busy ? <Loader2 className="h-8 w-8 animate-spin text-blue-500" /> : <Icon className="h-9 w-9" strokeWidth={1.5} />}
        <span className="absolute -right-3.5 -top-3.5 flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-blue-600 shadow-[0_4px_10px_-4px_rgba(15,23,42,0.25)] dark:border-white/[0.12] dark:bg-zinc-900 dark:text-blue-400">
          <Badge className="h-4 w-4" />
        </span>
      </span>
      <span className="mt-7 text-lg font-semibold text-slate-900 dark:text-white">{busy ? "Preparing photo…" : title}</span>
      <span className="mt-1 text-[15px] text-slate-500 dark:text-slate-400">{subtitle}</span>
    </button>
  );
}

/** The picker's "New avatar" step: generate one from a prompt, or upload a photo. */
export function NewAvatarModal({
  onClose,
  onGenerate,
  onUpload,
  isPreparingUpload,
  canSave,
}: {
  onClose: () => void;
  onGenerate: () => void;
  onUpload: (file: File) => void;
  isPreparingUpload: boolean;
  /** False when the avatar library can't save -- creating is disabled so no credits are spent on an avatar that would be lost. */
  canSave: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  return (
    <AvatarDialog onClose={onClose} labelledBy="new-avatar-title" layer="top" className="max-w-[760px]">
      <div className="flex items-start justify-between gap-4 px-6 pt-6 sm:px-8 sm:pt-7">
        <div>
          <h2 id="new-avatar-title" className="text-xl font-semibold tracking-[-0.01em] text-slate-900 dark:text-white">
            New avatar
          </h2>
          <p className="mt-1 text-[15px] text-slate-500 dark:text-slate-400">Add an avatar you can drop into any video.</p>
        </div>
        <DialogCloseButton onClick={onClose} className="-mr-2 -mt-1" />
      </div>

      {!canSave && (
        <div role="alert" className="mx-6 mt-5 flex gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-sm sm:mx-8 dark:border-amber-400/20 dark:bg-amber-400/[0.08]">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-300" />
          <p className="text-amber-800 dark:text-amber-200">
            <span className="font-medium">Avatar saving is temporarily unavailable.</span> New avatars can&apos;t be created until it&apos;s back, so you won&apos;t be charged for one that can&apos;t be saved. Presets still work.
          </p>
        </div>
      )}

      <div className="grid gap-4 p-6 sm:grid-cols-2 sm:p-8">
        <OptionCard icon={UserRound} badge={WandSparkles} title="Generate" subtitle="From a text prompt" disabled={!canSave} onClick={onGenerate} />
        <OptionCard
          icon={ImageIcon}
          badge={Upload}
          title="Upload"
          subtitle="Turn any photo into an avatar"
          dashed
          disabled={!canSave}
          busy={isPreparingUpload}
          dragging={dragging}
          onClick={() => inputRef.current?.click()}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            // The picker validates the type, so a wrong file gets an error rather than nothing.
            const file = event.dataTransfer.files[0];
            if (file) onUpload(file);
          }}
        />
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) onUpload(file);
        }}
      />
    </AvatarDialog>
  );
}
