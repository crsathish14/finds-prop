"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { FilterRail, FilterSheet, type PlaceFieldSlot } from "@/components/domain/filters";
import { ActiveFilters, LabelFilter, ResultsBar } from "@/components/domain/results-bar";
import {
  ResultsEmpty,
  ResultsError,
  ResultsGrid,
  ResultsLoadMore,
  ResultsSkeleton,
} from "@/components/domain/results-list";
import {
  RADIUS_CHOICES_KM,
  sortOptionsFor,
  type FilterValues,
  type RadiusChoice,
  type SortOption,
} from "@/config/search-options";
import type { Translate } from "@/lib/format";
import type { CuratedLocality } from "./from-card";
import { clearSearchFilters, hasSearchPlace } from "./params";
import { PlaceBox } from "./place-box.client";
import {
  appliedFilters,
  atShowLimit,
  changeSearch,
  filterValuesFromParams,
  nextShow,
  searchFromFilterValues,
  withLabel,
  withoutFilter,
} from "./results-view";
import { useSearchNavigation } from "./search-navigation.client";

/**
 * The parts of the results page that change the address (ADR-042): the filter rail (wide screens),
 * the bar with its chips (sort, view, the phone sheet, applied filters, the label choice) and the
 * list with its states. They hold no search of their own: every choice goes through
 * `useSearchNavigation`, and what they show is read from the parsed address.
 */

type FilterSource = {
  localities: readonly CuratedLocality[];
  allLocalitiesLabel: string;
};

function same(first: FilterValues, second: FilterValues): boolean {
  return (
    first.intent === second.intent &&
    first.locality === second.locality &&
    first.point?.lat === second.point?.lat &&
    first.point?.lng === second.point?.lng &&
    first.propertyType === second.propertyType &&
    first.bedrooms === second.bedrooms &&
    first.maxBudget === second.maxBudget &&
    (first.radiusKm ?? null) === (second.radiusKm ?? null) &&
    first.sort === second.sort
  );
}

/**
 * The Locality field of the filters: the place search box (ADR-136). In the Design Lab (`preview`) the
 * pictured Locality list stays, so nothing there calls the route.
 */
function placeFieldFor(
  preview: boolean,
  applyWhileTyping: boolean,
): { placeField?: PlaceFieldSlot } {
  if (preview) return {};
  return {
    placeField: (field) => <PlaceBox {...field} applyWhileTyping={applyWhileTyping} />,
  };
}

/**
 * What a place search adds to the filters (ADR-137): the "Search within" distances and the "Nearest
 * first" order, only while a place is searched. Nothing in the Design Lab (`preview`), whose pictures
 * stay as they were approved; its "Nearby homes" entry draws these parts on its own.
 */
function placeChoicesFor(
  placed: boolean,
  preview: boolean,
): { radiusChoices?: readonly RadiusChoice[]; sortOptions: readonly SortOption[] } {
  const live = placed && !preview;
  return {
    ...(live ? { radiusChoices: RADIUS_CHOICES_KM } : {}),
    sortOptions: sortOptionsFor(live),
  };
}

/** The filter panel beside the results on a wide screen (hidden below 1024 px). */
export function ResultsRail({ localities, allLocalitiesLabel }: FilterSource) {
  const { params, go, preview } = useSearchNavigation();
  const { radiusChoices } = placeChoicesFor(hasSearchPlace(params), preview);
  return (
    <FilterRail
      {...placeFieldFor(preview, false)}
      {...(radiusChoices === undefined ? {} : { radiusChoices })}
      values={filterValuesFromParams(params)}
      onChange={(values) => go(searchFromFilterValues(params, values, localities))}
      onClearAll={() => go(clearSearchFilters(params))}
      localities={localities.map((place) => place.label)}
      allLocalitiesLabel={allLocalitiesLabel}
      budgetNeedsLooking
      className="hidden lg:flex"
    />
  );
}

