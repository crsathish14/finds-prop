import {
  CityPicker,
  DEFAULT_CITY_KEY,
  getListedCities,
  getSelectedCity,
  type CityOption,
} from "@/features/cities";
import { getTranslate } from "./translator";

/** The city selector for the header. Reads the cookie, so the header puts it inside a Suspense boundary. */
export async function HeaderCity() {
  const translate = await getTranslate();
  const [chosen, listed] = await Promise.all([getSelectedCity(), getListedCities()]);
  // The default city is the site's own wording (en.json); the others are data and are shown as they are.
  const named = (city: CityOption): CityOption =>
    city.key === DEFAULT_CITY_KEY ? { ...city, name: translate("site.header.defaultCity") } : city;
  const selected = named(chosen);
  const cities = listed.map(named);
  return (
    <CityPicker
      cities={cities}
      selectedKey={selected.key}
      labels={{
        button: translate("site.header.cityButton", { city: selected.name }),
        heading: translate("site.header.cityHeading"),
      }}
    />
  );
}
