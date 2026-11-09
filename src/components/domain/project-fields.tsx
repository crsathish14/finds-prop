/**
 * ProjectFields: the sections of the project form: Basics, Location, RERA, Details, (Media) and SEO.
 * Purpose: what the admin and a builder type to describe a project (S7-T02, FR-ADM-04, FR-BLD-02). Owner: design
 *   system. It holds no state: the page keeps the values and the errors and passes the words, already translated.
 *   Numbers are typed as text (the server reads "78,00,000" too), and "" means not set.
 * Props: values (every box: text boxes as text, bhkOptions as numbers, advantages, nearby and amenities as lists,
 *   reraApplicable as true or false), errors (the message of each box with a problem, by box), onChange (box, value),
 *   options ({ builders?, projectTypes, propertyTypes, statuses }, each { value, label }[]; give builders only for the
 *   admin: that is what shows the Builder box), amenitySuggestions (phrases offered under Amenities), slugLocked
 *   (a builder cannot change the page address of an approved project), media (what goes in the Media section;
 *   leave it out and the section is not shown), disabled (while saving), words (the headings, labels, hints and
 *   the tag list's words), className.
 * Responsive: one column on phones, two from 768 px; the sections are cards stacked one above the other.
 * Accessibility: every box has a visible label tied to it; hints and errors are read with the box; an error also shows
 *   an icon; the BHK choices are a named group of checkboxes; the RERA switch has a visible label and turns the
 *   RERA number box on and off.
 * States: empty, filled, with errors, saving (all disabled), builder mode (no Builder box), page address locked.
 * Dependencies: FormSection, FormField, TagListField, Input, Textarea, NativeSelect, Checkbox, Switch, Label, cn.
 *   Tests: project-form-parts.test.tsx; Design Lab "Admin" (S7-T02).
 * UX reference: admin-project-form screen (Basics, Location, RERA, Details, Media, SEO), builder-project-form screen.
 */
import type { ReactNode } from "react";
import { FormField } from "@/components/patterns/form-field";
import { FormSection } from "@/components/patterns/form-section";
import { TagListField, type TagListWords } from "@/components/patterns/tag-list-field";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/cn";

type ProjectFieldValues = {
  name: string;
  builderId: string;
  projectType: string;
  propertyType: string;
  projectStatus: string;
  priceMin: string;
  priceMax: string;
  bhkOptions: number[];
  landAreaAcres: string;
  totalUnits: string;
  /** yyyy-mm-dd, or "" */
  possessionDate: string;
  contactPhone: string;
  locality: string;
  address: string;
  latitude: string;
  longitude: string;
  advantages: string[];
  nearby: string[];
  reraApplicable: boolean;
  reraNumber: string;
  description: string;
  specifications: string;
  amenities: string[];
  seoTitle: string;
  slug: string;
  seoDescription: string;
};

type ProjectFieldName = keyof ProjectFieldValues;

/** The boxes that hold text. */
type ProjectTextField = {
  [Name in ProjectFieldName]: ProjectFieldValues[Name] extends string ? Name : never;
}[ProjectFieldName];

type ProjectFieldOption = { value: string; label: string };

type ProjectFieldsWords = {
  basics: { title: string; description: string };
  location: { title: string; description: string };
  rera: { title: string; description: string };
  details: { title: string; description: string };
  media: { title: string; description: string };
  seo: { title: string; description: string };
  name: string;
  builder: string;
  builderHint: string;
  /** The first, empty choice of a list that may stay unset. */
  unset: string;
  projectType: string;
  propertyType: string;
  projectStatus: string;
  priceMin: string;
  priceMax: string;
  bhk: string;
  landArea: string;
  totalUnits: string;
  possession: string;
  contactPhone: string;
  locality: string;
  address: string;
  latitude: string;
  longitude: string;
  advantages: string;
  nearby: string;
  reraApplicable: string;
  reraNumber: string;
  description: string;
  specifications: string;
  amenities: string;
  seoTitle: string;
  slug: string;
  /** Said before the slug in the hint: "Page address: /projects/". */
  slugHint: string;
  slugLockedHint: string;
  seoDescription: string;
  /** "(optional)". */
  optional: string;
  tags: TagListWords;
};

type ProjectFieldsProps = {
  values: ProjectFieldValues;
  errors?: Partial<Record<ProjectFieldName, string>>;
  onChange: <Name extends ProjectFieldName>(name: Name, value: ProjectFieldValues[Name]) => void;
  options: {
    builders?: ProjectFieldOption[];
    projectTypes: ProjectFieldOption[];
    propertyTypes: ProjectFieldOption[];
    statuses: ProjectFieldOption[];
  };
  amenitySuggestions?: readonly string[];
  slugLocked?: boolean;
  media?: ReactNode;
  disabled?: boolean;
  words: ProjectFieldsWords;
  className?: string;
};

