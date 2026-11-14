/**
 * The columns the assistant's own reads ask for (ADR-128 section 5.1). They live in a file of their own, with
 * no imports, so the public-projection tests (S4-T13, IT-queries) can check the exact strings the assistant
 * sends. `builders!inner` keeps only the projects of an active builder (an inactive builder is not visible to
 * visitors at all, BR-94).
 */

/** `list_localities`: a locality name and nothing else. */
export const LOCALITY_HOME_COLUMNS = "locality";
export const LOCALITY_PROJECT_COLUMNS = "locality, builders!inner(id)";

/**
 * `get_builder`: a builder's public profile (the five columns a visitor is granted; the contact person, phone
 * and email, the status and the invitation are not public) and, for each live project, only what the tool
 * shows. A builder's own created-at column is not public, so "first project listed here" comes from the
 * earliest project's `created_at`.
 */
export const BUILDER_DIRECTORY_COLUMNS = "id, name";
export const BUILDER_COLUMNS = "id, name, website, description";
export const BUILDER_PROJECT_COLUMNS =
  "slug, name, project_status, locality, possession_date, rera_applicable, rera_number, created_at";
export const BUILDER_FIRST_PROJECT_COLUMNS = "created_at";
