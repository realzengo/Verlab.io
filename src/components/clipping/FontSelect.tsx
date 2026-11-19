"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown } from "lucide-react";
import {
  Fragment,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type KeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import { CAPTION_FONTS, type CaptionFont } from "@/lib/client/clip-render";
import { TRAY_PANEL } from "@/components/ui/PillDropdown";
import { cn } from "@/lib/utils";

// The caption and hook font menu: a select whose trigger and rows show each
// font in its own face, so picking one is picking how it looks. The menu
// opens in a portal (the settings panel scrolls and would clip it), under the
// trigger or above it when there's more room there, and works from the
// keyboard like a native select: arrows, Home/End, Enter, Escape, type to jump.

const FONT_IDS = Object.keys(CAPTION_FONTS) as CaptionFont[];

/** A word on what a font is for, beside its name. */
const FONT_NOTES: Partial<Record<CaptionFont, string>> = {
  komika: "MrBeast style",
  arabic: "Arabic",
};

const MENU_MAX_HEIGHT = 480;
const MENU_GAP = 6;
const VIEWPORT_MARGIN = 12;
const TYPEAHEAD_MS = 600;

// True in the browser, false on the server and while hydrating: the menu's portal waits for it.
const subscribeNever = () => () => {};
const useIsClient = () => useSyncExternalStore(subscribeNever, () => true, () => false);

const faceOf = (id: CaptionFont): CSSProperties => {
  const font = CAPTION_FONTS[id];
  return { fontFamily: `${font.family}, sans-serif`, fontWeight: font.weights[font.weights.length - 1] };
};

type Placement = { left: number; width: number; maxHeight: number } & ({ top: number } | { bottom: number });

/** Under the trigger, or above it when the space below is short and there's more above. */
function placeMenu(trigger: HTMLElement): Placement {
  const box = trigger.getBoundingClientRect();
  const below = window.innerHeight - box.bottom - MENU_GAP - VIEWPORT_MARGIN;
  const above = box.top - MENU_GAP - VIEWPORT_MARGIN;
  const width = Math.max(box.width, 260);
  const left = Math.min(Math.max(VIEWPORT_MARGIN, box.left), window.innerWidth - width - VIEWPORT_MARGIN);
  if (below < 240 && above > below) {
    return { left, width, maxHeight: Math.min(MENU_MAX_HEIGHT, above), bottom: window.innerHeight - box.top + MENU_GAP };
  }
  return { left, width, maxHeight: Math.min(MENU_MAX_HEIGHT, below), top: box.bottom + MENU_GAP };
}

export function FontSelect<T extends CaptionFont | "auto">({
  label,
  value,
  onChange,
  withAuto,
  autoFont,
}: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  /** Offer "Template": the font of the chosen caption style. */
  withAuto?: boolean;
  /** The font "Template" stands for right now, shown beside it. */
  autoFont?: CaptionFont;
}) {
  const options = [...(withAuto ? (["auto"] as const) : []), ...FONT_IDS] as T[];
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [placement, setPlacement] = useState<Placement | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<(HTMLDivElement | null)[]>([]);
  const typed = useRef({ text: "", at: 0 });
  const listId = useId();
  const isClient = useIsClient();

  const labelOf = (id: T) => (id === "auto" ? "Template" : CAPTION_FONTS[id as CaptionFont].label);
  const selectedIndex = Math.max(0, options.indexOf(value));

  const show = useCallback(() => {
    if (!triggerRef.current) return;
    setPlacement(placeMenu(triggerRef.current));
    setActive(selectedIndex);
    setOpen(true);
  }, [selectedIndex]);

  const hide = useCallback((refocus: boolean) => {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  }, []);

  const choose = (index: number) => {
    onChange(options[index]);
    hide(true);
  };

  // Follow the trigger while the page or the panel scrolls; close on a press anywhere else.
  useEffect(() => {
    if (!open) return;
    let frame = 0;
    const follow = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => triggerRef.current && setPlacement(placeMenu(triggerRef.current)));
    };
    const pressOutside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!listRef.current?.contains(target) && !triggerRef.current?.contains(target)) hide(false);
    };
    window.addEventListener("scroll", follow, true);
    window.addEventListener("resize", follow);
    document.addEventListener("pointerdown", pressOutside);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", follow, true);
      window.removeEventListener("resize", follow);
      document.removeEventListener("pointerdown", pressOutside);
    };
  }, [open, hide]);

  // Keys go to the list while it's open; the highlighted row stays in view.
  useLayoutEffect(() => {
    if (open) listRef.current?.focus({ preventScroll: true });
  }, [open]);
  useEffect(() => {
    if (open) optionRefs.current[active]?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  const onTriggerKey = (event: KeyboardEvent) => {
    if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
      event.preventDefault();
      show();
    }
  };

  const onListKey = (event: KeyboardEvent) => {
    const last = options.length - 1;
    const move = (index: number) => {
      event.preventDefault();
      setActive(Math.min(last, Math.max(0, index)));
    };
    if (event.key === "ArrowDown") move(active + 1);
    else if (event.key === "ArrowUp") move(active - 1);
    else if (event.key === "Home") move(0);
    else if (event.key === "End") move(last);
    else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      choose(active);
    } else if (event.key === "Escape") {
      event.preventDefault();
      hide(true);
    } else if (event.key === "Tab") {
      hide(false);
    } else if (event.key.length === 1 && /\S/.test(event.key)) {
      // Type the start of a name to jump to it.
      const now = event.timeStamp;
      typed.current = {
        text: (now - typed.current.at < TYPEAHEAD_MS ? typed.current.text : "") + event.key.toLowerCase(),
        at: now,
      };
      const match = options.findIndex((id) => labelOf(id).toLowerCase().startsWith(typed.current.text));
      if (match >= 0) move(match);
    }
  };

  const current = value === "auto" ? null : (value as CaptionFont);
  const triggerNote = current ? FONT_NOTES[current] : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onClick={() => (open ? hide(false) : show())}
        onKeyDown={onTriggerKey}
        className={cn(
          "group flex h-11 w-full items-center gap-2.5 rounded-xl px-3.5 text-left outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-primary/40",
          open ? "bg-(--app-fill-strong)" : "bg-(--app-fill) hover:bg-(--app-fill-strong)"
        )}
      >
        {current ? (
          <span className="min-w-0 truncate text-[15px] leading-[1.4] text-heading" style={faceOf(current)}>
            {CAPTION_FONTS[current].label}
          </span>
        ) : (
          <span className="flex min-w-0 items-baseline gap-2">
            <span className="text-[14px] font-medium text-heading">Template</span>
            {autoFont && (
              <span className="truncate text-[13px] leading-[1.4] text-subtle" style={faceOf(autoFont)}>
                {CAPTION_FONTS[autoFont].label}
              </span>
            )}
          </span>
        )}
        {triggerNote && (
          <span className="min-w-0 shrink-[4] truncate text-[11.5px] font-medium text-subtle">{triggerNote}</span>
        )}
        <ChevronDown
          aria-hidden
          className={cn(
            "ml-auto h-4 w-4 shrink-0 text-subtle transition-transform duration-200 group-hover:text-body",
            open && "rotate-180"
          )}
        />
      </button>

      {isClient &&
        createPortal(
          <AnimatePresence>
            {open && placement && (
              <motion.div
                ref={listRef}
                id={listId}
                role="listbox"
                aria-label={label}
                aria-activedescendant={`${listId}-${active}`}
                tabIndex={-1}
                onKeyDown={onListKey}
                initial={{ opacity: 0, y: "top" in placement ? -4 : 4, scale: 0.985 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, transition: { duration: 0.08 } }}
                transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
                style={{
                  position: "fixed",
                  left: placement.left,
                  width: placement.width,
                  maxHeight: placement.maxHeight,
                  ...("top" in placement ? { top: placement.top } : { bottom: placement.bottom }),
                  transformOrigin: "top" in placement ? "top center" : "bottom center",
                }}
                className={cn(
                  TRAY_PANEL,
                  "z-[120] overflow-y-auto overscroll-contain rounded-2xl p-1.5 outline-none [scrollbar-width:thin]"
                )}
              >
                {options.map((id, index) => {
                  const font = id === "auto" ? null : (id as CaptionFont);
                  const selected = index === selectedIndex;
                  const note = font ? FONT_NOTES[font] : null;
                  return (
                    <Fragment key={id}>
                      <div
                        ref={(node) => {
                          optionRefs.current[index] = node;
                        }}
                        id={`${listId}-${index}`}
                        role="option"
                        aria-selected={selected}
                        onPointerMove={() => setActive(index)}
                        onClick={() => choose(index)}
                        className={cn(
                          "flex h-11 cursor-pointer select-none items-center gap-2.5 rounded-[10px] px-2.5 transition-colors duration-100",
                          index === active && "bg-(--app-fill)"
                        )}
                      >
                        {font ? (
                          <span
                            className={cn("min-w-0 truncate text-[16px] leading-[1.4]", selected ? "text-heading" : "text-body")}
                            style={faceOf(font)}
                          >
                            {CAPTION_FONTS[font].label}
                          </span>
                        ) : (
                          <span className="flex min-w-0 items-baseline gap-2">
                            <span className={cn("text-[14px] font-medium", selected ? "text-heading" : "text-body")}>
                              Template
                            </span>
                            {autoFont && (
                              <span className="truncate text-[13px] leading-[1.4] text-subtle" style={faceOf(autoFont)}>
                                {CAPTION_FONTS[autoFont].label}
                              </span>
                            )}
                          </span>
                        )}
                        {note && (
                          // Squeezed before the name is: it gives way four times as fast.
                          <span className="ml-auto min-w-0 shrink-[4] truncate rounded-full bg-(--app-fill) px-2 py-0.5 text-[10.5px] font-medium text-subtle">
                            {note}
                          </span>
                        )}
                        <Check
                          aria-hidden
                          className={cn("h-4 w-4 shrink-0 text-primary", !note && "ml-auto", !selected && "invisible")}
                        />
                      </div>
                      {id === "auto" && <div aria-hidden className="mx-2 my-1 h-px bg-hairline" />}
                    </Fragment>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </>
  );
}
