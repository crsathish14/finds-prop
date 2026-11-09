/**
 * SiteHeaderFields: the boxes of the admin's Header page: the site name, the navigation links and the button.
 * Purpose: what the admin types to change the header of every public page (S7-T10, FR-ADM-10). Owner: design system.
 *   It holds no state: the page keeps the values and the errors and passes the words, already translated. An empty
 *   site name, an empty list or two empty button boxes mean "use the standard one" on the public site (BR-81).
 * Props: values ({ name, links, ctaLabel, ctaHref }; links are rows with an id the page keeps), errors (the message
 *   of each box with a problem: name, ctaLabel, ctaHref, and links by row id), onChange (the new values), linksMax,
 *   disabled (while saving), words (the headings, labels, hints and the link list's words), className.
 * Responsive: three cards stacked one above the other; the button's two boxes sit side by side from 768 px.
 * Accessibility: every box has a visible label tied to it (the link rows name theirs by place); hints and errors are
 *   read with the box; an error also shows an icon.
 * States: standard (empty), filled, with errors, saving (all disabled).
 * Dependencies: FormSection, FormField, LinkListField, Input, cn. Tests: site-content-parts.test.tsx; Design Lab
 *   "Admin" (S7-T10).
 * UX reference: admin-cms screen (#header: Brand, Navigation links, Call to action). The "Logo link" box is left
 *   out: the header uses the Find Prop mark and the box would have no effect (ADR-090).
 */
import { FormField } from "@/components/patterns/form-field";
import { FormSection } from "@/components/patterns/form-section";
import {
  LinkListField,
  type LinkListWords,
  type LinkRow,
  type LinkRowErrors,
} from "@/components/patterns/link-list-field";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/cn";

type SiteHeaderValues = {
  name: string;
  links: LinkRow[];
  ctaLabel: string;
  ctaHref: string;
};

type SiteHeaderErrors = {
  name?: string;
  ctaLabel?: string;
  ctaHref?: string;
  links?: Record<string, LinkRowErrors>;
};

type SiteHeaderFieldsWords = {
  brand: { title: string; description: string };
  links: { title: string; description: string };
  cta: { title: string; description: string };
  name: string;
  ctaLabel: string;
  ctaHref: string;
  /** "(optional)". */
  optional: string;
  linkList: LinkListWords;
};

type SiteHeaderFieldsProps = {
  values: SiteHeaderValues;
  errors?: SiteHeaderErrors;
  onChange: (values: SiteHeaderValues) => void;
  linksMax: number;
  disabled?: boolean;
  words: SiteHeaderFieldsWords;
  className?: string;
};

const LIMITS = { name: 60, label: 60 };

function SiteHeaderFields({
  values,
  errors = {},
  onChange,
  linksMax,
  disabled = false,
  words,
  className,
}: SiteHeaderFieldsProps) {
  const problem = (message: string | undefined) => (message ? { error: message } : {});
  const set = (patch: Partial<SiteHeaderValues>) => onChange({ ...values, ...patch });
  return (
    <div data-slot="site-header-fields" className={cn("flex flex-col gap-6", className)}>
      <FormSection
        id="header-brand"
        title={words.brand.title}
        description={words.brand.description}
      >
        <FormField label={words.name} optionalLabel={words.optional} {...problem(errors.name)}>
          <Input
            value={values.name}
            disabled={disabled}
            maxLength={LIMITS.name}
            autoComplete="off"
            onChange={(event) => set({ name: event.target.value })}
          />
        </FormField>
      </FormSection>
      <FormSection
        id="header-links"
        title={words.links.title}
        description={words.links.description}
      >
        <LinkListField
          title={words.links.title}
          links={values.links}
          onChange={(links) => set({ links })}
          max={linksMax}
          {...(errors.links ? { errors: errors.links } : {})}
          disabled={disabled}
          words={words.linkList}
        />
      </FormSection>
      <FormSection id="header-cta" title={words.cta.title} description={words.cta.description}>
        <div className="grid gap-5 md:grid-cols-2">
          <FormField
            label={words.ctaLabel}
            optionalLabel={words.optional}
            {...problem(errors.ctaLabel)}
          >
            <Input
              value={values.ctaLabel}
              disabled={disabled}
              maxLength={LIMITS.label}
              autoComplete="off"
              onChange={(event) => set({ ctaLabel: event.target.value })}
            />
          </FormField>
          <FormField
            label={words.ctaHref}
            optionalLabel={words.optional}
            {...problem(errors.ctaHref)}
          >
            <Input
              value={values.ctaHref}
              disabled={disabled}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              onChange={(event) => set({ ctaHref: event.target.value })}
            />
          </FormField>
        </div>
      </FormSection>
    </div>
  );
}

export { SiteHeaderFields };
export type { SiteHeaderErrors, SiteHeaderFieldsProps, SiteHeaderFieldsWords, SiteHeaderValues };
