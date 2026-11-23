import { Suspense } from "react";
import { getChosenCity, getSelectedCity } from "@/features/cities";
import { FeaturedSection, NewestSection, NewLaunchesSection } from "./card-sections";
import { BrowseSection } from "./sections";

/** Holds the place of a section while the visitor's city is read, so the page below does not jump. */
function SectionPlaceholder() {
  return <div aria-hidden="true" className="h-96" />;
}

async function FeaturedForCity() {
  const city = await getSelectedCity();
  return <FeaturedSection cityKey={city.key} />;
}

async function NewLaunchesForCity() {
  const city = await getSelectedCity();
  return <NewLaunchesSection cityKey={city.key} />;
}

async function NewestForCity({ brandName }: { brandName: string }) {
  const city = await getSelectedCity();
  return <NewestSection brandName={brandName} cityKey={city.key} />;
}

async function BrowseForCity({ siteRegion }: { siteRegion: string | undefined }) {
  const chosen = await getChosenCity();
  return <BrowseSection regionName={chosen?.name ?? siteRegion} />;
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

/** "Top developers" with the projects of the city in the header (see CityFeaturedSection). */
export function CityNewLaunchesSection() {
  return (
    <Suspense fallback={<SectionPlaceholder />}>
      <NewLaunchesForCity />
    </Suspense>
  );
}

/**
 * "Browse by area": the city the visitor chose in the header, or the site's region when none was chosen
 * (see CityFeaturedSection).
 */
export function CityBrowseSection({ siteRegion }: { siteRegion?: string | undefined }) {
  return (
    <Suspense fallback={<SectionPlaceholder />}>
      <BrowseForCity siteRegion={siteRegion} />
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
