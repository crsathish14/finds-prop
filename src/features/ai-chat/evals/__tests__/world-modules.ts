/**
 * The module stand-ins the evals register with `vi.mock` (AI-P8-T01): each one is the shape of a real module the tools
 * import, with its database read replaced by the made-up world (`../world`) and its pure page rules taken from the
 * real feature. They sit here, beside the tests, because a test may reach into another feature's files for a stand-in
 * and ordinary code may not (R-FE-03). A test file registers them in one line each:
 *
 *   vi.mock("@/features/search", async () => (await import("./world-modules")).searchModule());
 */
import {
  getBlogList,
  getBuilderDirectory,
  getBuilderProfile,
  getComparedHomes,
  getContentModuleOn,
  getJobList,
  getLocalityCounts,
  getOpenJobById,
  getProject,
  getProjects,
  getProperty,
  getPublicFaqs,
  getPublishedBlogPostById,
  getSearchResults,
  getSessionView,
  ownsHome,
  searchPublicFaqs,
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
  const { bhkSizes, priceOf, TREND_MONTHS } = await import("@/features/projects/view");
  const { isProjectSlug } = await import("@/features/projects/address");
  const { OFFER_TYPES, PRICE_TYPES, PROJECT_STATUSES } =
    await import("@/features/projects/schemas");
  const { indiaToday, visitDateProblem } = await import("@/features/projects/lead-view");
  return {
    getProjects,
    indiaToday,
    getProject,
    bhkSizes,
    priceOf,
    TREND_MONTHS,
    isProjectSlug,
    OFFER_TYPES,
    PRICE_TYPES,
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

/** `@/features/blog`: the reads under search_content and get_content_item, and the page's own text rule. */
export async function blogModule() {
  const { blocksToPlainText } = await import("@/features/blog/body-text");
  return { getBlogList, getPublishedBlogPostById, blocksToPlainText };
}

/** `@/features/faq`: the reads, and the page's own rule for an answer's paragraphs. */
export async function faqModule() {
  const { answerParagraphs } = await import("@/features/faq/view");
  return { searchPublicFaqs, getPublicFaqs, answerParagraphs };
}

/** `@/features/careers`: the reads, the page's own rules for a job, and the lists the tool takes its inputs from. */
export async function careersModule() {
  const { descriptionParagraphs, isJobOpenAt, pointsOf } = await import("@/features/careers/view");
  const { EMPLOYMENT_TYPES, WORK_MODES } = await import("@/features/careers/constants");
  return {
    getJobList,
    getOpenJobById,
    descriptionParagraphs,
    isJobOpenAt,
    pointsOf,
    EMPLOYMENT_TYPES,
    WORK_MODES,
  };
}

/** `@/features/site`: the one helper that says whether a content module is switched on. */
export function siteModule() {
  return { getContentModuleOn };
}
