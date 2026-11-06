import { formFieldsSchema, type FormDefinition } from "./schemas";

/**
 * The contact page's form as it first goes live (S5-T05, ADR-055). It is written the way the form builder
 * stores a form, so the page draws it with the same renderer as any admin-built form. The same fields are
 * inserted into `forms` by the migration `default_contact_form` (the database function only accepts a stored
 * form); a test keeps the two identical. The admin form builder (Stage 7) can edit the stored copy.
 * The words are the content team's own, like the labels of any stored form.
 */
export const CONTACT_FORM_SLUG = "contact";

export const CONTACT_FORM: FormDefinition = {
  slug: CONTACT_FORM_SLUG,
  name: "Contact us",
  kind: "contact",
  placement: "contact",
  projectId: null,
  buttonText: "Send message",
  successMessage: null,
  // Read through the same schema as a stored form, so this list is exactly what the server would read.
  fields: formFieldsSchema.parse([
    { label: "Your name", key: "name", type: "text", required: true },
    { label: "Mobile", key: "mobile", type: "text", required: true },
    {
      label: "Email",
      key: "email",
      type: "email",
      placeholder: "you@example.com",
      required: false,
    },
    {
      label: "I'm interested in",
      key: "interest",
      type: "dropdown",
      options: [
        "A home to buy",
        "A home to rent",
        "A new project",
        "Listing my property",
        "Something else",
      ],
      required: false,
    },
    {
      label: "Message",
      key: "message",
      type: "textarea",
      placeholder: "How can we help?",
      max: 1000,
      required: false,
    },
  ]),
};
