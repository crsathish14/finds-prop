import { Suspense, type ReactNode } from "react";
import { getChosenCity } from "@/features/cities";

/**
 * The homepage hero for the city the visitor chose in the header (owner, 24 Nov). The city is a cookie,
 * so the hero is read behind its own Suspense boundary and the rest of the page stays in the static shell.
 * The fallback is the hero for the site's own region, which is what the shell holds and what the page
 * shows until the city is read. `render` gets the name to put in the headline: the chosen city, or
 * undefined when none was chosen, so the site's region is used (as before the header picker).
 */
export function CityHero({
  siteRegion,
  render,
}: {
  siteRegion: string | undefined;
  render: (regionName: string | undefined) => ReactNode;
}) {
  return (
    <Suspense fallback={render(siteRegion)}>
      <CityHeroReader render={render} />
    </Suspense>
  );
}

async function CityHeroReader({
  render,
}: {
  render: (regionName: string | undefined) => ReactNode;
}) {
  const chosen = await getChosenCity();
  return render(chosen?.name);
}
