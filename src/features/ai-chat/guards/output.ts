/**
 * The output check and the segmenter (ADR-128 section 6.4.2): what the assistant writes is held back until a sentence
 * ends, and each sentence is checked before it is sent. If one fails, the stream stops, the client receives a
 * `replace` event that swaps the whole message for a fixed line, and the turn ends as `blocked`.
 *
 * What it is not: the security boundary. The model has no write tool, no web tool and cannot make a link; this check
 * catches the one wrong sentence that could still get through, and word lists are easy to get around. A check that
 * throws fails closed (the fixed fallback), never unchecked text.
 *
 * Rules, in the order they run on each segment:
 * 1. Prompt leak: the canary string, or a long run copied from the system prompt. Blocks.
 * 2. Internals disclosure: a tool name, the stack, the provider, a secret, how the assistant is built. Blocks, with
 *    the fixed self-description. Tag `internals_leak`.
 * 3. Competitor portals: the same list as the input rule. Blocks.
 * 4. Contact allow-list: a phone number, email or web address must be one a tool result gave this turn as a contact
 *    (a project's `contactPhone`, a builder's `website`). Anything else blocks.
 * 5. Card and id validation: a reference to a home or project (`[[home:ID]]`, `[[project:SLUG]]`, or a `/properties/…`
 *    or `/projects/…` path) must name a record a tool returned this turn. A known one becomes a `card` event and is
 *    taken out of the text; an unknown one is dropped, the text stays, and it is counted (`unknown_reference`).
 * 6. Advice and guarantee phrases: the text stays and the fixed disclaimer line follows the answer (`advice_phrase`).
 * 7. Number grounding: SHADOW MODE. Figures that no tool result or customer message holds are counted and logged;
 *    nothing is changed or blocked until the offline evals show an acceptable false-positive rate.
 * 8. Format: Markdown and HTML are removed, silently.
 *
 * Nothing here stores, logs or returns the text it matched, only rule tags and counts (R-BE-10). Every sentence a
 * customer reads that this file chooses is an `en.json` key; the endpoint turns a key into text with `translate`.
 * The Tamil lines of the fixed replies are not supplied (decision D12), so every language gets the English line:
 * owner to confirm.
 */
import {
  AI_ADVICE_PHRASE_PATTERNS,
  AI_INTERNALS_LEAK_PATTERNS,
  AI_PROMPT_COPY_RUN_WORDS,
  AI_SEGMENT_MAX_CHARACTERS,
} from "@/config/ai";
import { logger } from "@/server/logger";
import type { ToolReference } from "../tools/types";
import { namesCompetitorPortal } from "./competitors";
import {
  buildEvidence,
  compactText,
  findAddresses,
  normalizeAddress,
  phoneIsGiven,
  wordRuns,
  wordsOfText,
  type OutputEvidence,
  type OutputEvidenceInput,
} from "./output-evidence";
import { stripFormat } from "./output-format";
import { countUngroundedFigures, withAsciiDigits } from "./number-grounding";
import { findContacts } from "./personal-data";

export type { OutputEvidenceInput } from "./output-evidence";

/** The fixed lines this check points at, as `en.json` keys. */
export const OUTPUT_MESSAGE_KEYS = {
  /** A blocked answer: the same fixed fallback as a turn that could not finish. */
  fallback: "ai.fallback",
  /** An answer that described how the assistant or the site is built: the fixed self-description. */
  internals: "ai.refuseInternals",
  /** The line that follows an answer with an advice or guarantee phrase. */
  disclaimer: "ai.disclaimer",
} as const;

export type OutputReplaceKey =
  typeof OUTPUT_MESSAGE_KEYS.fallback | typeof OUTPUT_MESSAGE_KEYS.internals;

/** The rule names for the usage row. Only the name and a count are ever kept, never the text. */
export type OutputTag =
  | "prompt_leak"
  | "internals_leak"
  | "competitor"
  | "contact_blocked"
  | "unknown_reference"
  | "advice_phrase"
  | "format_stripped"
  | "check_failed";

/** The rules that stop an answer. The others only change it or count it. */
export type OutputBlockTag = Extract<
  OutputTag,
  "prompt_leak" | "internals_leak" | "competitor" | "contact_blocked" | "check_failed"
>;

