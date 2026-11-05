"use client";

import Image from "next/image";
import { Loader2, Plus, Trash2, UserRound } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  AVATAR_AGE_RANGES,
  AVATAR_PRESETS,
  avatarPresetImagePath,
  userAvatarImagePath,
  type AvatarAgeRange,
  type AvatarGender,
  type AvatarSource,
  type UserAvatar,
} from "@/lib/config/avatars";
import { MAX_FRAME_IMAGE_BYTES, processFrameImageFile } from "../FrameImagePicker";
import { FrameImageGenerateModal } from "../FrameImageGenerateModal";
import { AvatarDialog, DialogCloseButton, SegmentedControl } from "./AvatarDialog";
import { NewAvatarModal } from "./NewAvatarModal";
import { AvatarDetailsModal } from "./AvatarDetailsModal";
import { deleteUserAvatar, fetchAvatarLibrary, getCachedAvatarLibrary } from "./avatar-client";

// Saved avatars are stored at up to 1536px; normalizing to that before the
// upload keeps the request well under the route's body limit.
const AVATAR_NORMALIZE = { maxDimension: 1536, quality: 0.9 };

export interface PickedAvatar {
  /** Same-origin URL or data URL -- whatever it is, the caller re-normalizes it. */
  src: string;
  name: string;
}

type GenderFilter = "all" | AvatarGender;
type AgeFilter = "all" | AvatarAgeRange;
type Step = null | "new" | "generate" | "details";

const GENDER_FILTERS: { value: GenderFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
];

const AGE_FILTERS: { value: AgeFilter; label: string }[] = [
  { value: "all", label: "All ages" },
  ...AVATAR_AGE_RANGES.map((value) => ({ value, label: value })),
];

interface GridItem {
  key: string;
  name: string;
  gender: AvatarGender | null;
  ageRange: AvatarAgeRange | null;
  /** Full-size image handed to the composer. */
  src: string;
  /** User avatars only -- presets can't be deleted. */
  userAvatarId?: string;
}

const CARD_SHELL =
  "flex w-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white text-left outline-none transition-[border-color,box-shadow] duration-200 dark:border-white/[0.08] dark:bg-white/[0.03]";

function AvatarCardSkeleton() {
  return (
    <div className={CARD_SHELL}>
      <Skeleton className="aspect-[4/5] w-full" />
      <div className="border-t border-slate-100 px-3.5 py-3 dark:border-white/[0.06]">
        <Skeleton className="h-4 w-2/3 rounded-md" />
      </div>
    </div>
  );
}

