/**
 * Honest claims (ADR-207): a sentence that calls a home or project the cheapest, the largest or the best must be
 * backed by this turn's tool results, or it is taken out of the answer. The model is told the same in the prompt and
 * the tool descriptions; this is the check behind it, so a promotion (which only orders genuine matches) or a guess
 * can never become "the best project" or "the cheapest home" in front of the customer.
 *
 * - Price claims ("cheapest", "lowest price", "most affordable", "best deal"): backed by a record a result marks as the
 *   lowest (`lowestPriceOfMatches`, a comparison's `lowestHomeId` / `lowestSlug` of price or price per sq ft).
 * - Size claims ("largest", "biggest", "most spacious"): backed by `largestOfMatches` or a comparison's largest area.
 * - Quality claims ("the best project", "number one builder", "is the best"): no result can back one, so they are
 *   never let through, except when the sentence is conditional on the customer ("best if you want a pool") or says
 *   there is no single best.
 *
 * A backed sentence names a backed record (by its card marker or its name), or names no record at all while the turn
 * has a backed record or the customer asked for that very thing ("show me the cheapest"). Everything is read from
 * the parsed results here; nothing is stored or logged but a count.
 */
import type { CardReference } from "../tools/types";
import { UNTRUSTED_TEXT_KEY } from "../tools/untrusted";

export type ClaimKind = "price" | "size" | "quality";

const PRICE_CLAIM =
  /\b(?:cheapest|least expensive|most affordable|lowest[- ]priced|lowest (?:price|cost|rate)|best (?:price|deal|value|rate))\b/u;
const SIZE_CLAIM = /\b(?:largest|biggest|most spacious|roomiest)\b/u;
const LISTING_NOUN =
  "(?:homes?|flats?|apartments?|projects?|builders?|developers?|propert(?:y|ies)|villas?|plots?|options?|choices?|investments?|picks?|one)";
const QUALITY_CLAIM = new RegExp(
  String.raw`\b(?:best|finest|top[- ]rated|number one|no\. ?1)\s+(?:[\p{L}-]+\s+){0,2}?${LISTING_NOUN}\b|\b(?:is|are|would be)\s+(?:the|our|my)\s+(?:very\s+)?(?:best|finest|number one)\b(?!\s+(?:match|matches|fit|fits|way|time|thing))|\bno\. ?1\b|#1\b`,
  "u",
);
/** A sentence that ties "best" to the customer's own priorities, or denies a single best, makes no claim. */
const QUALITY_EXEMPT =
  /\b(?:if you|if your|depends on|depending on|for your needs|for your budget|whether you)\b|\b(?:no|not|isn't|is not|can't|cannot)\b[^.!?]{0,30}\bbest\b/u;

/** The claims a sentence makes (lower-case text, as the output check reads it). */
export function claimsIn(text: string): ClaimKind[] {
  const kinds: ClaimKind[] = [];
  if (PRICE_CLAIM.test(text)) kinds.push("price");
  if (SIZE_CLAIM.test(text)) kinds.push("size");
  if (QUALITY_CLAIM.test(text) && !QUALITY_EXEMPT.test(text) && !PRICE_CLAIM.test(text)) {
    kinds.push("quality");
  }
  return kinds;
}

/** What this turn's results back: the records that are the lowest-priced and the largest, and every record's name. */
export interface ClaimEvidence {
  /** `home:ID` and `project:SLUG` keys. */
  readonly lowest: ReadonlySet<string>;
  readonly largest: ReadonlySet<string>;
  /** Each record's key by its name or title, lower case (names of at least four characters only). */
  readonly names: ReadonlyMap<string, string>;
  /** The claims the customer's own message asks for. */
  readonly asked: ReadonlySet<ClaimKind>;
}

const NAME_MIN_CHARACTERS = 4;

