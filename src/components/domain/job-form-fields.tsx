/**
 * JobFormFields: the boxes of the admin's job page.
 * Purpose: what the admin types to add or change one job (ADR-143 section 5, FR-ADM-15), in four sections: Basics
 *   (title, address, department, place, work mode, type, experience), About the job (summary, description,
 *   responsibilities, requirements), How to apply (a link or an email address, and an optional pay note) and Closing
 *   (the last moment to apply). Owner: design system. It holds no state: the page keeps the values and the errors.
 *   Put it above the shared save bar inside the page's form; the Open and Close posting buttons are the page's.
 * Props: values (see JobFormValues), errors (the message of each box with a problem, by the value's name), onChange
 *   (the new values), departments ({ value, label }[], only the job departments), limits ({ title, location,
 *   experience, summary, description, responsibilities, requirements, salaryNote }: the most characters), open (the job
 *   is on the site: a note warns that a new address changes its link), disabled (while saving), className.
 * Responsive: the sections are cards stacked one above the other; the place and the work mode share a line from
 *   768 px.
 * Accessibility: every box has a visible label tied to it; hints, counters and errors are read with the box (a counter
 *   is a polite live region); an error also shows an icon; the work mode and the way to apply are labelled groups where
 *   the arrow keys move and the chosen option is announced.
 * States: new (empty), filled, open (address note), with errors on the boxes, texts near and over their limit, saving
 *   (all disabled), no department yet (the box says to add one first), apply by link and by email.
 * Dependencies: FormSection, FormField, Input, Textarea, Select, SegmentedControl, next-intl, cn. Tests:
 *   job-parts.test.tsx; Design Lab "Careers" (ADR-143).
 * UX reference: none yet; drawn for the owner's approval. It follows the admin project form (sections, save bar).
 */
import { useTranslations } from "next-intl";
import { FormField } from "@/components/patterns/form-field";
import { FormSection } from "@/components/patterns/form-section";
import { Input } from "@/components/ui/input";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/cn";
import type { EmploymentType, WorkMode } from "./job-card";

type JobFormValues = {
  title: string;
  slug: string;
  departmentId: string;
  location: string;
  workMode: WorkMode;
  employmentType: EmploymentType;
  experience: string;
  summary: string;
  description: string;
  responsibilities: string;
  requirements: string;
  salaryNote: string;
  applyKind: "link" | "email";
  applyUrl: string;
  applyEmail: string;
  /** A date and time as the browser's box writes it ("2026-12-31T18:00"), or empty for no closing date. */
  closesAt: string;
};

type JobFormErrors = Partial<Record<keyof JobFormValues, string>>;

type JobFormLimits = {
  title: number;
  location: number;
  experience: number;
  summary: number;
  description: number;
  responsibilities: number;
  requirements: number;
  salaryNote: number;
};

type JobFormFieldsProps = {
  values: JobFormValues;
  errors?: JobFormErrors;
  onChange: (values: JobFormValues) => void;
  departments: { value: string; label: string }[];
  limits: JobFormLimits;
  open?: boolean;
  disabled?: boolean;
  className?: string;
};

const WORK_MODES: WorkMode[] = ["onsite", "hybrid", "remote"];
const EMPLOYMENT_TYPES: EmploymentType[] = ["full_time", "part_time", "contract", "internship"];

