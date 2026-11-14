/**
 * Personal data masking, the third rule of the input pre-check (ADR-128 sections 6.4.1 and 6.4.3). A phone number,
 * an email, an Aadhaar-like number, a PAN or a card-like number in a customer's message is replaced with a
 * placeholder before the model sees it, so a pasted number can never become a search key or be repeated. A phone or
 * email for an enquiry comes from the signed-in account, never from the chat.
 *
 * Pure and deterministic. It takes the cleaned text (digits already written 0 to 9, see `cleanMessage`), reports
 * which kinds it found, and never returns, logs or stores what it removed. Masking errs on the side of removing
 * too much: a long run of digits that is not really a card does no harm when it is replaced.
 */
import { AI_MASK_PLACEHOLDERS } from "@/config/ai";

export type PersonalDataKind = "email" | "phone" | "aadhaar" | "pan" | "card";

interface MaskRule {
  readonly kind: PersonalDataKind;
  readonly pattern: RegExp;
}

/**
 * The order matters: an email can hold digits, a card holds runs that look like a phone or an Aadhaar number, and a
 * phone with its country code holds 12 digits, so the longer and more specific shapes go first.
 */
const MASK_RULES: readonly MaskRule[] = [
  {
    kind: "email",
    pattern: /[\p{L}\p{N}._%+-]+@[\p{L}\p{N}-]+(?:\.[\p{L}\p{N}-]+)*\.\p{L}{2,}/gu,
  },
  // 13 to 19 digits: grouped 4-4-4-x, Amex 4-6-5, or in one run.
  { kind: "card", pattern: /(?<!\d)\d{4}[\s-]\d{4}[\s-]\d{4}[\s-]\d{1,7}(?!\d)/g },
  { kind: "card", pattern: /(?<!\d)\d{4}[\s-]\d{6}[\s-]\d{5}(?!\d)/g },
  { kind: "card", pattern: /(?<!\d)\d{13,19}(?!\d)/g },
  // Indian mobile numbers, with or without the country code, in one run or split 5-5 or 3-3-4.
  { kind: "phone", pattern: /(?<!\d)(?:\+\s?91[\s-]?|91[\s-]?|0)?[6-9]\d{4}[\s-]?\d{5}(?!\d)/g },
  { kind: "phone", pattern: /(?<!\d)[6-9]\d{2}[\s-]\d{3}[\s-]\d{4}(?!\d)/g },
  // A landline with its area code, and any other number written with a country code.
  { kind: "phone", pattern: /(?<!\d)0\d{2,4}[\s-]\d{3,4}[\s-]?\d{3,4}(?!\d)/g },
  { kind: "phone", pattern: /\+\d{1,3}[\s-]?\d(?:[\s-]?\d){7,11}(?!\d)/g },
  // Aadhaar-like: 12 digits, in one run or grouped 4-4-4, not starting with 0 or 1.
  { kind: "aadhaar", pattern: /(?<!\d)[2-9]\d{3}[\s-]?\d{4}[\s-]?\d{4}(?!\d)/g },
  // PAN: five letters, four digits, one letter.
  { kind: "pan", pattern: /(?<![\p{L}\p{N}])[A-Za-z]{5}\d{4}[A-Za-z](?![\p{L}\p{N}])/gu },
];

export interface MaskedText {
  /** The text with every piece of personal data replaced by its placeholder. */
  readonly text: string;
  /** Which kinds were found, once each, in the order the rules ran. Empty when nothing was removed. */
  readonly kinds: readonly PersonalDataKind[];
}

export function maskPersonalData(cleanedText: string): MaskedText {
  let text = cleanedText;
  const kinds: PersonalDataKind[] = [];
  for (const rule of MASK_RULES) {
    let found = false;
    text = text.replace(rule.pattern, () => {
      found = true;
      return AI_MASK_PLACEHOLDERS[rule.kind];
    });
    if (found && !kinds.includes(rule.kind)) kinds.push(rule.kind);
  }
  return { text, kinds };
}

/** An email address or phone number found in text, as it was written. */
export interface FoundContact {
  readonly kind: "email" | "phone";
  readonly value: string;
}

/**
 * The emails and phone numbers in a text, for the output check (the assistant's answer may only repeat a number
 * that a tool result gave). It runs the same rules in the same order as `maskPersonalData`, so a card number is not
 * mistaken for a phone, but reports what it found and leaves the text alone. A card, Aadhaar-like or PAN match is
 * consumed and not reported. Returns the values only so the caller can compare them and must not store or log them.
 */
export function findContacts(cleanedText: string): readonly FoundContact[] {
  const found: FoundContact[] = [];
  let text = cleanedText;
  for (const rule of MASK_RULES) {
    text = text.replace(rule.pattern, (match) => {
      if (rule.kind === "email" || rule.kind === "phone") {
        found.push({ kind: rule.kind, value: match });
      }
      return " ";
    });
  }
  return found;
}
