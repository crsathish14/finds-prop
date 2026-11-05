import { isShortId } from "@/lib/short-id";

/**
 * The compare selection and its rules (S4-T02, ADR-044, FR-PUB-10). Pure: no browser, no framework,
 * so the rules are tested on their own. The selection is up to three homes, held in the visitor's
 * browser under one key; it works signed out and survives a reload. Each entry keeps what the bar
 * needs to draw it (the title and the cover picture) so the bar never has to fetch anything.
 */

export const COMPARE_KEY = "findsprop:compare:v1";
export const COMPARE_MAX = 3;
/** Comparing starts with two homes. */
export const COMPARE_MIN = 2;
export const COMPARE_PATH = "/compare";

export type CompareEntry = { id: string; title: string; cover: string | null };

const TITLE_MAX = 140;
const COVER_MAX = 500;

/** A cover address we are willing to draw: our own public storage or a rooted path, never anything else. */
function safeCover(value: unknown): string | null {
  if (typeof value !== "string" || value.length === 0 || value.length > COVER_MAX) return null;
  return /^(https?:\/\/|\/(?!\/))/.test(value) ? value : null;
}

/**
 * Reads what the browser kept. Anything that does not fit is dropped, never thrown on: text that is
 * not JSON, an entry with no valid public id, a repeat, and everything past the third. An entry may
 * be written as the bare id.
 */
export function parseSelection(text: string | null): CompareEntry[] {
  if (text === null) return [];
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return [];
  }
  if (!Array.isArray(data)) return [];
  const list: CompareEntry[] = [];
  for (const item of data) {
    if (list.length >= COMPARE_MAX) break;
    const raw: Record<string, unknown> =
      typeof item === "string"
        ? { id: item }
        : item !== null && typeof item === "object"
          ? item
          : {};
    const id = raw["id"];
    if (typeof id !== "string" || !isShortId(id) || list.some((entry) => entry.id === id)) continue;
    const title = raw["title"];
    list.push({
      id,
      title: typeof title === "string" ? title.slice(0, TITLE_MAX) : "",
      cover: safeCover(raw["cover"]),
    });
  }
  return list;
}

export function serializeSelection(list: readonly CompareEntry[]): string {
  return JSON.stringify(list.slice(0, COMPARE_MAX));
}

export function hasEntry(list: readonly CompareEntry[], id: string): boolean {
  return list.some((entry) => entry.id === id);
}

/** True when three homes are chosen: every other toggle is switched off. */
export function isFull(list: readonly CompareEntry[]): boolean {
  return list.length >= COMPARE_MAX;
}

/** Adds a home. Nothing changes when it is already there, when the list is full, or when its id is not one. */
export function addEntry(list: readonly CompareEntry[], entry: CompareEntry): CompareEntry[] {
  if (!isShortId(entry.id) || hasEntry(list, entry.id) || isFull(list)) return [...list];
  return [
    ...list,
    { id: entry.id, title: entry.title.slice(0, TITLE_MAX), cover: safeCover(entry.cover) },
  ];
}

export function removeEntry(list: readonly CompareEntry[], id: string): CompareEntry[] {
  return list.filter((entry) => entry.id !== id);
}

/** The address of the comparison for some homes: their ids, in order. */
export function compareHref(ids: readonly string[]): string {
  const valid = ids.filter(isShortId).slice(0, COMPARE_MAX);
  return valid.length === 0 ? COMPARE_PATH : `${COMPARE_PATH}?ids=${valid.join(",")}`;
}

/**
 * The homes an address asks for (`?ids=a,b,c`): each must be a public id, repeats count once, and
 * only the first three are kept. Anything else is dropped, never thrown on.
 */
export function parseIdsParam(value: string | readonly string[] | undefined): string[] {
  const first = typeof value === "string" ? value : value?.[0];
  if (typeof first !== "string") return [];
  const ids: string[] = [];
  for (const part of first.split(",")) {
    const id = part.trim();
    if (isShortId(id) && !ids.includes(id)) ids.push(id);
    if (ids.length >= COMPARE_MAX) break;
  }
  return ids;
}

/**
 * Where the bar is drawn: on the homepage and the results (with the phone's bottom bar under it), and
 * beside a home's page from 1024 px (a phone has the sticky price bar there). Nowhere else, and not on
 * the comparison itself, which is the comparison.
 */
export type CompareBarMode = "hidden" | "above-bottom-bar" | "wide-only";

export function compareBarMode(pathname: string): CompareBarMode {
  const path = pathname.split(/[?#]/, 1)[0]?.replace(/\/+$/, "") || "/";
  if (path === "/" || path === "/properties") return "above-bottom-bar";
  if (path.startsWith("/properties/")) return "wide-only";
  return "hidden";
}
