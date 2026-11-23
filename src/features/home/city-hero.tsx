import { Suspense, type ReactNode } from "react";
import { getSelectedCity } from "@/features/cities";

/**
 * The homepage hero for the city the visitor chose in the header (owner, 24 Nov). The city is a cookie,
 * so the hero is read behind its own Suspense boundary and the rest of the page stays in the static shell.
 * The fallback is the hero for the site's own region, which is what the shell holds and what the page
 * shows until the city is read. `render` gets the region name to name (the city, or the site's region in
 * the fallback) and returns the hero.
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
  const city = await getSelectedCity();
  return render(city.name);
}
