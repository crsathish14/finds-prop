import { compact, JSON_LD_CONTEXT, postalAddress, type JsonLdDocument } from "@/features/seo";
import type { ProjectData } from "./types";
import { projectMetaDescription } from "./view";

/** How many photos the data names; a project can hold many, a few are enough for a search result. */
const IMAGES_NAMED = 6;

/**
 * The structured data of a project's page (FR-PUB-14): an `ApartmentComplex` with its name, photos,
 * number of units, amenities and place. The place is the locality only (a project has no city of its
 * own); there is no street address or exact location, here or on the page (BR-94). Empty values are
 * left out.
 */
export function projectStructuredData(
  project: ProjectData,
  input: { url: string; images: readonly string[] },
): JsonLdDocument {
  return {
    "@context": JSON_LD_CONTEXT,
    "@type": "ApartmentComplex",
    ...compact({
      name: project.name,
      url: input.url,
      description: projectMetaDescription(project),
      image: input.images.slice(0, IMAGES_NAMED),
      numberOfAccommodationUnits:
        project.totalUnits !== null && project.totalUnits > 0 ? project.totalUnits : null,
      amenityFeature: project.amenities.map((name) => ({
        "@type": "LocationFeatureSpecification",
        name,
        value: true,
      })),
    }),
    address: postalAddress({ locality: project.locality }),
  };
}
