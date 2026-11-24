/**
 * The rules of the Developer spotlight on the home page (concept D, ADR-193), apart from the reads so they can be
 * tested alone: which of the picked builders can show, which one this visit shows, and the short words drawn from
 * what the builder uploaded.
 */

/** How many of the builder's projects the spotlight shows, and how many it reads to count the launching ones. */
export const SPOTLIGHT_PROJECTS = 3;
export const SPOTLIGHT_PROJECTS_READ = 24;

/** The introduction shown when the builder gave no tagline: the start of their description, up to this length. */
export const SPOTLIGHT_ABOUT_MAX = 140;

/** One builder that can show: picked by the admin and with a live project in the city, with those projects' slugs. */
export type SpotlightCandidate = { builderId: string; slugs: string[] };

/**
 * The picked builders that have a live project, in the order the admin picked them, each with their projects' slugs in
 * the order the rows give (featured first, then the newest). A picked builder with nothing live is left out, as is a
 * repeated pick; rows of builders not picked are ignored.
 */
export function spotlightCandidates(
  rows: readonly { builderId: string; slug: string }[],
  picked: readonly string[],
): SpotlightCandidate[] {
  const slugsOf = new Map<string, string[]>();
  for (const row of rows) {
    const slugs = slugsOf.get(row.builderId) ?? [];
    if (!slugs.includes(row.slug)) slugs.push(row.slug);
    slugsOf.set(row.builderId, slugs);
  }
  const seen = new Set<string>();
  return picked.flatMap((builderId) => {
    const slugs = slugsOf.get(builderId);
    if (!slugs || slugs.length === 0 || seen.has(builderId)) return [];
    seen.add(builderId);
    return [{ builderId, slugs }];
  });
}

/** The one this visit shows, by chance among them (so each visit may differ); with one, that one; with none, null. */
export function pickSpotlight<T>(candidates: readonly T[], random: () => number): T | null {
  if (candidates.length === 0) return null;
  const index = Math.min(candidates.length - 1, Math.floor(random() * candidates.length));
  return candidates[index] ?? null;
}

/**
 * The line under the builder's name: their tagline, or else the start of their description, cut at a word and marked
 * with an ellipsis when it is longer than the limit. Nothing given, nothing shown.
 */
export function spotlightAbout(
  tagline: string | null,
  description: string | null,
  max: number = SPOTLIGHT_ABOUT_MAX,
): string | null {
  const line = tagline?.trim();
  if (line) return line;
  const text = description?.replace(/\s+/g, " ").trim();
  if (!text) return null;
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max / 2 ? cut.slice(0, lastSpace) : cut).replace(/[\s,.;:–-]+$/u, "")}…`;
}

/** Whole years since the year the builder started, or null when it is not given or not in the past. */
export function yearsSince(startedYear: number | null, currentYear: number): number | null {
  if (startedYear === null) return null;
  const years = currentYear - startedYear;
  return years >= 1 ? years : null;
}
