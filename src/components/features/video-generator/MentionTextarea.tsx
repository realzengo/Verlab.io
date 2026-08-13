"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { GLASS_PANEL } from "@/components/ui/PillDropdown";

const MENTION_LABEL_ATTR = "data-mention-label";
const MENTION_PATTERN = /@Image(\d+)/g;

/** Recursively flattens a DOM subtree back into the plain-string model: text nodes contribute their text, mention chip spans contribute their "@ImageN" token, everything else is walked into. Works on both a live root and a detached fragment (e.g. Range.cloneContents()), which is what makes it double as the caret-offset calculator below. */
function serializeNode(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? "";
  if (node instanceof HTMLElement && node.hasAttribute(MENTION_LABEL_ATTR)) {
    return `@${node.getAttribute(MENTION_LABEL_ATTR)}`;
  }
  let result = "";
  node.childNodes.forEach((child) => {
    result += serializeNode(child);
  });
  return result;
}

/** Builds one atomic, non-editable inline chip -- the browser's native contenteditable=false handling is what makes backspace-deletes-whole-chip and selection-spans-the-chip "just work" without custom key handling. */
function createMentionChip(label: string, image: string): HTMLSpanElement {
  const chip = document.createElement("span");
  chip.setAttribute(MENTION_LABEL_ATTR, label);
  chip.contentEditable = "false";
  chip.className =
    "mx-0.5 inline-flex select-none items-center gap-1 whitespace-nowrap rounded-full bg-slate-100 py-0.5 pl-0.5 pr-2 align-middle text-[0.85em] font-semibold text-slate-600 dark:bg-white/[0.08] dark:text-slate-300";

  const avatar = document.createElement("span");
  avatar.className = "h-4 w-4 shrink-0 overflow-hidden rounded-full ring-1 ring-slate-900/[0.06] dark:ring-white/10";
  const img = document.createElement("img");
  img.src = image;
  img.alt = "";
  img.className = "h-full w-full object-cover";
  avatar.appendChild(img);

  chip.appendChild(avatar);
  chip.appendChild(document.createTextNode(`@${label}`));
  return chip;
}

/** Rebuilds the editable's DOM from the plain-string model: any "@ImageN" substring that matches an actually-attached reference becomes a chip, everything else stays plain text. Only called for external value changes (see the sync effect) -- never on every keystroke, which would fight the browser's own cursor handling. */
function renderIntoDom(root: HTMLDivElement, text: string, images: string[]) {
  root.innerHTML = "";
  const fragment = document.createDocumentFragment();
  let lastIndex = 0;
  MENTION_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = MENTION_PATTERN.exec(text))) {
    const index = Number(match[1]) - 1;
    if (index < 0 || index >= images.length) continue;
    if (match.index > lastIndex) fragment.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
    fragment.appendChild(createMentionChip(`Image${index + 1}`, images[index]));
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
  root.appendChild(fragment);
}

function getCaretOffset(root: HTMLDivElement): number | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;
  const range = selection.getRangeAt(0);
  if (!root.contains(range.startContainer)) return null;
  const preRange = document.createRange();
  preRange.selectNodeContents(root);
  preRange.setEnd(range.startContainer, range.startOffset);
  return serializeNode(preRange.cloneContents()).length;
}

/** Inverse of getCaretOffset: walks the DOM to find the {node, offset} a plain-string index corresponds to, so a mention picked from the popover can be spliced in via Range APIs. A target that lands inside a chip (shouldn't normally happen -- chips are atomic) snaps to just after it. */
function findDomPosition(root: HTMLDivElement, target: number): { node: Node; offset: number } {
  let remaining = target;
  let found: { node: Node; offset: number } | null = null;

  function walk(node: Node): boolean {
    if (node.nodeType === Node.TEXT_NODE) {
      const length = (node.textContent ?? "").length;
      if (remaining <= length) {
        found = { node, offset: remaining };
        return true;
      }
      remaining -= length;
      return false;
    }
    if (node instanceof HTMLElement && node.hasAttribute(MENTION_LABEL_ATTR)) {
      const length = (node.getAttribute(MENTION_LABEL_ATTR)?.length ?? 0) + 1;
      if (remaining <= length) {
        const parent = node.parentNode as Node;
        found = { node: parent, offset: Array.prototype.indexOf.call(parent.childNodes, node) + 1 };
        return true;
      }
      remaining -= length;
      return false;
    }
    for (const child of Array.from(node.childNodes)) {
      if (walk(child)) return true;
    }
    return false;
  }

  walk(root);
  return found ?? { node: root, offset: root.childNodes.length };
}

