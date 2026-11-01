import { ActionError } from "../actions/normalise-error";
import type { SessionView } from "./session";

/**
 * Guards for actions and handlers (plan 07 section 4.1). Each throws an ActionError that
 * defineAction turns into a closed error code; nothing here returns a sentence to the caller.
 * The `assert*` functions are pure so they can be tested without a database; the `require*`
 * wrappers in require.ts read the session.
 */

export function assertUser(session: SessionView | null): asserts session is SessionView {
  if (!session) throw new ActionError("UNAUTHENTICATED", "Please sign in to continue.");
}

/** Customer write paths need a phone that was confirmed by a code (plan 06 6.3). */
export function assertVerifiedPhone(session: SessionView | null): asserts session is SessionView {
  assertUser(session);
  if (!session.phoneVerified) {
    throw new ActionError("FORBIDDEN", "A verified phone number is required.", {
      reason: "PHONE_NOT_VERIFIED",
    });
  }
}

export function assertAdmin(session: SessionView | null): asserts session is SessionView {
  assertUser(session);
  if (!session.roles.includes("super_admin")) {
    throw new ActionError("FORBIDDEN", "You don't have permission to do that.");
  }
}

/** BR-34: the builder role AND an active builder record. Agents are builders with a type. */
export function assertBuilder(
  session: SessionView | null,
): asserts session is SessionView & { builderId: string } {
  assertUser(session);
  if (!session.roles.includes("builder") || session.builderId === null) {
    throw new ActionError("FORBIDDEN", "You don't have permission to do that.");
  }
}
