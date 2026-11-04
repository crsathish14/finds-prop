"use client";

/**
 * SearchCard: the home page's search box. The same four fields in the same order everywhere.
 * Purpose: lets a visitor choose Buy or Rent, a locality, a kind of property, bedrooms and a maximum
 *   budget and go to the results. Owner: design system. It holds only what the visitor has chosen so
 *   far; it knows nothing about web addresses or the database. The page gives it the localities to
 *   suggest and the links, and turns the chosen values into the results address (S4-T04).
 * Props: onSearch (called with { intent, locality, propertyType, bedrooms, maxBudget } when the
 *   visitor presses Search or Enter in the locality box), layout ("wide" one joined bar from a wide
 *   card | "stacked" two rows at every width), defaultValues (what to start with), projectsHref (the
 *   "New projects" link-tab), aiSearchHref (the "Describe it in words" link; leave it out while AI
 *   search is off and the link is not drawn), localityOptions, onLocalityQueryChange,
 *   localityLoading and localityMinChars (the suggestion list, passed to Combobox; 1 letter by
 *   default), popular (up to four { label, href } localities, links; none leaves the group out),
 *   quickPickHrefs ({ bedrooms, budget }: the two quick picks "3 BHK" and "Budget homes", each a
 *   link the page addresses; a missing one is left out), className.
 *   Bedrooms are one value (1 to 4 or Any). Budget is a maximum only; Buy lists sale amounts and Rent
 *   lists monthly rents, and an amount the other list does not have goes back to Any. Search is never
 *   disabled: an empty search shows everything.
 * Responsive: it answers to its own width (container queries), not the screen's. Under 576 px: the
 *   tabs on a full row, then the fields (locality on its own row, the other three side by side), then
 *   Search, then the AI link; short labels and no chips. From 576 px: the tabs and the AI link share a
 *   row, the locality and Search share a row, the labels are in full and the chips show. A wide card
 *   joins all four fields and the button in one bar from 896 px.
 * Accessibility: a form named "Property search" (role search). Buy and Rent are a radio group named
 *   "Looking to"; "New projects" is an ordinary link in the same row. Locality is a combobox (arrow
 *   keys move, Enter picks, Escape closes); the other fields are native selects named in full even
 *   where the visible label is short. Enter in the locality box searches when no suggestion is being
 *   picked. Chips are links, in two labelled groups.
 * States: default; filled; Rent; field hover and focus (a ring around the whole field); locality
 *   typing, loading, results, no results and picked (see Combobox); no AI link; no Popular chips.
 * Dependencies: Combobox, SegmentedControl, Button, Chip, Link, Icon, search-options, format
 *   helpers, next-intl.
 * Tests: search-card.test.tsx; Design Lab "Domain" (S4-T01).
 * UX reference: search card on home-a and home-b, ds-components "Search card" (c-cards.css .search).
 */
import { ArrowRight, ChevronDown, MapPin, Search, Sparkles } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import {
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { Combobox, type ComboboxOption } from "@/components/patterns/combobox";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Icon } from "@/components/ui/icon";
import { Link } from "@/components/ui/link";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { cn } from "@/lib/cn";
import { formatPrice, type Translate } from "@/lib/format";
import {
  BEDROOM_CHOICES,
  PROPERTY_TYPES,
  PROPERTY_TYPE_WORDS,
  budgetStepsFor,
  keepBudget,
  parseBedrooms,
  parseBudget,
  parsePropertyType,
  type BedroomChoice,
  type PropertyType,
  type SearchIntent,
} from "@/config/search-options";

type SearchValues = {
  intent: SearchIntent;
  /** The text in the locality box: a suggestion the visitor picked, or what they typed. */
  locality: string;
  propertyType: PropertyType | null;
  bedrooms: BedroomChoice | null;
  /** In whole rupees (a sale price when buying, a monthly rent when renting). */
  maxBudget: number | null;
};

type SearchLink = { label: string; href: string };

type SearchCardProps = {
  onSearch: (values: SearchValues) => void;
  layout?: "wide" | "stacked";
  defaultValues?: Partial<SearchValues>;
  projectsHref: string;
  aiSearchHref?: string | undefined;
  localityOptions: ComboboxOption[];
  onLocalityQueryChange: (query: string) => void;
  localityLoading?: boolean;
  localityMinChars?: number;
  popular?: readonly SearchLink[];
  quickPickHrefs?: { bedrooms?: string | undefined; budget?: string | undefined } | undefined;
  className?: string;
};

