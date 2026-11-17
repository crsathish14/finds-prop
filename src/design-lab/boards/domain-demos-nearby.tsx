"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { FilterRail } from "@/components/domain/filters";
import { NearbySection } from "@/components/domain/nearby-section";
import { usePlacePanel } from "@/components/domain/place-panel";
import { PropertyCard, type PropertyCardData } from "@/components/domain/property-card";
import { ResultsGrid } from "@/components/domain/results-list";
import { Combobox, type ComboboxOption } from "@/components/patterns/combobox";
import { Text } from "@/components/ui/text";
import { RADIUS_CHOICES_KM, type FilterValues } from "@/config/search-options";
import type { Translate } from "@/lib/format";
import { Specimen } from "../frame";
import { RENT_PRIME, SALE_BUDGET, SALE_FEATURED } from "./domain-demos";

const LOCALITIES = ["Velachery", "Adyar", "Perungudi"];

const VELACHERY: ComboboxOption[] = [
  { value: "velachery", label: "Velachery", description: "Chennai, Tamil Nadu · 600042" },
  {
    value: "velachery-main-road",
    label: "Velachery Main Road",
    description: "Velachery, Chennai · 600042",
  },
  { value: "vellore", label: "Vellore", description: "Vellore, Tamil Nadu" },
];

const FILLED: FilterValues = {
  intent: "buy",
  locality: null,
  propertyType: "apartment",
  bedrooms: 3,
  maxBudget: 1_50_00_000,
  sort: "newest",
  radiusKm: 5,
};

/** The place search box as the rail holds it: the panel opens under it. */
function RailPlaceBox({ open }: { open: boolean }) {
  const [text, setText] = useState(open ? "Vel" : "Velachery, Chennai");
  const panel = usePlacePanel("ready", text);
  return (
    <Combobox
      aria-label="Locality"
      value={text}
      onValueChange={setText}
      onQueryChange={() => undefined}
      onSelect={() => undefined}
      options={open ? VELACHERY : []}
      {...panel}
      defaultOpen={open}
    />
  );
}

function RailHost({ open, radiusKm }: { open: boolean; radiusKm: FilterValues["radiusKm"] }) {
  const [values, setValues] = useState<FilterValues>({ ...FILLED, radiusKm });
  return (
    <FilterRail
      values={values}
      onChange={setValues}
      localities={LOCALITIES}
      allLocalitiesLabel="All of Chennai"
      placeField={<RailPlaceBox open={open} />}
      radiusChoices={RADIUS_CHOICES_KM}
    />
  );
}

function withDistance(
  property: PropertyCardData,
  translate: Translate,
  distance: string,
  approximate = false,
): PropertyCardData {
  return {
    ...property,
    distanceText: translate(
      approximate ? "domain.propertyCard.distanceApprox" : "domain.propertyCard.distanceAway",
      { distance },
    ),
  };
}

export function NearbyDemo() {
  const translate = useTranslations() as unknown as Translate;
  const near = [
    withDistance(SALE_FEATURED, translate, "1.2"),
    withDistance(SALE_BUDGET, translate, "2.4"),
    withDistance(RENT_PRIME, translate, "4.1", true),
  ];
  const further = [
    withDistance(SALE_BUDGET, translate, "7.8"),
    withDistance(RENT_PRIME, translate, "9.3"),
    withDistance(SALE_FEATURED, translate, "12.6", true),
  ];
  return (
    <div className="flex flex-col gap-10">
      <Text tone="muted">
        A place search adds three things (ADR-131, OLA_MAPS_PLAN.md D5): a &ldquo;Search
        within&rdquo; choice in the filter rail and sheet (2, 5, 10 or 15 km, 5 by default), the
        distance on each card, and, when the first circle has only a few homes, an &ldquo;Also
        near&rdquo; section with homes from the wider circle, nearest first. These parts are drawn
        from existing components; the wording and the look are for approval.
      </Text>
      <div className="flex flex-wrap items-start gap-x-8 gap-y-8">
        <Specimen label="Filter rail with a place chosen and the distance choices (5 km)">
          <div className="w-70 max-w-full">
            <RailHost open={false} radiusKm={5} />
          </div>
        </Specimen>
        <Specimen label="Rail, 15 km chosen, the place panel open">
          <div className="h-170 w-70 max-w-full">
            <RailHost open radiusKm={15} />
          </div>
        </Specimen>
      </div>
      <Specimen label="Cards with their distance (the last one is approximate: the owner gave only the locality)">
        <div className="w-full max-w-5xl">
          <ResultsGrid view="grid">
            {near.map((property) => (
              <PropertyCard
                key={property.href + (property.distanceText ?? "")}
                property={property}
              />
            ))}
          </ResultsGrid>
        </div>
      </Specimen>
      <Specimen label="Also near: homes from the wider circle under the first results">
        <div className="w-full max-w-5xl">
          <NearbySection place="Velachery" radiusKm={15} count={further.length}>
            {further.map((property) => (
              <PropertyCard
                key={property.href + (property.distanceText ?? "")}
                property={property}
              />
            ))}
          </NearbySection>
        </div>
      </Specimen>
      <Specimen label="Also near, list layout, one home">
        <div className="w-full max-w-5xl">
          <NearbySection place="Velachery" radiusKm={10} count={1} view="list">
            <PropertyCard property={withDistance(SALE_BUDGET, translate, "6.7")} layout="list" />
          </NearbySection>
        </div>
      </Specimen>
    </div>
  );
}
