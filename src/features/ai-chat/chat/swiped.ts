import { useCallback, useSyncExternalStore } from "react";

/**
 * Whether this browser's visitor has already swiped to the cards pane of the AI chat (ADR-220, owner decision A7). It
 * is a per-browser convenience: until the first swipe the chat tells the visitor to swipe and nudges the screen, and
 * after it the hint turns into a plain "See the 6 homes". It lives in `localStorage` and nothing else depends on it.
 * Storage can be missing or refuse to answer (a private window, blocked site data); then the flag cannot be kept
 * between visits (the hint shows again, no error), and a copy in memory keeps it for the rest of this visit.
 */
export const SWIPED_KEY = "findsprop.ai-cards-swiped";

const listeners = new Set<() => void>();
let swipedInMemory = false;

export function readSwiped(): boolean {
  if (swipedInMemory) return true;
  try {
    return window.localStorage.getItem(SWIPED_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeSwiped(): void {
  swipedInMemory = true;
  try {
    window.localStorage.setItem(SWIPED_KEY, "1");
  } catch {
    // Not kept for the next visit; the copy in memory still holds for this one.
  }
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

/** True once the visitor has swiped to the cards; false while the page is built (so the server and the first render agree). */
export function useSwiped(): { swiped: boolean; markSwiped: () => void } {
  const swiped = useSyncExternalStore(subscribe, readSwiped, () => false);
  const markSwiped = useCallback(() => writeSwiped(), []);
  return { swiped, markSwiped };
}

/** Test helper: forget this visit's copy in memory. */
export function resetSwipedForTests(): void {
  swipedInMemory = false;
}
