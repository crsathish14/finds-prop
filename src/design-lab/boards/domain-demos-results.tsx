"use client";

import { useState } from "react";
import { FilterSheet } from "@/components/domain/filters";
import {
  ActiveFilters,
  LabelFilter,
  ResultsBar,
  type ActiveFilter,
  type LabelChoice,
  type ResultsView,
} from "@/components/domain/results-bar";
import {
  ResultsEmpty,
  ResultsError,
  ResultsGrid,
  ResultsLoadMore,
  ResultsSkeleton,
} from "@/components/domain/results-list";
import type { FilterValues, SortOption } from "@/config/search-options";
import { Specimen } from "../frame";
import { InteractiveCard, RENT_PRIME, SALE_BUDGET, SALE_FEATURED } from "./domain-demos";

const APPLIED: ActiveFilter[] = [
  { id: "locality", label: "Velachery" },
  { id: "propertyType", label: "Apartment" },
  { id: "bedrooms", label: "3 BHK" },
  { id: "maxBudget", label: "Up to ₹1.5 Cr" },
];

const FILTERS_FOR_BUTTON: FilterValues = {
  intent: "buy",
  locality: "Velachery",
  propertyType: "apartment",
  bedrooms: 3,
  maxBudget: 1_50_00_000,
  sort: "newest",
};

const WIDE = "w-full max-w-5xl";

function BarHost({
  withFilters,
  startEmpty = false,
}: {
  withFilters: boolean;
  startEmpty?: boolean;
}) {
  const [sort, setSort] = useState<SortOption>("newest");
  const [view, setView] = useState<ResultsView>("grid");
  const [label, setLabel] = useState<LabelChoice>("all");
  const [applied, setApplied] = useState<ActiveFilter[]>(startEmpty ? [] : APPLIED);
  return (
    <ResultsBar
      sort={sort}
      onSortChange={setSort}
      view={view}
      onViewChange={setView}
      {...(withFilters
        ? {
            filters: (
              <FilterSheet
                values={FILTERS_FOR_BUTTON}
                onApply={() => undefined}
                localities={["Velachery"]}
                allLocalitiesLabel="All of Chennai"
                resultCount={48}
              />
            ),
          }
        : {})}
    >
      <ActiveFilters
        filters={applied}
        onRemove={(id) => setApplied((current) => current.filter((item) => item.id !== id))}
        onClearAll={() => setApplied([])}
      />
      <LabelFilter value={label} onChange={setLabel} />
    </ResultsBar>
  );
}

function MoreHost() {
  const [shown, setShown] = useState(12);
  return (
    <ResultsLoadMore shown={shown} total={48} onShowMore={() => setShown((count) => count + 12)} />
  );
}

export function ResultsBarDemo() {
  return (
    <div className="flex flex-col gap-10">
      <Specimen
        label="With four filters applied and the Filters button (shown below 1024 px; a wide screen has the rail instead)"
        className={WIDE}
      >
        <BarHost withFilters />
      </Specimen>
      <Specimen label="No filter applied: no chips and no Clear all" className={WIDE}>
        <BarHost withFilters={false} startEmpty />
      </Specimen>
    </div>
  );
}

export function ResultsBodyDemo() {
  return (
    <div className="flex flex-col gap-10">
      <Specimen label="Grid view: 1, 2 and 3 across as the results area widens" className="w-full">
        <ResultsGrid view="grid" className="w-full">
          <InteractiveCard property={SALE_FEATURED} />
          <InteractiveCard property={RENT_PRIME} startSaved />
          <InteractiveCard property={SALE_BUDGET} startCompared />
        </ResultsGrid>
      </Specimen>
      <Specimen label="List view: one card per row" className="w-full">
        <ResultsGrid view="list" className="w-full">
          <InteractiveCard property={SALE_FEATURED} layout="list" />
          <InteractiveCard property={RENT_PRIME} layout="list" />
        </ResultsGrid>
      </Specimen>
      <Specimen label="Loading, grid (aria-busy, named Loading homes)" className="w-full">
        <ResultsSkeleton view="grid" count={3} className="w-full" />
      </Specimen>
      <Specimen label="Loading, list" className="w-full">
        <ResultsSkeleton view="list" count={2} className="w-full" />
      </Specimen>
      <div className="flex flex-wrap items-start gap-x-10 gap-y-8">
        <Specimen label="Show more: 12 of 48 (press it to see the count grow)">
          <MoreHost />
        </Specimen>
        <Specimen label="Show more: loading">
          <ResultsLoadMore shown={24} total={48} loading onShowMore={() => undefined} />
        </Specimen>
        <Specimen label="Show more: everything shown, no button">
          <ResultsLoadMore shown={48} total={48} onShowMore={() => undefined} />
        </Specimen>
        <Specimen label="Show more: at the 120-home cap, Refine your search">
          <ResultsLoadMore
            shown={120}
            total={300}
            atLimit
            onShowMore={() => undefined}
            onRefine={() => undefined}
          />
        </Specimen>
      </div>
      <Specimen
        label="Empty: with the AI search link (only when AI search is on)"
        className="w-full"
      >
        <ResultsEmpty onClearAll={() => undefined} describeHref="#ai-search" className="w-full" />
      </Specimen>
      <Specimen label="Empty: AI search off, no trace of the link" className="w-full">
        <ResultsEmpty onClearAll={() => undefined} className="w-full" />
      </Specimen>
      <Specimen label="Error: the filters are kept, Try again" className="w-full">
        <ResultsError onRetry={() => undefined} className="w-full" />
      </Specimen>
    </div>
  );
}
