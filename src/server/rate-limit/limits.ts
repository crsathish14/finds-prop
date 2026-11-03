/**
 * The closed list of rate limits (plan 07 section 11, BR-70 to BR-72, DEC-31, DEC-33). A scope can
 * have several rules, for example a phone code is limited per phone and per address. Each rule
 * counts under its own database scope, `<scope>_<who>`, so the windows never mix.
 *
 * Who is counted:
 *   visitor      a one-way hash of the address and browser (BR-75)
 *   ip           a one-way hash of the address alone
 *   user         the signed-in user's id
 *   key          a one-way hash of a value the action names, such as a phone number
 *   visitor_key  the visitor hash joined with that key, such as one visitor on one form
 */
export type RateLimitWho = "visitor" | "ip" | "user" | "key" | "visitor_key";

export interface RateLimitRule {
  who: RateLimitWho;
  windowSeconds: number;
  max: number;
}

const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export const RATE_LIMITS = {
  /** 5 submissions per visitor per form per hour (BR-61, BR-70). */
  form_submit: [{ who: "visitor_key", windowSeconds: HOUR, max: 5 }],
  /** 30 events per visitor per minute (BR-71). */
  project_event: [{ who: "visitor", windowSeconds: MINUTE, max: 30 }],
  /** 5 leads per visitor per hour (BR-72). */
  project_lead: [{ who: "visitor", windowSeconds: HOUR, max: 5 }],
  /** 5 codes per phone per hour and 20 per address per day (DEC-31). */
  otp_request: [
    { who: "key", windowSeconds: HOUR, max: 5 },
    { who: "ip", windowSeconds: DAY, max: 20 },
  ],
  /** 10 wrong or right tries per phone per hour (DEC-31). */
  otp_verify: [{ who: "key", windowSeconds: HOUR, max: 10 }],
  /** 5 verification emails per user per hour and 20 per address per day (owner decision, 3 Nov 2026). */
  email_link: [
    { who: "user", windowSeconds: HOUR, max: 5 },
    { who: "ip", windowSeconds: DAY, max: 20 },
  ],
  /** Starting a staff Google sign-in: 10 per visitor per 10 minutes and 30 per address per hour (S3-T10). */
  staff_sign_in: [
    { who: "visitor", windowSeconds: 10 * MINUTE, max: 10 },
    { who: "ip", windowSeconds: HOUR, max: 30 },
  ],
  /** 10 enquiries per user per day (DEC-26). */
  enquiry: [{ who: "user", windowSeconds: DAY, max: 10 }],
  /** 10 listings created per user per day (DEC-26). */
  listing_create: [{ who: "user", windowSeconds: DAY, max: 10 }],
  /** 30 upload addresses per user per hour. */
  upload_url: [{ who: "user", windowSeconds: HOUR, max: 30 }],
  /** 60 place searches per visitor per minute (protects the provider quota). */
  places: [{ who: "visitor", windowSeconds: MINUTE, max: 60 }],
  /** 60 map searches per visitor per minute. */
  map_search: [{ who: "visitor", windowSeconds: MINUTE, max: 60 }],
} as const satisfies Record<string, readonly RateLimitRule[]>;

export type RateLimitScope = keyof typeof RATE_LIMITS;

export const RATE_LIMIT_SCOPES = Object.keys(RATE_LIMITS) as RateLimitScope[];

/** The database scope for one rule of one scope, such as `otp_request_ip`. */
export function databaseScope(scope: RateLimitScope, rule: RateLimitRule): string {
  return `${scope}_${rule.who}`;
}
