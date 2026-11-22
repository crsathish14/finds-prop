import { CityPicker, getListedCities, getSelectedCity } from "@/features/cities";
import { getTranslate } from "./translator";

/** The city selector for the header. Reads the cookie, so the header puts it inside a Suspense boundary. */
export async function HeaderCity() {
  const translate = await getTranslate();
  const [selected, cities] = await Promise.all([getSelectedCity(), getListedCities()]);
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
