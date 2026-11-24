"use client";

import {
  FeaturedProjectCard,
  type FeaturedProjectCardData,
} from "@/components/domain/featured-project-card";
import { Text } from "@/components/ui/text";
import { Specimen } from "../frame";

/**
 * The Featured project card (ADR-192): a project of a builder or agent the admin picked, after the sixth result in the
 * homes and projects lists. The photos are sample drawings and the details are samples, not a real project.
 */

const PHOTOS = "/design-lab/sponsor-photos";

const FULL: FeaturedProjectCardData = {
  href: "/projects/lakeview-residences",
  name: "Lakeview Residences",
  developerName: "Sample Homes",
  developerLogo: "/design-lab/logos/sample-builder.svg",
  locality: "Sholinganallur, OMR",
  bedrooms: [2, 3],
  areaMinSqft: 1120,
  areaMaxSqft: 1640,
  priceRupees: 7_800_000,
  priceType: null,
  status: "new_launch",
  possession: "2027-12-01",
  rera: true,
  highlights: ["Clubhouse, pool and gym", "Lake-facing walkway"],
  photos: [`${PHOTOS}/photo-a.svg`, `${PHOTOS}/photo-c.svg`, `${PHOTOS}/photo-b.svg`],
  photoCount: 7,
};

const BARE: FeaturedProjectCardData = {
  ...FULL,
  name: "Velachery One Grand Residences Phase Two",
  developerName: "Sample Developers and Promoters",
  developerLogo: null,
  locality: "Velachery",
  bedrooms: [3],
  areaMinSqft: null,
  areaMaxSqft: null,
  priceRupees: null,
  status: "ready_to_move",
  possession: null,
  rera: false,
  highlights: [],
  photos: [`${PHOTOS}/photo-c.svg`],
  photoCount: 1,
};

export function FeaturedProjectCardDemo() {
  return (
    <div className="flex flex-col gap-8">
      <Text tone="muted">
        Shown after the sixth result in the homes and projects lists, across the whole row. It is
        drawn only from what the builder or agent uploaded; the admin only picks them.
      </Text>
      <Specimen label="Every detail, three photos and more, the builder's logo" className="w-full">
        <FeaturedProjectCard project={FULL} className="w-full" />
      </Specimen>
      <Specimen
        label="Little given: one photo, no logo (initials), no price, size or RERA; a long name"
        className="w-full"
      >
        <FeaturedProjectCard project={BARE} className="w-full" />
      </Specimen>
    </div>
  );
}
