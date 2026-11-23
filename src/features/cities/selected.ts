import "server-only";
import { cookies } from "next/headers";
import { CITY_COOKIE } from "./constants";
import { resolveCity, type CityOption } from "./list";
import { getListedCities } from "./queries";

/**
 * The visitor's city: the remembered one when it is still a listed city, else the default. Reading the
 * cookie makes the caller dynamic, so call this only inside a Suspense boundary.
 */
export async function getSelectedCity(): Promise<CityOption> {
  const store = await cookies();
  return resolveCity(store.get(CITY_COOKIE)?.value, await getListedCities());
}
