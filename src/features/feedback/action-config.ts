import { sendFeedbackSchema, setFeedbackReviewedSchema } from "./schemas";

/**
 * How the feedback actions run, kept apart from the "use server" file so a test can build them.
 * Sending: only a builder or an agent (the builder role). Limited by the `builder_feedback` scope (5 an hour per
 * person), so a script cannot fill the super admin's list. No idempotency key: the form stops a double click while it
 * sends. Nothing public changes, so no cache tags are refreshed. The database records the message in the audit log
 * (`feedback.created`, the id and the sender, never the text).
 * Marking reviewed: only the super admin, limited with the admin's other edits (`admin_edit`); it sets a value, so a
 * repeat changes nothing more. The database records the change (`feedback.reviewed` or `feedback.unreviewed`).
 */
export const sendFeedbackConfig = {
  name: "sendFeedback",
  input: sendFeedbackSchema,
  auth: { role: "builder" as const },
  rateLimit: { scope: "builder_feedback" as const },
};

export const setFeedbackReviewedConfig = {
  name: "setFeedbackReviewed",
  input: setFeedbackReviewedSchema,
  auth: { role: "super_admin" as const },
  rateLimit: { scope: "admin_edit" as const },
};
