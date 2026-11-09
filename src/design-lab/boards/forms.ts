import type { LabEntry } from "../types";
import {
  FormFieldsEditorDemo,
  FormSettingsFieldsDemo,
  FormsManagerDemo,
} from "./admin-forms-demos";

/**
 * What the admin uses to build the forms shown on project pages and the contact page (S7-T08, FR-ADM-08): the list of
 * forms, the Settings box of the editor, and the Fields editor with its live preview. It has its own board because
 * the Admin board had grown too tall to photograph within the time limit at 820 and 1440 px (as the Site content and
 * Sponsors boards did). It mirrors the admin Forms screen.
 */
export const FORMS: LabEntry[] = [
  {
    id: "forms-manager",
    name: "Forms manager",
    description:
      "The Forms page of the admin: the heading and New form, and the list of forms (a table from 1024 px of room, cards below that) with the name and kind, the slug, how many fields, where the form is shown, the CRM it is linked to, an Active switch, and Edit, Duplicate and Delete on each row. Shown with four forms (one off), a form being copied with a very long name and slug, and nothing yet.",
    sources: ["domain/forms-manager.tsx"],
    Demo: FormsManagerDemo,
  },
  {
    id: "form-settings-fields",
    name: "Form settings fields",
    description:
      "The Settings box of the form editor: name, slug, kind, placement, the project (on only for one project), the CRM integration, the button text, the Active switch and the success message, in two columns from 768 px. Shown filled in, for one project, with errors (a project not chosen, a slug already used) and while saving.",
    sources: ["domain/form-settings-fields.tsx"],
    Demo: FormSettingsFieldsDemo,
  },
  {
    id: "form-fields-editor",
    name: "Form fields editor",
    description:
      "The Fields box of the form editor, with the live preview beside it: quick-add chips, a row for each field (label, kind, required) that opens to its label, key, kind, placeholder, choices, smallest and largest, and Required, reordered by dragging or with the arrow buttons, and Add field. The preview is read only and drawn by the same part visitors see. Shown with the second field open, a dropdown and a number open, errors on two fields, at the limit, empty, and while saving.",
    sources: ["domain/form-fields-editor.tsx", "domain/form-preview.tsx"],
    Demo: FormFieldsEditorDemo,
  },
];
