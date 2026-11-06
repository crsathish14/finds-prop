/**
 * Where the signed-in person's email stands (ADD-03):
 * - "verified": an address on the account was confirmed. Nothing is asked.
 * - "pending": a link was sent to an address that is not confirmed yet. The banner reminds them.
 * - "none": no address at all. The prompt card offers to add one.
 * - "unknown": the state could not be read. Nothing is shown rather than a wrong state.
 */
export type EmailState =
  | { kind: "none" }
  | { kind: "pending"; email: string }
  | { kind: "verified"; email: string }
  | { kind: "unknown" };

/** What Supabase Auth says about the account's address, reduced to the three facts that matter. */
export interface EmailFacts {
  /** The address on the account. */
  email: string | null | undefined;
  /** When that address was confirmed, if it was. */
  confirmedAt: string | null | undefined;
  /** An address a link was sent to and that is not confirmed yet. */
  pendingEmail: string | null | undefined;
}

function present(value: string | null | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Pure: puts the facts together. A confirmed address always wins, even when a change to another
 * address is waiting, because posting needs one verified address, not the newest one.
 */
export function emailStateFrom(facts: EmailFacts): EmailState {
  if (present(facts.email) && present(facts.confirmedAt)) {
    return { kind: "verified", email: facts.email };
  }
  if (present(facts.pendingEmail)) return { kind: "pending", email: facts.pendingEmail };
  // An address that sits on the account without a confirmation date is one a link was sent to.
  if (present(facts.email)) return { kind: "pending", email: facts.email };
  return { kind: "none" };
}
