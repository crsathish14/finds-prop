/**
 * The columns the localities read asks for (ADR-128 section 5.1, `list_localities`). They live in a file of
 * their own, with no imports, so the public-projection tests (S4-T13, IT-queries) can check the exact strings
 * the assistant sends: a locality name and nothing else. `builders!inner` keeps only the projects of an
 * active builder (an inactive builder is not visible to visitors at all, BR-94).
 */
export const LOCALITY_HOME_COLUMNS = "locality";
export const LOCALITY_PROJECT_COLUMNS = "locality, builders!inner(id)";
