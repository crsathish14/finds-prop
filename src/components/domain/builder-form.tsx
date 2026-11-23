/**
 * BuilderForm: the fields of the invite drawer and of the edit drawer of a builder or an agent.
 * Purpose: what the admin types to invite or change a builder (S7-T05, FR-ADM-04): the company, the login email,
 *   the type, a contact person and phone, a logo link, a website and a few words about them. Owner: design system.
 *   It holds no state: the page keeps the values and the errors and passes the words, already translated.
 * Props: mode ("invite" | "edit"; in edit the email is shown but cannot be changed), showKind (false leaves out the
 *   Type box: the builder's own profile, S7-T03), values ({ name, email, kind
 *   "builder" | "agent", contactPerson, phone, logoUrl, website, description }, all text), errors (the message of
 *   each field with a problem, by field), onChange (field, value), disabled (while sending), words (the labels,
 *   hints and options), showLogoUrl (false leaves out the logo link box: the builder's own profile uploads a logo
 *   instead, ADR-179), className. The Developer Spotlight boxes (tagline, year started, projects delivered) sit
 *   under their own heading at the end.
 * Responsive: one column on phones, two from 768 px for the contact fields.
 * Accessibility: every box has a visible label tied to it; the hint and the error are read with it; an error also
 *   shows an icon; the email in edit mode is read-only with a hint saying why.
 * States: empty, filled, with errors (such as an email that cannot be used), sending (all disabled), edit.
 * Dependencies: FormField, Input, Select, Textarea, cn. Tests: builder-parts.test.tsx; Design Lab "Admin"
 *   (S7-T05).
 * UX reference: admin-builders screen (new: the invite drawer, blocked: the reserved email).
 */
import { FormField } from "@/components/patterns/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/cn";

type BuilderFormField =
  | "name"
  | "email"
  | "kind"
  | "contactPerson"
  | "phone"
  | "logoUrl"
  | "website"
  | "description"
  | "tagline"
  | "establishedYear"
  | "projectsDelivered";

type BuilderFormValues = {
  name: string;
  email: string;
  kind: "builder" | "agent";
  contactPerson: string;
  phone: string;
  logoUrl: string;
  website: string;
  description: string;
  tagline: string;
  establishedYear: string;
  projectsDelivered: string;
};

type BuilderFormWords = {
  name: string;
  email: string;
  emailHint: string;
  /** Edit mode: why the email is not a box to change. */
  emailLockedHint: string;
  kind: string;
  kindBuilder: string;
  kindAgent: string;
  contactPerson: string;
  phone: string;
  logoUrl: string;
  website: string;
  description: string;
  /** The heading over the Developer Spotlight boxes and the line under it. */
  spotlight: string;
  spotlightHint: string;
  tagline: string;
  taglineHint: string;
  establishedYear: string;
  projectsDelivered: string;
  /** "(optional)". */
  optional: string;
};

type BuilderFormProps = {
  mode: "invite" | "edit";
  values: BuilderFormValues;
  errors?: Partial<Record<BuilderFormField, string>>;
  onChange: (field: BuilderFormField, value: string) => void;
  disabled?: boolean;
  /** Whether the Type box is shown; the builder's own profile leaves it out, as only the admin sets the type. */
  showKind?: boolean;
  /** Whether the logo link box is shown; the builder's own profile uploads a logo instead. */
  showLogoUrl?: boolean;
  words: BuilderFormWords;
  className?: string;
};

function BuilderForm({
  mode,
  values,
  errors = {},
  onChange,
  disabled = false,
  showKind = true,
  showLogoUrl = true,
  words,
  className,
}: BuilderFormProps) {
  const text = (field: BuilderFormField) => ({
    value: values[field],
    disabled,
    onChange: (event: { target: { value: string } }) => onChange(field, event.target.value),
  });
  return (
    <div data-slot="builder-form" className={cn("flex flex-col gap-5", className)}>
      <FormField label={words.name} required {...(errors.name ? { error: errors.name } : {})}>
        <Input {...text("name")} maxLength={120} autoComplete="organization" />
      </FormField>
      <FormField
        label={words.email}
        required
        hint={mode === "edit" ? words.emailLockedHint : words.emailHint}
        {...(errors.email ? { error: errors.email } : {})}
      >
        <Input
          {...text("email")}
          type="email"
          inputMode="email"
          maxLength={254}
          autoComplete="off"
          readOnly={mode === "edit"}
          disabled={disabled || mode === "edit"}
        />
      </FormField>
      {showKind ? (
        <FormField label={words.kind} {...(errors.kind ? { error: errors.kind } : {})}>
          <Select {...text("kind")}>
            <option value="builder">{words.kindBuilder}</option>
            <option value="agent">{words.kindAgent}</option>
          </Select>
        </FormField>
      ) : null}
      <div className="grid gap-5 md:grid-cols-2">
        <FormField
          label={words.contactPerson}
          optionalLabel={words.optional}
          {...(errors.contactPerson ? { error: errors.contactPerson } : {})}
        >
          <Input {...text("contactPerson")} maxLength={120} autoComplete="off" />
        </FormField>
        <FormField
          label={words.phone}
          optionalLabel={words.optional}
          {...(errors.phone ? { error: errors.phone } : {})}
        >
          <Input {...text("phone")} type="tel" inputMode="tel" autoComplete="off" />
        </FormField>
      </div>
      {showLogoUrl ? (
        <FormField
          label={words.logoUrl}
          optionalLabel={words.optional}
          {...(errors.logoUrl ? { error: errors.logoUrl } : {})}
        >
          <Input
            {...text("logoUrl")}
            type="url"
            inputMode="url"
            maxLength={500}
            autoComplete="off"
          />
        </FormField>
      ) : null}
      <FormField
        label={words.website}
        optionalLabel={words.optional}
        {...(errors.website ? { error: errors.website } : {})}
      >
        <Input {...text("website")} type="url" inputMode="url" maxLength={300} autoComplete="off" />
      </FormField>
      <FormField
        label={words.description}
        optionalLabel={words.optional}
        {...(errors.description ? { error: errors.description } : {})}
      >
        <Textarea {...text("description")} maxLength={2000} rows={4} />
      </FormField>
      <fieldset className="flex min-w-0 flex-col gap-5 border-t border-line pt-5">
        <legend className="float-left mb-1 flex w-full flex-col gap-1">
          <span className="font-bold text-ink">{words.spotlight}</span>
          <span className="text-small text-muted">{words.spotlightHint}</span>
        </legend>
        <FormField
          label={words.tagline}
          optionalLabel={words.optional}
          hint={words.taglineHint}
          {...(errors.tagline ? { error: errors.tagline } : {})}
        >
          <Input {...text("tagline")} maxLength={100} autoComplete="off" />
        </FormField>
        <div className="grid gap-5 md:grid-cols-2">
          <FormField
            label={words.establishedYear}
            optionalLabel={words.optional}
            {...(errors.establishedYear ? { error: errors.establishedYear } : {})}
          >
            <Input
              {...text("establishedYear")}
              inputMode="numeric"
              maxLength={4}
              autoComplete="off"
            />
          </FormField>
          <FormField
            label={words.projectsDelivered}
            optionalLabel={words.optional}
            {...(errors.projectsDelivered ? { error: errors.projectsDelivered } : {})}
          >
            <Input
              {...text("projectsDelivered")}
              inputMode="numeric"
              maxLength={6}
              autoComplete="off"
            />
          </FormField>
        </div>
      </fieldset>
    </div>
  );
}

export { BuilderForm };
export type { BuilderFormField, BuilderFormProps, BuilderFormValues, BuilderFormWords };
