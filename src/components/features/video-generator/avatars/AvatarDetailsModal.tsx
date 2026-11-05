"use client";

import { AlertCircle, ArrowLeft, Loader2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { isValidName } from "@/lib/validation";
import {
  AVATAR_AGE_RANGES,
  AVATAR_NAME_MAX,
  type AvatarAgeRange,
  type AvatarGender,
  type AvatarSource,
  type UserAvatar,
} from "@/lib/config/avatars";
import { AvatarDialog, DialogCloseButton, SegmentedControl } from "./AvatarDialog";
import { AvatarSaveError, createUserAvatar } from "./avatar-client";

type GenderChoice = AvatarGender | "unset";
type AgeChoice = AvatarAgeRange | "unset";

const GENDER_OPTIONS: { value: GenderChoice; label: string }[] = [
  { value: "unset", label: "Not set" },
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
];

const AGE_OPTIONS: { value: AgeChoice; label: string }[] = [
  { value: "unset", label: "Not set" },
  ...AVATAR_AGE_RANGES.map((value) => ({ value, label: value })),
];

const PRIMARY_BUTTON =
  "flex h-10 items-center gap-2 rounded-full bg-btn-primary px-5 text-sm font-semibold text-white outline-none transition-colors hover:bg-btn-primary-hover focus-visible:ring-2 focus-visible:ring-blue-400/60 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 dark:focus-visible:ring-offset-[#131318]";

const FIELD_LABEL = "mb-2 block text-[13px] font-medium text-slate-700 dark:text-slate-300";

/** Last step of "New avatar": name the image, tag it for the filters, save it to the library. */
export function AvatarDetailsModal({
  image,
  source,
  onBack,
  onClose,
  onSaved,
  onLibraryUnavailable,
}: {
  /** Normalized JPEG data URL. */
  image: string;
  source: AvatarSource;
  onBack: () => void;
  onClose: () => void;
  onSaved: (avatar: UserAvatar) => void;
  /** The server has no avatar library, so the picker can stop offering New avatar. */
  onLibraryUnavailable: () => void;
}) {
  const [name, setName] = useState("");
  const [gender, setGender] = useState<GenderChoice>("unset");
  const [ageRange, setAgeRange] = useState<AgeChoice>("unset");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Separate from `error` (a fixable form problem): the save itself failed.
  const [saveFailure, setSaveFailure] = useState<{ message: string; unavailable: boolean } | null>(null);

  const trimmed = name.trim();
  const nameIsValid = isValidName(trimmed, AVATAR_NAME_MAX);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    if (!nameIsValid) {
      setError(trimmed ? "Use letters, numbers and basic punctuation only." : "Give your avatar a name.");
      return;
    }
    setSaving(true);
    setError(null);
    setSaveFailure(null);
    try {
      const avatar = await createUserAvatar({
        image,
        name: trimmed,
        gender: gender === "unset" ? null : gender,
        ageRange: ageRange === "unset" ? null : ageRange,
        source,
      });
      onSaved(avatar);
    } catch (err) {
      const unavailable = err instanceof AvatarSaveError && err.unavailable;
      setSaveFailure({ message: err instanceof Error ? err.message : "Could not save your avatar. Please try again.", unavailable });
      if (unavailable) onLibraryUnavailable();
      setSaving(false);
    }
  }

  return (
    <AvatarDialog onClose={onClose} dismissible={!saving} labelledBy="avatar-details-title" layer="top" className="max-h-[calc(100dvh-1rem)] max-w-[720px]">
      <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5 dark:border-white/[0.06]">
          <div>
            <h2 id="avatar-details-title" className="text-lg font-semibold text-slate-900 dark:text-white">
              Save avatar
            </h2>
            <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">Name it, and tag it so the filters can find it later.</p>
          </div>
          <DialogCloseButton onClick={onClose} className="-mr-2" />
        </div>

        <div className="grid min-h-0 gap-6 overflow-y-auto p-6 sm:grid-cols-[208px_1fr]">
          {/* eslint-disable-next-line @next/next/no-img-element -- data URL preview, not a static asset */}
          <img
            src={image}
            alt="New avatar preview"
            className="mx-auto aspect-[4/5] w-44 rounded-2xl border border-slate-200 bg-slate-100 object-cover sm:w-full dark:border-white/[0.08] dark:bg-white/[0.04]"
          />

          <div className="flex min-w-0 flex-col gap-5">
            <div>
              <label htmlFor="avatar-name" className={FIELD_LABEL}>
                Name
              </label>
              <input
                id="avatar-name"
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                  if (error) setError(null);
                }}
                maxLength={AVATAR_NAME_MAX}
                placeholder="e.g. Coach Maya"
                autoFocus
                autoComplete="off"
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-[15px] text-slate-900 outline-none transition-[border-color,box-shadow] placeholder:text-slate-400 focus:border-blue-500 focus:shadow-[0_0_0_4px_rgba(51,92,255,0.12)] dark:border-white/[0.10] dark:bg-white/[0.03] dark:text-white dark:placeholder:text-zinc-500"
              />
            </div>
            <div>
              <span className={FIELD_LABEL}>Gender</span>
              <SegmentedControl label="Gender" value={gender} options={GENDER_OPTIONS} onChange={setGender} className="w-fit" />
            </div>
            <div>
              <span className={FIELD_LABEL}>Age</span>
              <SegmentedControl label="Age" value={ageRange} options={AGE_OPTIONS} onChange={setAgeRange} className="w-fit max-w-full overflow-x-auto [scrollbar-width:none]" />
            </div>
            {error && (
              <p role="alert" className="text-sm font-medium text-red-500">
                {error}
              </p>
            )}
            {saveFailure && (
              <div role="alert" className="flex gap-2.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm dark:border-red-400/20 dark:bg-red-500/[0.08]">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500 dark:text-red-400" />
                <div className="min-w-0">
                  <p className="font-medium text-red-700 dark:text-red-300">Couldn&apos;t save your avatar</p>
                  <p className="mt-0.5 text-red-600/90 dark:text-red-300/80">
                    {saveFailure.message} Your image stays here, so nothing is lost.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-6 py-4 dark:border-white/[0.06]">
          <button
            type="button"
            onClick={onBack}
            disabled={saving}
            className="flex h-10 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-slate-600 outline-none transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-blue-400/50 disabled:opacity-50 dark:text-slate-300 dark:hover:bg-white/[0.06] dark:hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <button type="submit" disabled={saving || !trimmed} className={PRIMARY_BUTTON}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {saving ? "Saving…" : saveFailure ? "Try again" : "Save and use"}
          </button>
        </div>
      </form>
    </AvatarDialog>
  );
}
