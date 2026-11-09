/** The decisions an admin can make on a project (S7-T04, FR-ADM-03). Deleting is a separate action. */
export const PROJECT_DECISIONS = [
  "approve",
  "reject",
  "publish",
  "unpublish",
  "feature",
  "unfeature",
] as const;
export type ProjectDecision = (typeof PROJECT_DECISIONS)[number];

/**
 * The most projects the admin's page reads. The list is filtered in the browser (as the builder's is), so it is read
 * whole; above this the oldest are left out and the page says so.
 */
export const PROJECT_LIST_MAX = 500;
