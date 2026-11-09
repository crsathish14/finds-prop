/**
 * FormPreview: a read-only picture of a form as visitors will see it, beside the form editor.
 * Purpose: the "Live preview" of the admin's form builder (S7-T08, FR-ADM-08): the fields in their order with their
 *   placeholders and required marks, and the form's button, drawn by the same DynamicForm the pages use, so what the
 *   admin sees is what a visitor gets. Owner: design system. Nothing in it can be used: it is inert (no focus, no
 *   typing, no sending).
 * Props: label (the card's heading, such as "Live preview (read only)"), note (a line under the picture, optional),
 *   fields (as DynamicForm takes them), buttonText (the form's own button words; the default when left out), empty
 *   (the words shown while the form has no fields), className.
 * Responsive: it fills the width it is given; one column at every width (compact), as it sits in a narrow card.
 * Accessibility: the card is a labelled region; its content is inert and hidden from screen readers, because it is
 *   a picture of a form and not a form to fill in (the editor beside it is the real one).
 * States: with fields, with a choice field and a long text, without fields (the note instead).
 * Dependencies: DynamicForm, Text, cn. Tests: form-parts.test.tsx; Design Lab "Admin" (S7-T08).
 * UX reference: admin-forms screen, editor, the preview card (preview-card, pv-label).
 */
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";
import { DynamicForm } from "./dynamic-form";

type FormPreviewProps = {
  label: string;
  note?: string;
  fields: ComponentProps<typeof DynamicForm>["fields"];
  buttonText?: string | null | undefined;
  empty: string;
  className?: string;
};

function FormPreview({ label, note, fields, buttonText, empty, className }: FormPreviewProps) {
  return (
    <aside
      aria-label={label}
      data-slot="form-preview"
      className={cn(
        "flex min-w-0 flex-col gap-3 rounded-xl border border-line bg-surface p-4 md:p-6",
        className,
      )}
    >
      <p className="text-overline font-bold text-muted uppercase">{label}</p>
      {fields.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line-strong p-4 text-center text-small text-muted">
          {empty}
        </p>
      ) : (
        <div inert aria-hidden="true">
          <DynamicForm fields={fields} buttonText={buttonText} compact />
        </div>
      )}
      {note ? <p className="text-small text-muted">{note}</p> : null}
    </aside>
  );
}

export { FormPreview };
export type { FormPreviewProps };
