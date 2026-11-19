/** The lists a category can belong to (ADR-143): article categories, FAQ groups and job departments. */
export const CATEGORY_MODULES = ["blog", "faq", "department"] as const;
export type CategoryModule = (typeof CATEGORY_MODULES)[number];

export const CATEGORY_NAME_MAX = 60;
export const CATEGORY_SLUG_MAX = 60;
export const CATEGORY_SORT_MAX = 10000;
