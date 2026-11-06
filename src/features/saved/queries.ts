import "server-only";
import { z } from "zod";
import { getProperty, type PropertyData } from "@/features/property";
import { logger } from "@/server/logger";
import { createServerSupabase } from "@/server/supabase/server";

/** How many saved homes the dashboard reads; the newest first. */
export const SAVED_LIMIT = 60;

const savedRowSchema = z.object({
  properties: z.object({ short_id: z.string() }),
});

/**
 * The short ids of the visitor's saved homes that they can still see, newest first. The inner join
 * drops a saved home the database no longer shows (sold, rented, withdrawn), so it leaves the list
 * without a word, as the sold-homes rule asks. A failed read throws: the error page shows it.
 */
export async function savedShortIds(): Promise<string[]> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("saved_properties")
    .select("created_at, properties!inner(short_id)")
    .order("created_at", { ascending: false })
    .limit(SAVED_LIMIT);
  if (error) {
    logger.error("saved homes could not be read", { errorCode: error.code });
    throw error;
  }
  const ids: string[] = [];
  for (const row of data ?? []) {
    const parsed = savedRowSchema.safeParse(row);
    if (parsed.success) ids.push(parsed.data.properties.short_id);
  }
  return ids;
}

/** The homes the visitor saved, as the property read gives them (public only, cached like any home). */
export async function savedHomes(): Promise<PropertyData[]> {
  const ids = await savedShortIds();
  const results = await Promise.all(ids.map((shortId) => getProperty(shortId)));
  return results.flatMap((result) => (result.status === "found" ? [result.property] : []));
}
