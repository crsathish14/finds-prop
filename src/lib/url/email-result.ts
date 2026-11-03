/**
 * What the email link answers with: the visitor is sent to `/auth?email=verified` or
 * `/auth?email=expired` (ADD-03). Pure, so the route that finishes the link and the page that shows
 * the answer share one set of names.
 */
export const EMAIL_RESULTS = ["verified", "expired"] as const;

export type EmailResult = (typeof EMAIL_RESULTS)[number];

export function emailResultPath(result: EmailResult): string {
  return `/auth?email=${result}`;
}

/** The `email` value of a page's query string, or null if it is missing or not one of ours. */
export function parseEmailResult(value: string | string[] | undefined): EmailResult | null {
  const first = Array.isArray(value) ? value[0] : value;
  return EMAIL_RESULTS.find((result) => result === first) ?? null;
}
