import { textParagraphs } from "@/lib/text";
import type {
  PriceType,
  ProjectData,
  ProjectPlotStatus,
  ProjectPropertyType,
  ProjectVillaType,
  ProjectStatus,
  ProjectUnit,
  TrendPoint,
  UnitStatus,
} from "./types";

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
 * The one price and what it means, or null when the developer gave none (a price of nothing is none). The words and
 * the formatting are the page's.
 */
export function priceOf(
  project: Pick<ProjectData, "price" | "priceType">,
): { rupees: number; type: PriceType | null } | null {
  if (project.price === null || project.price <= 0) return null;
  return { rupees: project.price, type: project.priceType };
}

/**
 * The size range of a plot or a commercial project, smallest first, or null when it was not given (or one end is
 * missing: half a range says nothing).
 */
export function areaRange(
  project: Pick<ProjectData, "areaMinSqft" | "areaMaxSqft">,
): { min: number; max: number } | null {
  const { areaMinSqft, areaMaxSqft } = project;
  if (areaMinSqft === null || areaMaxSqft === null || areaMinSqft <= 0 || areaMaxSqft <= 0) {
    return null;
  }
  return { min: Math.min(areaMinSqft, areaMaxSqft), max: Math.max(areaMinSqft, areaMaxSqft) };
}

/** One entry of "Project overview", in the order of the UX. */
export type SpecItem =
  | { key: "price"; rupees: number; type: PriceType | null }
  | { key: "propertyType"; value: ProjectPropertyType }
  | { key: "plotStatus"; value: ProjectPlotStatus }
  | { key: "villaType"; value: ProjectVillaType }
  | { key: "configuration"; sizes: number[] }
  | { key: "area"; min: number; max: number }
  | { key: "status"; value: ProjectStatus }
  | { key: "possession"; date: string }
  | { key: "landArea"; acres: number }
  | { key: "totalUnits"; value: number }
  | { key: "availableUnits"; value: number }
  | { key: "rera"; number: string };

type SpecSource = Pick<
  ProjectData,
  | "price"
  | "priceType"
  | "propertyType"
  | "plotStatus"
  | "villaType"
  | "areaMinSqft"
  | "areaMaxSqft"
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
 * The facts for "Project overview": the price, property type, configuration, area range, status, possession, land
 * area, total units, available units and the RERA number. Each is left out when not given. Available units
 * are counted from the units the developer listed, so they are left out when none are listed. The
 * RERA number is drawn only for a project that is under RERA and has a number.
 */
