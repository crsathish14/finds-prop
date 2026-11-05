import "server-only";
import { getProperty, type PropertyData } from "@/features/property";

/**
 * The homes of a comparison, in the order of the ids: each read the way the property page reads it (as
 * a visitor, approved homes only, cached for minutes), so the two cannot disagree. A home that is not
 * there any more (sold, rented, withdrawn, never listed) is left out, never an error: a shared link to a
 * comparison keeps working with the homes that remain. A read that fails throws, as the property page's
 * does, and the route's error screen answers it.
 */
export async function getComparedProperties(ids: readonly string[]): Promise<PropertyData[]> {
  const results = await Promise.all(ids.map((id) => getProperty(id)));
  return results.flatMap((result) => (result.status === "found" ? [result.property] : []));
}
