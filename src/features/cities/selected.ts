import "server-only";
import { cookies } from "next/headers";
import { CITY_COOKIE } from "./constants";
import { resolveCity, withDefaultCity, type CityOption } from "./list";
import { getListedCities } from "./queries";

/**
 * The visitor's city: the remembered one when it is still a listed city, else the default. Reading the
 * cookie makes the caller dynamic, so call this only inside a Suspense boundary.
 */
export async function getSelectedCity(): Promise<CityOption> {
  const store = await cookies();
  return resolveCity(store.get(CITY_COOKIE)?.value, await getListedCities());
}

/**
 * The city the visitor chose in the header, or nothing when they have not chosen one (no cookie, or a
 * city that is no longer listed). The hero and Browse by area use it: with no choice they keep the
 * site's own region, so a site with no region keeps its region-neutral wording (DEC-14). Reads the
 * cookie, so call it only inside a Suspense boundary.
 */
export async function getChosenCity(): Promise<CityOption | undefined> {
  const store = await cookies();
  const remembered = store.get(CITY_COOKIE)?.value;
  if (!remembered) return undefined;
  return withDefaultCity(await getListedCities()).find((city) => city.key === remembered);
}
