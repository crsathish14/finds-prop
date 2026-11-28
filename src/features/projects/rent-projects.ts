import type { SearchParams } from "@/features/search";
import type { ProjectKind } from "./queries";
import type { ProjectListItem } from "./types";
import { bhkSizes } from "./view";

/**
 * The projects for rent under a rent search on the results page (ADR-219): residential projects for rent of the
 * selected city, the searched area first, narrowed by the search's property type, bedrooms and budget. The homes,
 * their count, their order and their pages are left as they are. Pure: the page reads the list and the kinds.
 */

/** The most project cards the section shows. */
export const RENT_PROJECTS_MAX = 6;

/** Whether the search lists projects for rent at all: a rent search for a kind a residential project can be. */
export function wantsRentProjects(params: SearchParams): boolean {
  if (params.listingType !== "rent") return false;
  return params.propertyType !== "house" && params.propertyType !== "commercial";
}

/** Letters and digits only, lower case, so "Anna Nagar" finds "Anna Nagar West" and "anna-nagar". */
function areaKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Every filter but the kind, which the list does not carry: for rent, priced per month (the only price a residential
 * project for rent has, ADR-214), the bedrooms on offer, and the monthly rent within the budget. A project with no
 * price never meets a budget.
 */
export function rentProjectFits(project: ProjectListItem, params: SearchParams): boolean {
  if (project.offerType !== "rent" || project.priceType !== "rent_per_month") return false;
  if (params.bhk !== undefined && !bhkSizes(project.bhkOptions).includes(params.bhk)) return false;
  if (params.minPrice !== undefined || params.maxPrice !== undefined) {
    if (project.price === null) return false;
    if (params.minPrice !== undefined && project.price < params.minPrice) return false;
    if (params.maxPrice !== undefined && project.price > params.maxPrice) return false;
  }
  return true;
}

/** Residential only; with a property type, that type only. A project whose kind could not be read is left out. */
function kindFits(kind: ProjectKind | undefined, params: SearchParams): boolean {
  if (kind?.projectType !== "residential") return false;
  return params.propertyType === undefined || kind.propertyType === params.propertyType;
}

/**
 * The projects to show, at most RENT_PROJECTS_MAX: those whose locality holds the searched area first, then the rest,
 * each group in the list's own order (featured first, then the newest).
 */
export function pickRentProjects(
  projects: readonly ProjectListItem[],
  kinds: ReadonlyMap<string, ProjectKind>,
  params: SearchParams,
): ProjectListItem[] {
  if (!wantsRentProjects(params)) return [];
  const fitting = projects.filter(
    (project) => rentProjectFits(project, params) && kindFits(kinds.get(project.slug), params),
  );
  const area = areaKey(params.place ?? params.locality ?? "");
  const inArea = (project: ProjectListItem) =>
    area !== "" && areaKey(project.locality).includes(area);
  return [...fitting.filter(inArea), ...fitting.filter((project) => !inArea(project))].slice(
    0,
    RENT_PROJECTS_MAX,
  );
}
