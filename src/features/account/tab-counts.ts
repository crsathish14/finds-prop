import type { TabCounts } from "./schemas";

/** What the four count reads gave. */
export interface RawTabCounts {
  saved: number;
  listings: number;
  /** All enquiries received, and the New ones among them. */
  received: { total: number; fresh: number };
  sent: number;
}

/**
 * The numbers on the dashboard's tabs (S6-T03): a tab with nothing to count shows no number; Enquiries received
 * shows the New ones as "N new" in the orange style when there are any, and the total otherwise. `newWord` says
 * "N new" in the visitor's language.
 */
export function tabCountsFrom(raw: RawTabCounts, newWord: (count: number) => string): TabCounts {
  const counts: TabCounts = {};
  if (raw.saved > 0) counts.saved = { value: raw.saved };
  if (raw.listings > 0) counts.listings = { value: raw.listings };
  if (raw.received.fresh > 0) {
    counts.received = { value: newWord(raw.received.fresh), tone: "new" };
  } else if (raw.received.total > 0) {
    counts.received = { value: raw.received.total };
  }
  if (raw.sent > 0) counts.sent = { value: raw.sent };
  return counts;
}
