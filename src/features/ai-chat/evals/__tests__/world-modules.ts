/**
 * The module stand-ins the evals register with `vi.mock` (AI-P8-T01): each one is the shape of a real module the tools
 * import, with its database read replaced by the made-up world (`../world`) and its pure page rules taken from the
 * real feature. They sit here, beside the tests, because a test may reach into another feature's files for a stand-in
 * and ordinary code may not (R-FE-03). A test file registers them in one line each:
 *
 *   vi.mock("@/features/search", async () => (await import("./world-modules")).searchModule());
 */
import {
  getBuilderDirectory,
  getBuilderProfile,
  getComparedHomes,
  getLocalityCounts,
  getProject,
  getProjects,
  getProperty,
  getSearchResults,
  getSessionView,
  ownsHome,
} from "../world";

/** `@/features/search`: the read, and the defaults the tool takes from the real feature. */
export async function searchModule() {
  const { DEFAULT_RADIUS_KM, DEFAULT_SORT, DEFAULT_VIEW } =
    await import("@/features/search/schemas");
  const { NEARBY_RADIUS_KM, nearbyHomesToShow, nearbySearchParams, wantsNearby } =
    await import("@/features/search/nearby");
  return {
    getSearchResults,
    DEFAULT_RADIUS_KM,
    DEFAULT_SORT,
    DEFAULT_VIEW,
    NEARBY_RADIUS_KM,
    nearbyHomesToShow,
    nearbySearchParams,
    wantsNearby,
  };
}

/** `@/features/property`: the read, and the page's own rules. */
export async function propertyModule() {
  const { amenityList, perSqftRupees } = await import("@/features/property/view");
  return { getProperty, amenityList, perSqftRupees };
}

/** `@/features/compare`: the read, and the real limits. */
export async function compareModule() {
  const { COMPARE_MAX, COMPARE_MIN } = await import("@/features/compare/store");
  return { getComparedHomes, COMPARE_MAX, COMPARE_MIN };
}

/** `@/features/projects`: the reads, and the real page rules the tools use. */
export async function projectsModule() {
  const { bhkSizes, priceBounds, TREND_MONTHS } = await import("@/features/projects/view");
  const { isProjectSlug } = await import("@/features/projects/address");
  const { PROJECT_STATUSES } = await import("@/features/projects/schemas");
  const { visitDateProblem } = await import("@/features/projects/lead-view");
  return {
    getProjects,
    getProject,
    bhkSizes,
    priceBounds,
    TREND_MONTHS,
    isProjectSlug,
    PROJECT_STATUSES,
    visitDateProblem,
    PROJECT_LIST_LIMIT: 60,
  };
}

/** `../queries` of the feature: the locality and builder reads, and the ownership check. */
export function queriesModule() {
  return { getLocalityCounts, getBuilderDirectory, getBuilderProfile, ownsHome };
}

/** `@/server/auth/get-session-view`. */
export function sessionModule() {
  return { getSessionView };
}
