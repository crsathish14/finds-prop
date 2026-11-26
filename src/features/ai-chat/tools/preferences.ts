import { z } from "zod";

/**
 * The preference inputs of the two search tools (ADR-205): what the customer would like but did not insist on. A
 * preference ranks the results; it never filters them. Each is a short list of short texts, checked here (the portable
 * schema has no length keywords, so the limits are also in each description).
 */

/** How many preferred localities and amenities one search takes, and the longest of each, in characters. */
export const PREFER_LOCALITIES_MAX = 5;
export const PREFER_AMENITIES_MAX = 8;
export const PREFER_LOCALITY_MAX_CHARACTERS = 80;
export const PREFER_AMENITY_MAX_CHARACTERS = 40;

const CONTROL_CHARACTER = /[\p{Cc}\p{Zl}\p{Zp}]/u;

/** A short list of short texts, each without control characters, or null. */
export const preferList = (maxItems: number, maxCharacters: number, description: string) =>
  z
    .array(z.string())
    .nullable()
    .refine(
      (value) =>
        value === null ||
        (value.length <= maxItems &&
          value.every(
            (item) =>
              item.trim().length > 0 &&
              item.trim().length <= maxCharacters &&
              !CONTROL_CHARACTER.test(item),
          )),
    )
    .describe(description);

/** The preferred localities: they rank higher, the others still show. */
export const preferLocalitiesInput = (what: string) =>
  preferList(
    PREFER_LOCALITIES_MAX,
    PREFER_LOCALITY_MAX_CHARACTERS,
    `Preferred localities, or null (at most 5): ${what} there rank higher.`,
  );

/** The preferred amenities: they rank higher, the others still show. */
export const preferAmenitiesInput = (what: string) =>
  preferList(
    PREFER_AMENITIES_MAX,
    PREFER_AMENITY_MAX_CHARACTERS,
    `Preferred amenities (pool, gym), or null (at most 8): ${what} with them rank higher.`,
  );

/** A preference list, trimmed, without empty items. */
export function trimmedList(list: readonly string[] | null): string[] {
  return (list ?? []).map((item) => item.trim()).filter((item) => item !== "");
}
