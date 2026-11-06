/**
 * A form's typed answers, kept in this tab while the visitor signs in again (S5-T07). Written only when the
 * visitor presses "Sign in again" (never as they type), read once when they come back to the same page, and
 * removed when it is read (the page asks again each time it draws, so what was read is remembered for the life
 * of the page and the same answers come back). It lives in `sessionStorage`: this tab only, gone when the tab closes, and never
 * sent anywhere. Nothing here is a secret, but it is the visitor's own words, so it is bounded and short
 * lived: 30 minutes, at most 20 answers, each answer cut to a fixed length. Storage that is blocked or full
 * means the answers are simply not kept; nothing else breaks.
 */

export type DraftValue = string | boolean | string[];
export type DraftValues = Record<string, DraftValue>;

const PREFIX = "findsprop:draft:";
export const DRAFT_MAX_AGE_MS = 30 * 60 * 1000;
export const DRAFT_MAX_ANSWERS = 20;
export const DRAFT_MAX_TEXT = 5000;
const MAX_CHOICES = 40;

/** A key for one form on one page: the form's name and the page's address without its query. */
function storageKey(form: string, path: string): string {
  return `${PREFIX}${form}:${path}`;
}

function clean(values: DraftValues): DraftValues {
  const kept: DraftValues = {};
  for (const [name, value] of Object.entries(values).slice(0, DRAFT_MAX_ANSWERS)) {
    if (typeof value === "string") kept[name] = value.slice(0, DRAFT_MAX_TEXT);
    else if (typeof value === "boolean") kept[name] = value;
    else if (Array.isArray(value)) {
      kept[name] = value
        .filter((item): item is string => typeof item === "string")
        .slice(0, MAX_CHOICES)
        .map((item) => item.slice(0, 200));
    }
  }
  return kept;
}

function isDraftValues(value: unknown): value is DraftValues {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  return Object.values(value).every(
    (item) =>
      typeof item === "string" ||
      typeof item === "boolean" ||
      (Array.isArray(item) && item.every((choice) => typeof choice === "string")),
  );
}

/** Keeps the answers for the next visit to this page. Silent when storage is not available. */
export function saveDraft(form: string, path: string, values: DraftValues, now = Date.now()) {
  looked.delete(storageKey(form, path));
  announced.delete(storageKey(form, path));
  try {
    window.sessionStorage.setItem(
      storageKey(form, path),
      JSON.stringify({ at: now, values: clean(values) }),
    );
  } catch {
    // Without storage the visitor types again; nothing else breaks.
  }
}

/** What was read for each form and page: the answers, or nothing. Asked again, the same answer comes back. */
const looked = new Map<string, DraftValues | null>();
/** Which kept answers have already been announced ("we kept what you typed"). */
const announced = new Set<string>();

/**
 * The answers kept for this page, removed from storage the first time they are read. Asked again (the page
 * asks each time it draws, and a second form on the same page, the card and the phone's sheet, asks too),
 * the very same object comes back. Anything older than 30 minutes or not shaped like a draft is dropped and
 * counts as nothing. Reading storage and removing from it is the only effect, and it happens once.
 */
export function takeDraft(form: string, path: string, now = Date.now()): DraftValues | null {
  const key = storageKey(form, path);
  if (looked.has(key)) return looked.get(key) ?? null;
  let result: DraftValues | null = null;
  try {
    const text = window.sessionStorage.getItem(key);
    if (text !== null) {
      window.sessionStorage.removeItem(key);
      const stored: unknown = JSON.parse(text);
      if (typeof stored === "object" && stored !== null) {
        const { at, values } = stored as { at?: unknown; values?: unknown };
        if (typeof at === "number" && now - at <= DRAFT_MAX_AGE_MS && isDraftValues(values)) {
          result = clean(values);
        }
      }
    }
  } catch {
    result = null;
  }
  looked.set(key, result);
  return result;
}

/** True once for each page's kept answers, so only one form says "we kept what you typed". */
export function announceDraftOnce(form: string, path: string): boolean {
  const key = storageKey(form, path);
  if (announced.has(key)) return false;
  announced.add(key);
  return true;
}

/** Forgets a kept draft once its form has been sent. */
export function dropDraft(form: string, path: string) {
  looked.set(storageKey(form, path), null);
  try {
    window.sessionStorage.removeItem(storageKey(form, path));
  } catch {
    // Nothing to remove.
  }
}

/** Test helper: forget what was read, as a new page load would. */
export function resetDraftsForTests() {
  looked.clear();
  announced.clear();
}
