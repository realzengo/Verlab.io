"use client";

import { useRef, type ReactNode, type Ref } from "react";
import { cn } from "@/lib/utils";

// Eleven v3 audio tags, e.g. [angry], [whispers], [laughs harder].
const AUDIO_TAG = /(\[[^\]\n]{1,200}\])/g;

function renderHighlighted(text: string): ReactNode[] {
  return text.split(AUDIO_TAG).map((part, index) =>
    index % 2 === 1 ? (
      // Pill look without moving any text: horizontal padding is cancelled
      // by an equal negative margin, the outline is an inset box-shadow (not
      // a border), and the font weight is unchanged -- so the overlay stays
      // glyph-for-glyph aligned with the textarea's caret.
      <mark
        key={index}
        className="-mx-[3px] rounded-md bg-primary/[0.06] px-[3px] py-[2px] text-primary shadow-[inset_0_0_0_1px_rgba(51,92,255,0.3)] [box-decoration-break:clone] dark:bg-primary/15 dark:text-blue-300 dark:shadow-[inset_0_0_0_1px_rgba(120,150,255,0.35)]"
      >
        {part}
      </mark>
    ) : (
      part
    )
  );
}

/**
 * The script editor. When `highlightTags` is on, a styled copy of the text
 * is drawn behind a transparent-text textarea so [audio tags] show up blue
 * while typing, selection and the caret stay native.
 */
export function ScriptTextarea({
  value,
  onChange,
  highlightTags,
  placeholder,
  maxLength,
  className,
  paddingClassName,
  onSubmit,
  textareaRef,
}: {
  value: string;
  onChange: (value: string) => void;
  highlightTags: boolean;
  placeholder?: string;
  maxLength?: number;
  /** Sizing/margins for the editor box, e.g. "mt-2 min-h-[300px] flex-1". */
  className?: string;
  /** Text inset, shared by the textarea and the highlight layer so they line up. */
  paddingClassName: string;
  /** Called on ⌘/Ctrl+Enter. */
  onSubmit?: () => void;
  textareaRef?: Ref<HTMLTextAreaElement>;
}) {
  const backdropRef = useRef<HTMLDivElement | null>(null);
  const shared = cn(
    "h-full w-full whitespace-pre-wrap break-words text-[15px] font-normal leading-7 [scrollbar-gutter:stable]",
    paddingClassName
  );

  return (
    <div className={cn("relative flex", className)}>
      {highlightTags && (
        <div ref={backdropRef} aria-hidden className={cn(shared, "pointer-events-none absolute inset-0 overflow-hidden text-body")}>
          {renderHighlighted(value)}
          {/* Keeps a trailing newline's empty last line the same height as the textarea's. */}
          {"\n"}
        </div>
      )}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (onSubmit && event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            onSubmit();
          }
        }}
        onScroll={(event) => {
          if (backdropRef.current) backdropRef.current.scrollTop = event.currentTarget.scrollTop;
        }}
        placeholder={placeholder}
        maxLength={maxLength}
        className={cn(
          shared,
          "relative flex-1 resize-none overflow-y-auto bg-transparent outline-none placeholder:font-normal placeholder:text-[#9AA0AB] dark:placeholder:text-zinc-500",
          highlightTags ? "text-transparent caret-heading selection:bg-primary/25" : "text-body"
        )}
      />
    </div>
  );
}
