import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { logger } from "@/server/logger";
import { createPublicSupabase } from "@/server/supabase/public";
import { withDefaultCity, type CityOption } from "./list";
import { cityRowSchema } from "./schemas";

/**
 * The cities that have at least one approved home, most homes first, read as a visitor through
 * `listed_cities()`. The default city is always in the list. A failed read is logged by its code only and
 * leaves just the default city, so the header still works.
 */
export async function getListedCities(): Promise<CityOption[]> {
  "use cache";
  cacheTag(CACHE_TAGS.listings);
  cacheLife("minutes");
  const { data, error } = await createPublicSupabase().rpc("listed_cities");
  if (error) {
    logger.error("the city list could not be read, only the default city is offered", {
      errorCode: error.code,
    });
    return withDefaultCity([]);
  }
  const cities: CityOption[] = [];
  for (const row of data ?? []) {
    const parsed = cityRowSchema.safeParse(row);
    if (parsed.success) {
      cities.push({
        key: parsed.data.key,
        name: parsed.data.name,
        count: parsed.data.listing_count,
      });
    }
  }
  return withDefaultCity(cities);
}
