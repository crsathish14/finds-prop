/**
 * The rules of the localities list (ADR-128 sections 3 and 5.1): findsprop has no place search, so "near
 * Velachery" can only be a match on the locality an owner or a developer typed. This file groups those typed
 * names, counts them, and finds the ones that look like what a customer wrote, spelling mistakes included
 * ("Velacheri" finds Velachery). Pure: no database, no words, no dependencies.
 */

/** One locality: the name as most listings spell it, and how many approved homes and live projects name it. */
export type LocalityCount = { name: string; homes: number; projects: number };

/** How far a name may be from the text and still count as a spelling of it: one change for every four letters. */
const LETTERS_PER_ALLOWED_CHANGE = 4;
const MAX_ALLOWED_CHANGES = 3;
/** Text shorter than this is matched by its letters only, never by "close enough". */
const SHORTEST_FUZZY_TEXT = 4;

/**
 * The form two spellings of one locality share: lower case, with everything that is not a letter, a mark or
 * a digit read as one space ("T. Nagar", "T.Nagar" and "t  nagar" are one place). Marks are kept because
 * Tamil vowel signs are marks.
 */
export function localityKey(name: string): string {
  return name
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, " ")
    .trim();
}

type Tally = { homes: number; projects: number; spellings: Map<string, number> };

function addTo(tallies: Map<string, Tally>, name: string, kind: "homes" | "projects"): void {
  const spelling = name.trim().replace(/\s+/g, " ");
  const key = localityKey(spelling);
  if (key === "") return;
  const tally = tallies.get(key) ?? { homes: 0, projects: 0, spellings: new Map() };
  tally[kind] += 1;
  tally.spellings.set(spelling, (tally.spellings.get(spelling) ?? 0) + 1);
  tallies.set(key, tally);
}

/** The spelling most listings use; of two used equally often, the one that sorts first, so the answer is stable. */
function commonSpelling(spellings: Map<string, number>): string {
  let best = "";
  let bestCount = 0;
  for (const [spelling, count] of spellings) {
    if (count > bestCount || (count === bestCount && spelling < best)) {
      best = spelling;
      bestCount = count;
    }
  }
  return best;
}

/** The busiest locality first; two equally busy ones in the order of their names. */
function byCountThenName(first: LocalityCount, second: LocalityCount): number {
  const difference = second.homes + second.projects - (first.homes + first.projects);
  if (difference !== 0) return difference;
  return first.name < second.name ? -1 : first.name > second.name ? 1 : 0;
}

/**
 * The localities of the given homes and projects, each counted once however it was spelt, busiest first.
 * A name with no letter or digit in it is left out.
 */
export function countLocalities(
  homeLocalities: readonly string[],
  projectLocalities: readonly string[],
): LocalityCount[] {
  const tallies = new Map<string, Tally>();
  for (const name of homeLocalities) addTo(tallies, name, "homes");
  for (const name of projectLocalities) addTo(tallies, name, "projects");
  return [...tallies.values()]
    .map((tally) => ({
      name: commonSpelling(tally.spellings),
      homes: tally.homes,
      projects: tally.projects,
    }))
    .sort(byCountThenName);
}

/**
 * How many single-letter changes (a letter added, dropped or swapped for another) turn one text into the
 * other, or `limit + 1` as soon as it is known to be more than `limit`.
 */
export function editDistance(first: string, second: string, limit: number): number {
  const from = Array.from(first);
  const to = Array.from(second);
  if (Math.abs(from.length - to.length) > limit) return limit + 1;
  let previous = Array.from({ length: to.length + 1 }, (_, column) => column);
  for (let row = 1; row <= from.length; row += 1) {
    const current = [row];
    let smallest = row;
    for (let column = 1; column <= to.length; column += 1) {
      const swap = (previous[column - 1] ?? 0) + (from[row - 1] === to[column - 1] ? 0 : 1);
      const drop = (previous[column] ?? 0) + 1;
      const add = (current[column - 1] ?? 0) + 1;
      const cost = Math.min(swap, drop, add);
      current.push(cost);
      smallest = Math.min(smallest, cost);
    }
    if (smallest > limit) return limit + 1;
    previous = current;
  }
  return Math.min(previous[to.length] ?? limit + 1, limit + 1);
}

/** How well a name answers the text: 0 the same, 1 starts with it, 2 holds it, 3 a close spelling; null no match. */
function matchRank(key: string, wanted: string): { rank: number; distance: number } | null {
  if (key === wanted) return { rank: 0, distance: 0 };
  if (key.startsWith(wanted)) return { rank: 1, distance: 0 };
  if (key.includes(wanted)) return { rank: 2, distance: 0 };
  // Spaces are not part of a spelling: "tnagar" and "t nagar" are the same word to a customer.
  const wantedLetters = wanted.replace(/ /g, "");
  const wantedLength = Array.from(wantedLetters).length;
  if (wantedLength < SHORTEST_FUZZY_TEXT) return null;
  const allowed = Math.min(
    MAX_ALLOWED_CHANGES,
    Math.max(1, Math.floor(wantedLength / LETTERS_PER_ALLOWED_CHANGE)),
  );
  const distance = editDistance(key.replace(/ /g, ""), wantedLetters, allowed);
  return distance <= allowed ? { rank: 3, distance } : null;
}

/**
 * The localities that answer what a customer wrote, best first, at most `limit`: the same name, then names
 * that start with the text, names that hold it, and names one or two letters away from it. With no text, the
 * busiest localities. The list given must be in `countLocalities` order (busiest first).
 */
export function findLocalities(
  localities: readonly LocalityCount[],
  search: string | null,
  limit: number,
): LocalityCount[] {
  return findByName(localities, search, limit);
}

/**
 * The same match for anything with a name (a builder's name, for `get_builder`): the best match first, ties in
 * the order given, at most `limit`. With no text, the first `limit` as given.
 */
export function findByName<Named extends { name: string }>(
  items: readonly Named[],
  search: string | null,
  limit: number,
): Named[] {
  const wanted = search === null ? "" : localityKey(search);
  if (wanted === "") return items.slice(0, limit);
  const found: { item: Named; rank: number; distance: number; order: number }[] = [];
  items.forEach((item, order) => {
    const match = matchRank(localityKey(item.name), wanted);
    if (match !== null) found.push({ item, ...match, order });
  });
  return found
    .sort(
      (first, second) =>
        first.rank - second.rank || first.distance - second.distance || first.order - second.order,
    )
    .slice(0, limit)
    .map((entry) => entry.item);
}
