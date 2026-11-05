"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
  addEntry,
  COMPARE_KEY,
  hasEntry,
  isFull,
  parseSelection,
  removeEntry,
  serializeSelection,
  type CompareEntry,
} from "./store";

/**
 * The compare selection in the visitor's browser (S4-T02, ADR-044). One external store behind a hook:
 * every toggle, the bar and the comparison read the same list, in this tab and (through the `storage`
 * event) in every other. Where the browser will not keep it (private mode, storage blocked) the list
 * lives in memory for the visit, so comparing still works, it just is not remembered. On the server
 * and on the first browser render the list is empty, so the page and its first hydration agree.
 */

const NOTHING: CompareEntry[] = [];
const listeners = new Set<() => void>();

let memory: CompareEntry[] = NOTHING;
// Once a write is refused, the list is kept in memory for the rest of the visit.
let storageRefused = false;
let seenText: string | null | undefined;
let seenList: CompareEntry[] = NOTHING;

function emit() {
  for (const listener of listeners) listener();
}

function readList(): CompareEntry[] {
  if (storageRefused) return memory;
  let text: string | null;
  try {
    text = window.localStorage.getItem(COMPARE_KEY);
  } catch {
    storageRefused = true;
    return memory;
  }
  // The same text gives the same list, so React sees no change until something is written.
  if (text === seenText) return seenList;
  seenText = text;
  seenList = text === null ? NOTHING : parseSelection(text);
  return seenList;
}

function writeList(next: CompareEntry[]) {
  memory = next;
  if (!storageRefused) {
    try {
      window.localStorage.setItem(COMPARE_KEY, serializeSelection(next));
    } catch {
      storageRefused = true;
    }
  }
  emit();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === COMPARE_KEY) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** For tests: forget everything this module remembers about the browser. */
export function resetCompareStore(): void {
  memory = NOTHING;
  storageRefused = false;
  seenText = undefined;
  seenList = NOTHING;
  listeners.clear();
}

export type Compare = {
  list: readonly CompareEntry[];
  ids: string[];
  has: (id: string) => boolean;
  /** Three are chosen: no other home can be added. */
  full: boolean;
  add: (entry: CompareEntry) => void;
  remove: (id: string) => void;
  clear: () => void;
};

export function useCompare(): Compare {
  const list = useSyncExternalStore(subscribe, readList, () => NOTHING);
  const add = useCallback((entry: CompareEntry) => writeList(addEntry(readList(), entry)), []);
  const remove = useCallback((id: string) => writeList(removeEntry(readList(), id)), []);
  const clear = useCallback(() => writeList([]), []);
  return {
    list,
    ids: list.map((entry) => entry.id),
    has: (id) => hasEntry(list, id),
    full: isFull(list),
    add,
    remove,
    clear,
  };
}
