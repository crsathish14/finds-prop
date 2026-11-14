import {
  AI_ANONYMOUS_IP_MESSAGES_PER_DAY,
  AI_BURST_MESSAGES_PER_MINUTE,
  AI_GLOBAL_DAILY_MESSAGE_BUDGET,
  AI_SIGNED_IN_MESSAGES_PER_DAY,
  AI_TRIAL_MESSAGES,
  AI_TRIAL_WINDOW_SECONDS,
} from "@/config/ai";

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
 *   network      like `ip`, but an IPv6 address is cut to its /64 prefix, because one subscriber rotates
 *                addresses inside that block (ADR-128 section 7.1)
 *   cookie       a one-way hash of the anonymous cookie id of the AI chat (D13), one per browser
 *   global       one constant key shared by every caller, for a limit on the whole platform
 *
 * A rule may name `otherwise`: the "who" values to try, in order, when `who` does not exist for this caller
 * (a user id for an anonymous caller, a cookie id for a browser that sends none). The database scope follows
 * the "who" that was used, so the counts of different kinds of caller never mix. A rule may also name `only`:
 * the rule is skipped for the other kind of caller.
 */
export type RateLimitWho =
  "visitor" | "ip" | "network" | "user" | "key" | "visitor_key" | "cookie" | "global";

export interface RateLimitRule {
  who: RateLimitWho;
  windowSeconds: number;
  max: number;
  otherwise?: readonly RateLimitWho[];
  only?: "anonymous" | "signed_in";
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
  /** 120 listing decisions (approve, reject, feature) per admin per hour (S6-T04). */
  admin_decision: [{ who: "user", windowSeconds: HOUR, max: 120 }],
  /** 600 edits per admin per hour: the units of a project, a lead's state and the like (S7-T07). */
  admin_edit: [{ who: "user", windowSeconds: HOUR, max: 600 }],
  /** 300 edits per builder per hour: their units, a lead's state and their profile (S7-T03). */
  builder_edit: [{ who: "user", windowSeconds: HOUR, max: 300 }],
  /** 60 project saves per user per hour: the admin's and a builder's project form (S7-T02). */
  project_save: [{ who: "user", windowSeconds: HOUR, max: 60 }],
  /** 60 place searches per visitor per minute (protects the provider quota). */
  places: [{ who: "visitor", windowSeconds: MINUTE, max: 60 }],
  /** 60 map searches per visitor per minute. */
  map_search: [{ who: "visitor", windowSeconds: MINUTE, max: 60 }],
  /**
   * The AI chat (ADR-128 section 7, D9, D13). The trial counts the anonymous cookie id, or the visitor hash for a
   * browser that sends no cookie. Its database scopes, `ai_chat_trial_cookie` and `ai_chat_trial_visitor`, are the
   * two the retention job keeps for a year (migration 20261114120000): do not rename them.
   */
  ai_chat_trial: [
    {
      who: "cookie",
      otherwise: ["visitor"],
      windowSeconds: AI_TRIAL_WINDOW_SECONDS,
      max: AI_TRIAL_MESSAGES,
      only: "anonymous",
    },
  ],
  /** A loose per-address backstop for anonymous messages, never a per-person limit (shared carrier addresses). */
  ai_chat_trial_ip: [
    {
      who: "network",
      windowSeconds: DAY,
      max: AI_ANONYMOUS_IP_MESSAGES_PER_DAY,
      only: "anonymous",
    },
  ],
  /** Messages a minute: the user id when signed in, else the cookie id, else the visitor hash. */
  ai_chat_burst: [
    {
      who: "user",
      otherwise: ["cookie", "visitor"],
      windowSeconds: MINUTE,
      max: AI_BURST_MESSAGES_PER_MINUTE,
    },
  ],
  /** A signed-in customer's messages a day. */
  ai_chat_user_day: [
    { who: "user", windowSeconds: DAY, max: AI_SIGNED_IN_MESSAGES_PER_DAY, only: "signed_in" },
  ],
  /** Every caller together: the daily budget (a placeholder until the owner sets it, gate G-B). */
  ai_chat_global_day: [{ who: "global", windowSeconds: DAY, max: AI_GLOBAL_DAILY_MESSAGE_BUDGET }],
} as const satisfies Record<string, readonly RateLimitRule[]>;

export type RateLimitScope = keyof typeof RATE_LIMITS;

export const RATE_LIMIT_SCOPES = Object.keys(RATE_LIMITS) as RateLimitScope[];

/** The database scope for one rule of one scope, such as `otp_request_ip`. */
export function databaseScope(scope: RateLimitScope, rule: RateLimitRule): string {
  return `${scope}_${rule.who}`;
}

/**
 * The AI chat scopes in the order a message is counted. The short, cheap limits come first so a refused
 * message uses up as little as possible; the global budget is last, so a message that another limit already
 * refused never spends it. A signed-in caller skips the two anonymous scopes and an anonymous caller skips the
 * signed-in one (`only` on the rule).
 */
export const AI_CHAT_RATE_LIMIT_SCOPES = [
  "ai_chat_burst",
  "ai_chat_trial",
  "ai_chat_trial_ip",
  "ai_chat_user_day",
  "ai_chat_global_day",
] as const satisfies readonly RateLimitScope[];
