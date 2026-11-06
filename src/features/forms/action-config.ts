import { submitFormSchema, type SubmitFormInput } from "./schemas";

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
