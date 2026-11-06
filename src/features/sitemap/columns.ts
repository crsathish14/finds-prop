/**
 * The columns the two sitemap reads ask for. They live in a file of their own, with no imports, so
 * the public-projection tests (S4-T13) can check the exact strings the sitemap sends.
 */
export const SITEMAP_HOME_COLUMNS = "slug, short_id, updated_at";
export const SITEMAP_PROJECT_COLUMNS = "slug, updated_at, builders!inner(id)";
