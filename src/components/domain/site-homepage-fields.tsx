"use client";

/**
 * SiteHomepageFields: the boxes of the admin's Homepage page: a switch for each section below the hero, and the list
 * of curated localities.
 * Purpose: what the admin chooses to change which sections the home page shows and which places it features
 *   (S7-T10, FR-ADM-10, BR-82, ADD-11). Owner: design system. It holds no state: the page keeps the values and the
 *   errors and passes the words, already translated. A hidden section is not drawn at all on the public page.
 * Props: values ({ showFeatured, showProjectTypes, showDiscovery, showWhyUs, showCta, localities }), errors (the
 *   message of each locality box with a problem, by row id), onChange (the new values), localitiesMax, radii,
 *   defaultRadius (passed on to the localities list), disabled (while saving), placePicker (the place search box of
 *   each locality row, passed on to the list: ADR-140), words (the headings, the five
 *   switches' names and lines, and the localities list's words), className.
 * Responsive: two cards stacked one above the other; each switch row keeps its text on the left and the switch on the
 *   right on every width.
 * Accessibility: each switch has a visible label that is the whole row's click target; its line is read with it
 *   (aria-describedby); the switch says on or off by its state, not by colour alone.
 * States: all on, some off, the localities empty, at the limit, with errors, saving (all disabled).
 * Dependencies: FormSection, SiteLocalitiesEditor, Switch, Label, cn. Tests: site-content-parts.test.tsx; Design
 *   Lab "Site content" (S7-T10).
 * UX reference: admin-cms screen (#homepage: Sections) and admin-localities screen. The "Featured section title" box
 *   is left out: the title is part of the page's own wording and changing it is a separate change (ADR-099).
 */
import { useId } from "react";
import type { PlacePickerComponent } from "@/components/domain/place-picker";
import {
  SiteLocalitiesEditor,
  type SiteLocalitiesWords,
  type SiteLocalityErrors,
  type SiteLocalityRow,
} from "@/components/domain/site-localities-editor";
import { FormSection } from "@/components/patterns/form-section";
import { Label } from "@/components/ui/label";
import { SortableList, SortableRow } from "@/components/patterns/sortable-list";
import { Switch } from "@/components/ui/switch";
import type { HomeSectionKey } from "@/lib/home-sections";
import { cn } from "@/lib/cn";

type SiteHomepageSwitch =
  "showFeatured" | "showProjectTypes" | "showDiscovery" | "showWhyUs" | "showCta";

type SiteHomepageValues = Record<SiteHomepageSwitch, boolean> & {
  localities: SiteLocalityRow[];
  /** The order of the sections below the hero (CR plan 5). Left out, the switches show as a plain list (no reordering). */
  order?: HomeSectionKey[];
};

type SiteHomepageErrors = { localities?: Record<string, SiteLocalityErrors> };

type SwitchWords = { label: string; hint: string };

type SiteHomepageFieldsWords = {
  sections: { title: string; description: string } & Record<
    "featured" | "projectTypes" | "discovery" | "whyUs" | "cta",
    SwitchWords
  >;
  localities: SiteLocalitiesWords;
  /** Words for reordering; needed when `values.order` is given. */
  order?: {
    /** One line under the list: the hero stays first, one order for every screen. */
    hint: string;
    /** The sections that have no switch: they show when there is something to show. */
    newLaunches: SwitchWords;
    newest: SwitchWords;
    /** The Developer spotlight (ADR-193): shown when the admin picked a developer for it. */
    spotlight: SwitchWords;
    /** The grip and the arrows of one row, naming the section ("Move Featured listings up"). */
    rowLabels: (section: string) => { drag: string; moveUp: string; moveDown: string };
  };
};

type SiteHomepageFieldsProps = {
  values: SiteHomepageValues;
  errors?: SiteHomepageErrors;
  onChange: (values: SiteHomepageValues) => void;
  localitiesMax: number;
  radii: readonly number[];
  defaultRadius: number;
  disabled?: boolean;
  /** The place search box of each locality row (ADR-140); left out, the rows have the typed boxes alone. */
  placePicker?: PlacePickerComponent;
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

/** The switch of each section, by its key in the order. */
const SWITCH_OF: Partial<
  Record<HomeSectionKey, { value: SiteHomepageSwitch; word: (typeof SWITCHES)[number]["word"] }>
> = {
  discovery: { value: "showDiscovery", word: "discovery" },
  featured: { value: "showFeatured", word: "featured" },
  projectTypes: { value: "showProjectTypes", word: "projectTypes" },
  whyUs: { value: "showWhyUs", word: "whyUs" },
  cta: { value: "showCta", word: "cta" },
};

function SwitchRow({
  checked,
  disabled,
  words,
  onChange,
  plain = false,
}: {
  checked?: boolean;
  disabled: boolean;
  words: SwitchWords;
  onChange?: (checked: boolean) => void;
  /** In a sortable row: no divider lines. */
  plain?: boolean;
}) {
  const base = useId();
  const switchId = base + "-switch";
  const hintId = base + "-hint";
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4",
        !plain && "border-t border-line py-4 first:border-t-0 first:pt-0 last:pb-0",
      )}
    >
      <Label htmlFor={switchId} className="flex min-w-0 flex-1 flex-col items-start gap-1">
        <span className="font-bold text-ink">{words.label}</span>
        <span id={hintId} className="text-small font-normal text-muted">
          {words.hint}
        </span>
      </Label>
      {onChange ? (
        <Switch
          id={switchId}
          aria-describedby={hintId}
          checked={checked ?? false}
          disabled={disabled}
          onCheckedChange={onChange}
        />
      ) : null}
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
  placePicker,
  words,
  className,
}: SiteHomepageFieldsProps) {
  const orderWords = words.order;
  return (
    <div data-slot="site-homepage-fields" className={cn("flex flex-col gap-6", className)}>
      <FormSection
        id="homepage-sections"
        title={words.sections.title}
        description={words.sections.description}
      >
        {values.order && orderWords ? (
          <div className="flex flex-col gap-3">
            <p className="text-small text-muted">{orderWords.hint}</p>
            <SortableList
              ids={values.order}
              onReorder={(ids) => onChange({ ...values, order: ids as HomeSectionKey[] })}
            >
              {values.order.map((key) => {
                const found = SWITCH_OF[key];
                const rowWords =
                  found === undefined
                    ? orderWords[key as "newLaunches" | "newest" | "spotlight"]
                    : words.sections[found.word];
                return (
                  <SortableRow key={key} id={key} labels={orderWords.rowLabels(rowWords.label)}>
                    <SwitchRow
                      plain
                      disabled={disabled}
                      words={rowWords}
                      {...(found
                        ? {
                            checked: values[found.value],
                            onChange: (checked: boolean) =>
                              onChange({ ...values, [found.value]: checked }),
                          }
                        : {})}
                    />
                  </SortableRow>
                );
              })}
            </SortableList>
          </div>
        ) : (
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
        )}
      </FormSection>
      <SiteLocalitiesEditor
        localities={values.localities}
        onChange={(localities) => onChange({ ...values, localities })}
        max={localitiesMax}
        radii={radii}
        defaultRadius={defaultRadius}
        {...(errors.localities ? { errors: errors.localities } : {})}
        disabled={disabled}
        {...(placePicker ? { placePicker } : {})}
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