/** What the segmenter sends on, in order. */
export type OutputEvent =
  /** A checked, plain-text piece of the answer. Send it as it is. */
  | { readonly type: "text"; readonly text: string }
  /** A home or project the answer refers to, and a tool returned this turn: draw its card (built by code). */
  | { readonly type: "card"; readonly reference: ToolReference }
  /** The fixed disclaimer, after the last text of an answer that used an advice or guarantee phrase. */
  | { readonly type: "notice"; readonly messageKey: typeof OUTPUT_MESSAGE_KEYS.disclaimer }
  /** Swap the whole message for the fixed line. The stream stops; nothing more is sent. */
  | {
      readonly type: "replace";
      readonly messageKey: OutputReplaceKey;
      readonly rule: OutputBlockTag;
    };

export interface OutputSummary {
  /** `blocked` when a `replace` event was sent. */
  readonly outcome: "passed" | "blocked";
  /** The rules that fired, once each, in the order they first fired. */
  readonly tags: readonly OutputTag[];
  /** How often each rule fired. */
  readonly counts: Readonly<Partial<Record<OutputTag, number>>>;
  /** Shadow rules: counted and logged, never changing the answer. */
  readonly shadow: { readonly numberUngrounded: number };
}

export interface OutputGuard {
  /** Gives the guard the next piece of the model's answer; returns the events that may be sent now (maybe none). */
  push(delta: string): readonly OutputEvent[];
  /** The answer is complete: checks and releases what is still held, then the disclaimer if one is due. */
  finish(): readonly OutputEvent[];
  summary(): OutputSummary;
}

// ---------------------------------------------------------------- cleaning

const INVISIBLE = /[\p{Cc}\p{Cf}\p{Co}\p{Cs}]/gu;

/** The segment as it is sent: composed (NFKC), invisible characters removed except the line break and the two joiners. */
function cleanSegment(segment: string): string {
  return segment
    .normalize("NFKC")
    .replace(/\r\n?/g, "\n")
    .replace(/\t/g, " ")
    .replace(INVISIBLE, (character) => {
      const code = character.codePointAt(0) ?? 0;
      return code === 0x0a || code === 0x200c || code === 0x200d ? character : "";
    });
}

/** The text the rules look at: Tamil digits as 0 to 9, lower case, no joiners, every run of space as one space. */
function checkableText(cleaned: string): string {
  return withAsciiDigits(cleaned)
    .toLowerCase()
    .replace(/[‌‍]/g, "")
    .replace(/[^\S\n]+/g, " ");
}

// ---------------------------------------------------------------- references

const CARD_MARKER = /\[\[\s*(home|project)\s*:\s*([^\]\s]{1,80})\s*\]\]/giu;
/** An internal path such as `/properties/velachery-flat-k3m9p2xw`; one after a host is a web address and is not this. */
const INTERNAL_PATH = /(?<![\p{L}\p{N}_/.:-])\/(properties|projects)\/([\p{L}\p{N}-]+)/giu;
/** A home's public id: 8 characters, as the database allows them. */
const HOME_ID = /[a-hjkmnp-z2-9]{8}$/u;

interface ReferenceOutcome {
  readonly text: string;
  readonly cards: readonly ToolReference[];
  readonly unknown: number;
}

function resolveReferences(
  text: string,
  evidence: OutputEvidence,
  references: readonly ToolReference[],
): ReferenceOutcome {
  const cards: ToolReference[] = [];
  let unknown = 0;

  const lookUp = (kind: "home" | "project", written: string): void => {
    const id = written.toLowerCase();
    const found = references.find((reference) =>
      reference.kind === "home"
        ? kind === "home" && reference.homeId.toLowerCase() === id
        : kind === "project" && reference.slug.toLowerCase() === id,
    );
    const known = kind === "home" ? evidence.homeIds.has(id) : evidence.projectSlugs.has(id);
    if (found !== undefined && known) cards.push(found);
    else unknown += 1;
  };

  const withoutMarkers = text.replace(CARD_MARKER, (_match, kind: string, id: string) => {
    lookUp(kind.toLowerCase() === "home" ? "home" : "project", id);
    return "";
  });
  const withoutPaths = withoutMarkers.replace(
    INTERNAL_PATH,
    (_match, kind: string, slug: string) => {
      if (kind.toLowerCase() === "properties") {
        const shortId = HOME_ID.exec(slug.toLowerCase())?.[0];
        if (shortId === undefined) unknown += 1;
        else lookUp("home", shortId);
      } else {
        lookUp("project", slug);
      }
      return "";
    },
  );
  return { text: withoutPaths, cards, unknown };
}

// ---------------------------------------------------------------- one segment

type SegmentVerdict =
  | { readonly kind: "block"; readonly rule: OutputBlockTag; readonly messageKey: OutputReplaceKey }
  | {
      readonly kind: "pass";
      readonly text: string;
      readonly cards: readonly ToolReference[];
      readonly tags: readonly OutputTag[];
      readonly numberUngrounded: number;
    };

