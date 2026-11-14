/**
 * The other-property-portal rule, shared by the input pre-check (a customer's message) and the output check (the
 * assistant's answer), so both read the same list: `AI_COMPETITOR_PORTAL_TERMS` in `src/config/ai.ts`.
 */
import { AI_COMPETITOR_PORTAL_TERMS } from "@/config/ai";

function escapeForRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** One pattern for the whole list. A Latin term must stand alone; a Tamil term may take an ending. */
const COMPETITOR_PATTERN = new RegExp(
  AI_COMPETITOR_PORTAL_TERMS.map((term) => {
    const body = escapeForRegExp(term).replace(/ /g, "\\s*");
    return /[a-z0-9.]$/.test(term)
      ? `(?<![\\p{L}\\p{N}])${body}(?![\\p{L}\\p{N}])`
      : `(?<![\\p{L}\\p{N}])${body}`;
  }).join("|"),
  "u",
);

/** Whether the text (already lower case, spaces collapsed) names another property portal. */
export function namesCompetitorPortal(matchable: string): boolean {
  return COMPETITOR_PATTERN.test(matchable);
}
