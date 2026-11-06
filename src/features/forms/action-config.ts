import {
  submitFormSchema,
  submitProjectFormSchema,
  type SubmitFormInput,
  type SubmitProjectFormInput,
} from "./schemas";

/**
 * How the form action runs, kept apart from the "use server" file so a test can build it. Anyone may send
 * a form, signed in or not (the contact form is open to visitors; a project's own form adds its gate
 * on the page). It is limited to 5 submissions per visitor per form per hour with a friendly "please
 * wait" (BR-61, BR-70), and a one-time key stops a double click or a retry from storing two (R-BE-05).
 */
export const submitFormConfig = {
  name: "submitForm",
  input: submitFormSchema,
  auth: "none" as const,
  rateLimit: {
    scope: "form_submit" as const,
    key: (input: SubmitFormInput) => input.formSlug,
  },
  idempotencyKey: (input: SubmitFormInput) => input.idempotencyKey,
};

/**
 * How the project form action runs. Unlike the contact form, a project's form needs a signed-in visitor
 * with a verified phone (owner decision, 6 Nov 2026: the same gate as the built-in enquiry card), and the
 * phone stored is the account's own. It uses the same limit as every form, 5 per visitor per hour,
 * counted for the project's page (BR-61, BR-70), and a one-time key stops a double click or a retry from
 * storing two (R-BE-05).
 */
export const submitProjectFormConfig = {
  name: "submitProjectForm",
  input: submitProjectFormSchema,
  auth: "verified-phone" as const,
  rateLimit: {
    scope: "form_submit" as const,
    key: (input: SubmitProjectFormInput) => "project-" + input.projectSlug,
  },
  idempotencyKey: (input: SubmitProjectFormInput) => input.idempotencyKey,
};
