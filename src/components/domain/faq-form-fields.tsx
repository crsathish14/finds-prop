/**
 * FaqFormFields: the boxes of the admin's FAQ question page.
 * Purpose: what the admin types to add or change one question (ADR-143, FR-ADM-13): the category, the question, the
 *   answer and whether it is a draft or published. Owner: design system. It holds no state: the page keeps the values
 *   and the errors and passes the words, already translated. Put it above the shared save bar inside the page's form.
 * Props: values ({ categoryId, question, answer, status ("draft" | "published") }), errors (the message of each box
 *   with a problem: categoryId, question, answer), onChange (the new values), categories ({ value, label }[], only
 *   the categories of the FAQ list), limits ({ question, answer }: the most characters), disabled (while saving),
 *   words (the section titles and lines, the labels, hints, the counter text and the status words), className.
 * Responsive: two cards stacked one above the other; the status choice is a short row that fills a phone's width.
 * Accessibility: every box has a visible label tied to it; hints, counters and errors are read with the box (the
 *   counter is a polite live region); an error also shows an icon; the status choice is a labelled group where the
 *   arrow keys move and the chosen option is announced.
 * States: new (empty, a draft), filled, published, with errors on the boxes, the answer near and over its limit,
 *   saving (all disabled), no category yet (the box says to add one first).
 * Dependencies: FormSection, FormField, Input, Textarea, Select, SegmentedControl, cn. Tests: faq-parts.test.tsx;
 *   Design Lab "Site content" (ADR-143).
 * UX reference: none approved yet; drawn in the Design Lab for the owner to approve (ADR-143). It follows the admin
 *   project form (sections, save bar).
 */
import { FormField } from "@/components/patterns/form-field";
import { FormSection } from "@/components/patterns/form-section";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/cn";

type FaqFormValues = {
  categoryId: string;
  question: string;
  answer: string;
  status: "draft" | "published";
};

type FaqFormErrors = { categoryId?: string; question?: string; answer?: string };

type FaqFormWords = {
  content: { title: string; description: string };
  publishing: { title: string; description: string };
  category: string;
  categoryPlaceholder: string;
  /** Shown instead of the box when the FAQ list has no category yet. */
  noCategory: string;
  question: string;
  questionHint: string;
  answer: string;
  answerHint: string;
  /** "{count} / {max}": the counter under the answer, already filled in. */
  answerCounter: (count: number, max: number) => string;
  status: string;
  statusDraft: string;
  statusPublished: string;
  statusHint: string;
};

type FaqFormFieldsProps = {
  values: FaqFormValues;
  errors?: FaqFormErrors;
  onChange: (values: FaqFormValues) => void;
  categories: { value: string; label: string }[];
  limits: { question: number; answer: number };
  disabled?: boolean;
  words: FaqFormWords;
  className?: string;
};

function FaqFormFields({
  values,
  errors = {},
  onChange,
  categories,
  limits,
  disabled = false,
  words,
  className,
}: FaqFormFieldsProps) {
  const problem = (message: string | undefined) => (message ? { error: message } : {});
  const set = (patch: Partial<FaqFormValues>) => onChange({ ...values, ...patch });
  return (
    <div data-slot="faq-form-fields" className={cn("flex flex-col gap-6", className)}>
      <FormSection
        id="faq-content"
        title={words.content.title}
        description={words.content.description}
      >
        {categories.length === 0 ? (
          <p className="text-small text-muted">{words.noCategory}</p>
        ) : (
          <FormField label={words.category} {...problem(errors.categoryId)}>
            <Select
              value={values.categoryId}
              disabled={disabled}
              onChange={(event) => set({ categoryId: event.target.value })}
            >
              <option value="">{words.categoryPlaceholder}</option>
              {categories.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </FormField>
        )}
        <FormField label={words.question} hint={words.questionHint} {...problem(errors.question)}>
          <Input
            value={values.question}
            disabled={disabled}
            maxLength={limits.question}
            autoComplete="off"
            onChange={(event) => set({ question: event.target.value })}
          />
        </FormField>
        <FormField label={words.answer} hint={words.answerHint} {...problem(errors.answer)}>
          <Textarea
            value={values.answer}
            disabled={disabled}
            rows={8}
            autoGrow
            counter={words.answerCounter(values.answer.length, limits.answer)}
            onChange={(event) => set({ answer: event.target.value })}
          />
        </FormField>
      </FormSection>
      <FormSection
        id="faq-publishing"
        title={words.publishing.title}
        description={words.publishing.description}
      >
        <div className="flex flex-col gap-2">
          <p className="text-small font-semibold text-ink">{words.status}</p>
          <SegmentedControl
            aria-label={words.status}
            value={values.status}
            onValueChange={(next) => {
              if (!disabled && (next === "draft" || next === "published")) set({ status: next });
            }}
            options={[
              { value: "draft", label: words.statusDraft },
              { value: "published", label: words.statusPublished },
            ]}
          />
          <p className="text-small text-muted">{words.statusHint}</p>
        </div>
      </FormSection>
    </div>
  );
}

export { FaqFormFields };
export type { FaqFormErrors, FaqFormFieldsProps, FaqFormValues, FaqFormWords };
