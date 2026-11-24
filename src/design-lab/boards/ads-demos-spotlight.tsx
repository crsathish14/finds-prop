"use client";

import {
  DeveloperSpotlight,
  type DeveloperSpotlightData,
} from "@/components/domain/developer-spotlight";
import { Text } from "@/components/ui/text";
import { Specimen } from "../frame";

/**
 * The Developer spotlight (ADR-193): one builder or agent the admin picked, on the home page. The photos are sample
 * drawings and the details are samples, not a real developer.
 */

const PHOTOS = "/design-lab/sponsor-photos";

const FULL: DeveloperSpotlightData = {
  name: "Sample Homes",
  logo: "/design-lab/logos/sample-builder.svg",
  about: "Lake-side and garden communities across south Chennai.",
  years: 25,
  delivered: 42,
  listed: 6,
  launching: 3,
  website: "https://example.com",
  projects: [
    {
      href: "/projects/lakeview-residences",
      name: "Lakeview Residences",
      locality: "Sholinganallur, OMR",
      bedrooms: [2, 3],
      priceRupees: 7_800_000,
      priceType: "basic",
      status: "new_launch",
      cover: `${PHOTOS}/photo-a.svg`,
    },
    {
      href: "/projects/coastal-greens",
      name: "Coastal Greens",
      locality: "ECR",
      bedrooms: [4],
      priceRupees: 21_000_000,
      priceType: null,
      status: "ready_to_move",
      cover: `${PHOTOS}/photo-b.svg`,
    },
    {
      href: "/projects/velachery-one",
      name: "Velachery One",
      locality: "Velachery",
      bedrooms: [3],
      priceRupees: 12_000_000,
      priceType: "all_inclusive",
      status: "under_construction",
      cover: `${PHOTOS}/photo-c.svg`,
    },
  ],
};

const BARE: DeveloperSpotlightData = {
  name: "Sample Developers and Promoters of Chennai",
  logo: null,
  about: null,
  years: null,
  delivered: null,
  listed: 1,
  launching: 0,
  website: null,
  projects: [
    {
      href: "/projects/one",
      name: "Velachery One Grand Residences Phase Two",
      locality: "Velachery",
      bedrooms: [],
      priceRupees: null,
      priceType: null,
      status: null,
      cover: null,
    },
  ],
};

export function DeveloperSpotlightDemo() {
  return (
    <div className="flex flex-col gap-8">
      <Text tone="muted">
        A section of the home page, in the place the admin gives it in the section order. One picked
        developer per visit, drawn only from what they uploaded; the admin only picks them. On
        phones the projects scroll sideways.
      </Text>
      <Specimen
        label="Every detail: logo, tagline, figures, website, three projects"
        className="w-full"
      >
        <DeveloperSpotlight
          developer={FULL}
          headingId="lab-spot-full"
          eyebrowId="lab-spot-full-label"
        />
      </Specimen>
      <Specimen
        label="Little given: no logo (initials), no tagline, figures or website; one project with no photo or price; a long name"
        className="w-full"
      >
        <DeveloperSpotlight
          developer={BARE}
          headingId="lab-spot-bare"
          eyebrowId="lab-spot-bare-label"
        />
      </Specimen>
    </div>
  );
}
