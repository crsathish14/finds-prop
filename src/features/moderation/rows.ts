import type { ListingStatus, QueueTab } from "./constants";
import type { Decision } from "./constants";

/**
 * Small pure rules the queue's screen shares with its tests (S6-T04). No framework, no text.
 */

/** Whether a listing in this state belongs on this tab. */
export function matchesTab(tab: QueueTab, status: ListingStatus): boolean {
  if (tab === "all") return true;
  if (tab === "closed") return status === "sold" || status === "rented";
  return status === tab;
}

/** What a decision leaves the listing as, for rows whose page is not re-read until the next refresh. */
export function afterDecision(
  decision: Decision,
  current: { status: ListingStatus; featured: boolean },
): { status: ListingStatus; featured: boolean } {
  if (decision === "approve") return { status: "approved", featured: current.featured };
  if (decision === "reject") return { status: "rejected", featured: false };
  return { status: current.status, featured: decision === "feature" };
}

/** The decisions that make sense for a listing in this state, in the order their buttons are drawn. */
export function decisionsFor(status: ListingStatus, featured: boolean): Decision[] {
  if (status === "pending") return ["approve", "reject"];
  if (status === "approved") return [featured ? "unfeature" : "feature"];
  return [];
}

/** The rows with the first of each id kept: a page read again while "Show more" rows are on screen repeats some. */
export function uniqueById<T extends { id: string }>(rows: readonly T[]): T[] {
  const seen = new Set<string>();
  return rows.filter((row) => {
    if (seen.has(row.id)) return false;
    seen.add(row.id);
    return true;
  });
}
