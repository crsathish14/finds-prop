/**
 * FormSettingsFields: the Settings box of the form editor.
 * Purpose: what the admin sets about a form as a whole (S7-T08, FR-ADM-08): its name, slug, kind, where it is shown
 *   (placement), the project when it is for one project, the CRM integration, the button text, whether it is
 *   active, and the message shown after it is sent. Owner: design system. It holds no state: the page keeps the
 *   values and the errors and passes the words, already translated.
 * Props: values ({ name, slug, kind, placement, projectId, crmIntegrationId, buttonText, successMessage, active }, all
 *   text but active), errors (the message of each box with a problem, by box), onChange (box, value), kinds,
 *   placements, projects and integrations ({ value, label }[]; the CRM and project lists get a first "none" choice
 *   from the words), disabled (while saving), words (the labels, the choices "Not linked" and "Not needed for this
 *   placement", and "Active"), className.
 * Responsive: one column on a phone; two from 768 px; the success message has the full width.
 * Accessibility: every box has a visible label tied to it; required boxes are marked; an error shows an icon and
 *   words; the Project box is off (not hidden) unless the placement is "one project", and says why; Active is a
 *   switch inside its label, so the whole line is the target.
 * States: empty, filled, with errors (a slug already used), a placement that needs a project, saving (all off).
 * Dependencies: FormField, Input, NativeSelect, Switch, Label, cn. Tests: form-parts.test.tsx; Design Lab "Admin"
 *   (S7-T08).
 * UX reference: admin-forms screen, editor, Settings (form-grid two, field, select, switch).
 */
import { FormField } from "@/components/patterns/form-field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/cn";

type FormSettingsField =
  | "name"
  | "slug"
  | "kind"
  | "placement"
  | "projectId"
  | "crmIntegrationId"
  | "buttonText"
  | "successMessage"
  | "active";

type FormSettingsValues = {
  name: string;
  slug: string;
  kind: string;
  placement: string;
  projectId: string;
  crmIntegrationId: string;
  buttonText: string;
  successMessage: string;
  active: boolean;
};

type Choice = { value: string; label: string };

type FormSettingsWords = {
  name: string;
  slug: string;
  kind: string;
  placement: string;
  project: string;
  /** Shown in the Project box while the placement does not use a project. */
  projectNotNeeded: string;
  /** The first choice of the Project box when one is needed and none is picked yet. */
  projectChoose: string;
  crm: string;
  crmNone: string;
  buttonText: string;
  status: string;
  active: string;
  successMessage: string;
};

type FormSettingsFieldsProps = {
  values: FormSettingsValues;
  errors?: Partial<Record<FormSettingsField, string>>;
  onChange: (field: FormSettingsField, value: string | boolean) => void;
  kinds: Choice[];
  placements: Choice[];
  projects: Choice[];
  integrations: Choice[];
  disabled?: boolean;
  words: FormSettingsWords;
  className?: string;
};

function FormSettingsFields({
  values,
  errors = {},
  onChange,
  kinds,
  placements,
  projects,
  integrations,
  disabled = false,
  words,
  className,
}: FormSettingsFieldsProps) {
  const text = (field: Exclude<FormSettingsField, "active">) => ({
    value: values[field],
    disabled,
    onChange: (event: { target: { value: string } }) => onChange(field, event.target.value),
  });
  const needsProject = values.placement === "project_specific";
  return (
    <div data-slot="form-settings-fields" className={cn("grid gap-5 md:grid-cols-2", className)}>
      <FormField label={words.name} required {...(errors.name ? { error: errors.name } : {})}>
        <Input {...text("name")} maxLength={120} autoComplete="off" />
      </FormField>
      <FormField label={words.slug} required {...(errors.slug ? { error: errors.slug } : {})}>
        <Input {...text("slug")} maxLength={80} autoComplete="off" spellCheck={false} />
      </FormField>
      <FormField label={words.kind} {...(errors.kind ? { error: errors.kind } : {})}>
        <NativeSelect {...text("kind")}>
          {kinds.map((choice) => (
            <option key={choice.value} value={choice.value}>
              {choice.label}
            </option>
          ))}
        </NativeSelect>
      </FormField>
      <FormField label={words.placement} {...(errors.placement ? { error: errors.placement } : {})}>
        <NativeSelect {...text("placement")}>
          {placements.map((choice) => (
            <option key={choice.value} value={choice.value}>
              {choice.label}
            </option>
          ))}
        </NativeSelect>
      </FormField>
      <FormField
        label={words.project}
        required={needsProject}
        {...(errors.projectId ? { error: errors.projectId } : {})}
      >
        <NativeSelect {...text("projectId")} disabled={disabled || !needsProject}>
          {needsProject ? (
            <option value="">{words.projectChoose}</option>
          ) : (
            <option value="">{words.projectNotNeeded}</option>
          )}
          {needsProject
            ? projects.map((choice) => (
                <option key={choice.value} value={choice.value}>
                  {choice.label}
                </option>
              ))
            : null}
        </NativeSelect>
      </FormField>
      <FormField
        label={words.crm}
        {...(errors.crmIntegrationId ? { error: errors.crmIntegrationId } : {})}
      >
        <NativeSelect {...text("crmIntegrationId")}>
          <option value="">{words.crmNone}</option>
          {integrations.map((choice) => (
            <option key={choice.value} value={choice.value}>
              {choice.label}
            </option>
          ))}
        </NativeSelect>
      </FormField>
      <FormField
        label={words.buttonText}
        {...(errors.buttonText ? { error: errors.buttonText } : {})}
      >
        <Input {...text("buttonText")} maxLength={40} autoComplete="off" />
      </FormField>
      <div className="flex flex-col gap-2">
        <span className="text-small font-semibold text-ink">{words.status}</span>
        <label className="flex min-h-13 items-center gap-3 text-ink">
          <Switch
            checked={values.active}
            onCheckedChange={(checked) => onChange("active", checked)}
            disabled={disabled}
          />
          {words.active}
        </label>
      </div>
      <FormField
        className="md:col-span-2"
        label={words.successMessage}
        {...(errors.successMessage ? { error: errors.successMessage } : {})}
      >
        <Input {...text("successMessage")} maxLength={300} autoComplete="off" />
      </FormField>
    </div>
  );
}

export { FormSettingsFields };
export type { FormSettingsField, FormSettingsFieldsProps, FormSettingsValues, FormSettingsWords };
