/**
 * ResultsBar, ActiveFilters, LabelFilter: the bar above the results of a search.
 * Purpose: the sort order and the grid or list choice (ResultsBar), what is applied with a way to take
 *   each filter off (ActiveFilters), and the quick Featured / Prime / Budget choice (LabelFilter).
 *   Owner: design system. All three are controlled: values in, the choice out; they build no address
 *   (S4-T04 step C joins them to it) and fetch nothing.
 * Props:
 *   ResultsBar: sort and onSortChange, view ("grid" | "list") and onViewChange, filters (the
 *     "Filters (n)" button, drawn below 1024 px only; the wide rail takes its place), children (the
 *     rows under the bar: active filters, label choice), className.
 *   ActiveFilters: filters ([{ id, label }], already-translated text), onRemove(id), onClearAll.
 *     Draws nothing when there are no filters.
 *   LabelFilter: value ("all" | "featured" | "prime" | "budget"), onChange.
 * Responsive: the sort label shows from 768 px up to 1024 px (wide screens have the rail beside it, and the label
 *   is read by screen readers only); the grid and list toggle is hidden on a phone, as drawn.
 * Accessibility: the sort is a real select named "Sort by"; the toggle is a named radio group whose
 *   items are named "Grid view" and "List view"; every chip has its own remove button named for the
 *   filter ("Remove filter: 3 BHK"); the label choice is a group of toggle chips with aria-pressed.
 * States: default; a chip set with and without filters; the label choice on each value.
 * Dependencies: NativeSelect, SegmentedControl, RemovableChip, Chip, Button, search-options, next-intl.
 * Tests: results.test.tsx; Design Lab "Domain" (S4-T04).
 * UX reference: search screen, results bar (.rbar, .sortsel, .view-toggle, .active-chips, quick label
 *   filter). Not as drawn: the open sort list is the browser's own list (like the sheet's), the
 *   chips are 40 px tall (the UX draws a smaller size), and the UX's "Proposed" flag is a design
 *   note, not part of the screen.
 */
import { LayoutGrid, List } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Icon } from "@/components/ui/icon";
import { NativeSelect } from "@/components/ui/native-select";
import { RemovableChip } from "@/components/ui/removable-chip";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { cn } from "@/lib/cn";
import { parseSort, SORT_OPTIONS, SORT_WORDS, type SortOption } from "@/config/search-options";

type ResultsView = "grid" | "list";

type ResultsBarProps = {
  sort: SortOption;
  onSortChange: (sort: SortOption) => void;
  view: ResultsView;
  onViewChange: (view: ResultsView) => void;
  filters?: ReactNode;
  children?: ReactNode;
  className?: string;
};

function ResultsBar({
  sort,
  onSortChange,
  view,
  onViewChange,
  filters,
  children,
  className,
}: ResultsBarProps) {
  const translate = useTranslations();
  const sortId = useId();
  return (
    <div data-slot="results-bar" className={cn("flex flex-col gap-3", className)}>
      <div className="flex items-center justify-between gap-3">
        {filters ? <div className="lg:hidden">{filters}</div> : null}
        <div className="ml-auto flex min-w-0 flex-1 items-center justify-end gap-3 md:flex-none">
          <label
            htmlFor={sortId}
            className="sr-only text-small font-semibold whitespace-nowrap text-muted md:not-sr-only lg:sr-only"
          >
            {translate("domain.filters.sortLabel")}
          </label>
          <div className="min-w-0 flex-1 md:w-52 md:flex-none">
            <NativeSelect
              id={sortId}
              value={sort}
              onChange={(event) => onSortChange(parseSort(event.target.value))}
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {translate(SORT_WORDS[option])}
                </option>
              ))}
            </NativeSelect>
          </div>
          <SegmentedControl
            size="sm"
            aria-label={translate("domain.results.view.label")}
            className="hidden md:inline-flex"
            value={view}
            onValueChange={(next) => onViewChange(next === "list" ? "list" : "grid")}
            options={[
              {
                value: "grid",
                label: (
                  <>
                    <Icon icon={LayoutGrid} size="sm" />
                    <span className="sr-only">{translate("domain.results.view.grid")}</span>
                  </>
                ),
              },
              {
                value: "list",
                label: (
                  <>
                    <Icon icon={List} size="sm" />
                    <span className="sr-only">{translate("domain.results.view.list")}</span>
                  </>
                ),
              },
            ]}
          />
        </div>
      </div>
      {children}
    </div>
  );
}

type ActiveFilter = { id: string; label: string };

type ActiveFiltersProps = {
  filters: readonly ActiveFilter[];
  onRemove: (id: string) => void;
  onClearAll: () => void;
  className?: string;
};

function ActiveFilters({ filters, onRemove, onClearAll, className }: ActiveFiltersProps) {
  const translate = useTranslations();
  if (filters.length === 0) return null;
  return (
    <div
      data-slot="active-filters"
      role="group"
      aria-label={translate("domain.results.active.label")}
      className={cn("flex flex-wrap items-center gap-2", className)}
    >
      {filters.map((filter) => (
        <RemovableChip
          key={filter.id}
          removeLabel={translate("domain.results.active.remove", { label: filter.label })}
          onRemove={() => onRemove(filter.id)}
        >
          {filter.label}
        </RemovableChip>
      ))}
      <Button variant="ghost" size="sm" onClick={onClearAll}>
        {translate("domain.filters.clearAll")}
      </Button>
    </div>
  );
}

const LABEL_CHOICES = [
  { value: "all", key: "domain.results.labels.all" },
  { value: "featured", key: "domain.propertyCard.label.featured" },
  { value: "prime", key: "domain.propertyCard.label.prime" },
  { value: "budget", key: "domain.propertyCard.label.budget" },
] as const;

type LabelChoice = (typeof LABEL_CHOICES)[number]["value"];

type LabelFilterProps = {
  value: LabelChoice;
  onChange: (value: LabelChoice) => void;
  className?: string;
};

function LabelFilter({ value, onChange, className }: LabelFilterProps) {
  const translate = useTranslations();
  return (
    <div
      data-slot="label-filter"
      role="group"
      aria-label={translate("domain.results.labels.label")}
      className={cn("flex flex-wrap items-center gap-2", className)}
    >
      <span className="text-small font-semibold text-muted">
        {translate("domain.results.labels.leadIn")}
      </span>
      {LABEL_CHOICES.map((choice) => (
        <Chip
          key={choice.value}
          size="sm"
          selected={value === choice.value}
          onClick={() => onChange(choice.value)}
        >
          {translate(choice.key)}
        </Chip>
      ))}
    </div>
  );
}

export { ActiveFilters, LabelFilter, ResultsBar };
export type { ActiveFilter, LabelChoice, ResultsView };
