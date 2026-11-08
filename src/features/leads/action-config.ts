import { leadFilterSchema, setLeadStatusSchema, submissionFilterSchema } from "./schemas";
import type { LeadDone } from "./lead-service";

/**
 * How the admin's lead actions run, kept apart from the "use server" file so a test can build them (S7-T07). Only
 * a super admin may call them now (the builder portal, S7-T03, adds the builder, whose own leads the database
 * limits them to). A state change is limited with the admin's other edits (`admin_edit`, 600 an hour: working
 * through a morning of new leads is well inside it, a stuck script is not). No idempotency key: it sets a value, so a
 * repeat changes nothing more. Leads are never shown to the public, so no cache tags are refreshed. The database does
 * not audit leads, so the change adds its own entry to the audit log (`lead.status_changed`, entity `lead` and its
 * id, with the admin as the actor and no details of the lead).
 */
export const setLeadStatusConfig = {
  name: "setLeadStatus",
  input: setLeadStatusSchema,
  auth: { role: "super_admin" as const },
  rateLimit: { scope: "admin_edit" as const },
  audit: {
    action: "lead.status_changed",
    entity: (done: LeadDone) => ({ type: "lead", id: done.leadId }),
  },
};

/**
 * "Show more" on the two lists (S7-T07): reads, so they change nothing and have no cache tags, audit entry or
 * idempotency key. Only a super admin may call them. They have no rate limit of their own: each call reads one page
 * of 25 for a person who is already signed in as an admin.
 */
export const loadMoreLeadsConfig = {
  name: "loadMoreLeads",
  input: leadFilterSchema,
  auth: { role: "super_admin" as const },
};

export const loadMoreSubmissionsConfig = {
  name: "loadMoreSubmissions",
  input: submissionFilterSchema,
  auth: { role: "super_admin" as const },
};
