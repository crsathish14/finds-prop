"use client";

/**
 * SiteHomepageFields: the boxes of the admin's Homepage page: a switch for each section below the hero, and the list
 * of curated localities.
 * Purpose: what the admin chooses to change which sections the home page shows and which places it features
 *   (S7-T10, FR-ADM-10, BR-82, ADD-11). Owner: design system. It holds no state: the page keeps the values and the
 *   errors and passes the words, already translated. A hidden section is not drawn at all on the public page.
 * Props: values ({ showFeatured, showProjectTypes, showDiscovery, showWhyUs, showCta, localities }), errors (the
 *   message of each locality box with a problem, by row id), onChange (the new values), localitiesMax, radii,
 *   defaultRadius (passed on to the localities list), disabled (while saving), words (the headings, the five
 *   switches' names and lines, and the localities list's words), className.
 * Responsive: two cards stacked one above the other; each switch row keeps its text on the left and the switch on the
 *   right on every width.
 * Accessibility: each switch has a visible label that is the whole row's click target; its line is read with it
 *   (aria-describedby); the switch says on or off by its state, not by colour alone.
 * States: all on, some off, the localities empty, at the limit, with errors, saving (all disabled).
 * Dependencies: FormSection, SiteLocalitiesEditor, Switch, Label, cn. Tests: site-content-parts.test.tsx; Design
 *   Lab "Site content" (S7-T10).
 * UX reference: admin-cms screen (#homepage: Sections) and admin-localities screen. The "Featured section title" box
 *   is left out: the title is part of the page's own wording and changing it is a separate change (ADR-093).
 */
import { useId } from "react";
import {
  SiteLocalitiesEditor,
  type SiteLocalitiesWords,
  type SiteLocalityErrors,
  type SiteLocalityRow,
} from "@/components/domain/site-localities-editor";
import { FormSection } from "@/components/patterns/form-section";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/cn";

type SiteHomepageSwitch =
  "showFeatured" | "showProjectTypes" | "showDiscovery" | "showWhyUs" | "showCta";

type SiteHomepageValues = Record<SiteHomepageSwitch, boolean> & {
  localities: SiteLocalityRow[];
};

type SiteHomepageErrors = { localities?: Record<string, SiteLocalityErrors> };

type SwitchWords = { label: string; hint: string };

type SiteHomepageFieldsWords = {
  sections: { title: string; description: string } & Record<
    "featured" | "projectTypes" | "discovery" | "whyUs" | "cta",
    SwitchWords
  >;
  localities: SiteLocalitiesWords;
};

type SiteHomepageFieldsProps = {
  values: SiteHomepageValues;
  errors?: SiteHomepageErrors;
  onChange: (values: SiteHomepageValues) => void;
  localitiesMax: number;
  radii: readonly number[];
  defaultRadius: number;
  disabled?: boolean;
  words: SiteHomepageFieldsWords;
  className?: string;
};

/** The five switches in the order of the approved screen, with the key of each in the values and in the words. */
const SWITCHES = [
  { value: "showFeatured", word: "featured" },
  { value: "showProjectTypes", word: "projectTypes" },
  { value: "showDiscovery", word: "discovery" },
  { value: "showWhyUs", word: "whyUs" },
  { value: "showCta", word: "cta" },
] as const satisfies readonly {
  value: SiteHomepageSwitch;
  word: keyof Omit<SiteHomepageFieldsWords["sections"], "title" | "description">;
}[];

function SwitchRow({
  checked,
  disabled,
  words,
  onChange,
}: {
  checked: boolean;
  disabled: boolean;
  words: SwitchWords;
  onChange: (checked: boolean) => void;
}) {
  const base = useId();
  const switchId = base + "-switch";
  const hintId = base + "-hint";
  return (
    <div className="flex items-center justify-between gap-4 border-t border-line py-4 first:border-t-0 first:pt-0 last:pb-0">
      <Label htmlFor={switchId} className="flex min-w-0 flex-1 flex-col items-start gap-1">
        <span className="font-bold text-ink">{words.label}</span>
        <span id={hintId} className="text-small font-normal text-muted">
          {words.hint}
        </span>
      </Label>
      <Switch
        id={switchId}
        aria-describedby={hintId}
        checked={checked}
        disabled={disabled}
        onCheckedChange={onChange}
      />
    </div>
  );
}

function SiteHomepageFields({
  values,
  errors = {},
  onChange,
  localitiesMax,
  radii,
  defaultRadius,
  disabled = false,
  words,
  className,
}: SiteHomepageFieldsProps) {
  return (
    <div data-slot="site-homepage-fields" className={cn("flex flex-col gap-6", className)}>
      <FormSection
        id="homepage-sections"
        title={words.sections.title}
        description={words.sections.description}
      >
        <div className="flex flex-col">
          {SWITCHES.map(({ value, word }) => (
            <SwitchRow
              key={value}
              checked={values[value]}
              disabled={disabled}
              words={words.sections[word]}
              onChange={(checked) => onChange({ ...values, [value]: checked })}
            />
          ))}
        </div>
      </FormSection>
      <SiteLocalitiesEditor
        localities={values.localities}
        onChange={(localities) => onChange({ ...values, localities })}
        max={localitiesMax}
        radii={radii}
        defaultRadius={defaultRadius}
        {...(errors.localities ? { errors: errors.localities } : {})}
        disabled={disabled}
        words={words.localities}
      />
    </div>
  );
}

export { SiteHomepageFields };
export type {
  SiteHomepageErrors,
  SiteHomepageFieldsProps,
  SiteHomepageFieldsWords,
  SiteHomepageSwitch,
  SiteHomepageValues,
};
