import { Suspense } from "react";
import { DeveloperSpotlight } from "@/components/domain/developer-spotlight";
import { HomeSection } from "@/components/domain/home-section";
import { getSelectedCity } from "@/features/cities";
import { getSpotlight } from "./spotlight-queries";

const HEADING_ID = "developer-spotlight-name";
const EYEBROW_ID = "developer-spotlight-label";

/** The spotlight of the visitor's city: one picked developer per visit, or nothing (no region, no gap). */
async function SpotlightForCity() {
  const city = await getSelectedCity();
  const developer = await getSpotlight(city.key);
  if (!developer) return null;
  return (
    <HomeSection labelledBy={`${EYEBROW_ID} ${HEADING_ID}`}>
      <DeveloperSpotlight developer={developer} headingId={HEADING_ID} eyebrowId={EYEBROW_ID} />
    </HomeSection>
  );
}

/**
 * The Developer spotlight on the home page (ADR-193). The city is a cookie and the developer is picked for each visit,
 * so it is read behind its own Suspense boundary and the rest of the home page stays part of the static shell. The
 * page renders it only when the admin picked someone; while it is read nothing holds its place, so a city with no
 * picked developer leaves no gap behind.
 */
export function SpotlightSection() {
  return (
    <Suspense fallback={null}>
      <SpotlightForCity />
    </Suspense>
  );
}
