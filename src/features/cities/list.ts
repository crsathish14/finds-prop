import { DEFAULT_CITY_KEY, DEFAULT_CITY_NAME } from "./constants";

/** One city of the dropdown: its key (what the filter and the cookie hold), its name and its approved homes. */
export type CityOption = { key: string; name: string; count: number };

/** The city list with the default city always in it, first when it has no homes yet. */
export function withDefaultCity(cities: CityOption[]): CityOption[] {
  if (cities.some((city) => city.key === DEFAULT_CITY_KEY)) return cities;
  return [{ key: DEFAULT_CITY_KEY, name: DEFAULT_CITY_NAME, count: 0 }, ...cities];
}

/** The city to use: the remembered one when it is a listed city, else the default. Never trusts the cookie. */
export function resolveCity(remembered: string | undefined, cities: CityOption[]): CityOption {
  const list = withDefaultCity(cities);
  const found = list.find((city) => city.key === remembered);
  if (found) return found;
  return (
    list.find((city) => city.key === DEFAULT_CITY_KEY) ?? {
      key: DEFAULT_CITY_KEY,
      name: DEFAULT_CITY_NAME,
      count: 0,
    }
  );
}