function getCaretRect(root: HTMLDivElement): { top: number; left: number; height: number } | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;
  const range = selection.getRangeAt(0).cloneRange();
  range.collapse(true);
  const rect = range.getClientRects()[0] ?? range.getBoundingClientRect();
  if (!rect || (rect.width === 0 && rect.height === 0)) return null;
  const containerRect = root.getBoundingClientRect();
  return { top: rect.top - containerRect.top + root.scrollTop, left: rect.left - containerRect.left + root.scrollLeft, height: rect.height || 16 };
}

/** Same "@" must-start-line-or-follow-whitespace, no-embedded-whitespace rule as before -- unchanged from the textarea version. */
function findActiveMention(value: string, caret: number): { start: number; query: string } | null {
  const upToCaret = value.slice(0, caret);
  const atIndex = upToCaret.lastIndexOf("@");
  if (atIndex === -1) return null;
  const charBefore = atIndex === 0 ? "" : upToCaret[atIndex - 1];
  if (charBefore && !/\s/.test(charBefore)) return null;
  const query = upToCaret.slice(atIndex + 1);
  if (/\s/.test(query)) return null;
  return { start: atIndex, query };
}

interface MentionTextareaProps {
  value: string;
  onChange: (value: string) => void;
  images: string[];
  placeholder?: string;
  className?: string;
}

/**
 * Prompt editor with "@" mention autocomplete over attached reference
 * images, rendered as real inline chips (thumbnail + label) inside the text
 * flow -- not literal "@Image2" characters -- matching the competitor's
 * tagging UI. A plain <textarea> can't host an atomic inline node, so this
 * is a small contenteditable-based editor instead: the plain-string
 * "@ImageN" form (see renderIntoDom/serializeNode) is still the single
 * source of truth handed to the caller via onChange -- the chip is purely a
 * presentation layer over that string, rebuilt from it whenever `value`
 * changes for a reason other than this instance's own typing (so two
 * mounted instances bound to the same state, e.g. the docked card and
 * PromptExpandModal open at once, stay in sync without fighting each
 * other's cursor).
 */