function AvatarCard({
  item,
  onSelect,
  onDelete,
}: {
  item: GridItem;
  onSelect: () => void;
  onDelete?: () => Promise<void>;
}) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);

  return (
    <div className="group relative">
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          CARD_SHELL,
          "hover:border-slate-300 hover:shadow-[0_16px_32px_-18px_rgba(15,23,42,0.4)] focus-visible:ring-2 focus-visible:ring-blue-400/60 dark:hover:border-white/[0.18]"
        )}
      >
        <span className="relative block aspect-[4/5] w-full overflow-hidden bg-slate-100 dark:bg-white/[0.04]">
          {item.userAvatarId && imageFailed ? (
            <span className="absolute inset-0 flex items-center justify-center text-slate-400 dark:text-slate-500">
              <UserRound className="h-10 w-10" strokeWidth={1.5} />
            </span>
          ) : item.userAvatarId ? (
            // eslint-disable-next-line @next/next/no-img-element -- session-gated route; next/image's optimizer wouldn't forward the cookie
            <img
              src={userAvatarImagePath(item.userAvatarId, 480)}
              alt={item.name}
              loading="lazy"
              decoding="async"
              onError={() => setImageFailed(true)}
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
            />
          ) : (
            <Image
              src={item.src}
              alt={item.name}
              fill
              sizes="(min-width: 1024px) 240px, (min-width: 640px) 30vw, 45vw"
              className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
            />
          )}
        </span>
        <span className="block truncate border-t border-slate-100 px-3.5 py-3 text-[15px] font-medium text-slate-900 dark:border-white/[0.06] dark:text-white">
          {item.name}
        </span>
      </button>

      {onDelete && !confirming && (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          aria-label={`Delete ${item.name}`}
          className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/55 text-white opacity-0 backdrop-blur-sm transition-[opacity,background-color] duration-150 hover:bg-black/75 focus-visible:opacity-100 group-hover:opacity-100 pointer-coarse:opacity-100"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      )}

      {onDelete && confirming && (
        <div className="absolute inset-x-0 top-0 flex aspect-[4/5] flex-col items-center justify-center gap-3 rounded-t-2xl bg-slate-950/70 p-4 text-center backdrop-blur-[2px]">
          <p className="text-sm font-semibold text-white">Delete this avatar?</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={deleting}
              className="h-8 rounded-full bg-white/15 px-3.5 text-sm font-medium text-white transition-colors hover:bg-white/25 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={async () => {
                setDeleting(true);
                try {
                  await onDelete();
                } catch {
                  setDeleting(false);
                  setConfirming(false);
                }
              }}
              disabled={deleting}
              className="flex h-8 items-center gap-1.5 rounded-full bg-red-500 px-3.5 text-sm font-semibold text-white transition-colors hover:bg-red-600 disabled:opacity-70"
            >
              {deleting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * "Choose avatar" -- the user's saved avatars followed by the bundled
 * presets, filtered by gender and age bucket, with a "New avatar" card that
 * generates or uploads one and saves it to the library (user_avatars).
 * Competitor-parity layout.
 */
export function AvatarPickerModal({ onClose, onSelect }: { onClose: () => void; onSelect: (avatar: PickedAvatar) => void }) {
  const [gender, setGender] = useState<GenderFilter>("all");
  const [age, setAge] = useState<AgeFilter>("all");
  const [userAvatars, setUserAvatars] = useState<UserAvatar[] | null>(() => getCachedAvatarLibrary()?.avatars ?? null);
  // False when the server has no avatar library -- New avatar is then
  // disabled, so nobody spends credits on an avatar that can't be saved.
  const [libraryAvailable, setLibraryAvailable] = useState(() => getCachedAvatarLibrary()?.available ?? true);
  const [notice, setNotice] = useState<string | null>(null);
  const [step, setStep] = useState<Step>(null);
  const [draft, setDraft] = useState<{ image: string; source: AvatarSource } | null>(null);
  const [isPreparingUpload, setIsPreparingUpload] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchAvatarLibrary()
      .then((library) => {
        if (cancelled) return;
        setUserAvatars(library.avatars);
        setLibraryAvailable(library.available);
      })
      .catch(() => {
        if (cancelled) return;
        // The presets still work -- only the saved ones are missing.
        setUserAvatars((prev) => prev ?? []);
        setNotice("Your saved avatars couldn't be loaded right now. Presets are still available.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const items = useMemo<GridItem[]>(() => {
    const saved: GridItem[] = (userAvatars ?? []).map((avatar) => ({
      key: `user-${avatar.id}`,
      name: avatar.name,
      gender: avatar.gender,
      ageRange: avatar.ageRange,
      src: userAvatarImagePath(avatar.id),
      userAvatarId: avatar.id,
    }));
    const presets: GridItem[] = AVATAR_PRESETS.map((preset) => ({
      key: `preset-${preset.id}`,
      name: preset.name,
      gender: preset.gender,
      ageRange: preset.ageRange,
      src: avatarPresetImagePath(preset.id),
    }));
    return [...saved, ...presets].filter(
      (item) => (gender === "all" || item.gender === gender) && (age === "all" || item.ageRange === age)
    );
  }, [userAvatars, gender, age]);

  const closeStep = useCallback(() => {
    setStep(null);
    setDraft(null);
  }, []);

  function continueWithImage(image: string, source: AvatarSource) {
    setDraft({ image, source });
    setStep("details");
  }

  async function handleUpload(file: File) {
    if (!file.type.startsWith("image/")) {
      setNotice("That file isn't an image. Upload a JPG, PNG or WebP photo.");
      setStep(null);
      return;
    }
    if (file.size > MAX_FRAME_IMAGE_BYTES) {
      setNotice(`That photo is over ${MAX_FRAME_IMAGE_BYTES / (1024 * 1024)}MB.`);
      setStep(null);
      return;
    }
    setIsPreparingUpload(true);
    try {
      const image = await processFrameImageFile(file, AVATAR_NORMALIZE);
      setNotice(null);
      continueWithImage(image, "uploaded");
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Could not read that photo.");
      setStep(null);
    } finally {
      setIsPreparingUpload(false);
    }
  }

  async function handleGenerated(dataUrl: string) {
    try {
      const blob = await (await fetch(dataUrl)).blob();
      const image = await processFrameImageFile(new File([blob], "avatar", { type: blob.type || "image/png" }), AVATAR_NORMALIZE);
      continueWithImage(image, "generated");
    } catch {
      setNotice("Could not prepare that image. Try generating it again.");
      setStep(null);
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteUserAvatar(id);
      setUserAvatars((prev) => (prev ?? []).filter((avatar) => avatar.id !== id));
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Could not delete that avatar.");
      throw err;
    }
  }

  const filtersActive = gender !== "all" || age !== "all";

  return (
    <>
      <AvatarDialog
        onClose={onClose}
        dismissible={step === null}
        labelledBy="avatar-picker-title"
        className="h-[min(900px,calc(100dvh-1rem))] max-w-[1240px] sm:h-[min(900px,calc(100dvh-2rem))]"
      >
        <h2 id="avatar-picker-title" className="sr-only">
          Choose an avatar
        </h2>
        <div className="flex items-center gap-3 border-b border-slate-100 py-3 pl-4 pr-3 sm:py-4 sm:pl-6 sm:pr-4 dark:border-white/[0.06]">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            <SegmentedControl label="Filter by gender" value={gender} options={GENDER_FILTERS} onChange={setGender} />
            <SegmentedControl label="Filter by age" value={age} options={AGE_FILTERS} onChange={setAge} />
          </div>
          <DialogCloseButton onClick={onClose} />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          {notice && (
            <div role="status" className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800 dark:border-amber-400/20 dark:bg-amber-400/[0.08] dark:text-amber-200">
              <span>{notice}</span>
              <button type="button" onClick={() => setNotice(null)} className="shrink-0 font-medium underline-offset-2 hover:underline">
                Dismiss
              </button>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5 lg:gap-5">
            <button
              type="button"
              onClick={() => setStep("new")}
              className="group flex min-h-[220px] w-full flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 px-4 text-center outline-none transition-colors duration-200 hover:border-slate-400 hover:bg-slate-100/70 focus-visible:ring-2 focus-visible:ring-blue-400/60 dark:border-white/[0.14] dark:bg-white/[0.02] dark:hover:border-white/[0.26] dark:hover:bg-white/[0.04]"
            >
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-200/70 text-slate-600 transition-transform duration-200 group-hover:scale-105 dark:bg-white/[0.08] dark:text-slate-300">
                <Plus className="h-6 w-6" strokeWidth={1.75} />
              </span>
              <span className="mt-4 text-[15px] font-semibold text-slate-900 dark:text-white">New avatar</span>
              <span className="mt-1 text-sm text-slate-500 dark:text-slate-400">Generate or upload</span>
            </button>

            {userAvatars === null ? (
              Array.from({ length: 9 }, (_, index) => <AvatarCardSkeleton key={index} />)
            ) : items.length === 0 ? (
              // Phone: its own row under the New avatar card. Wider: the rest of that card's row.
              <div className="col-span-full flex flex-col items-center px-4 py-16 text-center sm:col-span-2 sm:items-start sm:justify-center sm:py-0 sm:pl-4 sm:text-left md:col-span-3 lg:col-span-4">
                <p className="text-[15px] font-semibold text-slate-900 dark:text-white">No avatars match these filters</p>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Try another age or gender, or create a new avatar.</p>
                {filtersActive && (
                  <button
                    type="button"
                    onClick={() => {
                      setGender("all");
                      setAge("all");
                    }}
                    className="mt-4 h-9 rounded-full bg-slate-100 px-4 text-sm font-medium text-slate-800 transition-colors hover:bg-slate-200/70 dark:bg-white/[0.07] dark:text-slate-100 dark:hover:bg-white/[0.11]"
                  >
                    Clear filters
                  </button>
                )}
              </div>
            ) : (
              items.map((item) => (
                <AvatarCard
                  key={item.key}
                  item={item}
                  onSelect={() => onSelect({ src: item.src, name: item.name })}
                  onDelete={item.userAvatarId ? () => handleDelete(item.userAvatarId!) : undefined}
                />
              ))
            )}
          </div>
        </div>
      </AvatarDialog>

      {step === "new" && (
        <NewAvatarModal
          onClose={closeStep}
          onGenerate={() => setStep("generate")}
          onUpload={(file) => void handleUpload(file)}
          isPreparingUpload={isPreparingUpload}
          canSave={libraryAvailable}
        />
      )}
      {step === "generate" && (
        <FrameImageGenerateModal
          frameLabel="character"
          defaultAspectRatio="3:4"
          title="Generate an avatar"
          description="Describe the person you want. You'll name and save them next."
          confirmLabel="Continue"
          onClose={() => setStep("new")}
          onSelect={(dataUrl) => void handleGenerated(dataUrl)}
        />
      )}
      {step === "details" && draft && (
        <AvatarDetailsModal
          image={draft.image}
          source={draft.source}
          onBack={() => {
            setDraft(null);
            setStep(draft.source === "generated" ? "generate" : "new");
          }}
          onClose={closeStep}
          onSaved={(avatar) => {
            setUserAvatars((prev) => [avatar, ...(prev ?? []).filter((item) => item.id !== avatar.id)]);
            closeStep();
            // Already in memory -- no need to fetch it back from the image route.
            onSelect({ src: draft.image, name: avatar.name });
          }}
          onLibraryUnavailable={() => setLibraryAvailable(false)}
        />
      )}
    </>
  );
}
