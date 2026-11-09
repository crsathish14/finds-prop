import { DEFAULT_SUBMISSION_RANGE, type LeadKind, type SubmissionRange } from "./constants";
import type { AnswerValue } from "./view";

/** The name of each kind among the words (keys are plain names, so "site_visit" is "siteVisit"). */
export const KIND_KEYS = {
  enquiry: "enquiry",
  site_visit: "siteVisit",
  brochure: "brochure",
} as const satisfies Record<LeadKind, string>;

/** The name of each date choice among the words (keys start with a letter, so "7" is "days7"). */
export const RANGE_KEYS = {
  "7": "days7",
  "30": "days30",
  "90": "days90",
  all: "all",
} as const satisfies Record<SubmissionRange, string>;

/**
 * A stored mobile number as the admin reads it and as a call link. Ten digits are an Indian mobile, shown in two
 * groups of five ("98410 55512"); twelve digits that start with 91 carry the country code ("+91 98410 55512");
 * anything else is shown as it is, because a number we cannot read is better shown than guessed at.
 */
export function phoneParts(digits: string): { text: string; href: string } {
  if (/^[0-9]{10}$/.test(digits)) {
    return { text: `${digits.slice(0, 5)} ${digits.slice(5)}`, href: `tel:${digits}` };
  }
  if (/^91[0-9]{10}$/.test(digits)) {
    return {
      text: `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`,
      href: `tel:+${digits}`,
    };
  }
  return { text: digits, href: `tel:${digits}` };
}

/** An answer as text: a list is its items with commas, yes and no are the given words, a number is its digits. */
export function answerText(value: AnswerValue, words: { yes: string; no: string }): string {
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "boolean") return value ? words.yes : words.no;
  return String(value);
}

/** How far away a retry is, in the largest whole unit that is not zero; "soon" when it is due or past. */
export function retryDelay(
  nextRetryAt: string,
  now: number,
): { unit: "soon" } | { unit: "minutes" | "hours" | "days"; count: number } {
  const minutes = Math.ceil((Date.parse(nextRetryAt) - now) / 60_000);
  if (!Number.isFinite(minutes) || minutes < 1) return { unit: "soon" };
  if (minutes < 60) return { unit: "minutes", count: minutes };
  const hours = Math.round(minutes / 60);
  if (hours < 24) return { unit: "hours", count: hours };
  return { unit: "days", count: Math.round(hours / 24) };
}

/** Where the admin's Leads page lives. */
export const LEADS_PATH = "/admin/leads";

/**
 * The address of the Leads page for some choices: the tab and, on the submissions tab, its filters. What is the
 * default (the project leads tab, the last 30 days, no form, project or source, any CRM state) is left out of the
 * address (R-FE-11), and the page cursor is never in it: "Show more" adds rows to the page in place.
 */
export function leadsHref(choice: {
  tab: "leads" | "submissions";
  range?: SubmissionRange | undefined;
  form?: string | undefined;
  project?: string | undefined;
  source?: string | undefined;
  crm?: string | undefined;
}): string {
  if (choice.tab === "leads") return LEADS_PATH;
  const query = new URLSearchParams({ tab: "submissions" });
  if (choice.range && choice.range !== DEFAULT_SUBMISSION_RANGE) query.set("range", choice.range);
  if (choice.form) query.set("form", choice.form);
  if (choice.project) query.set("project", choice.project);
  if (choice.source) query.set("source", choice.source);
  if (choice.crm && choice.crm !== "any") query.set("crm", choice.crm);
  return `${LEADS_PATH}?${query.toString()}`;
}
