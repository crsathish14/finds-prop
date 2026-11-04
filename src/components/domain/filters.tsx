"use client";

/**
 * Filters: the search results' filter panel on a wide screen (FilterRail) and the bottom sheet on a
 * phone (FilterSheet), both made from one set of fields (FilterFields) so they cannot differ.
 * Purpose: lets a visitor narrow the results by Looking to (All, Buy, Rent), locality, kind of
 *   property, bedrooms and maximum budget (the sheet adds Sort by). Owner: design system. They keep
 *   only what the visitor has chosen and know nothing about web addresses or the database; the page
 *   (S4-T04) turns the values into the results address and gives the count for "Show N homes".
 * Props: FilterRail: values (FilterValues), onChange (called with the whole new set at every
 *   change; "Clear all" calls it with clearFilters(values)), localities (the names for the Locality
 *   dropdown), allLocalitiesLabel (the first option, such as "All of Chennai", given by the page
 *   because the city is a site setting), className (the page makes it sticky and hides it on a
 *   phone). FilterSheet: values, onApply (the whole set, only when the visitor presses Show),
 *   localities, allLocalitiesLabel, resultCount (the number in "Show N homes"; leave it out while
 *   unknown and the button says "Show homes"), onDraftChange (so the page can count the matches of
 *   what is being chosen), className (the page hides the "Filters" button on a wide screen).
 *   FilterFields: values, onChange, localities, allLocalitiesLabel, showSort.
 *   Bedrooms are one value (Any or 1 to 4). The budget list follows Looking to: Rent lists monthly
 *   rents, Buy and All list sale amounts (as the UX draws it); an amount the new list does not have
 *   goes back to Any. A locality not in the list is added to it so the box never lies.
 * Responsive: the rail fills the width it is given (280 px in the UX) and is a card. The sheet is the
 *   shared bottom Sheet (full width, up to 90% of the height, scrolls inside). Fields stack in one
 *   column at every width.
 * Accessibility: the rail is a complementary landmark named by its heading. The sheet is a dialog
 *   named "Filters" (focus trapped, Escape and the close button close it, focus returns to the
 *   "Filters" button). Looking to is a radio group; Locality, Property type, Max budget and Sort
 *   are native selects with visible labels; Bedrooms are toggle buttons in a labelled group, each
 *   named "3 BHK". The "Filters" button is named "Filters, 4 applied" when filters are set. The
 *   sheet keeps its choices until Show is pressed; closing it any other way throws them away.
 * States: rail and sheet: default, filled, Rent, All, nothing set. Button: with and without a
 *   count. Sheet: closed, open. Show button: with a count, one home, count unknown.
 * Dependencies: Sheet, Button, Chip, Icon, Label, NativeSelect, SegmentedControl, search-options,
 *   format helpers, next-intl.
 * Tests: filters.test.tsx; Design Lab "Domain" (S4-T01).
 * UX reference: search screen, filters rail and sheet (s-browse.css .filter-panel, .filters-btn; fp-pages.js FP.filters).
 */
import { SlidersHorizontal } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useId, useState, type ChangeEvent, type ReactNode } from "react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/patterns/sheet";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Icon } from "@/components/ui/icon";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { cn } from "@/lib/cn";
import { formatPrice, type Translate } from "@/lib/format";
import {
  BEDROOM_CHOICES,
  PROPERTY_TYPES,
  PROPERTY_TYPE_WORDS,
  SORT_OPTIONS,
  SORT_WORDS,
  budgetStepsForFilter,
  clearFilters,
  countActiveFilters,
  keepFilterBudget,
  parseFilterBudget,
  parseFilterIntent,
  parsePropertyType,
  parseSort,
  type BedroomChoice,
  type FilterValues,
} from "@/config/search-options";

type FilterFieldsProps = {
  values: FilterValues;
  onChange: (next: FilterValues) => void;
  localities: readonly string[];
  allLocalitiesLabel: string;
  showSort?: boolean;
};

