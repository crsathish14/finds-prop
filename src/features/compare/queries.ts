import "server-only";
import { getProperty, type PropertyData } from "@/features/property";

/** The homes of a comparison and when the oldest of the reads behind them was taken. */
export type ComparedHomes = {
  /** Only the homes that are listed now, in the order of the ids. */
  readonly properties: PropertyData[];
  /** The oldest `readAt` among the reads (ISO time): the reads are cached, so the answer may be minutes old. */
  readonly readAt: string;
};

/**
 * The homes of a comparison with the time they were read, for a caller that must say how old the answer is
 * (the AI chat's `compare_properties`, ADR-128 section 13). Each home is read the way the property page
 * reads it (as a visitor, approved homes only, cached for minutes), so this and the page cannot disagree.
 * A home that is not there any more is left out, never an error. A read that fails throws.
 */
export async function getComparedHomes(ids: readonly string[]): Promise<ComparedHomes> {
  const results = await Promise.all(ids.map((id) => getProperty(id)));
  const readAt = results.reduce(
    (oldest, result) => (result.readAt < oldest ? result.readAt : oldest),
    results[0]?.readAt ?? new Date().toISOString(),
  );
  return {
    properties: results.flatMap((result) => (result.status === "found" ? [result.property] : [])),
    readAt,
  };
}

/**
 * The homes of a comparison, in the order of the ids: each read the way the property page reads it (as
 * a visitor, approved homes only, cached for minutes), so the two cannot disagree. A home that is not
 * there any more (sold, rented, withdrawn, never listed) is left out, never an error: a shared link to a
 * comparison keeps working with the homes that remain. A read that fails throws, as the property page's
 * does, and the route's error screen answers it.
 */
export async function getComparedProperties(ids: readonly string[]): Promise<PropertyData[]> {
  return (await getComparedHomes(ids)).properties;
}
