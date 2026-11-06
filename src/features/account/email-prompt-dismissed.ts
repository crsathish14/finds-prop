/**
 * Whether this browser's visitor chose "Later" on the email prompt. It is a per-browser convenience
 * (the prompt can come back on another device), so it lives in localStorage and nothing else depends
 * on it. Storage can be missing or refuse to answer (a private window, blocked site data), so every
 * access is guarded and a copy in memory keeps the choice for the rest of the visit.
 */
const STORAGE_KEY = "findsprop:email-prompt-dismissed:v1";

const listeners = new Set<() => void>();
let dismissedInMemory = false;

export function readDismissed(): boolean {
  if (dismissedInMemory) return true;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeDismissed(): void {
  dismissedInMemory = true;
  try {
    window.localStorage.setItem(STORAGE_KEY, "1");
  } catch {
    // The choice still holds for this visit through the copy in memory.
  }
  for (const listener of listeners) listener();
}

export function subscribeDismissed(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

/** What the server and the first browser render assume: hidden, so a prompt never flashes and goes. */
export function serverDismissed(): boolean {
  return true;
}

/** Test helper: forget the visit's copy in memory. */
export function resetDismissedForTests(): void {
  dismissedInMemory = false;
}
