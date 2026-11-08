/**
 * The one place that decides which colour a status gets (plan 04 section 4, R-DS-09). Components
 * never choose a status colour themselves; they ask StatusBadge, which reads this map. The words
 * are in en.json under `status.<kind>.<status>`.
 *
 * Moderation and CRM-delivery statuses are added when Stage 3 defines them (S3-T01). The names
 * here follow the requirements (FR-ACC-05, FR-ACC-10, FR-ACC-12); S3-T01 may rename them.
 */
export type StatusTone = "neutral" | "success" | "warning" | "danger" | "info" | "featured";

export const STATUS_TONES = {
  listing: {
    draft: "neutral",
    live: "success",
    pendingReview: "warning",
    sold: "neutral",
    rentedOut: "neutral",
    notApproved: "danger",
  },
  enquiry: {
    new: "featured",
    contacted: "info",
    closed: "neutral",
    waitingForOwner: "warning",
  },
  builder: {
    active: "success",
    invited: "warning",
    inactive: "neutral",
  },
  project: {
    draft: "neutral",
    pending: "warning",
    approved: "success",
    rejected: "danger",
  },
  crm: {
    success: "success",
    failed: "danger",
    pending: "warning",
    not_applicable: "neutral",
  },
  unit: {
    available: "success",
    onHold: "warning",
    sold: "neutral",
    blocked: "danger",
  },
} as const satisfies Record<string, Record<string, StatusTone>>;

export type StatusKind = keyof typeof STATUS_TONES;
export type StatusOf<Kind extends StatusKind> = keyof (typeof STATUS_TONES)[Kind];
