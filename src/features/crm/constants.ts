/**
 * The numbers of the CRM connections (S7-T09, FR-ADM-09). The retry schedule is BR-66: a failed delivery is tried
 * again after 1, 5, 30, 120 and 720 minutes, so a delivery is attempted at most six times. The database holds the
 * same six (`form_submissions.crm_attempts`, `crm_api_logs.attempt`).
 */
export const RETRY_MINUTES = [1, 5, 30, 120, 720] as const;
export const MAX_ATTEMPTS = RETRY_MINUTES.length + 1;

/** A call to a CRM that has not answered by now has failed. */
export const REQUEST_TIMEOUT_MS = 10_000;
/** The most of an answer that is read; the rest is dropped. */
export const RESPONSE_BYTES_MAX = 65_536;
/** The most of an answer that is kept in the delivery log (the column's limit). */
export const SNIPPET_MAX = 500;

/** The limits of the connection's boxes; the first four are the table's own checks. */
export const NAME_MAX = 120;
export const LEAD_SOURCE_MAX = 80;
export const URL_MAX = 300;
export const PATH_MAX = 300;
export const LEAD_ID_PATH_MAX = 120;
export const ROWS_MAX = 30;
export const ROW_VALUE_MAX = 500;
export const SECRET_MAX = 2000;

/** Headers the server sets itself; a connection cannot override them. */
export const BLOCKED_HEADERS = [
  "host",
  "content-length",
  "connection",
  "transfer-encoding",
  "upgrade",
  "te",
  "trailer",
  "expect",
] as const;

export const CRM_METHODS = ["POST", "PUT"] as const;
export type CrmMethod = (typeof CRM_METHODS)[number];