/** The bedroom counts offered; a project that has another count keeps it and shows it too. */
const BHK_CHOICES = [1, 2, 3, 4, 5];

const LIMITS = {
  name: 140,
  locality: 80,
  address: 300,
  rera: 60,
  text: 5000,
  seoTitle: 120,
  seoDescription: 300,
  slug: 80,
  phone: 20,
  tags: { advantages: 20, nearby: 20, amenities: 30 },
};

function ProjectFields({
  values,
  errors = {},
  onChange,
  options,
  amenitySuggestions = [],
  slugLocked = false,
  media,
  disabled = false,
  words,
  className,
}: ProjectFieldsProps) {
  const problem = (name: ProjectFieldName) => {
    const message = errors[name];
    return message ? { error: message } : {};
  };
  const text = (name: ProjectTextField) => ({
    value: values[name],
    disabled,
    onChange: (event: { target: { value: string } }) => onChange(name, event.target.value),
  });
  const optional = { optionalLabel: words.optional };
  const choices = (list: ProjectFieldOption[]) => (
    <>
      <option value="">{words.unset}</option>
      {list.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </>
  );
  const bhkShown = [...new Set([...BHK_CHOICES, ...values.bhkOptions])].sort(
    (first, second) => first - second,
  );
  const toggleBhk = (count: number) =>
    onChange(
      "bhkOptions",
      values.bhkOptions.includes(count)
        ? values.bhkOptions.filter((one) => one !== count)
        : [...values.bhkOptions, count].sort((first, second) => first - second),
    );

  return (
    <div data-slot="project-fields" className={cn("flex flex-col gap-6", className)}>
      <FormSection id="basics" title={words.basics.title} description={words.basics.description}>
        <div className="grid gap-5 md:grid-cols-2">
          <FormField label={words.name} required className="md:col-span-2" {...problem("name")}>
            <Input {...text("name")} maxLength={LIMITS.name} autoComplete="off" />
          </FormField>
          {options.builders ? (
            <FormField
              label={words.builder}
              required
              hint={words.builderHint}
              className="md:col-span-2"
              {...problem("builderId")}
            >
              <NativeSelect {...text("builderId")}>
                <option value="">{words.unset}</option>
                {options.builders.map((builder) => (
                  <option key={builder.value} value={builder.value}>
                    {builder.label}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
          ) : null}
          <FormField label={words.projectType} {...optional} {...problem("projectType")}>
            <NativeSelect {...text("projectType")}>{choices(options.projectTypes)}</NativeSelect>
          </FormField>
          <FormField label={words.propertyType} {...optional} {...problem("propertyType")}>
            <NativeSelect {...text("propertyType")}>{choices(options.propertyTypes)}</NativeSelect>
          </FormField>
          <FormField label={words.projectStatus} {...optional} {...problem("projectStatus")}>
            <NativeSelect {...text("projectStatus")}>{choices(options.statuses)}</NativeSelect>
          </FormField>
          <span aria-hidden="true" className="hidden md:block" />
          <FormField label={words.priceMin} {...optional} {...problem("priceMin")}>
            <Input {...text("priceMin")} inputMode="numeric" autoComplete="off" />
          </FormField>
          <FormField label={words.priceMax} {...optional} {...problem("priceMax")}>
            <Input {...text("priceMax")} inputMode="numeric" autoComplete="off" />
          </FormField>
          <fieldset className="flex min-w-0 flex-col gap-2 md:col-span-2">
            <legend className="mb-2 text-small font-semibold text-ink">
              {words.bhk} <span className="font-normal text-muted">{words.optional}</span>
            </legend>
            <div className="flex flex-wrap gap-x-6 gap-y-3">
              {bhkShown.map((count) => (
                <Label key={count} className="flex items-center gap-2 font-medium">
                  <Checkbox
                    checked={values.bhkOptions.includes(count)}
                    disabled={disabled}
                    onCheckedChange={() => toggleBhk(count)}
                  />
                  {count}
                </Label>
              ))}
            </div>
            {errors.bhkOptions ? (
              <p className="text-caption font-semibold text-danger">{errors.bhkOptions}</p>
            ) : null}
          </fieldset>
          <FormField label={words.landArea} {...optional} {...problem("landAreaAcres")}>
            <Input {...text("landAreaAcres")} inputMode="decimal" autoComplete="off" />
          </FormField>
          <FormField label={words.totalUnits} {...optional} {...problem("totalUnits")}>
            <Input {...text("totalUnits")} inputMode="numeric" autoComplete="off" />
          </FormField>
          <FormField label={words.possession} {...optional} {...problem("possessionDate")}>
            <Input {...text("possessionDate")} type="date" autoComplete="off" />
          </FormField>
          <FormField label={words.contactPhone} {...optional} {...problem("contactPhone")}>
            <Input
              {...text("contactPhone")}
              type="tel"
              inputMode="tel"
              maxLength={LIMITS.phone}
              autoComplete="off"
            />
          </FormField>
        </div>
      </FormSection>

      <FormSection
        id="location"
        title={words.location.title}
        description={words.location.description}
      >
        <div className="grid gap-5 md:grid-cols-2">
          <FormField label={words.locality} required {...problem("locality")}>
            <Input {...text("locality")} maxLength={LIMITS.locality} autoComplete="off" />
          </FormField>
          <FormField label={words.address} {...optional} {...problem("address")}>
            <Input {...text("address")} maxLength={LIMITS.address} autoComplete="off" />
          </FormField>
          <FormField label={words.latitude} {...optional} {...problem("latitude")}>
            <Input {...text("latitude")} inputMode="decimal" autoComplete="off" />
          </FormField>
          <FormField label={words.longitude} {...optional} {...problem("longitude")}>
            <Input {...text("longitude")} inputMode="decimal" autoComplete="off" />
          </FormField>
          <TagListField
            label={words.advantages}
            tags={values.advantages}
            onChange={(tags) => onChange("advantages", tags)}
            max={LIMITS.tags.advantages}
            disabled={disabled}
            words={words.tags}
            className="md:col-span-2"
            {...problem("advantages")}
          />
          <TagListField
            label={words.nearby}
            tags={values.nearby}
            onChange={(tags) => onChange("nearby", tags)}
            max={LIMITS.tags.nearby}
            disabled={disabled}
            words={words.tags}
            className="md:col-span-2"
            {...problem("nearby")}
          />
        </div>
      </FormSection>

      <FormSection id="rera" title={words.rera.title} description={words.rera.description}>
        <div className="flex flex-col gap-5">
          <Label className="flex items-center gap-3 font-medium">
            <Switch
              checked={values.reraApplicable}
              disabled={disabled}
              onCheckedChange={(checked) => onChange("reraApplicable", checked)}
            />
            {words.reraApplicable}
          </Label>
          <FormField
            label={words.reraNumber}
            className="max-w-105"
            {...(values.reraApplicable ? {} : optional)}
            {...problem("reraNumber")}
          >
            <Input
              {...text("reraNumber")}
              disabled={disabled || !values.reraApplicable}
              maxLength={LIMITS.rera}
              autoComplete="off"
            />
          </FormField>
        </div>
      </FormSection>

      <FormSection id="details" title={words.details.title} description={words.details.description}>
        <div className="flex flex-col gap-5">
          <FormField label={words.description} {...optional} {...problem("description")}>
            <Textarea {...text("description")} maxLength={LIMITS.text} rows={6} />
          </FormField>
          <FormField label={words.specifications} {...optional} {...problem("specifications")}>
            <Textarea {...text("specifications")} maxLength={LIMITS.text} rows={4} />
          </FormField>
          <TagListField
            label={words.amenities}
            tags={values.amenities}
            onChange={(tags) => onChange("amenities", tags)}
            max={LIMITS.tags.amenities}
            suggestions={amenitySuggestions}
            disabled={disabled}
            words={words.tags}
            {...problem("amenities")}
          />
        </div>
      </FormSection>

      {media ? (
        <FormSection id="media" title={words.media.title} description={words.media.description}>
          {media}
        </FormSection>
      ) : null}

      <FormSection id="seo" title={words.seo.title} description={words.seo.description}>
        <div className="grid gap-5 md:grid-cols-2">
          <FormField
            label={words.seoTitle}
            className="md:col-span-2"
            {...optional}
            {...problem("seoTitle")}
          >
            <Input {...text("seoTitle")} maxLength={LIMITS.seoTitle} autoComplete="off" />
          </FormField>
          <FormField
            label={words.slug}
            required
            hint={slugLocked ? words.slugLockedHint : `${words.slugHint}${values.slug}`}
            className="md:col-span-2"
            {...problem("slug")}
          >
            <Input
              {...text("slug")}
              readOnly={slugLocked}
              disabled={disabled || slugLocked}
              maxLength={LIMITS.slug}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
            />
          </FormField>
          <FormField
            label={words.seoDescription}
            className="md:col-span-2"
            {...optional}
            {...problem("seoDescription")}
          >
            <Textarea {...text("seoDescription")} maxLength={LIMITS.seoDescription} rows={3} />
          </FormField>
        </div>
      </FormSection>
    </div>
  );
}

export { ProjectFields };
export type {
  ProjectFieldName,
  ProjectFieldOption,
  ProjectFieldsProps,
  ProjectFieldsWords,
  ProjectFieldValues,
  ProjectTextField,
};