function block(rule: OutputBlockTag, messageKey: OutputReplaceKey = OUTPUT_MESSAGE_KEYS.fallback) {
  return { kind: "block", rule, messageKey } as const;
}

function matchesAny(patterns: readonly RegExp[], text: string): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

/** Something to remember between segments, so a run that straddles two of them is still seen. */
interface Carry {
  words: string[];
  compact: string;
}

function leaksPrompt(checkable: string, evidence: OutputEvidence, carry: Carry): boolean {
  const compact = compactText(checkable);
  let leaked = false;
  if (evidence.canaryCompact !== null) {
    leaked = `${carry.compact}${compact}`.includes(evidence.canaryCompact);
    carry.compact = `${carry.compact}${compact}`.slice(-(evidence.canaryCompact.length - 1));
  }
  if (evidence.promptRuns.size > 0) {
    const words = [...carry.words, ...wordsOfText(checkable)];
    if (wordRuns(words, AI_PROMPT_COPY_RUN_WORDS).some((run) => evidence.promptRuns.has(run))) {
      leaked = true;
    }
    carry.words = words.slice(-(AI_PROMPT_COPY_RUN_WORDS - 1));
  }
  return leaked;
}

/** Whether every phone number, email and web address in the text is a contact a tool gave this turn. */
function contactsAllowed(checkable: string, evidence: OutputEvidence): boolean {
  let rest = checkable;
  for (const contact of findContacts(checkable)) {
    if (contact.kind === "email") return false;
    if (!phoneIsGiven(contact.value, evidence.phones)) return false;
  }
  // Take the emails out before looking for addresses, so that "a@b.com" is not read as the address "b.com".
  for (const contact of findContacts(checkable)) rest = rest.split(contact.value).join(" ");
  return findAddresses(rest).every((address) => evidence.addresses.has(normalizeAddress(address)));
}

function checkSegment(
  segment: string,
  evidence: OutputEvidence,
  references: readonly ToolReference[],
  carry: Carry,
): SegmentVerdict {
  const cleaned = cleanSegment(segment);
  const checkable = checkableText(cleaned);

  if (leaksPrompt(checkable, evidence, carry)) return block("prompt_leak");
  if (matchesAny(AI_INTERNALS_LEAK_PATTERNS, checkable)) {
    return block("internals_leak", OUTPUT_MESSAGE_KEYS.internals);
  }
  if (namesCompetitorPortal(checkable)) return block("competitor");

  // References first: a path such as /properties/… is a reference to check, and not a web address.
  const resolved = resolveReferences(cleaned, evidence, references);
  if (!contactsAllowed(checkableText(resolved.text), evidence)) return block("contact_blocked");

  const tags: OutputTag[] = [];
  for (let count = 0; count < resolved.unknown; count += 1) tags.push("unknown_reference");
  if (matchesAny(AI_ADVICE_PHRASE_PATTERNS, checkable)) tags.push("advice_phrase");

  const numberUngrounded = countUngroundedFigures(checkable, evidence.figures);

  const stripped = stripFormat(resolved.text);
  if (stripped.changed) tags.push("format_stripped");

  return {
    kind: "pass",
    text: stripped.text,
    cards: resolved.cards,
    tags,
    numberUngrounded,
  };
}

// ---------------------------------------------------------------- the segmenter

