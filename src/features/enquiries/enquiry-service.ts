import { ActionError } from "@/server/actions/normalise-error";
import type { SendEnquiryInput } from "./schemas";

/**
 * The write side of an enquiry (S5-T03), apart from the code that reaches the database so the rules can
 * be tested with a stand-in. The real store is in `service.ts`.
 */

/** One enquiry as the database function takes it. */
export interface EnquiryRow {
  shortId: string;
  /** The sender: the signed-in account, never a value from the form. */
  userId: string;
  name: string;
  phone: string;
  email: string | null;
  message: string | null;
}

export interface EnquiryWriteStore {
  /** Stores the enquiry and returns its id. Throws an `ActionError` when the database refuses it. */
  insertEnquiry(row: EnquiryRow): Promise<string>;
}

/** What the database says when a call fails: the error code and the message the function raised. */
export interface DatabaseFailure {
  code?: string | undefined;
  message?: string | undefined;
}

/**
 * Turns what `submit_enquiry` raises into the closed set of action errors. A home nobody can see (never
 * listed, in review, sold, withdrawn) is "not found"; a second enquiry about the same home within 24
 * hours is a conflict, which the card shows as "already sent"; the owner's own home is forbidden;
 * a value the table refuses is a validation problem. Anything else is our bug, so it is internal.
 */
export function mapEnquiryWriteError(failure: DatabaseFailure): ActionError {
  if (failure.code === "P0002") {
    return new ActionError("NOT_FOUND", "The home is not open for enquiries");
  }
  if (failure.code === "23505" && failure.message === "enquiry.duplicate") {
    return new ActionError("CONFLICT", "An enquiry about this home was sent in the last 24 hours");
  }
  if (failure.code === "42501" && failure.message === "enquiry.own_listing") {
    return new ActionError("FORBIDDEN", "An owner cannot enquire about their own home");
  }
  if (failure.code === "23514") {
    return new ActionError("VALIDATION", "The database refused a value", {
      fieldErrors: { _form: [{ key: "validation.invalid" }] },
    });
  }
  return new ActionError("INTERNAL", "The enquiry write failed");
}

/** Stores an enquiry for the signed-in visitor. The sender comes from the session, never from the form. */
export async function submitEnquiry(
  store: EnquiryWriteStore,
  parameters: { input: SendEnquiryInput; userId: string },
): Promise<{ enquiryId: string }> {
  const { input } = parameters;
  const enquiryId = await store.insertEnquiry({
    shortId: input.shortId,
    userId: parameters.userId,
    name: input.name,
    phone: input.phone,
    email: input.email ?? null,
    message: input.message ?? null,
  });
  return { enquiryId };
}
