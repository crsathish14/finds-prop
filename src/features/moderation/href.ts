import { DEFAULT_TAB } from "./constants";
import type { QueueFilters } from "./schemas";

/** Where the admin's listing queue lives. */
export const QUEUE_PATH = "/admin/listings";

/**
 * The address of the queue for some filters. What is the default (the pending tab, no locality, no kind) is left
 * out of the address (R-FE-11), and the page cursor is never in it: "Show more" adds rows to the page in place.
 */
export function queueHref(filters: Pick<QueueFilters, "tab" | "locality" | "kind">): string {
  const query = new URLSearchParams();
  if (filters.tab !== DEFAULT_TAB) query.set("tab", filters.tab);
  if (filters.locality) query.set("locality", filters.locality);
  if (filters.kind) query.set("kind", filters.kind);
  const text = query.toString();
  return text ? `${QUEUE_PATH}?${text}` : QUEUE_PATH;
}
