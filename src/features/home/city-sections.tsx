import { Suspense } from "react";
import { getSelectedCity } from "@/features/cities";
import { FeaturedSection, NewestSection } from "./card-sections";

/** Holds the place of a section while the visitor's city is read, so the page below does not jump. */
function SectionPlaceholder() {
  return <div aria-hidden="true" className="h-96" />;
}

async function FeaturedForCity() {
  const city = await getSelectedCity();
  return <FeaturedSection cityKey={city.key} />;
}

async function NewestForCity({ brandName }: { brandName: string }) {
  const city = await getSelectedCity();
  return <NewestSection brandName={brandName} cityKey={city.key} />;
}

/**
 * "Featured homes" for the city in the header. The city is a cookie, so the section is read behind its own
 * Suspense boundary and the rest of the homepage stays part of the static shell.
 */
export function CityFeaturedSection() {
  return (
    <Suspense fallback={<SectionPlaceholder />}>
      <FeaturedForCity />
    </Suspense>
  );
}

/** "Newest on findsprop" for the city in the header (see CityFeaturedSection). */
export function CityNewestSection({ brandName }: { brandName: string }) {
  return (
    <Suspense fallback={<SectionPlaceholder />}>
      <NewestForCity brandName={brandName} />
    </Suspense>
  );
}