function keyOf(node: Record<string, unknown>): string | null {
  if (typeof node["homeId"] === "string") return `home:${node["homeId"].toLowerCase()}`;
  if (typeof node["slug"] === "string" && typeof node["homeId"] !== "string") {
    return `project:${node["slug"].toLowerCase()}`;
  }
  return null;
}

function addGap(
  node: unknown,
  prefix: "home" | "project",
  into: Set<string>,
  end: "lowest" | "highest",
) {
  if (node === null || typeof node !== "object") return;
  const gap = node as Record<string, unknown>;
  const id = gap[prefix === "home" ? `${end}HomeId` : `${end}Slug`];
  if (typeof id === "string") into.add(`${prefix}:${id.toLowerCase()}`);
}

function walk(
  node: unknown,
  lowest: Set<string>,
  largest: Set<string>,
  names: Map<string, string>,
): void {
  if (Array.isArray(node)) {
    for (const item of node) walk(item, lowest, largest, names);
    return;
  }
  if (node === null || typeof node !== "object") return;
  const record = node as Record<string, unknown>;
  const key = keyOf(record);
  if (key !== null) {
    if (record["lowestPriceOfMatches"] === true) lowest.add(key);
    if (record["largestOfMatches"] === true) largest.add(key);
    const untrusted = record[UNTRUSTED_TEXT_KEY];
    if (untrusted !== null && typeof untrusted === "object") {
      for (const field of ["name", "title"]) {
        const name = (untrusted as Record<string, unknown>)[field];
        if (typeof name === "string" && name.trim().length >= NAME_MIN_CHARACTERS) {
          names.set(name.trim().toLowerCase(), key);
        }
      }
    }
  }
  const differences = record["differences"];
  if (differences !== null && typeof differences === "object") {
    const gaps = differences as Record<string, unknown>;
    const prefix = Array.isArray(record["homes"]) ? "home" : "project";
    addGap(gaps["price"], prefix, lowest, "lowest");
    addGap(gaps["pricePerSqft"], prefix, lowest, "lowest");
    addGap(gaps["area"], prefix, largest, "highest");
  }
  for (const [field, value] of Object.entries(record)) {
    if (field === UNTRUSTED_TEXT_KEY || field === "differences") continue;
    walk(value, lowest, largest, names);
  }
}

export function buildClaimEvidence(
  toolResults: readonly string[],
  customerMessage: string,
): ClaimEvidence {
  const lowest = new Set<string>();
  const largest = new Set<string>();
  const names = new Map<string, string>();
  for (const result of toolResults) {
    try {
      walk(JSON.parse(result), lowest, largest, names);
    } catch {
      // A result that is not JSON backs no claim.
    }
  }
  return {
    lowest,
    largest,
    names,
    asked: new Set(claimsIn(customerMessage.toLowerCase())),
  };
}

/** The records a sentence names: by its card markers, and by the names of the turn's records it holds. */
function namedIn(
  text: string,
  cards: readonly CardReference[],
  evidence: ClaimEvidence,
): Set<string> {
  const named = new Set<string>(
    cards.map((card) =>
      card.kind === "home"
        ? `home:${card.homeId.toLowerCase()}`
        : `project:${card.slug.toLowerCase()}`,
    ),
  );
  for (const [name, key] of evidence.names) if (text.includes(name)) named.add(key);
  return named;
}

/** Whether every claim the sentence makes is backed by this turn's results. */
export function claimsBacked(
  text: string,
  cards: readonly CardReference[],
  evidence: ClaimEvidence,
): boolean {
  const kinds = claimsIn(text);
  if (kinds.length === 0) return true;
  if (kinds.includes("quality")) return false;
  const named = namedIn(text, cards, evidence);
  return kinds.every((kind) => {
    const backed = kind === "price" ? evidence.lowest : evidence.largest;
    if (named.size === 0) return backed.size > 0 || evidence.asked.has(kind);
    return [...named].some((key) => backed.has(key));
  });
}
