/**
 * SubmissionsFilters: the boxes above the form submissions: the dates, the form, the project, the source and the CRM state.
 * Purpose: narrow the admin's submissions list (S7-T07, FR-ADM-06) and clear the choice with one button. Owner:
 *   design system. It holds no state: the page keeps the choices (and puts them in the address) and passes the
 *   options already translated.
 * Props: values ({ range, form, project, source, crm }, the chosen value of each; "" is the "all" choice of a
 *   box that has one), options ({ ranges, forms, projects, sources, crms }, each { value, label }[]), words ({ range,
 *   form, project, source, crm, allForms, allProjects, allSources, reset }), onChange (box, value), onReset,
 *   className. The date box has no "all" choice of its own: "all time" is one of its options.
 * Responsive: it asks its own width: one box to a line on a phone, two from 768 px of room, and all five and Reset on
 *   one line from 1024 px.
 * Accessibility: every box has its label; Reset is a real button; the choices are a native list, so the phone's own
 *   picker opens.
 * States: nothing chosen, some chosen; many options.
 * Dependencies: FormField, NativeSelect, Button. Tests: submissions-parts.test.tsx; Design Lab "Admin" (S7-T07).
 * UX reference: admin-leads screen, "Form submissions" (filter-card).
 */
import { FormField } from "@/components/patterns/form-field";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { cn } from "@/lib/cn";

type SubmissionsFilterBox = "range" | "form" | "project" | "source" | "crm";

type SubmissionsFilterOption = { value: string; label: string };

type SubmissionsFiltersProps = {
  values: Record<SubmissionsFilterBox, string>;
  options: Record<"ranges" | "forms" | "projects" | "sources" | "crms", SubmissionsFilterOption[]>;
  words: {
    range: string;
    form: string;
    project: string;
    source: string;
    crm: string;
    allForms: string;
    allProjects: string;
    allSources: string;
    reset: string;
  };
  onChange: (box: SubmissionsFilterBox, value: string) => void;
  onReset: () => void;
  className?: string;
};

function SubmissionsFilters({
  values,
  options,
  words,
  onChange,
  onReset,
  className,
}: SubmissionsFiltersProps) {
  const box = (
    name: SubmissionsFilterBox,
    label: string,
    choices: SubmissionsFilterOption[],
    all?: string,
  ) => (
    <FormField label={label}>
      <NativeSelect value={values[name]} onChange={(event) => onChange(name, event.target.value)}>
        {all === undefined ? null : <option value="">{all}</option>}
        {choices.map((choice) => (
          <option key={choice.value} value={choice.value}>
            {choice.label}
          </option>
        ))}
      </NativeSelect>
    </FormField>
  );
  return (
    <div data-slot="submissions-filters" className={cn("@container min-w-0", className)}>
      <div className="grid gap-4 rounded-lg border border-line bg-surface p-4 @3xl:grid-cols-2 @5xl:grid-cols-[repeat(5,minmax(0,1fr))_auto] @5xl:items-end">
        {box("range", words.range, options.ranges)}
        {box("form", words.form, options.forms, words.allForms)}
        {box("project", words.project, options.projects, words.allProjects)}
        {box("source", words.source, options.sources, words.allSources)}
        {box("crm", words.crm, options.crms)}
        <Button type="button" variant="secondary" onClick={onReset}>
          {words.reset}
        </Button>
      </div>
    </div>
  );
}

export { SubmissionsFilters };
export type { SubmissionsFilterBox, SubmissionsFilterOption, SubmissionsFiltersProps };