export function specItems(project: SpecSource): SpecItem[] {
  const items: SpecItem[] = [];
  const price = priceOf(project);
  if (price) items.push({ key: "price", ...price });
  if (project.propertyType !== null)
    items.push({ key: "propertyType", value: project.propertyType });
  // Only a plot has a plot status and only a villa a villa type, whatever else the row holds.
  if (project.propertyType === "plot" && project.plotStatus !== null)
    items.push({ key: "plotStatus", value: project.plotStatus });
  if (project.propertyType === "villa" && project.villaType !== null)
    items.push({ key: "villaType", value: project.villaType });
  const sizes = bhkSizes(project.bhkOptions);
  if (sizes.length > 0) items.push({ key: "configuration", sizes });
  const area = areaRange(project);
  if (area) items.push({ key: "area", ...area });
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

/** One extra box with its answer, as the project page shows it (ADR-168). */
export type ExtraRow = { id: string; label: string; value: string };

/** The box definitions the page needs: nothing about who may edit them. */
export type ExtraBoxDefinition = {
  id: string;
  label: string;
  appliesTo: readonly string[];
  on: boolean;
};

/**
 * The extra rows of the project page, in the super admin's order: a box that is on, asked for this property type and
 * answered. An answer whose box is off, not asked for this type or deleted is not shown; the text is shown as text.
 */
export function extraRows(
  boxes: readonly ExtraBoxDefinition[],
  propertyType: string | null,
  answers: Readonly<Record<string, string>>,
): ExtraRow[] {
  const rows: ExtraRow[] = [];
  for (const box of boxes) {
    if (!box.on) continue;
    if (
      box.appliesTo.length > 0 &&
      (propertyType === null || !box.appliesTo.includes(propertyType))
    )
      continue;
    const value = (answers[box.id] ?? "").trim();
    if (value !== "") rows.push({ id: box.id, label: box.label, value });
  }
  return rows;
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

/**
 * Why a project that is not under RERA is not, or null for a project that is under RERA and for one that gave no
 * reason. The developer wrote it, so the page draws it as plain text.
 */
export function reraReason(
  project: Pick<ProjectData, "reraApplicable" | "reraNotApplicableReason">,
): string | null {
  if (project.reraApplicable) return null;
  const reason = project.reraNotApplicableReason?.trim();
  return reason ? reason : null;
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

/** What "Call" and "WhatsApp" lead to, each null when the phone does not allow it. */
export type ContactLinks = { call: string | null; whatsapp: string | null };

const PHONE = /^\+?[0-9]{6,15}$/;

/**
 * The links for a project's contact number (the database allows an optional plus and 6 to 15 digits).
 * Call is a `tel:` link. WhatsApp needs the country code, so it is offered only for a number written
 * with its plus (the international form); a local number could be reached on the wrong code, so it
 * gets Call alone. A number that does not fit gets neither.
 */
export function contactLinks(phone: string | null): ContactLinks {
  const number = phone?.trim() ?? "";
  if (!PHONE.test(number)) return { call: null, whatsapp: null };
  return {
    call: `tel:${number}`,
    whatsapp: number.startsWith("+") ? `https://wa.me/${number.slice(1)}` : null,
  };
}

/** The specifications as the developer wrote them: name and value pairs, or plain paragraphs. */
export type SpecificationRows =
  | { kind: "pairs"; rows: { name: string; value: string }[] }
  | { kind: "text"; paragraphs: string[] };

const SPECIFICATION_LINE = /^([^:]{1,40}):\s*(\S.*)$/;

/**
 * The specifications text as the page draws it. When every line reads "Name: value" it is a list of
 * pairs (the UX's "Structure: RCC framed structure"); otherwise it is paragraphs, a blank line
 * starting a new one. Nothing typed is dropped and nothing is read as HTML. Null when there is no text.
 */
export function specificationRows(text: string | null): SpecificationRows | null {
  const lines = (text ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== "");
  if (lines.length === 0) return null;
  const pairs = lines.map((line) => SPECIFICATION_LINE.exec(line));
  if (pairs.every((pair): pair is RegExpExecArray => pair !== null)) {
    return {
      kind: "pairs",
      rows: pairs.map((pair) => ({
        name: (pair[1] ?? "").trim(),
        value: (pair[2] ?? "").trim(),
      })),
    };
  }
  return { kind: "text", paragraphs: textParagraphs(text) };
}

/** The scale of the price trend: the lowest and highest value drawn and the ticks between them. */
export type TrendScale = { min: number; max: number; ticks: number[] };

/** The nearest of 1, 2, 5 and 10 times a power of ten that is not below the value. */
function niceStep(value: number): number {
  const power = 10 ** Math.floor(Math.log10(value));
  const fraction = value / power;
  const nice = [1, 2, 5, 10].find((candidate) => fraction <= candidate) ?? 10;
  return nice * power;
}

/**
 * The scale for the price trend chart, or null when there are fewer than two months (one month is not
 * a trend, so the page draws no chart for it). The scale runs from just below the lowest value to just
 * above the highest, in round steps, so the line fills the chart; months that all have the same value
 * get a little room either side.
 */
export function trendScale(points: readonly TrendPoint[]): TrendScale | null {
  if (points.length < 2) return null;
  const values = points.map((point) => point.pricePerSqft);
  let low = Math.min(...values);
  let high = Math.max(...values);
  if (low === high) {
    const room = Math.max(1, Math.round(low * 0.05));
    low -= room;
    high += room;
  }
  const step = niceStep((high - low) / 3);
  const min = Math.max(0, Math.floor(low / step) * step);
  const max = Math.ceil(high / step) * step;
  const ticks: number[] = [];
  for (let value = min; value <= max + step / 2; value += step) {
    ticks.push(Math.round(value * 1000) / 1000);
  }
  return { min, max, ticks };
}

/** Where a value sits on the scale, from 0 (the bottom) to 1 (the top). */
export function trendFraction(value: number, scale: TrendScale): number {
  return (value - scale.min) / (scale.max - scale.min);
}

/**
 * Which months get a name under the chart: all when there are four or fewer, otherwise the first, the
 * last and two between, so the names never touch.
 */
export function trendLabelIndexes(count: number): number[] {
  if (count <= 4) return Array.from({ length: count }, (_, index) => index);
  const last = count - 1;
  return [0, Math.round(last / 3), Math.round((2 * last) / 3), last];
}

/**
 * The unit statuses as the status badge knows them: the database says "hold", the badge says "onHold".
 */
export const UNIT_BADGE_STATUS = {
  available: "available",
  hold: "onHold",
  sold: "sold",
  blocked: "blocked",
} as const satisfies Record<UnitStatus, string>;

/** Up to two capital letters from the first words of a name ("Kadal Homes" is "KH"), for a monogram. */
export function developerInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter((word) => word !== "")
    .slice(0, 2)
    .map((word) => (Array.from(word)[0] ?? "").toLocaleUpperCase("en"))
    .join("");
}

const DESCRIPTION_LIMIT = 160;

/**
 * The page description for search engines and shared links: the developer's own SEO description when
 * there is one, otherwise the first paragraph of the project's description cut at a word. Null when
 * there is neither.
 */
export function projectMetaDescription(
  project: Pick<ProjectData, "seoDescription" | "description">,
): string | null {
  const own = project.seoDescription?.replace(/\s+/g, " ").trim();
  if (own) return own;
  const first = textParagraphs(project.description)[0];
  if (first === undefined) return null;
  const flat = first.replace(/\s+/g, " ");
  if (flat.length <= DESCRIPTION_LIMIT) return flat;
  const cut = flat.slice(0, DESCRIPTION_LIMIT);
  const space = cut.lastIndexOf(" ");
  return `${(space > 40 ? cut.slice(0, space) : cut).trimEnd()}…`;
}
