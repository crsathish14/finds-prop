import { ActionError } from "@/server/actions/normalise-error";
import type { SubmitProjectLeadInput } from "./lead-schemas";

/**
 * The write side of the project page (S4-T09 step D), apart from the code that reaches the database
 * so the rules can be tested with a stand-in. The real store is in `service.ts`.
 */

/** One lead as the database function takes it. `phone` is digits only, from the verified account. */
export interface LeadRow {
  slug: string;
  kind: "enquiry" | "site_visit";
  name: string;
  phone: string;
  email: string | null;
  message: string | null;
  visitDate: string | null;
  visitor: string;
}

export interface EventRow {
  slug: string;
  event: string;
  visitor: string;
}

export interface ProjectWriteStore {
  /** Stores the lead and returns its id. Throws an `ActionError` when the database refuses it. */
  insertLead(row: LeadRow): Promise<string>;
  /** True when the event was recorded, false when it was a repeat or the project is not visible. */
  recordEvent(row: EventRow): Promise<boolean>;
}

/** What the database says when a call fails: the error code and the message the function raised. */
export interface DatabaseFailure {
  code?: string | undefined;
  message?: string | undefined;
}

/**
 * Turns what `submit_project_lead` and `track_project_event` raise into the closed set of action
 * errors. A visit date the database refuses is the same problem the card shows for a bad date; a
 * project nobody can see is "not found" (it may have been withdrawn since the page was made). Anything
 * else, including a visitor hash the function does not accept, is our bug, so it is internal.
 */
export function mapProjectWriteError(failure: DatabaseFailure): ActionError {
  if (failure.code === "P0002") {
    return new ActionError("NOT_FOUND", "The project is not open for leads");
  }
  if (failure.code === "22023" && failure.message === "project_lead.visit_date") {
    return new ActionError("VALIDATION", "The visit date is outside the allowed days", {
      fieldErrors: { visitDate: [{ key: "validation.visitDateRange" }] },
    });
  }
  if (failure.code === "22023" && failure.message === "project_lead.kind") {
    return new ActionError("VALIDATION", "The kind of request is not accepted", {
      fieldErrors: { kind: [{ key: "validation.invalid" }] },
    });
  }
  if (failure.code === "23514") {
    return new ActionError("VALIDATION", "The database refused a value", {
      fieldErrors: { _form: [{ key: "validation.invalid" }] },
    });
  }
  return new ActionError("INTERNAL", "The project write failed");
}

/** Stores a lead for the signed-in visitor. The phone and the visitor come from the server, never from the form. */
export async function submitLead(
  store: ProjectWriteStore,
  parameters: { input: SubmitProjectLeadInput; phone: string; visitor: string },
): Promise<{ leadId: string }> {
  const { input } = parameters;
  const leadId = await store.insertLead({
    slug: input.slug,
    kind: input.kind,
    name: input.name,
    phone: parameters.phone,
    email: input.email ?? null,
    message: input.message ?? null,
    visitDate: input.kind === "site_visit" ? (input.visitDate ?? null) : null,
    visitor: parameters.visitor,
  });
  return { leadId };
}

/** Records one event. A repeat view and a project nobody can see are not errors: nothing is recorded. */
export async function recordProjectEvent(
  store: ProjectWriteStore,
  row: EventRow,
): Promise<{ recorded: boolean }> {
  return { recorded: await store.recordEvent(row) };
}
