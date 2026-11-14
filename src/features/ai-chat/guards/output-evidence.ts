/**
 * What the output check may let an answer repeat: the facts of this turn (ADR-128 section 6.4.2). It is built once
 * per customer message from the tool results the model was given, the records those results named, the
 * customer's own message and the system prompt. Nothing here is stored or logged.
 *
 * Contacts are taken by key, as `public-contacts.ts` promises: a phone only from a `contactPhone` field, a web
 * address only from a `website` field, and never from inside `untrustedText`, because a number in a description
 * is something a stranger typed and not a contact the platform gave.
 */
import { AI_LINK_TLDS, AI_PROMPT_COPY_RUN_WORDS } from "@/config/ai";
import type { ToolReference } from "../tools/types";
import { UNTRUSTED_TEXT_KEY } from "../tools/untrusted";
import { groundingFigures } from "./number-grounding";

export interface OutputEvidenceInput {
  /** The text of every tool result of this turn, exactly as the model received it (JSON). */
  readonly toolResults: readonly string[];
  /** Every home and project those results named (the `references` of the agent's `done` event). */
  readonly references: readonly ToolReference[];
  /** The customer's latest message, as sent to the model (a figure they wrote is theirs to hear again). */
  readonly customerMessage: string;
  /** The random string placed in the system prompt (P4-T03); `null` when no prompt is in use yet. */
  readonly canary: string | null;
  /** The system prompt, to find long runs copied from it; `null` to skip that check. */
  readonly promptText?: string | null;
}

export interface OutputEvidence {
  /** The digits of each phone number a tool result gave as a contact. */
  readonly phones: ReadonlySet<string>;
  /** Each web address a tool result gave as a contact, in the form `normalizeAddress` writes. */
  readonly addresses: ReadonlySet<string>;
  readonly homeIds: ReadonlySet<string>;
  readonly projectSlugs: ReadonlySet<string>;
  /** Figures (see `groundingFigures`) from the tool results and the customer's message. */
  readonly figures: ReadonlySet<string>;
  /** The canary with everything but letters and digits removed, lower case; `null` when there is none. */
  readonly canaryCompact: string | null;
  /** Every run of `AI_PROMPT_COPY_RUN_WORDS` words of the system prompt, as one lower-case string. */
  readonly promptRuns: ReadonlySet<string>;
}

/** The canary is only used if it is long enough not to match ordinary text by chance. */
const CANARY_MIN_CHARACTERS = 6;

export function compactText(text: string): string {
  return text.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
}

/** The words of a text (letters, marks and digits), lower case, for comparing runs. */
export function wordsOfText(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^\p{L}\p{M}\p{N}]+/u)
    .filter((word) => word.length > 0);
}

/** The digits of a phone number as written. */
export function phoneDigits(written: string): string {
  return written.replace(/\D/g, "");
}

/** Whether a phone number in an answer is one of the given ones, with or without the country code or a leading 0. */
export function phoneIsGiven(written: string, phones: ReadonlySet<string>): boolean {
  const digits = phoneDigits(written);
  if (digits === "") return false;
  for (const given of phones) {
    if (
      digits === given ||
      digits === `91${given}` ||
      given === `91${digits}` ||
      digits === `0${given}` ||
      given === `0${digits}`
    ) {
      return true;
    }
  }
  return false;
}

/** A web address in one comparable form: lower case, no scheme, no `www.`, no closing punctuation or final slash. */
export function normalizeAddress(written: string): string {
  return written
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//u, "")
    .replace(/^www\./u, "")
    .replace(/[\s.,;:!?)\]}>'"”’]+$/u, "")
    .replace(/\/+$/u, "");
}

const TLD_ALTERNATIVES = AI_LINK_TLDS.join("|");

/** A web address with a scheme or `www`, up to a space or a closing bracket or quote. */
const ADDRESS_WITH_SCHEME = /(?:https?:\/\/|www\.)[^\s<>"'\])}]+/giu;

/** A bare address such as `kadalhomes.com/about`: dotted words ending in a known ending. */
const BARE_ADDRESS = new RegExp(
  String.raw`(?<![\p{L}\p{N}@./:-])(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+(?:${TLD_ALTERNATIVES})(?![\p{L}\p{N}-])(?:[/?#][^\s<>"'\])}]*)?`,
  "giu",
);

/** The web addresses in a text (lower case, digits 0 to 9), as written. Email addresses must be taken out first. */
export function findAddresses(text: string): string[] {
  const found: string[] = [];
  const rest = text.replace(ADDRESS_WITH_SCHEME, (match) => {
    found.push(match);
    return " ";
  });
  for (const match of rest.matchAll(BARE_ADDRESS)) found.push(match[0]);
  return found;
}

/** Walks a parsed tool result for the two contact keys, leaving `untrustedText` alone. */
function collectContacts(node: unknown, phones: Set<string>, addresses: Set<string>): void {
  if (Array.isArray(node)) {
    for (const item of node) collectContacts(item, phones, addresses);
    return;
  }
  if (node === null || typeof node !== "object") return;
  for (const [key, value] of Object.entries(node)) {
    if (key === UNTRUSTED_TEXT_KEY) continue;
    if (key === "contactPhone" && typeof value === "string") {
      const digits = phoneDigits(value);
      if (digits !== "") phones.add(digits);
    } else if (key === "website" && typeof value === "string") {
      const address = normalizeAddress(value);
      if (address !== "") addresses.add(address);
    } else {
      collectContacts(value, phones, addresses);
    }
  }
}

/** Every run of `size` words of the text, each as one string. */
export function wordRuns(words: readonly string[], size: number): string[] {
  const runs: string[] = [];
  for (let start = 0; start + size <= words.length; start += 1) {
    runs.push(words.slice(start, start + size).join(" "));
  }
  return runs;
}

export function buildEvidence(input: OutputEvidenceInput): OutputEvidence {
  const phones = new Set<string>();
  const addresses = new Set<string>();
  const figures = new Set<string>(groundingFigures(input.customerMessage));

  for (const result of input.toolResults) {
    for (const figure of groundingFigures(result)) figures.add(figure);
    try {
      collectContacts(JSON.parse(result), phones, addresses);
    } catch {
      // A result that is not JSON holds no contact the check may allow; its figures still count.
    }
  }

  const homeIds = new Set<string>();
  const projectSlugs = new Set<string>();
  for (const reference of input.references) {
    if (reference.kind === "home") homeIds.add(reference.homeId.toLowerCase());
    else projectSlugs.add(reference.slug.toLowerCase());
  }

  const canaryCompact =
    input.canary !== null && compactText(input.canary).length >= CANARY_MIN_CHARACTERS
      ? compactText(input.canary)
      : null;

  const promptRuns = new Set<string>(
    input.promptText ? wordRuns(wordsOfText(input.promptText), AI_PROMPT_COPY_RUN_WORDS) : [],
  );

  return { phones, addresses, homeIds, projectSlugs, figures, canaryCompact, promptRuns };
}