function JobFormFields({
  values,
  errors = {},
  onChange,
  departments,
  limits,
  open = false,
  disabled = false,
  className,
}: JobFormFieldsProps) {
  const translate = useTranslations();
  const problem = (message: string | undefined) => (message ? { error: message } : {});
  const set = (patch: Partial<JobFormValues>) => onChange({ ...values, ...patch });
  const counter = (text: string, max: number) =>
    translate("admin.careers.form.counter", { count: text.length, max });

  return (
    <div data-slot="job-form-fields" className={cn("flex flex-col gap-6", className)}>
      <FormSection
        id="job-basics"
        title={translate("admin.careers.form.basics.title")}
        description={translate("admin.careers.form.basics.description")}
      >
        <FormField label={translate("admin.careers.form.titleLabel")} {...problem(errors.title)}>
          <Input
            value={values.title}
            disabled={disabled}
            maxLength={limits.title}
            autoComplete="off"
            onChange={(event) => set({ title: event.target.value })}
          />
        </FormField>
        <FormField
          label={translate("admin.careers.form.slug")}
          hint={
            open
              ? translate("admin.careers.form.slugOpenHint")
              : translate("admin.careers.form.slugHint")
          }
          {...problem(errors.slug)}
        >
          <Input
            value={values.slug}
            disabled={disabled}
            autoComplete="off"
            spellCheck={false}
            onChange={(event) => set({ slug: event.target.value })}
          />
        </FormField>
        {departments.length === 0 ? (
          <p className="text-small text-muted">{translate("admin.careers.form.noDepartment")}</p>
        ) : (
          <FormField
            label={translate("admin.careers.form.department")}
            {...problem(errors.departmentId)}
          >
            <Select
              value={values.departmentId}
              disabled={disabled}
              onChange={(event) => set({ departmentId: event.target.value })}
            >
              <option value="">{translate("admin.careers.form.departmentPlaceholder")}</option>
              {departments.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </FormField>
        )}
        <div className="grid gap-4 md:grid-cols-2">
          <FormField label={translate("admin.careers.form.location")} {...problem(errors.location)}>
            <Input
              value={values.location}
              disabled={disabled}
              maxLength={limits.location}
              autoComplete="off"
              onChange={(event) => set({ location: event.target.value })}
            />
          </FormField>
          <FormField
            label={translate("admin.careers.form.experience")}
            hint={translate("admin.careers.form.experienceHint")}
            {...problem(errors.experience)}
          >
            <Input
              value={values.experience}
              disabled={disabled}
              maxLength={limits.experience}
              autoComplete="off"
              onChange={(event) => set({ experience: event.target.value })}
            />
          </FormField>
        </div>
        <div className="flex flex-col gap-2">
          <p className="text-small font-semibold text-ink">
            {translate("admin.careers.form.workMode")}
          </p>
          <SegmentedControl
            aria-label={translate("admin.careers.form.workMode")}
            value={values.workMode}
            onValueChange={(next) => {
              const mode = WORK_MODES.find((candidate) => candidate === next);
              if (!disabled && mode) set({ workMode: mode });
            }}
            options={WORK_MODES.map((mode) => ({
              value: mode,
              label: translate(`careers.workMode.${mode}`),
            }))}
          />
        </div>
        <FormField
          label={translate("admin.careers.form.employmentType")}
          {...problem(errors.employmentType)}
        >
          <Select
            value={values.employmentType}
            disabled={disabled}
            onChange={(event) => {
              const type = EMPLOYMENT_TYPES.find((candidate) => candidate === event.target.value);
              if (type) set({ employmentType: type });
            }}
          >
            {EMPLOYMENT_TYPES.map((type) => (
              <option key={type} value={type}>
                {translate(`careers.employmentType.${type}`)}
              </option>
            ))}
          </Select>
        </FormField>
      </FormSection>

      <FormSection
        id="job-about"
        title={translate("admin.careers.form.about.title")}
        description={translate("admin.careers.form.about.description")}
      >
        <FormField
          label={translate("admin.careers.form.summary")}
          hint={translate("admin.careers.form.summaryHint")}
          {...problem(errors.summary)}
        >
          <Textarea
            value={values.summary}
            disabled={disabled}
            rows={3}
            autoGrow
            counter={counter(values.summary, limits.summary)}
            onChange={(event) => set({ summary: event.target.value })}
          />
        </FormField>
        <FormField
          label={translate("admin.careers.form.descriptionLabel")}
          hint={translate("admin.careers.form.descriptionHint")}
          {...problem(errors.description)}
        >
          <Textarea
            value={values.description}
            disabled={disabled}
            rows={8}
            autoGrow
            counter={counter(values.description, limits.description)}
            onChange={(event) => set({ description: event.target.value })}
          />
        </FormField>
        <FormField
          label={translate("admin.careers.form.responsibilities")}
          hint={translate("admin.careers.form.pointsHint")}
          {...problem(errors.responsibilities)}
        >
          <Textarea
            value={values.responsibilities}
            disabled={disabled}
            rows={5}
            autoGrow
            counter={counter(values.responsibilities, limits.responsibilities)}
            onChange={(event) => set({ responsibilities: event.target.value })}
          />
        </FormField>
        <FormField
          label={translate("admin.careers.form.requirements")}
          hint={translate("admin.careers.form.pointsHint")}
          {...problem(errors.requirements)}
        >
          <Textarea
            value={values.requirements}
            disabled={disabled}
            rows={5}
            autoGrow
            counter={counter(values.requirements, limits.requirements)}
            onChange={(event) => set({ requirements: event.target.value })}
          />
        </FormField>
      </FormSection>

      <FormSection
        id="job-apply"
        title={translate("admin.careers.form.apply.title")}
        description={translate("admin.careers.form.apply.description")}
      >
        <div className="flex flex-col gap-2">
          <p className="text-small font-semibold text-ink">
            {translate("admin.careers.form.applyKind")}
          </p>
          <SegmentedControl
            aria-label={translate("admin.careers.form.applyKind")}
            value={values.applyKind}
            onValueChange={(next) => {
              if (!disabled && (next === "link" || next === "email")) set({ applyKind: next });
            }}
            options={[
              { value: "link", label: translate("admin.careers.form.applyLink") },
              { value: "email", label: translate("admin.careers.form.applyEmail") },
            ]}
          />
        </div>
        {values.applyKind === "link" ? (
          <FormField
            label={translate("admin.careers.form.applyUrl")}
            hint={translate("admin.careers.form.applyUrlHint")}
            {...problem(errors.applyUrl)}
          >
            <Input
              type="url"
              value={values.applyUrl}
              disabled={disabled}
              autoComplete="off"
              spellCheck={false}
              onChange={(event) => set({ applyUrl: event.target.value })}
            />
          </FormField>
        ) : (
          <FormField
            label={translate("admin.careers.form.applyAddress")}
            hint={translate("admin.careers.form.applyAddressHint")}
            {...problem(errors.applyEmail)}
          >
            <Input
              type="email"
              value={values.applyEmail}
              disabled={disabled}
              autoComplete="off"
              spellCheck={false}
              onChange={(event) => set({ applyEmail: event.target.value })}
            />
          </FormField>
        )}
        <FormField
          label={translate("admin.careers.form.salaryNote")}
          hint={translate("admin.careers.form.salaryNoteHint")}
          {...problem(errors.salaryNote)}
        >
          <Input
            value={values.salaryNote}
            disabled={disabled}
            maxLength={limits.salaryNote}
            autoComplete="off"
            onChange={(event) => set({ salaryNote: event.target.value })}
          />
        </FormField>
      </FormSection>

      <FormSection
        id="job-closing"
        title={translate("admin.careers.form.closing.title")}
        description={translate("admin.careers.form.closing.description")}
      >
        <FormField
          label={translate("admin.careers.form.closesAt")}
          hint={translate("admin.careers.form.closesAtHint")}
          {...problem(errors.closesAt)}
        >
          <Input
            type="datetime-local"
            value={values.closesAt}
            disabled={disabled}
            onChange={(event) => set({ closesAt: event.target.value })}
          />
        </FormField>
      </FormSection>
    </div>
  );
}

export { JobFormFields };
export type { JobFormErrors, JobFormFieldsProps, JobFormLimits, JobFormValues };
