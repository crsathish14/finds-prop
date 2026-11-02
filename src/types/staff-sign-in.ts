/**
 * Names shared by the staff sign-in server code and its client button (S3-T10). They live here, at
 * the bottom of the import order, because a client island may not import from `server/` (R-FE-02).
 */

/** Builders and agents share the builder area; the administrator has their own. */
export const STAFF_AREAS = ["builder", "admin"] as const;
export type StaffArea = (typeof STAFF_AREAS)[number];

/** What a sign-in page can say went wrong. One generic message each: never a reason or an address. */
export const STAFF_PROBLEMS = ["denied", "cancelled", "error"] as const;
export type StaffProblem = (typeof STAFF_PROBLEMS)[number];
