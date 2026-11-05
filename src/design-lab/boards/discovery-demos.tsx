"use client";

import { CompareBarView } from "@/features/compare/compare-bar.client";
import type { CompareColumn } from "@/features/compare/table";
import { CompareScreen } from "@/features/compare/compare-screen";
import { CompareSkeleton } from "@/features/compare/compare-skeleton";
import type { CompareEntry } from "@/features/compare/store";
import { Specimen } from "../frame";

const PICTURES = "/design-lab/listings";

const ENTRIES: CompareEntry[] = [
  {
    id: "k3x9a2bd",
    title: "3 BHK apartment with clubhouse and covered parking",
    cover: `${PICTURES}/home-a.svg`,
  },
  {
    id: "m4y8b3ce",
    title: "Furnished 2 BHK close to the IT corridor",
    cover: `${PICTURES}/home-b.svg`,
  },
  {
    id: "n5z7c4dh",
    title: "Bright 2 BHK, a short walk from the river",
    cover: `${PICTURES}/home-c.svg`,
  },
];

const NOTHING = () => undefined;

function Bar({ count }: { count: number }) {
  return (
    <CompareBarView
      entries={ENTRIES.slice(0, count)}
      placement="inline"
      onRemove={NOTHING}
      onClear={NOTHING}
    />
  );
}

/** The bar in its three states; the real one is pinned to the bottom of the screen. */
export function CompareBarDemo() {
  return (
    <div className="flex flex-col gap-8">
      <Specimen
        label="One home chosen: Compare now is off and the bar asks for another"
        className="w-full"
      >
        <Bar count={1} />
      </Specimen>
      <Specimen label="Two homes chosen: Compare now leads to the comparison" className="w-full">
        <Bar count={2} />
      </Specimen>
      <Specimen
        label="Three chosen: every slot is full and the other cards' Compare is off"
        className="w-full"
      >
        <Bar count={3} />
      </Specimen>
    </div>
  );
}

const COLUMNS: CompareColumn[] = [
  {
    shortId: "k3x9a2bd",
    href: "#home-1",
    title: "3 BHK apartment with clubhouse and covered parking",
    listingType: "sale",
    price: 1_25_00_000,
    perSqftRupees: 8803,
    propertyType: "apartment",
    place: "Velachery, Chennai",
    areaSqft: 1420,
    bedrooms: 3,
    bathrooms: 2,
    furnishing: "semi",
    amenities: [
      "Gym",
      "Swimming Pool",
      "24x7 Security",
      "Car Park",
      "Lift",
      "Power Backup",
      "Clubhouse",
      "Near Metro",
    ],
    label: "featured",
    cover: `${PICTURES}/home-a.svg`,
  },
  {
    shortId: "m4y8b3ce",
    href: "#home-2",
    title: "Furnished 2 BHK close to the IT corridor",
    listingType: "rent",
    price: 32_000,
    perSqftRupees: undefined,
    propertyType: "apartment",
    place: "Perungudi, Chennai",
    areaSqft: 1150,
    bedrooms: 2,
    bathrooms: 2,
    furnishing: "full",
    amenities: ["24x7 Security", "Car Park", "Lift", "Power Backup", "Near Beach"],
    label: "prime",
    cover: `${PICTURES}/home-b.svg`,
  },
  {
    shortId: "n5z7c4dh",
    href: "#home-3",
    title: "Residential plot in a gated layout",
    listingType: "sale",
    price: 58_00_000,
    perSqftRupees: 2417,
    propertyType: "plot",
    place: "Sholinganallur, Chennai",
    areaSqft: 2400,
    bedrooms: null,
    bathrooms: null,
    furnishing: null,
    amenities: ["24x7 Security"],
    label: "budget",
    cover: `${PICTURES}/home-c.svg`,
  },
];

const FRAME = "w-full rounded-xl border border-line bg-canvas";

/** The comparison with three homes (the third a plot with little given), with one home, and loading. */
export function ComparePageDemo() {
  return (
    <div className="flex flex-col gap-14">
      <Specimen
        label="Three homes, side by side: a sale, a rent and a plot with details missing"
        className="w-full"
      >
        <div className={FRAME}>
          <CompareScreen titleAs="h2" columns={COLUMNS} preview />
        </div>
      </Specimen>
      <Specimen label="Fewer than two homes: choose at least two" className="w-full">
        <div className={FRAME}>
          <CompareScreen titleAs="h2" columns={COLUMNS.slice(0, 1)} preview />
        </div>
      </Specimen>
      <Specimen label="Loading" className="w-full">
        <div className={FRAME}>
          <CompareSkeleton />
        </div>
      </Specimen>
    </div>
  );
}
