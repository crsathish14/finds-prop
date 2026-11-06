import { notify } from "@/lib/notify";
import { readSavedHomes, saveHomeAction, unsaveHomeAction } from "./actions";

/**
 * The visitor's saved homes in the browser, shared by every heart on the page. One read asks the server
 * who is signed in and which homes they saved; after that a tap changes the set at once and the server
 * is asked to match, and a failure puts the set back. A signed-out tap remembers the home for this tab
 * and sends the visitor to sign in; when they come back signed in, the home is saved once (BR-06:
 * the return address is checked by sign-in, and nothing here is trusted from the address).
 */
export type SavedSnapshot = {
  ready: boolean;
  signedIn: boolean;
  saved: ReadonlySet<string>;
};

/** What a tap did: saved, removed, sent to sign in, or failed (and put back). */
export type ToggleOutcome = "saved" | "removed" | "signed-out" | "failed";

const PENDING_KEY = "findsprop:pending-save:v1";

const EMPTY: SavedSnapshot = { ready: false, signedIn: false, saved: new Set() };
let snapshot: SavedSnapshot = EMPTY;
const listeners = new Set<() => void>();
let loading: Promise<boolean> | null = null;

function emit(next: SavedSnapshot) {
  snapshot = next;
  for (const listener of listeners) listener();
}

export function getSavedSnapshot(): SavedSnapshot {
  return snapshot;
}

export function subscribeSaved(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The browser may refuse storage (a private window, blocked site data); the tap still works without it. */
function readPending(): string | null {
  try {
    return window.sessionStorage.getItem(PENDING_KEY);
  } catch {
    return null;
  }
}

function writePending(shortId: string | null) {
  try {
    if (shortId === null) window.sessionStorage.removeItem(PENDING_KEY);
    else window.sessionStorage.setItem(PENDING_KEY, shortId);
  } catch {
    // Without storage a visitor who signs in must tap Save again; nothing else breaks.
  }
}

function setOne(shortId: string, saved: boolean) {
  const next = new Set(snapshot.saved);
  if (saved) next.add(shortId);
  else next.delete(shortId);
  emit({ ...snapshot, saved: next });
}

/** Changes one home at once, then asks the server; a refusal puts the set back. */
async function change(shortId: string, saved: boolean): Promise<boolean> {
  setOne(shortId, saved);
  const result = saved ? await saveHomeAction({ shortId }) : await unsaveHomeAction({ shortId });
  if (result.ok) return true;
  setOne(shortId, !saved);
  return false;
}

/**
 * Reads the visitor's saved homes once; later calls wait for the same read. `savedMessage` is the
 * words for the confirmation of a home saved on the way back from sign-in. A failed read is not
 * kept, so the next tap reads again.
 */
export function ensureSavedLoaded(savedMessage: string): Promise<boolean> {
  if (snapshot.ready) return Promise.resolve(true);
  loading ??= (async () => {
    const result = await readSavedHomes({});
    if (!result.ok) {
      loading = null;
      return false;
    }
    emit({
      ready: true,
      signedIn: result.data.signedIn,
      saved: new Set(result.data.shortIds),
    });
    const pending = readPending();
    if (pending !== null && result.data.signedIn) {
      writePending(null);
      if (!snapshot.saved.has(pending) && (await change(pending, true))) {
        notify.success(savedMessage);
      }
    }
    return true;
  })();
  return loading;
}

/**
 * A tap on a heart or the save button. `signInHref` is where a signed-out visitor goes; `go` moves
 * the browser there (passed in so the test can check it without leaving the page).
 */
export async function toggleSaved(
  shortId: string,
  signInHref: string,
  go: (href: string) => void = (href) => window.location.assign(href),
): Promise<ToggleOutcome> {
  if (!(await ensureSavedLoaded(""))) return "failed";
  if (!snapshot.signedIn) {
    writePending(shortId);
    go(signInHref);
    return "signed-out";
  }
  const saved = !snapshot.saved.has(shortId);
  return (await change(shortId, saved)) ? (saved ? "saved" : "removed") : "failed";
}

/** Test helper: forget everything, as a new page load would. */
export function resetSavedForTests() {
  snapshot = EMPTY;
  loading = null;
  listeners.clear();
  writePending(null);
}
