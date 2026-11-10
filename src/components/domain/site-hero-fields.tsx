/**
 * SiteHeroFields: the boxes of the admin's Hero page: the eyebrow, the headline and the line under it, and the choice
 * of layout (Search Desk or Split).
 * Purpose: what the admin types to change the first thing visitors see on the home page, and how it is arranged
 *   (S7-T10, FR-ADM-10, FR-ADM-11). Owner: design system. It holds no state: the page keeps the values and the errors
 *   and passes the words, already translated. An empty eyebrow or subtitle means "use the standard one" (BR-81); the
 *   headline is needed.
 * Props: values ({ eyebrow, title, subtitle, layout }), errors (the message of each box with a problem, by box),
 *   onChange (the new values), layoutNote (what the page shows under the two layout cards, such as which layout is live
 *   and a warning about the sponsors; optional, S7-T11), disabled (while saving), words (the headings, labels, hints and the two layouts'
 *   names and lines), className.
 * Responsive: two cards stacked one above the other; the two layout cards sit side by side from 768 px.
 * Accessibility: every box has a visible label tied to it; the layout is a radio group (one tab stop, arrow keys
 *   choose) named by the card's heading; each card's small drawing is hidden from screen readers and the chosen card
 *   also shows a tick, so the choice is not shown by colour alone.
 * States: standard (empty optional boxes), filled, with errors, one layout chosen or the other, saving (all disabled).
 * Dependencies: FormSection, FormField, ChoiceCards, Input, cn. Tests: site-content-parts.test.tsx; Design Lab
 *   "Site content" (S7-T10).
 * UX reference: admin-cms screen (#hero: Text, Layout). The "Background image" card is left out: neither approved
 *   layout uses an image, so the box would have no effect (ADR-099).
 */
import type { ReactNode } from "react";
import { ChoiceCards } from "@/components/domain/choice-cards";
import { FormField } from "@/components/patterns/form-field";
import { FormSection } from "@/components/patterns/form-section";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/cn";

type SiteHeroLayout = "search_desk" | "split";

type SiteHeroValues = {
  eyebrow: string;
  title: string;
  subtitle: string;
  layout: SiteHeroLayout;
};

type SiteHeroTextField = "eyebrow" | "title" | "subtitle";

type SiteHeroErrors = Partial<Record<SiteHeroTextField, string>>;

type SiteHeroFieldsWords = {
  text: { title: string };
  layout: {
    title: string;
    description: string;
    searchDesk: { label: string; hint: string };
    split: { label: string; hint: string };
  };
  eyebrow: string;
  eyebrowHint: string;
  headline: string;
  subtitle: string;
  /** "(optional)". */
  optional: string;
};

type SiteHeroFieldsProps = {
  values: SiteHeroValues;
  errors?: SiteHeroErrors;
  onChange: (values: SiteHeroValues) => void;
  layoutNote?: ReactNode;
  disabled?: boolean;
  words: SiteHeroFieldsWords;
  className?: string;
};

const LIMITS = { eyebrow: 80, title: 120, subtitle: 240 };

/** A small drawing of where the search and the banner sit in a layout. */
function LayoutDrawing({ layout }: { layout: SiteHeroLayout }) {
  return (
    <span
      className={cn(
        "flex h-20 w-full rounded-md border border-line bg-canvas p-2",
        layout === "split" ? "items-center gap-2" : "flex-col items-center justify-center gap-2",
      )}
    >
      <span
        className={cn(
          "block rounded-sm border border-line-input bg-surface",
          layout === "split" ? "h-8 w-1/2" : "h-6 w-3/5",
        )}
      />
      <span
        className={cn(
          "block rounded-sm bg-cta-tint",
          layout === "split" ? "h-full w-2/5" : "h-2 w-3/5",
        )}
      />
    </span>
  );
}

function SiteHeroFields({
  values,
  errors = {},
  onChange,
  layoutNote,
  disabled = false,
  words,
  className,
}: SiteHeroFieldsProps) {
  const set = (patch: Partial<SiteHeroValues>) => onChange({ ...values, ...patch });
  const problem = (name: SiteHeroTextField) => {
    const message = errors[name];
    return message ? { error: message } : {};
  };
  return (
    <div data-slot="site-hero-fields" className={cn("flex flex-col gap-6", className)}>
      <FormSection id="hero-text" title={words.text.title}>
        <div className="flex flex-col gap-5">
          <FormField
            label={words.eyebrow}
            optionalLabel={words.optional}
            hint={words.eyebrowHint}
            {...problem("eyebrow")}
          >
            <Input
              value={values.eyebrow}
              disabled={disabled}
              maxLength={LIMITS.eyebrow}
              autoComplete="off"
              onChange={(event) => set({ eyebrow: event.target.value })}
            />
          </FormField>
          <FormField label={words.headline} required {...problem("title")}>
            <Input
              value={values.title}
              disabled={disabled}
              maxLength={LIMITS.title}
              autoComplete="off"
              onChange={(event) => set({ title: event.target.value })}
            />
          </FormField>
          <FormField label={words.subtitle} optionalLabel={words.optional} {...problem("subtitle")}>
            <Input
              value={values.subtitle}
              disabled={disabled}
              maxLength={LIMITS.subtitle}
              autoComplete="off"
              onChange={(event) => set({ subtitle: event.target.value })}
            />
          </FormField>
        </div>
      </FormSection>
      <FormSection
        id="hero-layout"
        title={words.layout.title}
        description={words.layout.description}
      >
        <ChoiceCards
          legend={words.layout.title}
          hideLegend
          name="hero-layout"
          value={values.layout}
          disabled={disabled}
          onChange={(layout) => set({ layout: layout === "split" ? "split" : "search_desk" })}
          options={[
            {
              value: "search_desk",
              label: words.layout.searchDesk.label,
              hint: words.layout.searchDesk.hint,
              visual: <LayoutDrawing layout="search_desk" />,
            },
            {
              value: "split",
              label: words.layout.split.label,
              hint: words.layout.split.hint,
              visual: <LayoutDrawing layout="split" />,
            },
          ]}
        />
        {layoutNote}
      </FormSection>
    </div>
  );
}

export { SiteHeroFields };
export type {
  SiteHeroErrors,
  SiteHeroFieldsProps,
  SiteHeroFieldsWords,
  SiteHeroLayout,
  SiteHeroTextField,
  SiteHeroValues,
};
