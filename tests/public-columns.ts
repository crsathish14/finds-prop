/**
 * Shared by the unit test of the column lists (src/features/__tests__/public-columns.test.ts) and the
 * integration test that runs them against the database (tests/integration/public-queries.test.ts).
 * S4-T13, R-DB-06, ADR-017: a select a visitor's request sends names only public columns.
 */

/**
 * Words that no public select may contain, whatever the table: ownership, moderation, the private
 * form and CRM links, and a builder's private contact details. Whole words only, so `contact_phone`
 * (a project's public number) and `published_at` are different words from `phone` and `published`.
 */
export const NEVER_PUBLIC_WORDS: readonly string[] = [
  "owner_id",
  "rejection_reason",
  "moderation",
  "moderated_by",
  "moderated_at",
  "submitted_at",
  "closed_at",
  "published",
  "form_id",
  "crm_integration_id",
  "user_id",
  "email",
  "contact_person",
  "phone",
  "active",
];

/** Also never public on a home (a project's address and exact point are public by design, DEC-35). */
export const NEVER_PUBLIC_ON_HOMES: readonly string[] = ["address", "location"];

/** Every word of a select string: column names, the embedded table and its hint. */
export function wordsOf(select: string): string[] {
  return select.match(/[a-z_]+/g) ?? [];
}

/** The forbidden words found in a select string, plus a `*`, which asks for every column. */
export function forbiddenIn(select: string, extra: readonly string[] = []): string[] {
  const banned = new Set([...NEVER_PUBLIC_WORDS, ...extra]);
  const found = wordsOf(select).filter((word) => banned.has(word));
  return select.includes("*") ? [...found, "*"] : found;
}

/**
 * The keys a row has when it is selected with this string: the top-level columns, with an embedded
 * table (`builders!inner(id, name)`) counting as one key named after the table.
 */
export function topLevelKeys(select: string): string[] {
  return select
    .replace(/\([^)]*\)/g, "")
    .split(",")
    .map((part) => part.trim().replace(/!inner$/, ""))
    .filter((part) => part !== "")
    .sort();
}
