import {
  submitProjectLeadSchema,
  trackProjectEventSchema,
  type SubmitProjectLeadInput,
} from "./lead-schemas";

/**
 * How the two project actions run, kept apart from the "use server" file so a test can build the same
 * actions with fake dependencies.
 *
 * Sending a lead needs a signed-in visitor with a verified phone (owner decision, 6 Nov 2026): anyone
 * may read the list and the pages, but only a phone sign-in may ask a developer to get in touch. It is
 * limited to 5 per visitor per hour with a friendly "please wait" (BR-72), and a one-time key stops a
 * double click or a retry from storing two (R-BE-05).
 */
export const submitProjectLeadConfig = {
  name: "submitProjectLead",
  input: submitProjectLeadSchema,
  auth: "verified-phone" as const,
  rateLimit: { scope: "project_lead" as const },
  idempotencyKey: (input: SubmitProjectLeadInput) => input.idempotencyKey,
};

/**
 * Recording that a project page was opened. Anonymous visitors count too (FR-SYS-03: events are
 * recorded without accounts), limited to 30 events per visitor per minute (BR-71); one view per
 * visitor per project per hour is kept by the database function.
 */
export const trackProjectEventConfig = {
  name: "trackProjectEvent",
  input: trackProjectEventSchema,
  auth: "none" as const,
  rateLimit: { scope: "project_event" as const },
};
