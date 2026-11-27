import "server-only";
import type { PagedSearchName, SearchMemory, SearchPage } from "../tools/types";
import { EMPTY_CHAT_STATE, type ChatState } from "./chat-state";

/**
 * The requirements state of one message, from the state the browser sent back to the state the answer hands on
 * (ADR-206). The search tools read it through `ToolContext.search` and record each page they give; the endpoint adds
 * the offers it made, then signs what `next()` returns.
 *
 * Two searches are the same search when they are the same tool with the same filters, compared without case, spaces
 * or the order of a list. Only then does a next page carry on where the last one stopped. A changed filter starts a
 * new ranking, and the homes the customer already saw are marked as seen, not left out.
 */

/** A filter value as it is compared: text without case or outer spaces, lists in order, empty text and lists as none. */
function comparable(value: unknown): unknown {
  if (typeof value === "string") {
    const text = value.trim().toLowerCase();
    return text === "" ? null : text;
  }
  if (Array.isArray(value)) {
    const items = value.map(comparable).filter((item) => item !== null);
    return items.length === 0 ? null : items.map((item) => JSON.stringify(item)).sort();
  }
  return value ?? null;
}

/** Whether two sets of filters ask for the same search. */
export function sameFilters(
  first: Readonly<Record<string, unknown>>,
  second: Readonly<Record<string, unknown>>,
): boolean {
  const keys = new Set([...Object.keys(first), ...Object.keys(second)]);
  for (const key of keys) {
    if (JSON.stringify(comparable(first[key])) !== JSON.stringify(comparable(second[key]))) {
      return false;
    }
  }
  return true;
}

/**
 * The key a home or project is remembered by in `seen` and `offered`. A project listed by the home search already
 * carries its kind (`project:<slug>`, ADR-215) and is kept as it is.
 */
export function recordKey(tool: PagedSearchName, id: string): string {
  if (id.startsWith("project:")) return id;
  return `${tool === "search_properties" ? "home" : "project"}:${id}`;
}

export interface TurnMemory extends SearchMemory {
  /** Remembers that an enquiry or a site visit was offered for these records (`home:ID`, `project:SLUG`). */
  offer(keys: readonly string[]): void;
  /** Whether an enquiry or a site visit was already offered for this record. */
  wasOffered(key: string): boolean;
  /** The search this message ended with: the last one a tool recorded, or the one the browser sent back. */
  current(): ChatState["search"];
  /** True when a tool recorded a page during this message. */
  searched(): boolean;
  /** The state to sign for the next message. */
  next(): ChatState;
}

export function createTurnMemory(start: ChatState | null): TurnMemory {
  const before = start ?? EMPTY_CHAT_STATE;
  let search = before.search;
  let recorded = false;
  const seen = [...before.seen];
  const offered = [...before.offered];
  return {
    shownBefore(tool, filters) {
      if (search === null || search.tool !== tool || !sameFilters(search.filters, filters)) {
        return [];
      }
      return search.shown;
    },
    seenBefore(tool, id) {
      return seen.includes(recordKey(tool, id));
    },
    record(page: SearchPage) {
      recorded = true;
      search = {
        tool: page.tool,
        filters: { ...page.filters },
        shown: [...page.shown],
        total: page.total,
        place: page.place,
      };
      for (const id of page.shown) {
        const key = recordKey(page.tool, id);
        if (!seen.includes(key)) seen.push(key);
      }
    },
    offer(keys) {
      for (const key of keys) if (!offered.includes(key)) offered.push(key);
    },
    wasOffered(key) {
      return offered.includes(key);
    },
    current: () => search,
    searched: () => recorded,
    next: () => ({ search, seen: [...seen], offered: [...offered] }),
  };
}
