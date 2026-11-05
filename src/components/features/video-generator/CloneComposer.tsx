"use client";

import {
  ArrowUp,
  ImagePlus,
  Loader2,
  MapPin,
  Package,
  PersonStanding,
  Plus,
  Replace,
  Scan,
  Shirt,
  Sparkles,
  SquarePlay,
  Upload,
  UserRound,
  Video,
  X,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useRef, useState, type DragEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { PlasticButton } from "@/components/ui/plastic-button";
import type { CloneModeConfig, CloneToolConfig, CloneToolId } from "@/lib/config/video-models";
import { MentionTextarea } from "./MentionTextarea";
import { MAX_FRAME_IMAGE_BYTES, processFrameImageFile } from "./FrameImagePicker";
import { FrameImageGenerateModal } from "./FrameImageGenerateModal";
import { AvatarPickerModal } from "./avatars/AvatarPickerModal";
import { UploadOrb } from "./UploadOrb";
import {
  ChoicePill,
  COMPOSER_PILL_IDLE,
  COMPOSER_PILL_OPEN,
  COMPOSER_PILL_SHAPE,
  MENU_ICON_TILE,
  MENU_ITEM_BASE,
  MENU_ITEM_IDLE,
  PopoverPanel,
  usePopover,
} from "./ComposerMenus";

// Up to 12 references plus the captured frame travel in one JSON body, which
// has to stay under Vercel's ~4.5MB request limit -- so references are
// normalized smaller than Create's 2048px start/end frames.
const REFERENCE_NORMALIZE = { maxDimension: 1024, quality: 0.82 };

export interface CloneSourceState {
  id: string;
  /** Object URL for a fresh upload, or the library route for a reused clip. */
  previewUrl: string;
  durationSeconds: number;
}

interface CloneComposerProps {
  tools: CloneToolConfig[];
  tool: CloneToolConfig;
  onToolChange: (id: CloneToolId) => void;
  /** The model the tool runs on -- not user-selectable, but it sets the limits (clip length, image count). */
  mode: CloneModeConfig;
  source: CloneSourceState | null;
  isUploadingSource: boolean;
  /** What the video card says while a clip is being prepared -- progress is 0..1 while converting, null while uploading. */
  sourceStatus?: { label: string; progress: number | null } | null;
  onPickVideo: (file: File) => void;
  onClearSource: () => void;
  images: string[];
  onImagesChange: (next: string[]) => void;
  prompt: string;
  onPromptChange: (value: string) => void;
  resolution: string;
  /** Each option's cost for the attached clip (or the shortest allowed clip before one is attached). */
  resolutionOptions: { value: string; label: string; cost: number }[];
  onResolutionChange: (value: string) => void;
  keepOriginalSound: boolean;
  onKeepOriginalSoundChange: (value: boolean) => void;
  matchBackground: boolean;
  onMatchBackgroundChange: (value: boolean) => void;
  cost: number;
  /** No clip attached yet -- `cost` is the starting price, not this job's. */
  costIsStartingPrice: boolean;
  canSubmit: boolean;
  isGenerating: boolean;
  onSubmit: () => void;
  onError: (message: string | null) => void;
}

function formatDuration(seconds: number): string {
  const whole = Math.round(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

/** Re-encodes any same-origin or data-URL image through the same normalizer uploads use. */
async function normalizeImageSource(src: string): Promise<string> {
  const response = await fetch(src);
  if (!response.ok) throw new Error("Could not load that image.");
  const blob = await response.blob();
  return processFrameImageFile(new File([blob], "image", { type: blob.type || "image/jpeg" }), REFERENCE_NORMALIZE);
}

/** Person in scan brackets -- the competitor's Motion transfer glyph, built from two stock icons. */
function MotionTransferIcon({ className }: { className?: string }) {
  return (
    <span className={cn("relative inline-flex shrink-0", className)}>
      <Scan className="h-full w-full" />
      <PersonStanding className="absolute inset-0 m-auto h-[58%] w-[58%]" />
    </span>
  );
}

function ToolIcon({ tool, className }: { tool: CloneToolId; className?: string }) {
  if (tool === "motion_transfer") return <MotionTransferIcon className={className} />;
  const Icon = tool === "object_swap" ? Replace : UserRound;
  return <Icon className={className} />;
}

// Desktop: two tall drop cards beside the prompt. Phone: the same drop
// targets as full-width rows -- side by side at phone width the cards wrap
// their labels into narrow columns.
const CARD_SHAPE =
  "relative flex h-[168px] w-full flex-col items-center justify-center overflow-hidden rounded-2xl border border-dashed text-center outline-none transition-colors duration-200";
const ROW_SHAPE =
  "relative flex min-h-[76px] w-full items-center gap-3 overflow-hidden rounded-2xl border p-3 text-left outline-none transition-colors duration-200";

/** A phone row's label: what goes here, and its limit or current state. */
function RowText({ title, subtitle }: { title: string; subtitle: ReactNode }) {
  return (
    <div className="min-w-0 flex-1">
      <p className="text-sm font-medium leading-snug text-slate-900 dark:text-white">{title}</p>
      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>
    </div>
  );
}

const ROW_ACTION =
  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 dark:bg-white/[0.07] dark:text-slate-300";

/** Trailing remove button on a filled phone row. */
function RowRemove({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      aria-label={label}
      className={cn(ROW_ACTION, "outline-none transition-colors hover:bg-slate-200/70 focus-visible:ring-2 focus-visible:ring-blue-400/50 dark:hover:bg-white/[0.11]")}
    >
      <X className="h-4 w-4" />
    </button>
  );
}

function DropCard({
  onFiles,
  onClick,
  disabled,
  children,
  shape = CARD_SHAPE,
  className,
}: {
  onFiles: (files: File[]) => void;
  onClick?: () => void;
  disabled?: boolean;
  children: ReactNode;
  shape?: string;
  className?: string;
}) {
  const [dragging, setDragging] = useState(false);

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    if (disabled) return;
    const files = Array.from(event.dataTransfer.files);
    if (files.length > 0) onFiles(files);
  }

  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={disabled ? undefined : onClick}
      onKeyDown={(event) => {
        if (!disabled && onClick && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          onClick();
        }
      }}
      onDragOver={(event) => {
        event.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className={cn(
        shape,
        dragging
          ? "border-blue-400 bg-blue-50/60 dark:border-blue-400/60 dark:bg-blue-500/[0.08]"
          : "border-slate-200 bg-white dark:border-white/[0.10] dark:bg-white/[0.02]",
        onClick && !disabled && "cursor-pointer hover:border-blue-300 hover:bg-blue-50/40 focus-visible:ring-2 focus-visible:ring-blue-400/50 dark:hover:border-blue-400/40 dark:hover:bg-blue-500/[0.04]",
        className
      )}
    >
      {children}
    </div>
  );
}

/**
 * The Clone tab's composer -- competitor-parity layout: a video drop card, a
 * references/character drop card (addressable as @Image1... in the prompt),
 * a free-form prompt, and a bottom bar with the tool menu, per-tool settings
 * pills and the cost + submit pill. There's no model picker: each tool runs
 * on one model (see CLONE_TOOLS), whose limits the copy reflects.
 */
export function CloneComposer({
  tools,
  tool,
  onToolChange,
  mode,
  source,
  isUploadingSource,
  sourceStatus,
  onPickVideo,
  onClearSource,
  images,
  onImagesChange,
  prompt,
  onPromptChange,
  resolution,
  resolutionOptions,
  onResolutionChange,
  keepOriginalSound,
  onKeepOriginalSoundChange,
  matchBackground,
  onMatchBackgroundChange,
  cost,
  costIsStartingPrice,
  canSubmit,
  isGenerating,
  onSubmit,
  onError,
}: CloneComposerProps) {
  const videoInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [isProcessingImages, setIsProcessingImages] = useState(false);
  const [showPresets, setShowPresets] = useState(false);
  const [showAiCreate, setShowAiCreate] = useState(false);
  const { open: plusOpen, setOpen: setPlusOpen, ref: plusRef } = usePopover();

  const isCharacter = tool.id === "character";
  const maxImages = mode.maxReferenceImages;
  const isFull = images.length >= maxImages;
  // A single-photo tool replaces its photo rather than refusing a new one.
  const canAddMore = !isProcessingImages && (maxImages === 1 || !isFull);

  function addNormalizedImages(next: string[]) {
    if (maxImages === 1) {
      onImagesChange(next.slice(0, 1));
      return;
    }
    const room = maxImages - images.length;
    onImagesChange([...images, ...next.slice(0, room)]);
    onError(next.length > room ? `Only the first ${room} image${room === 1 ? "" : "s"} were added (max ${maxImages}).` : null);
  }

  async function addImageFiles(files: File[]) {
    const imageFiles = files.filter((file) => file.type.startsWith("image/"));
    if (imageFiles.length === 0) {
      onError("Those files aren't images.");
      return;
    }
    if (!canAddMore) {
      onError(`You can add up to ${maxImages} images.`);
      return;
    }
    const room = maxImages === 1 ? 1 : maxImages - images.length;
    const tooLarge = imageFiles.some((file) => file.size > MAX_FRAME_IMAGE_BYTES);
    const sized = imageFiles.filter((file) => file.size <= MAX_FRAME_IMAGE_BYTES);
    setIsProcessingImages(true);
    try {
      addNormalizedImages(await Promise.all(sized.slice(0, room).map((file) => processFrameImageFile(file, REFERENCE_NORMALIZE))));
      if (tooLarge) onError(`Images over ${MAX_FRAME_IMAGE_BYTES / (1024 * 1024)}MB were skipped.`);
      else if (maxImages > 1 && sized.length > room) onError(`Only the first ${room} image${room === 1 ? "" : "s"} were added (max ${maxImages}).`);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Could not read that image.");
    } finally {
      setIsProcessingImages(false);
    }
  }

  async function addImageFromSource(src: string) {
    setIsProcessingImages(true);
    try {
      addNormalizedImages([await normalizeImageSource(src)]);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Could not load that image.");
    } finally {
      setIsProcessingImages(false);
    }
  }

  function addVideoFiles(files: File[]) {
    const file = files.find((candidate) => candidate.type.startsWith("video/") || /\.(mp4|mov|m4v|webm|mkv)$/i.test(candidate.name));
    if (!file) {
      onError("Drop a video file (MP4, MOV or WebM).");
      return;
    }
    onPickVideo(file);
  }

  const plusItems: { action: "upload" | "preset" | "ai"; label: string; icon: LucideIcon }[] = [
    { action: "upload", label: isCharacter ? "Upload image" : "Upload images", icon: Upload },
    { action: "preset", label: "Choose avatar", icon: UserRound },
    { action: "ai", label: "Create a character with AI", icon: Sparkles },
  ];

  function handlePlusAction(action: "upload" | "preset" | "ai") {
    setPlusOpen(false);
    if (action === "upload") imageInputRef.current?.click();
    else if (action === "preset") setShowPresets(true);
    else setShowAiCreate(true);
  }

  return (
    // Phone radius 28 = the rows' 16 + this 12px padding, so the corners nest.
    <div className="flex w-full flex-col gap-3 rounded-[1.75rem] border border-slate-200 bg-white p-3 shadow-sm transition-[border-color,box-shadow] duration-200 focus-within:border-blue-500 focus-within:shadow-[0_0_0_4px_rgba(51,92,255,0.12)] lg:rounded-[2rem] lg:p-4 dark:border-white/[0.08] dark:bg-[#131318] dark:focus-within:border-blue-500/70">
      <div className="flex flex-col gap-3 lg:flex-row lg:gap-4">
        {/* Phone: the video and the images as two full-width rows */}
        <div className="flex flex-col gap-2 lg:hidden">
          <DropCard
            shape={ROW_SHAPE}
            onFiles={addVideoFiles}
            onClick={source || isUploadingSource ? undefined : () => videoInputRef.current?.click()}
            disabled={isUploadingSource}
            className={source ? "border-solid" : "border-dashed"}
          >
            {source ? (
              <>
                <video src={source.previewUrl} muted loop autoPlay playsInline className="h-[52px] w-[52px] shrink-0 rounded-xl bg-slate-100 object-cover dark:bg-white/[0.05]" />
                <RowText title="Your video" subtitle={formatDuration(source.durationSeconds)} />
                <RowRemove label="Remove video" onClick={onClearSource} />
              </>
            ) : isUploadingSource ? (
              <>
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-500/10">
                  <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-900 dark:text-white">
                    {sourceStatus?.label ?? "Preparing video…"}
                    {sourceStatus?.progress != null && <span className="tabular-nums"> {Math.round(sourceStatus.progress * 100)}%</span>}
                  </p>
                  {sourceStatus?.progress != null && (
                    <span className="mt-2 block h-1 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-white/[0.08]">
                      <span className="block h-full rounded-full bg-blue-500 transition-[width] duration-200" style={{ width: `${Math.round(sourceStatus.progress * 100)}%` }} />
                    </span>
                  )}
                </div>
              </>
            ) : (
              <>
                <UploadOrb icon={Video} className="h-11 w-11" />
                <RowText title={tool.videoTitle} subtitle={`${mode.minSourceDurationSeconds} to ${Math.floor(mode.maxSourceDurationSeconds)} seconds`} />
                <span className={ROW_ACTION}>
                  <Plus className="h-4 w-4" />
                </span>
              </>
            )}
          </DropCard>

          <DropCard
            shape={ROW_SHAPE}
            onFiles={(files) => void addImageFiles(files)}
            onClick={images.length === 0 && !isProcessingImages ? () => imageInputRef.current?.click() : undefined}
            disabled={isProcessingImages}
            className={images.length > 0 ? "border-solid" : "border-dashed"}
          >
            {isCharacter && images[0] ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element -- data URL preview, not a static asset */}
                <img src={images[0]} alt="Your character" className="h-[52px] w-[52px] shrink-0 rounded-xl bg-slate-50 object-cover dark:bg-white/[0.03]" />
                <RowText title="Your character" subtitle={tool.imagesSubtitle ?? "Photo added"} />
                <RowRemove label="Remove character" onClick={() => onImagesChange([])} />
              </>
            ) : images.length > 0 ? (
              // Scrolls sideways once the strip outgrows the row; remove is
              // always visible since there's no hover on touch.
              <div className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto [scrollbar-width:none]">
                {images.map((image, index) => (
                  <div key={index} className="relative h-[52px] w-[52px] shrink-0 overflow-hidden rounded-xl ring-1 ring-slate-200 dark:ring-white/10">
                    {/* eslint-disable-next-line @next/next/no-img-element -- data URL preview, not a static asset */}
                    <img src={image} alt={`Image ${index + 1}`} className="h-full w-full object-cover" />
                    <span className="pointer-events-none absolute bottom-0.5 left-0.5 rounded bg-black/55 px-1 text-[9px] font-semibold leading-tight text-white">
                      @{index + 1}
                    </span>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onImagesChange(images.filter((_, i) => i !== index));
                      }}
                      aria-label={`Remove image ${index + 1}`}
                      className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                {!isFull && (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      imageInputRef.current?.click();
                    }}
                    disabled={isProcessingImages}
                    aria-label="Add image"
                    className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-xl border border-dashed border-slate-300 text-slate-400 dark:border-zinc-700 dark:text-slate-500"
                  >
                    {isProcessingImages ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                  </button>
                )}
              </div>
            ) : isProcessingImages ? (
              <>
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-500/10">
                  <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                </span>
                <RowText title="Adding images…" subtitle="Preparing for upload" />
              </>
            ) : (
              <>
                <UploadOrb icon={isCharacter ? UserRound : ImagePlus} filled={isCharacter} className="h-11 w-11" />
                <RowText title={tool.imagesTitle} subtitle={tool.imagesSubtitle ?? `Up to ${maxImages} images`} />
                <span className={ROW_ACTION}>
                  <Plus className="h-4 w-4" />
                </span>
              </>
            )}
          </DropCard>
        </div>

        <div className="hidden lg:flex lg:shrink-0 lg:gap-3">
          {/* Video */}
          <DropCard
            onFiles={addVideoFiles}
            onClick={source || isUploadingSource ? undefined : () => videoInputRef.current?.click()}
            disabled={isUploadingSource}
            className="lg:w-[200px]"
          >
            {source ? (
              <>
                <video src={source.previewUrl} muted loop autoPlay playsInline className="absolute inset-0 h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onClearSource();
                  }}
                  aria-label="Remove video"
                  className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm transition-colors hover:bg-black/80"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
                <span className="absolute bottom-2 left-2 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-white backdrop-blur-sm">
                  {formatDuration(source.durationSeconds)}
                </span>
              </>
            ) : isUploadingSource ? (
              <div className="flex w-full flex-col items-center gap-2 px-5">
                <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                <span className="text-[13px] font-medium text-slate-600 dark:text-slate-300">
                  {sourceStatus?.label ?? "Preparing video…"}
                  {sourceStatus?.progress != null && <span className="tabular-nums"> {Math.round(sourceStatus.progress * 100)}%</span>}
                </span>
                {sourceStatus?.progress != null && (
                  <span className="h-1 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-white/[0.08]">
                    <span className="block h-full rounded-full bg-blue-500 transition-[width] duration-200" style={{ width: `${Math.round(sourceStatus.progress * 100)}%` }} />
                  </span>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center px-3">
                <UploadOrb icon={Video} className="h-12 w-12" />
                <span className="mt-3 text-[13px] font-medium text-slate-900 dark:text-white">{tool.videoTitle}</span>
                <span className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  {mode.minSourceDurationSeconds} to {Math.floor(mode.maxSourceDurationSeconds)} seconds
                </span>
              </div>
            )}
          </DropCard>

          {/* References / character */}
          <DropCard
            onFiles={(files) => void addImageFiles(files)}
            onClick={images.length === 0 && !isProcessingImages ? () => imageInputRef.current?.click() : undefined}
            disabled={isProcessingImages}
            className="lg:w-[200px]"
          >
            {isCharacter && images[0] ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element -- data URL preview, not a static asset */}
                <img src={images[0]} alt="Your character" className="absolute inset-0 h-full w-full bg-slate-50 object-contain dark:bg-white/[0.03]" />
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onImagesChange([]);
                  }}
                  aria-label="Remove character"
                  className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm transition-colors hover:bg-black/80"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </>
            ) : images.length > 0 ? (
              <div className="grid h-full w-full grid-cols-4 content-start gap-1.5 p-2">
                {images.map((image, index) => (
                  <div key={index} className="group/ref relative aspect-square overflow-hidden rounded-lg ring-1 ring-slate-200 dark:ring-white/10">
                    {/* eslint-disable-next-line @next/next/no-img-element -- data URL preview, not a static asset */}
                    <img src={image} alt={`Image ${index + 1}`} className="h-full w-full object-cover" />
                    <span className="pointer-events-none absolute bottom-0.5 left-0.5 rounded bg-black/55 px-1 text-[9px] font-semibold leading-tight text-white">
                      @{index + 1}
                    </span>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onImagesChange(images.filter((_, i) => i !== index));
                      }}
                      aria-label={`Remove image ${index + 1}`}
                      className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all duration-150 group-hover/ref:bg-black/40 group-hover/ref:opacity-100"
                    >
                      <X className="h-3.5 w-3.5 text-white" />
                    </button>
                  </div>
                ))}
                {!isFull && (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      imageInputRef.current?.click();
                    }}
                    disabled={isProcessingImages}
                    aria-label="Add image"
                    className="flex aspect-square items-center justify-center rounded-lg border border-dashed border-slate-300 text-slate-400 transition-colors hover:border-blue-400 hover:text-blue-500 dark:border-zinc-700 dark:text-slate-500 dark:hover:border-blue-400/50 dark:hover:text-blue-400"
                  >
                    {isProcessingImages ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
                  </button>
                )}
              </div>
            ) : isProcessingImages ? (
              <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
            ) : (
              <div className="flex flex-col items-center px-3">
                {isCharacter ? (
                  <UploadOrb icon={UserRound} className="h-8 w-8" />
                ) : (
                  <span className="flex">
                    {[UserRound, Shirt, Package, MapPin].map((Icon, index) => (
                      <UploadOrb key={index} icon={Icon} className={cn("h-8 w-8 ring-2 ring-white dark:ring-[#131318]", index > 0 && "-ml-2")} />
                    ))}
                  </span>
                )}
                <span className="mt-3 max-w-[160px] text-[13px] font-medium leading-snug text-slate-900 dark:text-white">{tool.imagesTitle}</span>
                <span className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{tool.imagesSubtitle ?? `Up to ${maxImages} images`}</span>
              </div>
            )}
          </DropCard>
        </div>

        {/* px-3 on phone puts the prompt's text on the rows' icon column. */}
        <div className="min-h-[96px] min-w-0 flex-1 px-3 lg:min-h-[120px] lg:px-0 lg:pt-1">
          <MentionTextarea
            value={prompt}
            onChange={onPromptChange}
            images={images}
            placeholder={tool.placeholder}
            className="h-full min-h-[96px] w-full resize-none bg-transparent text-[15px] font-normal leading-relaxed text-slate-900 outline-none placeholder:font-normal placeholder:text-slate-400 lg:min-h-[120px] dark:text-white dark:placeholder:text-zinc-500"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {/* + menu */}
        <div ref={plusRef} className="relative">
          <button
            type="button"
            onClick={() => setPlusOpen((prev) => !prev)}
            aria-label="Add images"
            aria-haspopup="menu"
            aria-expanded={plusOpen}
            className={cn(COMPOSER_PILL_SHAPE, "w-9 justify-center", plusOpen ? COMPOSER_PILL_OPEN : COMPOSER_PILL_IDLE)}
          >
            <Plus className="h-[18px] w-[18px]" strokeWidth={1.75} />
          </button>
          <PopoverPanel open={plusOpen} onClose={() => setPlusOpen(false)} title={isCharacter ? "Add your character" : "Add images"} className="w-64">
            {plusItems.map((item) => (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                disabled={!canAddMore}
                onClick={() => handlePlusAction(item.action)}
                className={cn(MENU_ITEM_BASE, MENU_ITEM_IDLE)}
              >
                <span className={MENU_ICON_TILE}>
                  <item.icon className="h-4 w-4" />
                </span>
                <span className="text-sm font-medium text-slate-900 dark:text-white">{item.label}</span>
              </button>
            ))}
          </PopoverPanel>
        </div>

        <ChoicePill
          ariaLabel="Clone tool"
          value={tool.id}
          onChange={(value) => onToolChange(value as CloneToolId)}
          triggerIcon={<ToolIcon tool={tool.id} className="h-4 w-4" />}
          panelClassName="w-[min(440px,calc(100vw-3rem))]"
          options={tools.map((option) => ({
            value: option.id,
            label: option.label,
            description: option.description,
            icon: <ToolIcon tool={option.id} className="h-4 w-4" />,
          }))}
        />

        <ChoicePill
          ariaLabel="Resolution"
          value={resolution}
          onChange={onResolutionChange}
          triggerIcon={isCharacter ? undefined : <Scan className="h-4 w-4" />}
          panelClassName="w-44"
          options={resolutionOptions.map((option) => ({
            value: option.value,
            label: option.label,
            description: `${costIsStartingPrice ? "from " : ""}${option.cost} credits`,
          }))}
        />

        {isCharacter && (
          <>
            <ChoicePill
              ariaLabel="Sound"
              value={keepOriginalSound ? "original" : "none"}
              onChange={(value) => onKeepOriginalSoundChange(value === "original")}
              panelClassName="w-60"
              options={[
                { value: "original", label: "Original sound", description: "Keep the video's audio." },
                { value: "none", label: "No sound", description: "Export a silent video." },
              ]}
            />
            <ChoicePill
              ariaLabel="Background"
              value={matchBackground ? "match" : "photo"}
              onChange={(value) => onMatchBackgroundChange(value === "match")}
              panelClassName="w-64"
              options={[
                { value: "match", label: "Match background", description: "Put your character into the video's own scene." },
                { value: "photo", label: "Photo background", description: "Keep the background from your photo." },
              ]}
            />
          </>
        )}

        {/* Desktop cost + submit pill. On phones it wrapped onto a line of
            its own, so there it lives in the fixed action bar below. */}
        <div className="ml-auto hidden h-11 items-center gap-2 rounded-full bg-slate-100 py-1 pl-3.5 pr-1 lg:flex dark:bg-white/[0.07]">
          <span className="flex items-center gap-1.5 text-sm font-medium tabular-nums text-slate-800 dark:text-slate-100">
            <SquarePlay className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            {costIsStartingPrice ? <span className="text-slate-500 dark:text-slate-400">from {cost}</span> : cost}
          </span>
          <button
            type="button"
            onClick={onSubmit}
            disabled={!canSubmit || isGenerating}
            aria-label="Generate"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-[radial-gradient(160%_160%_at_30%_20%,#6d9bff_0%,#335cff_60%,#1c3fd6_100%)] text-white shadow-[0_4px_12px_-4px_rgba(51,92,255,0.7),inset_0_1px_0_rgba(255,255,255,0.45)] transition-[transform,opacity] duration-200 active:scale-95 disabled:pointer-events-none disabled:opacity-45"
          >
            {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" strokeWidth={2.5} />}
          </button>
        </div>
      </div>

      {/* Phone action bar -- the same fixed bar Create uses (MobileCreatePanel). */}
      <div className="fixed inset-x-0 bottom-0 z-30 flex items-center border-t border-slate-200/70 bg-white/90 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-xl lg:hidden dark:border-white/[0.08] dark:bg-zinc-950/90">
        <PlasticButton
          text="Generate"
          loading={isGenerating}
          disabled={!canSubmit}
          onClick={onSubmit}
          trailing={
            <span className="inline-flex items-center gap-1 whitespace-nowrap text-blue-200/80">
              <span aria-hidden="true">&middot;</span>
              <Zap className="h-3.5 w-3.5" />
              {costIsStartingPrice ? `from ${cost}` : cost}
            </span>
          }
          className="!flex-1 !py-3 !text-sm font-semibold"
        />
      </div>

      <input
        ref={videoInputRef}
        type="file"
        accept="video/*,.mp4,.mov,.m4v,.webm,.mkv"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) onPickVideo(file);
        }}
      />
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        multiple={!isCharacter}
        className="hidden"
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          event.target.value = "";
          if (files.length > 0) void addImageFiles(files);
        }}
      />

      {showPresets && (
        <AvatarPickerModal
          onClose={() => setShowPresets(false)}
          onSelect={(avatar) => {
            setShowPresets(false);
            void addImageFromSource(avatar.src);
          }}
        />
      )}
      {showAiCreate && (
        <FrameImageGenerateModal
          frameLabel="character"
          defaultAspectRatio="9:16"
          onClose={() => setShowAiCreate(false)}
          onSelect={(dataUrl) => {
            setShowAiCreate(false);
            void addImageFromSource(dataUrl);
          }}
        />
      )}
    </div>
  );
}
