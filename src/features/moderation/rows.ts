import { hasFeaturedDays, type FeaturedDays } from "@/lib/promotion-dates";
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

/** A listing's Featured as a row holds it: the switch and its first and last day (ADR-210). */
export interface FeaturedState extends FeaturedDays {
  featured: boolean;
}

/**
 * What a decision leaves the listing as, for rows whose page is not re-read until the next refresh. A feature takes
 * the switch the database answered (off when its start date is still ahead) and the days that were sent; removing
 * from featured clears the days too.
 */
export function afterDecision(
  decision: Decision,
  current: { status: ListingStatus } & FeaturedState,
  featured?: FeaturedState,
): { status: ListingStatus } & FeaturedState {
  const dates = { featuredFrom: current.featuredFrom, featuredUntil: current.featuredUntil };
  if (decision === "approve") return { status: "approved", featured: current.featured, ...dates };
  if (decision === "reject") return { status: "rejected", featured: false, ...dates };
  if (decision === "feature") {
    return {
      status: current.status,
      ...(featured ?? { featured: true, featuredFrom: null, featuredUntil: null }),
    };
  }
  return { status: current.status, featured: false, featuredFrom: null, featuredUntil: null };
}

/**
 * The decisions that make sense for a listing in this state, in the order their buttons are drawn. An approved
 * listing whose Featured has dates (scheduled, running or ended) offers both: Feature to change the dates, and
 * Remove from featured, which also clears them.
 */
export function decisionsFor(status: ListingStatus, state: FeaturedState): Decision[] {
  if (status === "pending") return ["approve", "reject"];
  if (status !== "approved") return [];
  if (hasFeaturedDays(state)) return ["feature", "unfeature"];
  return [state.featured ? "unfeature" : "feature"];
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