const EMPTY: SearchValues = {
  intent: "buy",
  locality: "",
  propertyType: null,
  bedrooms: null,
  maxBudget: null,
};

/** The four fields share one box: label above, value below, a ring around all of it on focus. */
function fieldBox(wide: boolean) {
  return cn(
    "relative flex h-14 min-w-0 flex-col justify-center gap-1 rounded-md border-[length:var(--bw-field)] border-line-input bg-surface px-2 @xl:px-4",
    "transition-colors duration-(--dur-fast) hover:border-primary",
    "focus-within:border-primary focus-within:outline-2 focus-within:outline-offset-1 focus-within:outline-primary",
    wide &&
      "@4xl:h-17 @4xl:rounded-none @4xl:border-0 @4xl:border-r @4xl:border-r-line @4xl:px-5 @4xl:focus-within:-outline-offset-2",
  );
}

/** The small capitals label: a short word on a phone, the full name from 768 px. */
function FieldLabel({
  htmlFor,
  full,
  short,
}: {
  htmlFor?: string | undefined;
  full: string;
  short?: string | undefined;
}) {
  return (
    <label htmlFor={htmlFor} className="text-overline text-muted @max-xl:tracking-normal">
      {short ? (
        <>
          <span className="@xl:hidden">{short}</span>
          <span className="hidden @xl:inline">{full}</span>
        </>
      ) : (
        full
      )}
    </label>
  );
}

type SelectFieldProps = {
  id: string;
  fullLabel: string;
  shortLabel?: string;
  value: string;
  onChange: (event: ChangeEvent<HTMLSelectElement>) => void;
  wide: boolean;
  className?: string;
  children: ReactNode;
};

/**
 * A native select drawn inside the field box, so the phone's own picker opens. It is named in full
 * (aria-label) even where the visible label is the short word.
 */
function SelectField({
  id,
  fullLabel,
  shortLabel,
  value,
  onChange,
  wide,
  className,
  children,
}: SelectFieldProps) {
  return (
    <div className={cn(fieldBox(wide), className)}>
      <FieldLabel htmlFor={id} full={fullLabel} short={shortLabel} />
      {/* On a phone the chevron sits in the field's top corner (as in the UX), freeing the width for the value. */}
      <div className="@xl:relative">
        <select
          id={id}
          aria-label={fullLabel}
          value={value}
          onChange={onChange}
          className={cn(
            "h-6 w-full min-w-0 cursor-pointer appearance-none truncate bg-transparent @max-xs:pr-4 text-small font-semibold text-ink @xl:pr-6 @xl:text-body",
            "focus-visible:outline-0",
            value === "" && "font-normal text-muted",
          )}
        >
          {children}
        </select>
        <Icon
          icon={ChevronDown}
          size="sm"
          className="pointer-events-none absolute top-2 right-1 size-3 text-muted @max-xs:top-auto @max-xs:bottom-3 @xl:top-1/2 @xl:right-0 @xl:size-4 @xl:-translate-y-1/2"
        />
      </div>
    </div>
  );
}

