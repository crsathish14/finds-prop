import type { EnquiryStatus } from "./view";

/** The two moves an owner can make on an enquiry. */
export type EnquiryMove = "contacted" | "closed";

/**
 * The buttons an enquiry offers, by its state (S6-T03, FR-ACC-04): a New one can be marked Contacted or
 * Closed, a Contacted one can be Closed, a Closed one has none. The database refuses any other move
 * (`guard_enquiries`); this only decides which buttons are drawn.
 */
export function movesFrom(status: EnquiryStatus): EnquiryMove[] {
  if (status === "new") return ["contacted", "closed"];
  if (status === "contacted") return ["closed"];
  return [];
}
