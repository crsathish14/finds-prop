/**
 * MailTemplateFields: the boxes for the wording of one mail: a subject, a body and the list of words the wording may use.
 * Purpose: what the super admin types to change one of the enquiry mails (ADR-183): the mail to the poster of a home or
 *   project and the mail to the enquirer. Owner: design system. It holds no state: the page keeps the values and the
 *   errors and passes the words, already translated. Plain text only; the words in curly brackets are placeholders that
 *   are filled in when the mail is written, and the list says which ones this mail may use and which it must use.
 * Props: id (the anchor of the section), values ({ subject, body }), errors ({ subject?, body? }), onChange (the new
 *   values), limits ({ subject, body }: the most each may hold), placeholders ({ name, description, required }[]; the
 *   name without brackets), status (one line: what is live now, or that a draft is waiting), disabled (while saving),
 *   words, preview (a node under the boxes, usually a MailTemplatePreview), actions (a node under everything, usually
 *   the save bar), className.
 * Responsive: one column at every width; the placeholder rows wrap.
 * Accessibility: each box has a visible label tied to it, its hint and its problem; a problem shows an icon and words,
 *   not colour alone; the placeholder list is a real list and each name is read as written, in curly brackets.
 * States: filled, empty, with problems, at the limits (the counters say so), disabled while saving, with a draft waiting.
 * Dependencies: FormSection, FormField, Input, Textarea. Tests: mail-template-fields.test.tsx; Design Lab "Site
 *   content" (ADR-183).
 * UX reference: none: the mail editor has no approved screen (ADR-183); it follows the Site content boxes. Every word is
 *   unapproved.
 */
import type { ReactNode } from "react";
import { FormField } from "@/components/patterns/form-field";
import { FormSection } from "@/components/patterns/form-section";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type MailTemplateBoxes = { subject: string; body: string };

type MailTemplateErrors = { subject?: string; body?: string };

type MailTemplatePlaceholderRow = {
  /** The word without its brackets: `enquirerName`. */
  name: string;
  description: string;
  required: boolean;
};

type MailTemplateWords = {
  title: string;
  description: string;
  subject: { label: string; hint: string };
  body: { label: string; hint: string };
  /** "12 of 120": what has been typed and the most allowed. */
  counter: (used: number, max: number) => string;
  placeholders: { title: string; required: string };
};

type MailTemplateFieldsProps = {
  id: string;
  values: MailTemplateBoxes;
  errors?: MailTemplateErrors;
  onChange: (values: MailTemplateBoxes) => void;
  limits: { subject: number; body: number };
  placeholders: readonly MailTemplatePlaceholderRow[];
  status?: string;
  disabled?: boolean;
  words: MailTemplateWords;
  preview?: ReactNode;
  actions?: ReactNode;
  className?: string;
};

function MailTemplateFields({
  id,
  values,
  errors = {},
  onChange,
  limits,
  placeholders,
  status,
  disabled = false,
  words,
  preview,
  actions,
  className,
}: MailTemplateFieldsProps) {
  return (
    <FormSection id={id} title={words.title} description={words.description} className={className}>
      {status ? <p className="text-small font-semibold text-ink">{status}</p> : null}
      <FormField
        label={words.subject.label}
        hint={`${words.subject.hint} ${words.counter(values.subject.length, limits.subject)}`}
        {...(errors.subject ? { error: errors.subject } : {})}
      >
        <Input
          value={values.subject}
          disabled={disabled}
          autoComplete="off"
          onChange={(event) => onChange({ ...values, subject: event.target.value })}
        />
      </FormField>
      <FormField
        label={words.body.label}
        hint={`${words.body.hint} ${words.counter(values.body.length, limits.body)}`}
        {...(errors.body ? { error: errors.body } : {})}
      >
        <Textarea
          value={values.body}
          disabled={disabled}
          rows={10}
          onChange={(event) => onChange({ ...values, body: event.target.value })}
        />
      </FormField>
      <div className="flex min-w-0 flex-col gap-2">
        <p className="text-small font-bold text-ink">{words.placeholders.title}</p>
        <ul className="flex flex-col gap-2">
          {placeholders.map((placeholder) => (
            <li
              key={placeholder.name}
              className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1 text-small"
            >
              <code className="rounded-sm bg-canvas-sunken px-2 py-1 text-caption text-ink">{`{${placeholder.name}}`}</code>
              <span className="min-w-0 text-muted">
                {placeholder.description}
                {placeholder.required ? ` ${words.placeholders.required}` : ""}
              </span>
            </li>
          ))}
        </ul>
      </div>
      {preview}
      {actions}
    </FormSection>
  );
}

export { MailTemplateFields };
export type {
  MailTemplateBoxes,
  MailTemplateErrors,
  MailTemplateFieldsProps,
  MailTemplatePlaceholderRow,
  MailTemplateWords,
};