/** One field: its label above, its control below. */
function Field({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-2">{children}</div>;
}

const SELECT_HEIGHT = "min-h-(--size-btn)";
const GROUP_LABEL = "text-small font-semibold text-ink";

/** The fields of the filter rail and the filter sheet. */
function FilterFields({
  values,
  onChange,
  localities,
  allLocalitiesLabel,
  showSort = false,
}: FilterFieldsProps) {
  const translate = useTranslations() as unknown as Translate;
  const locale = useLocale();
  const ids = useId();
  const id = (name: string) => `${ids}-${name}`;
  const set = (patch: Partial<FilterValues>) => onChange({ ...values, ...patch });
  const localityList =
    values.locality !== null && !localities.includes(values.locality)
      ? [values.locality, ...localities]
      : localities;
  const bedroomChoices: (BedroomChoice | null)[] = [null, ...BEDROOM_CHOICES];

  return (
    <div className="flex flex-col gap-5">
      <Field>
        <span aria-hidden="true" className={GROUP_LABEL}>
          {translate("domain.searchCard.intentLabel")}
        </span>
        <SegmentedControl
          block
          aria-label={translate("domain.searchCard.intentLabel")}
          value={values.intent}
          onValueChange={(next) => {
            const intent = parseFilterIntent(next);
            set({ intent, maxBudget: keepFilterBudget(intent, values.maxBudget) });
          }}
          options={[
            { value: "all", label: translate("domain.filters.all") },
            { value: "buy", label: translate("domain.searchCard.buy") },
            { value: "rent", label: translate("domain.searchCard.rent") },
          ]}
        />
      </Field>

      <Field>
        <Label htmlFor={id("locality")}>{translate("domain.searchCard.locality.label")}</Label>
        <NativeSelect
          id={id("locality")}
          className={SELECT_HEIGHT}
          value={values.locality ?? ""}
          onChange={(event: ChangeEvent<HTMLSelectElement>) =>
            set({ locality: event.target.value === "" ? null : event.target.value })
          }
        >
          <option value="">{allLocalitiesLabel}</option>
          {localityList.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </NativeSelect>
      </Field>

      <Field>
        <Label htmlFor={id("type")}>{translate("domain.searchCard.propertyType.label")}</Label>
        <NativeSelect
          id={id("type")}
          className={SELECT_HEIGHT}
          value={values.propertyType ?? ""}
          onChange={(event: ChangeEvent<HTMLSelectElement>) =>
            set({ propertyType: parsePropertyType(event.target.value) })
          }
        >
          <option value="">{translate("domain.searchCard.propertyType.any")}</option>
          {PROPERTY_TYPES.map((type) => (
            <option key={type} value={type}>
              {translate(PROPERTY_TYPE_WORDS[type])}
            </option>
          ))}
        </NativeSelect>
      </Field>

      <Field>
        <span id={id("bedrooms")} className={GROUP_LABEL}>
          {translate("domain.filters.bedrooms")}
        </span>
        <div role="group" aria-labelledby={id("bedrooms")} className="grid grid-cols-5 gap-2">
          {bedroomChoices.map((choice) => (
            <Chip
              key={choice ?? "any"}
              aria-pressed={values.bedrooms === choice}
              {...(choice === null
                ? {}
                : { "aria-label": translate("property.bhk", { count: choice }) })}
              onClick={() => set({ bedrooms: choice })}
              // A single choice in a row: the chosen one is filled, with no tick (as the UX draws it).
              className="w-full justify-center px-0 aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-on-primary"
            >
              {choice === null ? translate("domain.filters.bedroomsAny") : choice}
            </Chip>
          ))}
        </div>
      </Field>

      <Field>
        <Label htmlFor={id("budget")}>{translate("domain.searchCard.budget.label")}</Label>
        <NativeSelect
          id={id("budget")}
          className={SELECT_HEIGHT}
          value={values.maxBudget === null ? "" : String(values.maxBudget)}
          onChange={(event: ChangeEvent<HTMLSelectElement>) =>
            set({ maxBudget: parseFilterBudget(values.intent, event.target.value) })
          }
        >
          <option value="">{translate("domain.searchCard.budget.any")}</option>
          {budgetStepsForFilter(values.intent).map((rupees) => (
            <option key={rupees} value={rupees}>
              {translate("domain.searchCard.budget.upTo", {
                amount: formatPrice(translate, locale, rupees),
              })}
            </option>
          ))}
        </NativeSelect>
      </Field>

      {showSort ? (
        <Field>
          <Label htmlFor={id("sort")}>{translate("domain.filters.sortLabel")}</Label>
          <NativeSelect
            id={id("sort")}
            className={SELECT_HEIGHT}
            value={values.sort}
            onChange={(event: ChangeEvent<HTMLSelectElement>) =>
              set({ sort: parseSort(event.target.value) })
            }
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {translate(SORT_WORDS[option])}
              </option>
            ))}
          </NativeSelect>
        </Field>
      ) : null}
    </div>
  );
}

