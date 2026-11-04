"use client";

import { useState } from "react";
import { CompareToggle, SaveButton } from "@/components/domain/property-card-controls.client";
import {
  PropertyCard,
  PropertyCardSkeleton,
  type PropertyCardData,
} from "@/components/domain/property-card";
import { Text } from "@/components/ui/text";
import { Column, Specimen } from "../frame";

const PICTURES = "/design-lab/listings";

export const SALE_FEATURED: PropertyCardData = {
  href: "#property-1",
  title: "3 BHK apartment with clubhouse and covered parking",
  locality: "Velachery",
  city: "Chennai",
  rupees: 1_25_00_000,
  listingType: "sale",
  bedrooms: 3,
  bathrooms: 2,
  areaSqft: 1420,
  label: "featured",
  listedAgo: "3 days ago",
  typeLabel: "Apartment",
  summary: "Apartment in Velachery, semi-furnished. Listed 3 days ago.",
  cover: { src: `${PICTURES}/home-a.svg`, alt: "Drawn placeholder: a house with a pitched roof" },
};

export const RENT_PRIME: PropertyCardData = {
  href: "#property-2",
  title: "Furnished 2 BHK close to the IT corridor",
  locality: "Perungudi",
  city: "Chennai",
  rupees: 32_000,
  listingType: "rent",
  bedrooms: 2,
  bathrooms: 2,
  areaSqft: 1150,
  label: "prime",
  listedAgo: "1 week ago",
  typeLabel: "Apartment",
  summary: "Apartment in Perungudi, fully furnished. Listed 1 week ago.",
  cover: { src: `${PICTURES}/home-b.svg`, alt: "Drawn placeholder: a house with a pitched roof" },
};

export const SALE_BUDGET: PropertyCardData = {
  href: "#property-3",
  title: "Bright 2 BHK, a short walk from the river",
  locality: "Adyar",
  city: "Chennai",
  rupees: 92_00_000,
  listingType: "sale",
  bedrooms: 2,
  bathrooms: 2,
  areaSqft: 1080,
  label: "budget",
  listedAgo: "2 days ago",
  typeLabel: "Apartment",
  summary: "Apartment in Adyar, unfurnished. Listed 2 days ago.",
  cover: { src: `${PICTURES}/home-c.svg`, alt: "Drawn placeholder: a house with a pitched roof" },
};

export const PLOT_NO_PICTURE: PropertyCardData = {
  href: "#property-4",
  title: "Residential plot in a gated layout",
  locality: "Sholinganallur",
  city: "Chennai",
  rupees: 58_00_000,
  listingType: "sale",
  areaSqft: 2400,
  listedAgo: "4 days ago",
  typeLabel: "Plot",
  summary: "Plot in Sholinganallur. Listed 4 days ago.",
};

const NOTHING_BUT_PRICE: PropertyCardData = {
  href: "#property-5",
  title: "Independent house, details to follow",
  locality: "Madurai",
  city: "Madurai",
  rupees: 15_000,
  listingType: "rent",
};

const LONG_TITLE: PropertyCardData = {
  ...SALE_FEATURED,
  href: "#property-6",
  title:
    "Spacious three bedroom apartment with a modular kitchen, a club house, a covered car park and a sunny balcony facing the park",
  locality: "Thiruvanmiyur Beach Road Extension",
  label: null,
};

/** A card wired to the heart and Compare the way a results page will do it. */
export function InteractiveCard({
  property,
  layout = "grid",
  startSaved = false,
  startCompared = false,
  compareDisabled = false,
}: {
  property: PropertyCardData;
  layout?: "grid" | "list";
  startSaved?: boolean;
  startCompared?: boolean;
  compareDisabled?: boolean;
}) {
  const [saved, setSaved] = useState(startSaved);
  const [compared, setCompared] = useState(startCompared);
  return (
    <PropertyCard
      property={property}
      layout={layout}
      compared={compared}
      // Eager, so the full-page screenshots of the board have every picture in them.
      priority
      save={<SaveButton saved={saved} onToggle={() => setSaved((value) => !value)} />}
      compare={
        <CompareToggle
          compared={compared}
          disabled={compareDisabled && !compared}
          onToggle={() => setCompared((value) => !value)}
        />
      }
    />
  );
}

export function PropertyCardDemo() {
  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-3">
        <Text variant="overline">Grid, as on the results page and the homepage</Text>
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          <InteractiveCard property={SALE_FEATURED} />
          <InteractiveCard property={RENT_PRIME} startSaved />
          <InteractiveCard property={SALE_BUDGET} startCompared />
        </div>
      </div>
      <div className="flex flex-col gap-3">
        <Text variant="overline">
          Hover lifts the card and zooms the picture; Tab reaches the title, the heart and Compare
        </Text>
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          <InteractiveCard property={SALE_BUDGET} compareDisabled />
          <InteractiveCard property={PLOT_NO_PICTURE} />
          <InteractiveCard property={NOTHING_BUT_PRICE} />
        </div>
      </div>
      <Specimen label="Long title and long locality (the title keeps two lines, the place truncates)">
        <div className="w-full max-w-sm">
          <InteractiveCard property={LONG_TITLE} />
        </div>
      </Specimen>
      <Specimen label="Loading: the same box, so nothing moves when the data arrives">
        <div className="grid w-full gap-5 md:grid-cols-2 xl:grid-cols-3">
          <PropertyCardSkeleton />
          <PropertyCardSkeleton />
          <PropertyCardSkeleton />
        </div>
      </Specimen>
    </div>
  );
}

export function PropertyCardListDemo() {
  return (
    <Column className="max-w-none gap-8">
      <Specimen label="List layout in a wide box: picture beside the text">
        <div className="w-full">
          <InteractiveCard property={SALE_FEATURED} layout="list" />
        </div>
      </Specimen>
      <Specimen label="The same list card in a narrow box: it stacks, because the card's own width decides">
        <div className="w-full max-w-sm">
          <InteractiveCard property={RENT_PRIME} layout="list" />
        </div>
      </Specimen>
      <Specimen label="List loading">
        <div className="w-full">
          <PropertyCardSkeleton layout="list" />
        </div>
      </Specimen>
    </Column>
  );
}
