// A tiny global signal so any client component that just spent (or was
// granted) credits can tell the header's balance display to refresh
// immediately, instead of waiting for its next poll tick. A plain DOM
// CustomEvent is enough here -- no context/provider needed since listeners
// just subscribe with window.addEventListener(CREDITS_CHANGED_EVENT, ...).
export const CREDITS_CHANGED_EVENT = "credits:changed";

export function notifyCreditsChanged(): void {
  window.dispatchEvent(new Event(CREDITS_CHANGED_EVENT));
}