type FilterRailProps = {
  values: FilterValues;
  onChange: (next: FilterValues) => void;
  localities: readonly string[];
  allLocalitiesLabel: string;
  className?: string | undefined;
};

/** The filter panel on a wide screen: every change is reported at once. */
function FilterRail({
  values,
  onChange,
  localities,
  allLocalitiesLabel,
  className,
}: FilterRailProps) {
  const translate = useTranslations();
  const headingId = useId();
  return (
    <aside
      data-slot="filter-rail"
      aria-labelledby={headingId}
      className={cn("flex flex-col gap-5 rounded-lg border border-line bg-surface p-5", className)}
    >
      <div className="flex items-center justify-between gap-3">
        <h2 id={headingId} className="text-title text-ink">
          {translate("domain.filters.title")}
        </h2>
        <Button variant="ghost" size="sm" onClick={() => onChange(clearFilters(values))}>
          {translate("domain.filters.clearAll")}
        </Button>
      </div>
      <FilterFields
        values={values}
        onChange={onChange}
        localities={localities}
        allLocalitiesLabel={allLocalitiesLabel}
      />
    </aside>
  );
}

type FilterSheetProps = {
  values: FilterValues;
  onApply: (values: FilterValues) => void;
  localities: readonly string[];
  allLocalitiesLabel: string;
  resultCount?: number | null | undefined;
  onDraftChange?: ((values: FilterValues) => void) | undefined;
  className?: string | undefined;
};

/** The "Filters" button and the bottom sheet it opens. Choices apply only when Show is pressed. */
function FilterSheet({
  values,
  onApply,
  localities,
  allLocalitiesLabel,
  resultCount,
  onDraftChange,
  className,
}: FilterSheetProps) {
  const translate = useTranslations();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<FilterValues>(values);
  const applied = countActiveFilters(values);

  function change(next: FilterValues) {
    setDraft(next);
    onDraftChange?.(next);
  }

  function onOpenChange(next: boolean) {
    // Each time it opens it starts from what is applied; closing any other way drops the choices.
    if (next) setDraft(values);
    setOpen(next);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>
        <Button
          variant="secondary"
          size="sm"
          iconStart={<Icon icon={SlidersHorizontal} />}
          iconEnd={
            applied > 0 ? (
              <span
                aria-hidden="true"
                className="grid h-6 min-w-6 place-items-center rounded-pill bg-primary px-2 text-caption font-bold text-on-primary"
              >
                {applied}
              </span>
            ) : undefined
          }
          className={className}
        >
          {applied > 0 ? (
            // The name comes from the content, not an aria-label, so it can never disagree with the
            // visible words (WCAG 2.5.3): the visible word and count are hidden from a screen
            // reader, which hears "Filters, 4 applied" instead.
            <>
              <span aria-hidden="true">{translate("domain.filters.button")}</span>
              <span className="sr-only">
                {translate("domain.filters.buttonApplied", { count: applied })}
              </span>
            </>
          ) : (
            translate("domain.filters.button")
          )}
        </Button>
      </SheetTrigger>
      <SheetContent
        title={translate("domain.filters.title")}
        closeLabel={translate("domain.filters.close")}
        footer={
          <>
            <Button variant="ghost" onClick={() => change(clearFilters(draft))}>
              {translate("domain.filters.clearAll")}
            </Button>
            <Button
              variant="accent"
              className="flex-1"
              onClick={() => {
                onApply(draft);
                setOpen(false);
              }}
            >
              {resultCount === null || resultCount === undefined
                ? translate("domain.filters.show")
                : translate("domain.filters.showCount", { count: resultCount })}
            </Button>
          </>
        }
      >
        <FilterFields
          showSort
          values={draft}
          onChange={change}
          localities={localities}
          allLocalitiesLabel={allLocalitiesLabel}
        />
      </SheetContent>
    </Sheet>
  );
}

export { FilterFields, FilterRail, FilterSheet };
export type { FilterFieldsProps, FilterRailProps, FilterSheetProps };
