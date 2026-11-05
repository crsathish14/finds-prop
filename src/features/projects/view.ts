import type { ProjectData, ProjectStatus, ProjectUnit, TrendPoint } from "./types";

/**
 * The rules the project pages apply between a project and the screen (S4-T09, ADR-046). Pure and
 * word-free: they say what is shown and in what order, and the page turns that into text. Anything
 * the developer did not give is left out, never drawn as a blank or a zero.
 */

/** How many units the units table draws (the table says "Showing 20 of N units"). */
export const UNITS_SHOWN = 20;

/** How many months of the price trend are read and drawn. */
export const TREND_MONTHS = 12;

/** The most videos a project can hold (the database allows five). */
const VIDEOS_SHOWN = 5;

/** The BHK sizes on offer, each once, smallest first. A size of 0 is not a count of bedrooms. */
export function bhkSizes(options: readonly number[]): number[] {
  return [...new Set(options)]
    .filter((size) => size > 0)
    .sort((smaller, larger) => smaller - larger);
}

/**
 * The prices on offer as a range, lowest first, or null when the developer gave none. One price is a
 * range whose two ends are the same. The database keeps the two in order, but a page must not depend
 * on that.
 */
export function priceBounds(
  min: number | null,
  max: number | null,
): { low: number; high: number } | null {
  const given = [min, max].filter((value): value is number => value !== null && value > 0);
  if (given.length === 0) return null;
  return { low: Math.min(...given), high: Math.max(...given) };
}

/** One entry of "Project overview", in the order of the UX. */
export type SpecItem =
  | { key: "priceRange"; low: number; high: number }
  | { key: "configuration"; sizes: number[] }
  | { key: "status"; value: ProjectStatus }
  | { key: "possession"; date: string }
  | { key: "landArea"; acres: number }
  | { key: "totalUnits"; value: number }
  | { key: "availableUnits"; value: number }
  | { key: "rera"; number: string };

type SpecSource = Pick<
  ProjectData,
  | "priceMin"
  | "priceMax"
  | "bhkOptions"
  | "status"
  | "possessionDate"
  | "landAreaAcres"
  | "totalUnits"
  | "unitCount"
  | "availableCount"
  | "reraApplicable"
  | "reraNumber"
>;

/** True for a `YYYY-MM-DD` text that is a real day. */
function isDay(text: string | null): text is string {
  if (text === null || !/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  return !Number.isNaN(Date.parse(`${text}T00:00:00Z`));
}

/**
 * The facts for "Project overview": price range, configuration, status, possession, land area,
 * total units, available units and the RERA number. Each is left out when not given. Available units
 * are counted from the units the developer listed, so they are left out when none are listed. The
 * RERA number is drawn only for a project that is under RERA and has a number.
 */
export function specItems(project: SpecSource): SpecItem[] {
  const items: SpecItem[] = [];
  const prices = priceBounds(project.priceMin, project.priceMax);
  if (prices) items.push({ key: "priceRange", ...prices });
  const sizes = bhkSizes(project.bhkOptions);
  if (sizes.length > 0) items.push({ key: "configuration", sizes });
  if (project.status !== null) items.push({ key: "status", value: project.status });
  if (isDay(project.possessionDate))
    items.push({ key: "possession", date: project.possessionDate });
  if (project.landAreaAcres !== null && project.landAreaAcres > 0) {
    items.push({ key: "landArea", acres: project.landAreaAcres });
  }
  if (project.totalUnits !== null && project.totalUnits > 0) {
    items.push({ key: "totalUnits", value: project.totalUnits });
  }
  if (project.unitCount > 0) items.push({ key: "availableUnits", value: project.availableCount });
  const rera = reraTag(project);
  if (rera?.number) items.push({ key: "rera", number: rera.number });
  return items;
}

/**
 * The RERA tag under the title: null for a project that is not under RERA, and for one that is, its
 * number when there is one (the tag then reads "RERA applicable" alone).
 */
export function reraTag(
  project: Pick<ProjectData, "reraApplicable" | "reraNumber">,
): { number: string | null } | null {
  if (!project.reraApplicable) return null;
  const number = project.reraNumber?.trim();
  return { number: number ? number : null };
}

const unitCollator = new Intl.Collator("en", { numeric: true, sensitivity: "base" });

/**
 * The units in the order of the table: by floor (units with no floor last), then by unit number, with
 * the numbers in a name read as numbers ("A-2" before "A-10"). The original list is not changed.
 */
export function orderUnits(units: readonly ProjectUnit[]): ProjectUnit[] {
  return [...units].sort((first, second) => {
    if (first.floor !== second.floor) {
      if (first.floor === null) return 1;
      if (second.floor === null) return -1;
      return first.floor - second.floor;
    }
    return unitCollator.compare(first.number, second.number);
  });
}

/**
 * What the units table's footer says: how many rows are drawn and how many units there are in all, or
 * null when there are no units (the section is then left out).
 */
export function unitsSummary(
  project: Pick<ProjectData, "units" | "unitCount">,
): { shown: number; total: number } | null {
  if (project.units.length === 0) return null;
  return { shown: project.units.length, total: Math.max(project.unitCount, project.units.length) };
}

/** The price trend oldest month first, each month once (the later entry wins), or none. */
export function trendSeries(points: readonly TrendPoint[]): TrendPoint[] {
  const byMonth = new Map<string, TrendPoint>();
  for (const point of points) byMonth.set(point.month, point);
  return [...byMonth.values()].sort((first, second) => first.month.localeCompare(second.month));
}

/**
 * The videos a page may link to: web addresses that start with https and carry no sign-in details,
 * each once, at most five. Anything else the developer typed (a script address, a plain http link,
 * text that is not an address) is dropped, since the page opens these links.
 */
export function videoLinks(videos: readonly string[]): string[] {
  const links = new Set<string>();
  for (const video of videos) {
    let url: URL;
    try {
      url = new URL(video.trim());
    } catch {
      continue;
    }
    if (url.protocol !== "https:" || url.username !== "" || url.password !== "") continue;
    links.add(url.href);
    if (links.size === VIDEOS_SHOWN) break;
  }
  return [...links];
}