function SearchCard({
  onSearch,
  layout = "wide",
  defaultValues,
  projectsHref,
  aiSearchHref,
  localityOptions,
  onLocalityQueryChange,
  localityLoading = false,
  localityMinChars = 1,
  popular = [],
  quickPickHrefs,
  className,
}: SearchCardProps) {
  const translate = useTranslations() as unknown as Translate;
  const locale = useLocale();
  const wide = layout === "wide";
  const ids = useId();
  const [values, setValues] = useState<SearchValues>({ ...EMPTY, ...defaultValues });
  // Enter in the locality box picks the highlighted suggestion; only an Enter that picked nothing
  // searches. The flag is set by the pick and cleared in the same tick.
  const justPicked = useRef(false);

  const popularShown = popular.slice(0, wide ? 4 : 3);
  const quickPicks = [
    quickPickHrefs?.bedrooms
      ? { label: translate("domain.searchCard.quickPickBedrooms"), href: quickPickHrefs.bedrooms }
      : null,
    quickPickHrefs?.budget
      ? { label: translate("domain.searchCard.quickPickBudget"), href: quickPickHrefs.budget }
      : null,
  ].filter((pick): pick is SearchLink => pick !== null);

  function submit() {
    onSearch({ ...values, locality: values.locality.trim() });
  }

  function onLocalityKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Enter") return;
    if (justPicked.current) {
      justPicked.current = false;
      return;
    }
    event.preventDefault();
    submit();
  }

  function chooseIntent(next: string) {
    const intent = next === "rent" ? "rent" : "buy";
    setValues((current) => ({
      ...current,
      intent,
      maxBudget: keepBudget(intent, current.maxBudget),
    }));
  }

  const localityId = `${ids}-locality`;
  const typeId = `${ids}-type`;
  const bedroomsId = `${ids}-bedrooms`;
  const budgetId = `${ids}-budget`;
  const popularId = `${ids}-popular`;
  const quickId = `${ids}-quick`;

  return (
    <div
      data-slot="search-card"
      data-layout={layout}
      className={cn("@container w-full", className)}
    >
      <form
        role="search"
        aria-label={translate("domain.searchCard.label")}
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
        className="flex flex-wrap items-center gap-x-3 gap-y-3 rounded-xl border border-line bg-surface p-3 text-left shadow-float @xl:p-4"
      >
        <SegmentedControl
          aria-label={translate("domain.searchCard.intentLabel")}
          value={values.intent}
          onValueChange={chooseIntent}
          className="order-1 w-full @max-xs:[&>*]:px-3 @xl:w-auto"
          options={[
            { value: "buy", label: translate("domain.searchCard.buy") },
            { value: "rent", label: translate("domain.searchCard.rent") },
            {
              href: projectsHref,
              label: (
                <>
                  {translate("domain.searchCard.newProjects")}
                  <Icon icon={ArrowRight} size="sm" />
                </>
              ),
            },
          ]}
        />

        {aiSearchHref ? (
          <Link
            href={aiSearchHref}
            variant="nav"
            className="order-3 inline-flex min-h-9 w-full items-center justify-center gap-2 rounded-sm px-2 text-small font-semibold text-cta-text no-underline hover:bg-cta-tint hover:text-cta-text @xl:order-2 @xl:ml-auto @xl:w-auto"
          >
            <Icon icon={Sparkles} size="sm" />
            {translate("domain.searchCard.describeInWords")}
          </Link>
        ) : null}

        <div
          className={cn(
            "order-2 grid w-full grid-cols-6 gap-2 @xl:order-3 @xl:gap-3",
            wide &&
              "@4xl:flex @4xl:items-stretch @4xl:gap-0 @4xl:overflow-hidden @4xl:rounded-lg @4xl:border-[length:var(--bw-field)] @4xl:border-line-input @4xl:bg-surface",
          )}
        >
          <div
            className={cn(
              fieldBox(wide),
              "col-span-6 px-3 @xl:col-span-4 @xl:row-start-1",
              wide && "@4xl:flex-[1.7]",
            )}
            onKeyDown={onLocalityKeyDown}
          >
            <FieldLabel htmlFor={localityId} full={translate("domain.searchCard.locality.label")} />
            <Combobox
              id={localityId}
              aria-label={translate("domain.searchCard.locality.label")}
              placeholder={translate("domain.searchCard.locality.placeholder")}
              icon={MapPin}
              value={values.locality}
              onValueChange={(text) => setValues((current) => ({ ...current, locality: text }))}
              onQueryChange={onLocalityQueryChange}
              onSelect={() => {
                justPicked.current = true;
                queueMicrotask(() => {
                  justPicked.current = false;
                });
              }}
              options={localityOptions}
              loading={localityLoading}
              minChars={localityMinChars}
              labels={{
                clear: translate("domain.searchCard.locality.clear"),
                loading: translate("domain.searchCard.locality.loading"),
                noResults: translate("domain.searchCard.locality.noResults"),
                resultCount: (count) =>
                  translate("domain.searchCard.locality.resultCount", { count }),
              }}
              // The box is drawn by the field, and the combobox is pulled out over the field's padding so
              // the pin lines up with the label above it.
              className={cn("-mx-3 w-auto @xl:-mx-4", wide && "@4xl:-mx-5")}
              inputClassName="h-6 min-h-0 border-0 bg-transparent text-small font-semibold @xl:text-body hover:border-0 focus-visible:border-0 focus-visible:outline-0"
            />
          </div>

          <SelectField
            id={typeId}
            fullLabel={translate("domain.searchCard.propertyType.label")}
            shortLabel={translate("domain.searchCard.propertyType.shortLabel")}
            value={values.propertyType ?? ""}
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                propertyType: parsePropertyType(event.target.value),
              }))
            }
            wide={wide}
            className={cn("col-span-2 @xl:row-start-2", wide && "@4xl:flex-[1.05]")}
          >
            <option value="">{translate("domain.searchCard.propertyType.any")}</option>
            {PROPERTY_TYPES.map((type) => (
              <option key={type} value={type}>
                {translate(PROPERTY_TYPE_WORDS[type])}
              </option>
            ))}
          </SelectField>

          <SelectField
            id={bedroomsId}
            fullLabel={translate("domain.searchCard.bedrooms.label")}
            value={values.bedrooms === null ? "" : String(values.bedrooms)}
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                bedrooms: parseBedrooms(event.target.value),
              }))
            }
            wide={wide}
            className={cn("col-span-2 @xl:row-start-2", wide && "@4xl:flex-[0.8]")}
          >
            <option value="">{translate("domain.searchCard.bedrooms.any")}</option>
            {BEDROOM_CHOICES.map((count) => (
              <option key={count} value={count}>
                {translate("property.bhk", { count })}
              </option>
            ))}
          </SelectField>

          <SelectField
            id={budgetId}
            fullLabel={translate("domain.searchCard.budget.label")}
            shortLabel={translate("domain.searchCard.budget.shortLabel")}
            value={values.maxBudget === null ? "" : String(values.maxBudget)}
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                maxBudget: parseBudget(current.intent, event.target.value),
              }))
            }
            wide={wide}
            className={cn("col-span-2 @xl:row-start-2", wide && "@4xl:flex-[1.15] @4xl:border-r-0")}
          >
            <option value="">{translate("domain.searchCard.budget.any")}</option>
            {budgetStepsFor(values.intent).map((rupees) => (
              <option key={rupees} value={rupees}>
                {translate("domain.searchCard.budget.upTo", {
                  amount: formatPrice(translate, locale, rupees),
                })}
              </option>
            ))}
          </SelectField>

          <Button
            type="submit"
            variant="accent"
            size="lg"
            iconStart={<Icon icon={Search} />}
            className={cn(
              "col-span-6 @xl:col-span-2 @xl:row-start-1 @xl:h-14",
              wide && "@4xl:m-2 @4xl:h-auto @4xl:flex-none @4xl:px-8",
            )}
          >
            {translate("domain.searchCard.search")}
          </Button>
        </div>

        {popularShown.length > 0 || quickPicks.length > 0 ? (
          <div className="order-4 hidden w-full flex-wrap items-center gap-2 px-1 pt-1 @xl:flex">
            {/* The groups take no box of their own, so the chips flow as one row and wrap together. */}
            {popularShown.length > 0 ? (
              <div role="group" aria-labelledby={popularId} className="contents">
                <span id={popularId} className="text-caption font-medium text-muted">
                  {translate("domain.searchCard.popular")}
                </span>
                {popularShown.map((link) => (
                  <Chip key={link.href} asChild size="sm">
                    <Link
                      href={link.href}
                      variant="nav"
                      className="no-underline hover:no-underline"
                    >
                      {link.label}
                    </Link>
                  </Chip>
                ))}
              </div>
            ) : null}
            {popularShown.length > 0 && quickPicks.length > 0 ? (
              <span aria-hidden="true" className="mx-2 h-4 w-px bg-line-strong" />
            ) : null}
            {quickPicks.length > 0 ? (
              <div role="group" aria-labelledby={quickId} className="contents">
                <span id={quickId} className="text-caption font-medium text-muted">
                  {translate("domain.searchCard.quickPicks")}
                </span>
                {quickPicks.map((link) => (
                  <Chip key={link.href} asChild size="sm">
                    <Link
                      href={link.href}
                      variant="nav"
                      className="no-underline hover:no-underline"
                    >
                      {link.label}
                    </Link>
                  </Chip>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </form>
    </div>
  );
}

export { SearchCard };
export type { SearchCardProps, SearchLink, SearchValues };