export function MentionTextarea({ value, onChange, images, placeholder, className }: MentionTextareaProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [mention, setMention] = useState<{ start: number; query: string; coords: { top: number; left: number; height: number } } | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isEmpty, setIsEmpty] = useState(value.length === 0);

  const matches = useMemo(() => {
    if (!mention) return [];
    const query = mention.query.toLowerCase();
    return images.map((image, index) => ({ image, index, label: `Image${index + 1}` })).filter((item) => item.label.toLowerCase().includes(query));
  }, [mention, images]);

  const safeActiveIndex = matches.length === 0 ? 0 : Math.min(activeIndex, matches.length - 1);

  // External sync only: rebuilding on every keystroke would blow away the
  // browser's own cursor position mid-type. Skipped whenever the DOM
  // already matches `value` -- i.e. whenever this instance's own onInput
  // handler is what produced the new value in the first place.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    if (serializeNode(root) === value) return;
    renderIntoDom(root, value, images);
    setIsEmpty(value.length === 0);
  }, [value, images]);

  function syncMentionState(root: HTMLDivElement) {
    if (images.length === 0) {
      setMention(null);
      return;
    }
    const caret = getCaretOffset(root);
    if (caret === null) {
      setMention(null);
      return;
    }
    const active = findActiveMention(serializeNode(root), caret);
    if (!active) {
      setMention(null);
      return;
    }
    const coords = getCaretRect(root);
    if (!coords) {
      setMention(null);
      return;
    }
    setMention({ start: active.start, query: active.query, coords });
  }

  function handleInput() {
    const root = rootRef.current;
    if (!root) return;
    const text = serializeNode(root);
    onChange(text);
    setIsEmpty(text.length === 0);
    syncMentionState(root);
  }

  function insertMention(item: { label: string; image: string }) {
    const root = rootRef.current;
    if (!root || !mention) return;
    const caret = getCaretOffset(root);
    if (caret === null) return;

    const startPos = findDomPosition(root, mention.start);
    const endPos = findDomPosition(root, caret);
    const range = document.createRange();
    range.setStart(startPos.node, startPos.offset);
    range.setEnd(endPos.node, endPos.offset);
    range.deleteContents();

    const chip = createMentionChip(item.label, item.image);
    range.insertNode(chip);
    const space = document.createTextNode(" ");
    chip.after(space);

    const newRange = document.createRange();
    newRange.setStart(space, 1);
    newRange.collapse(true);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(newRange);

    root.focus();
    setMention(null);
    const text = serializeNode(root);
    onChange(text);
    setIsEmpty(text.length === 0);
  }

  return (
    <div className="relative h-full min-h-0 flex-1">
      <div
        ref={rootRef}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label={placeholder}
        onInput={handleInput}
        onClick={(event) => syncMentionState(event.currentTarget)}
        onKeyUp={(event) => {
          if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End", "Backspace", "Delete"].includes(event.key)) {
            syncMentionState(event.currentTarget);
          }
        }}
        onKeyDown={(event) => {
          if (mention && matches.length > 0) {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setActiveIndex((safeActiveIndex + 1) % matches.length);
              return;
            }
            if (event.key === "ArrowUp") {
              event.preventDefault();
              setActiveIndex((safeActiveIndex - 1 + matches.length) % matches.length);
              return;
            }
            if (event.key === "Enter" || event.key === "Tab") {
              event.preventDefault();
              insertMention(matches[safeActiveIndex]);
              return;
            }
            if (event.key === "Escape") {
              event.preventDefault();
              setMention(null);
              return;
            }
          }
          if (event.key === "Enter") {
            event.preventDefault();
            document.execCommand("insertLineBreak");
          }
        }}
        onPaste={(event) => {
          event.preventDefault();
          const text = event.clipboardData.getData("text/plain");
          document.execCommand("insertText", false, text);
        }}
        onBlur={() => setMention(null)}
        className={cn(className, "overflow-y-auto whitespace-pre-wrap break-words")}
      />

      {isEmpty && (
        <span className="pointer-events-none absolute left-0 top-0 select-none font-normal text-slate-400 dark:text-zinc-500">{placeholder}</span>
      )}

      <AnimatePresence>
        {mention && matches.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.12, ease: [0.16, 1, 0.3, 1] }}
            style={{ top: mention.coords.top + mention.coords.height + 4, left: mention.coords.left }}
            className={cn("absolute z-50 w-48 origin-top-left overflow-hidden rounded-2xl p-1.5", GLASS_PANEL)}
          >
            {matches.map((item, index) => (
              <button
                key={item.label}
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => insertMention(item)}
                onMouseEnter={() => setActiveIndex(index)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm font-medium transition-colors duration-100",
                  index === safeActiveIndex ? "bg-blue-500/10 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300" : "text-slate-700 dark:text-slate-200"
                )}
              >
                <span className="h-6 w-6 shrink-0 overflow-hidden rounded-full ring-1 ring-slate-900/[0.06] dark:ring-white/10">
                  {/* eslint-disable-next-line @next/next/no-img-element -- data URL preview, not a static asset */}
                  <img src={item.image} alt="" className="h-full w-full object-cover" />
                </span>
                {item.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
