import { z } from "zod";
import { AI_SEARCH_PAGE_SIZE } from "@/config/ai";
import type { PagedSearchName, ToolContext } from "./types";

/**
 * Pages of a ranked search (ADR-206). A search ranks every match; each call gives one page of `AI_SEARCH_PAGE_SIZE`.
 * With `page: "next"` and the same filters as the chat's current search, the page starts after the ids that search
 * already gave, so no home or project repeats; with other filters (or no page) the ranking starts again, and a match
 * the customer saw earlier in the chat is marked `seenBefore`, never left out.
 */

/** The page input of the two search tools: required, null for a first page. */
export const pageInput = z
  .enum(["next"])
  .nullable()
  .describe('"next" for more of the same search, else null.');

/** A tool's input without its page: what decides whether two searches are the same. */
export function filtersOf(input: { readonly page: "next" | null }): Record<string, unknown> {
  const filters: Record<string, unknown> = { ...input };
  delete filters["page"];
  return filters;
}

export interface SearchPageCut<Item> {
  /** The items of this page, in the ranked order. */
  readonly items: readonly Item[];
  /** Every id the search has given so far, this page included. */
  readonly shown: readonly string[];
}

/** The next page of a ranked list for this search, and what the search has shown once it is given. */
export function cutPage<Item>(
  ranked: readonly Item[],
  idOf: (item: Item) => string,
  search: {
    readonly tool: PagedSearchName;
    readonly page: "next" | null;
    readonly filters: Readonly<Record<string, unknown>>;
  },
  context: ToolContext,
): SearchPageCut<Item> {
  const before =
    search.page === "next" ? (context.search?.shownBefore(search.tool, search.filters) ?? []) : [];
  const skip = new Set(before);
  const items = ranked.filter((item) => !skip.has(idOf(item))).slice(0, AI_SEARCH_PAGE_SIZE);
  return { items, shown: [...before, ...items.map(idOf)] };
}

/** Whether the customer saw this home or project earlier in the chat (before this page). */
export function seenBefore(tool: PagedSearchName, id: string, context: ToolContext): boolean {
  return context.search?.seenBefore(tool, id) ?? false;
}
