import "server-only";
import { bhkSizes, getProjects, type ProjectListItem } from "@/features/projects";
import type { ProjectPrimeRules } from "@/lib/project-prime";
import { cityFilterOf } from "../city-filter";
import { localityKey } from "../localities";
import {
  getPrimeRules,
  getProjectExtras,
  getPromotionLists,
  type ProjectExtras,
} from "../ranking/reads.server";
import type { RankFeatures } from "../ranking/rank";
import { isTotalPrice } from "./project-facts";
import { projectFeatures } from "./search-projects";
import type { ToolContext } from "./types";

/**
 * The projects a home search lists beside the homes (ADR-215): one list of homes and projects, ranked together. A buy
 * search reads projects for sale, a rent search projects for rent, a search for either reads both. Only for a signed-in
 * customer (a guest sees homes only, ADR-200), only when the customer asked for no order of their own and no home label,
 * and from the same cached list the projects page shows (live projects of active builders, at most the list's limit).
 */

/** The home search's filters a project is matched on. */
export interface ProjectMatchFilters {
  readonly listingType: "sale" | "rent" | null;
  readonly propertyType: string | null;
  readonly bhk: number | null;
  readonly minPrice: number | null;
  readonly maxPrice: number | null;
  readonly city: string | null;
  readonly locality: string | null;
  readonly keyword: string | null;
  readonly label: string | null;
  readonly sort: string | null;
}

export interface ListedProjects {
  readonly projects: readonly ProjectListItem[];
  readonly primeRules: ProjectPrimeRules;
  /** The ranking features of a listed project, with the price that compares with the customer's budget. */
  readonly featuresOf: (project: ProjectListItem) => RankFeatures;
}

/**
 * The price of a project that compares with a home search's budget: a monthly rent for a project for rent (rent per
 * month only), a total price (basic or all inclusive) for a project for sale; null for anything else (a rate per sq
 * ft, a rent per sq ft), which then never meets a budget.
 */
export function comparablePrice(project: ProjectListItem): number | null {
  if (project.price === null) return null;
  if (project.offerType === "rent") {
    return project.priceType === "rent_per_month" ? project.price : null;
  }
  return isTotalPrice(project.priceType) ? project.price : null;
}

/** Whether the offer fits: rent for a rent search, anything but rent for a buy search. */
function offerFits(project: ProjectListItem, listingType: "sale" | "rent" | null): boolean {
  if (listingType === null) return true;
  return listingType === "rent" ? project.offerType === "rent" : project.offerType !== "rent";
}

/**
 * Whether the kind fits. A home search with no property type reads residential projects only; "commercial" reads the
 * commercial ones; apartment, villa and plot read the residential projects of that kind; a house has no project kind.
 * A project whose kind could not be read counts as residential with an unknown property type.
 */
function kindFits(extra: ProjectExtras | undefined, propertyType: string | null): boolean {
  const projectType = extra?.projectType ?? "residential";
  if (propertyType === null) return projectType === "residential";
  if (propertyType === "commercial") return projectType === "commercial";
  if (propertyType === "house") return false;
  return projectType === "residential" && extra?.propertyType === propertyType;
}

/** Every filter but the kind, which needs the extra read. */
function matchesWithoutKind(project: ProjectListItem, filters: ProjectMatchFilters): boolean {
  const locality = localityKey(filters.locality?.trim() ?? "");
  if (locality !== "" && !localityKey(project.locality).includes(locality)) return false;
  const keyword = localityKey(filters.keyword?.trim() ?? "");
  if (keyword !== "" && !localityKey(`${project.name} ${project.locality}`).includes(keyword)) {
    return false;
  }
  if (!offerFits(project, filters.listingType)) return false;
  if (filters.bhk !== null && !bhkSizes(project.bhkOptions).includes(filters.bhk)) return false;
  if (filters.minPrice !== null || filters.maxPrice !== null) {
    const price = comparablePrice(project);
    if (price === null) return false;
    if (filters.minPrice !== null && price < filters.minPrice) return false;
    if (filters.maxPrice !== null && price > filters.maxPrice) return false;
  }
  return true;
}

/** Whether a home search reads projects at all for this customer and these filters. */
export function listsProjects(filters: ProjectMatchFilters, context: ToolContext): boolean {
  return context.signedIn && filters.sort === null && filters.label === null;
}

/**
 * The projects that match a home search, with what the ranking needs, or null when the search lists none. A failed
 * read lists none: the homes still answer.
 */
export async function projectsForHomeSearch(
  filters: ProjectMatchFilters,
  context: ToolContext,
): Promise<ListedProjects | null> {
  if (!listsProjects(filters, context)) return null;
  const city = cityFilterOf(filters.city);
  const [list, primeRules] = await Promise.all([
    (city === null ? getProjects() : getProjects(city)).catch(() => null),
    getPrimeRules(),
  ]);
  if (list === null || list.status === "failed") return null;
  const candidates = list.projects.filter((project) => matchesWithoutKind(project, filters));
  const [promotions, extras] = await Promise.all([
    getPromotionLists(),
    getProjectExtras(candidates.map((project) => project.slug)),
  ]);
  const projects = candidates.filter((project) =>
    kindFits(extras.get(project.slug), filters.propertyType),
  );
  const now = Date.now();
  return {
    projects,
    primeRules,
    featuresOf: (project) => ({
      ...projectFeatures(project, extras, promotions, now),
      price: comparablePrice(project),
    }),
  };
}
