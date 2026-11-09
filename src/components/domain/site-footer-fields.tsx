/**
 * SiteFooterFields: the boxes of the admin's Footer page: the about text, the contact details, the links and the
 * copyright line.
 * Purpose: what the admin types to change the footer of every public page (S7-T10, FR-ADM-10). Owner: design system.
 *   It holds no state: the page keeps the values and the errors and passes the words, already translated. An empty box
 *   is left out of the footer, or replaced by the standard line where there is one (BR-81).
 * Props: values ({ about, phone, email, address, links, copyright }; links are rows with an id the page keeps), errors
 *   (the message of each box with a problem, by box, and links by row id), onChange (the new values), linksMax,
 *   disabled (while saving), words (the headings, labels and the link list's words), className.
 * Responsive: two cards stacked one above the other; phone and email sit side by side from 768 px, and the about
 *   text and address take the full width.
 * Accessibility: every box has a visible label tied to it (the link rows name theirs by place); errors are read with
 *   the box and also show an icon.
 * States: standard (empty), filled, with errors, saving (all disabled).
 * Dependencies: FormSection, FormField, LinkListField, Input, Textarea, cn. Tests: site-content-parts.test.tsx;
 *   Design Lab "Site content" (S7-T10).
 * UX reference: admin-cms screen (#footer: About and contact, Links).
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
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/cn";

type SiteFooterValues = {
  about: string;
  phone: string;
  email: string;
  address: string;
  links: LinkRow[];
  copyright: string;
};

type SiteFooterTextField = "about" | "phone" | "email" | "address" | "copyright";

type SiteFooterErrors = Partial<Record<SiteFooterTextField, string>> & {
  links?: Record<string, LinkRowErrors>;
};

type SiteFooterFieldsWords = {
  contact: { title: string; description: string };
  links: { title: string; description: string };
  about: string;
  phone: string;
  email: string;
  address: string;
  copyright: string;
  /** "(optional)". */
  optional: string;
  linkList: LinkListWords;
};

type SiteFooterFieldsProps = {
  values: SiteFooterValues;
  errors?: SiteFooterErrors;
  onChange: (values: SiteFooterValues) => void;
  linksMax: number;
  disabled?: boolean;
  words: SiteFooterFieldsWords;
  className?: string;
};

const LIMITS = { about: 400, address: 200, phone: 30, email: 254, copyright: 200 };

function SiteFooterFields({
  values,
  errors = {},
  onChange,
  linksMax,
  disabled = false,
  words,
  className,
}: SiteFooterFieldsProps) {
  const set = (patch: Partial<SiteFooterValues>) => onChange({ ...values, ...patch });
  const optional = { optionalLabel: words.optional };
  const problem = (name: SiteFooterTextField) => {
    const message = errors[name];
    return message ? { error: message } : {};
  };
  return (
    <div data-slot="site-footer-fields" className={cn("flex flex-col gap-6", className)}>
      <FormSection
        id="footer-contact"
        title={words.contact.title}
        description={words.contact.description}
      >
        <div className="grid gap-5 md:grid-cols-2">
          <FormField
            label={words.about}
            className="md:col-span-2"
            {...optional}
            {...problem("about")}
          >
            <Textarea
              value={values.about}
              disabled={disabled}
              maxLength={LIMITS.about}
              rows={4}
              onChange={(event) => set({ about: event.target.value })}
            />
          </FormField>
          <FormField label={words.phone} {...optional} {...problem("phone")}>
            <Input
              value={values.phone}
              disabled={disabled}
              maxLength={LIMITS.phone}
              inputMode="tel"
              autoComplete="off"
              onChange={(event) => set({ phone: event.target.value })}
            />
          </FormField>
          <FormField label={words.email} {...optional} {...problem("email")}>
            <Input
              type="email"
              value={values.email}
              disabled={disabled}
              maxLength={LIMITS.email}
              autoComplete="off"
              autoCapitalize="none"
              onChange={(event) => set({ email: event.target.value })}
            />
          </FormField>
          <FormField
            label={words.address}
            className="md:col-span-2"
            {...optional}
            {...problem("address")}
          >
            <Input
              value={values.address}
              disabled={disabled}
              maxLength={LIMITS.address}
              autoComplete="off"
              onChange={(event) => set({ address: event.target.value })}
            />
          </FormField>
        </div>
      </FormSection>
      <FormSection
        id="footer-links"
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
        <FormField label={words.copyright} {...optional} {...problem("copyright")}>
          <Input
            value={values.copyright}
            disabled={disabled}
            maxLength={LIMITS.copyright}
            autoComplete="off"
            onChange={(event) => set({ copyright: event.target.value })}
          />
        </FormField>
      </FormSection>
    </div>
  );
}

export { SiteFooterFields };
export type {
  SiteFooterErrors,
  SiteFooterFieldsProps,
  SiteFooterFieldsWords,
  SiteFooterTextField,
  SiteFooterValues,
};