/** The bar above the results: sort, view, the phone filter sheet, the applied chips, the labels. */
export function ResultsToolbar({
  localities,
  allLocalitiesLabel,
  total,
}: FilterSource & { total: number | null }) {
  const { params, go, pending, preview } = useSearchNavigation();
  const translate = useTranslations() as unknown as Translate;
  const locale = useLocale();
  const values = filterValuesFromParams(params);
  // The count on the sheet's button is true only while the choices in it are the ones applied.
  const [draft, setDraft] = useState<FilterValues | null>(null);
  const choices = placeChoicesFor(hasSearchPlace(params), preview);
  const resultCount = total !== null && (draft === null || same(draft, values)) ? total : null;

  return (
    <div aria-busy={pending}>
      <ResultsBar
        sort={params.sort}
        sortOptions={choices.sortOptions}
        onSortChange={(sort) => go(changeSearch(params, { sort }))}
        view={params.view}
        onViewChange={(view) => go(changeSearch(params, { view }))}
        filters={
          <FilterSheet
            {...placeFieldFor(preview, true)}
            {...(choices.radiusChoices === undefined
              ? {}
              : { radiusChoices: choices.radiusChoices })}
            sortOptions={choices.sortOptions}
            values={values}
            onApply={(next) => go(searchFromFilterValues(params, next, localities), "push")}
            onDraftChange={setDraft}
            localities={localities.map((place) => place.label)}
            allLocalitiesLabel={allLocalitiesLabel}
            resultCount={resultCount}
            budgetNeedsLooking
          />
        }
      >
        <ActiveFilters
          filters={appliedFilters(params, translate, locale)}
          onRemove={(id) => go(withoutFilter(params, id))}
          onClearAll={() => go(clearSearchFilters(params))}
        />
        <LabelFilter
          value={params.label ?? "all"}
          onChange={(label) => go(withLabel(params, label))}
        />
      </ResultsBar>
    </div>
  );
}

/**
 * The results and what stands in for them: the loading skeleton while a new page is on its way, the
 * failed-load alert, the empty state, or the cards (given by the server) with "Show more". After
 * "Show more" keyboard focus moves to the first new card (frontend.md 6.2).
 */
export function ResultsList({
  status,
  total,
  shown,
  describeHref,
  children,
}: {
  status: "ok" | "failed";
  total: number;
  shown: number;
  describeHref?: string | undefined;
  children: ReactNode;
}) {
  const { params, go, pending, pendingMore, retry } = useSearchNavigation();
  const listing = useRef<HTMLDivElement>(null);
  // The number of cards on screen when "Show more" was pressed, until the longer list has arrived.
  const moreFrom = useRef<number | null>(null);

  // When the longer list arrives, focus the first of the new cards (frontend.md 6.2).
  useEffect(() => {
    const from = moreFrom.current;
    if (from === null || pending || shown <= from) return;
    moreFrom.current = null;
    // The Nth card, not the Nth child: a sponsored banner can sit among the cards (S4-T07).
    const card = listing.current?.querySelectorAll("[data-slot=property-card]")[from];
    card?.querySelector<HTMLElement>("a")?.focus();
  }, [pending, shown]);

  function refine() {
    window.scrollTo({ top: 0 });
    document.getElementById("results-title")?.focus();
  }

  // A new search shows the skeleton; a longer list keeps the cards and only the button waits.
  if (pending && !pendingMore) {
    return <ResultsSkeleton view={params.view} count={Math.min(6, Math.max(3, shown))} />;
  }
  if (status === "failed") return <ResultsError onRetry={retry} />;
  if (total === 0) {
    return (
      <ResultsEmpty onClearAll={() => go(clearSearchFilters(params))} describeHref={describeHref} />
    );
  }
  return (
    <div ref={listing} className="flex flex-col gap-8">
      <ResultsGrid view={params.view}>{children}</ResultsGrid>
      <ResultsLoadMore
        shown={shown}
        total={total}
        loading={pendingMore}
        atLimit={atShowLimit(params.show)}
        onRefine={refine}
        onShowMore={() => {
          moreFrom.current = shown;
          go(changeSearch(params, { show: nextShow(params.show) }));
        }}
      />
    </div>
  );
}

/**
 * The "Also near" section under the list (ADR-137). It is drawn by the server and given here only so it
 * can step aside while a new search is on its way, as the list does: the old nearby homes never stand
 * under the new search's skeleton.
 */
export function ResultsNearby({ children }: { children: ReactNode }) {
  const { pending, pendingMore } = useSearchNavigation();
  if (pending && !pendingMore) return null;
  return <>{children}</>;
}
