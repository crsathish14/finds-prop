/**
 * Whether the customer asked for a link this message (ADR-209, owner decision 26 Nov 2026): the chat keeps the
 * customer in the conversation, so the "See all" link to the results page and the source links of an article or a
 * question are drawn only when the customer asks for one. The cards of homes and projects are not links in this sense:
 * they stay, because they are how a customer sees the photos and the details.
 *
 * Worked out by code from the customer's own words, never by the model, so the model cannot add a link the customer
 * did not ask for. Plain words only: a link, a page, a web site or address, the source, where something came from,
 * the full article, or to see all the results. "Show me all homes in Adyar" is a search, not a request for a link: the
 * chat answers it with cards and Show more.
 */
const LINK_REQUEST: readonly RegExp[] = [
  /\b(link|links|url|urls|web ?site|web ?page|web address)\b/iu,
  /\b(page|pages)\b/iu,
  /\b(source|sources)\b/iu,
  /\bwhere\b.*\b(from|found|get|got|read)\b/iu,
  /\b(full|whole|complete|entire|original)\s+(article|post|answer|list|results?)\b/iu,
  /\bread\s+(it|this|that|more|the\s+(full\s+)?(article|post|answer))\b/iu,
  /\b(see|view|open)\s+(them\s+)?all\b/iu,
  /\ball\s+(of\s+)?(the\s+)?(\d+\s+)?(results|matches)\b/iu,
];

/** True when the customer's message asks for a link, a page, the source or every result. */
export function askedForLink(customerMessage: string): boolean {
  return LINK_REQUEST.some((pattern) => pattern.test(customerMessage));
}
