/**
 * The columns the two homepage developer reads ask for. They live in a file of their own, with no
 * imports, so the public-projection tests (S4-T13) can check the exact strings the page sends.
 */
export const RANKING_COLUMNS = "builder_id";
export const DEVELOPER_PROJECT_COLUMNS =
  "slug, name, builder_id, images, builders!inner(id, name, description)";
