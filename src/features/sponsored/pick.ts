/**
 * Which sponsored project the Featured card shows (ADR-192): one of the live projects of the builders and agents the
 * admin picked, a different one on each visit. A project in the area being searched comes first: when any of the
 * candidates is in that area, the card shows one of those. Pure: the chance comes in as a function, so the rule is
 * tested on its own.
 */

export type FeaturedCandidate = { slug: string; locality: string };

/** Lower case, single spaces, no punctuation: "Sholinganallur, OMR" and "sholinganallur omr" read the same. */
function plain(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** True when a project's locality is the searched area, or one names the other ("OMR" in "Sholinganallur, OMR"). */
export function inArea(locality: string, area: string): boolean {
  const place = plain(locality);
  const wanted = plain(area);
  if (place === "" || wanted === "") return false;
  return place === wanted || place.includes(wanted) || wanted.includes(place);
}

/**
 * The candidate to show, or null when there is none. `area` is the searched locality or place, if any; `chance` gives
 * a number from 0 up to (not including) 1, like Math.random.
 */
export function pickFeatured<Candidate extends FeaturedCandidate>(
  candidates: readonly Candidate[],
  area: string | undefined,
  chance: () => number,
): Candidate | null {
  if (candidates.length === 0) return null;
  const nearby = area ? candidates.filter((candidate) => inArea(candidate.locality, area)) : [];
  const pool = nearby.length > 0 ? nearby : candidates;
  const index = Math.min(pool.length - 1, Math.floor(chance() * pool.length));
  return pool[index] ?? null;
}