/** A sentence ends at . ! ? । or … (and any closing quote or bracket), followed by space and then more text. */
const SENTENCE_END = /[.!?।…]+["'”’)\]]*[^\S\n]+(?=\S)|\n+(?=\S)/gu;

/** The index just after the first sentence of the buffer, or -1 while the sentence is still going. */
function firstSentenceEnd(buffer: string): number {
  for (const match of buffer.matchAll(SENTENCE_END)) {
    const end = match.index + match[0].length;
    const terminator = match[0].trimEnd();
    const before = buffer[match.index - 1] ?? "";
    const next = buffer[end] ?? "";
    // "Rs. 50 L" and "No. 5" are not the end of a sentence: a full stop after a letter, before a digit.
    if (terminator === "." && /\p{L}/u.test(before) && /\d/.test(next)) continue;
    return end;
  }
  return -1;
}

/** Where to cut a sentence that has gone on too long: at a space, never inside a number such as "90000 12345". */
function forcedCut(buffer: string): number {
  for (let index = AI_SEGMENT_MAX_CHARACTERS; index > 0; index -= 1) {
    const character = buffer[index] ?? "";
    if (!/\s/u.test(character)) continue;
    if (/\d/.test(buffer[index - 1] ?? "") && /\d/.test(buffer[index + 1] ?? "")) continue;
    return index + 1;
  }
  return AI_SEGMENT_MAX_CHARACTERS;
}

/**
 * Starts the output check for one customer message. Give it the evidence of the turn (see `OutputEvidenceInput`),
 * push the model's text deltas in, and send the events it returns. After `finish()` (or a `replace`) it is done.
 */
export function createOutputGuard(input: OutputEvidenceInput): OutputGuard {
  const counts: Partial<Record<OutputTag, number>> = {};
  const tags: OutputTag[] = [];
  let numberUngrounded = 0;
  let buffer = "";
  let blocked = false;
  let finished = false;
  let disclaimerDue = false;
  const sentCards = new Set<string>();
  const carry: Carry = { words: [], compact: "" };

  const count = (tag: OutputTag, times = 1): void => {
    if (times <= 0) return;
    counts[tag] = (counts[tag] ?? 0) + times;
    if (!tags.includes(tag)) tags.push(tag);
  };

  let evidence: OutputEvidence | null = null;
  try {
    evidence = buildEvidence(input);
  } catch {
    evidence = null;
  }

  const stop = (rule: OutputBlockTag, messageKey: OutputReplaceKey): OutputEvent[] => {
    blocked = true;
    buffer = "";
    count(rule);
    // The rule's name and nothing else: the blocked text is never logged (R-BE-10).
    logger.warn("ai output blocked", { rule });
    return [{ type: "replace", messageKey, rule }];
  };

  const release = (segment: string): OutputEvent[] => {
    if (evidence === null) return stop("check_failed", OUTPUT_MESSAGE_KEYS.fallback);
    let verdict: SegmentVerdict;
    try {
      verdict = checkSegment(segment, evidence, input.references, carry);
    } catch {
      return stop("check_failed", OUTPUT_MESSAGE_KEYS.fallback);
    }
    if (verdict.kind === "block") return stop(verdict.rule, verdict.messageKey);

    for (const tag of verdict.tags) count(tag);
    if (verdict.tags.includes("advice_phrase")) disclaimerDue = true;
    numberUngrounded += verdict.numberUngrounded;

    const events: OutputEvent[] = [];
    if (verdict.text !== "") events.push({ type: "text", text: verdict.text });
    for (const reference of verdict.cards) {
      const key =
        reference.kind === "home" ? `home:${reference.homeId}` : `project:${reference.slug}`;
      if (sentCards.has(key)) continue;
      sentCards.add(key);
      events.push({ type: "card", reference });
    }
    return events;
  };

  const drain = (final: boolean): OutputEvent[] => {
    const events: OutputEvent[] = [];
    while (!blocked) {
      let end = firstSentenceEnd(buffer);
      if (end === -1 && buffer.length > AI_SEGMENT_MAX_CHARACTERS) end = forcedCut(buffer);
      if (end === -1) break;
      const segment = buffer.slice(0, end);
      buffer = buffer.slice(end);
      events.push(...release(segment));
    }
    if (final && !blocked && buffer !== "") {
      const segment = buffer;
      buffer = "";
      events.push(...release(segment));
    }
    return events;
  };

  return {
    push(delta) {
      if (blocked || finished) return [];
      buffer += delta;
      return drain(false);
    },
    finish() {
      if (blocked || finished) return [];
      finished = true;
      const events = drain(true);
      const blockedNow = events.some((event) => event.type === "replace");
      if (!blockedNow && disclaimerDue) {
        events.push({ type: "notice", messageKey: OUTPUT_MESSAGE_KEYS.disclaimer });
      }
      if (numberUngrounded > 0) {
        // Shadow mode: a count only, so the evals can show how often this rule would fire.
        logger.info("ai output number grounding (shadow)", { ungroundedFigures: numberUngrounded });
      }
      return events;
    },
    summary() {
      return {
        outcome: blocked ? "blocked" : "passed",
        tags: [...tags],
        counts: { ...counts },
        shadow: { numberUngrounded },
      };
    },
  };
}

/** The whole answer at once, for tests and for text that is not streamed. Same rules, same events. */
export function checkOutput(
  answer: string,
  input: OutputEvidenceInput,
): { events: readonly OutputEvent[]; summary: OutputSummary } {
  const guard = createOutputGuard(input);
  const events = [...guard.push(answer), ...guard.finish()];
  return { events, summary: guard.summary() };
}
