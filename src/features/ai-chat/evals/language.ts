/**
 * Which language an answer is written in (AI-P8-T01, the "language" score): English, Tamil script, or Tanglish
 * (Tamil in English letters). A heuristic, on purpose: a script count for Tamil, and a short list of Tanglish
 * function words that are not English words for the rest. It is good enough to tell a Tamil customer's answer
 * from an English one in a report, and it is not a language-identification tool: a very short or number-only
 * answer is `unknown` and is not scored. The unit test pins how it reads each kind of text.
 */
import type { EvalLanguage } from "./case-schema";

export type DetectedLanguage = EvalLanguage | "unknown";

/** Names, numbers and links are the same in every language, so they say nothing about it. */
const NEUTRAL = /\[\[[^\]]*\]\]|https?:\/\/\S+|\b[\w.-]+@[\w.-]+\b|[₹\d][\d,.]*/gu;

const TAMIL_LETTER = /[஀-௿]/gu;
const LATIN_LETTER = /[A-Za-z]/gu;

/** A text counts as Tamil when at least this share of its letters is Tamil script (names and units stay Latin). */
const TAMIL_SHARE = 0.3;

/** Tanglish function words and common words that are not English words. Lower case, whole words. */
const TANGLISH_WORDS: ReadonlySet<string> = new Set([
  "irukku",
  "irukkum",
  "irukkunga",
  "irukkuthu",
  "irukkaanga",
  "illa",
  "illai",
  "venum",
  "venumna",
  "vendam",
  "pannunga",
  "pannalaam",
  "pannalam",
  "panna",
  "pannitu",
  "pannikalaam",
  "sollunga",
  "solren",
  "solluren",
  "paarunga",
  "paakalaam",
  "paakkalaam",
  "paarkalaam",
  "kidaikum",
  "kidaikkum",
  "kidaikkuthu",
  "kidaikala",
  "kidaikkala",
  "unga",
  "ungalukku",
  "ungaluku",
  "ungaloda",
  "ungalaala",
  "enakku",
  "unakku",
  "naan",
  "naama",
  "naanga",
  "neenga",
  "nenga",
  "inga",
  "anga",
  "enga",
  "romba",
  "konjam",
  "nalla",
  "rendu",
  "moonu",
  "naalu",
  "oru",
  "veedu",
  "veedugal",
  "veetu",
  "vaadagai",
  "vilai",
  "evlo",
  "evvalavo",
  "iruntha",
  "irundha",
  "aana",
  "aanaa",
  "athu",
  "ithu",
  "intha",
  "antha",
  "theriyala",
  "theriyum",
  "sari",
  "seri",
  "kaattunga",
  "kaatunga",
  "paatha",
  "paakka",
  "mudiyum",
  "mudiyathu",
  "mudiyaathu",
  "ellam",
  "ethuvum",
  "thevai",
  "thevaiyaana",
  "vaanga",
  "vaangalaam",
  "kudukkalaam",
  "sonneenga",
  "pathi",
  "patri",
  "thaan",
  "dhaan",
  "enna",
  "yaaru",
  "eppadi",
  "avanga",
]);

export interface LanguageReading {
  readonly language: DetectedLanguage;
  readonly tamilShare: number;
  readonly tanglishWords: number;
}

export function readLanguage(text: string): LanguageReading {
  const plain = text.replace(NEUTRAL, " ");
  const tamil = plain.match(TAMIL_LETTER)?.length ?? 0;
  const latin = plain.match(LATIN_LETTER)?.length ?? 0;
  const letters = tamil + latin;
  if (letters < 3) return { language: "unknown", tamilShare: 0, tanglishWords: 0 };
  const tamilShare = tamil / letters;
  if (tamilShare >= TAMIL_SHARE) return { language: "ta", tamilShare, tanglishWords: 0 };
  const words = plain.toLowerCase().match(/[a-z]+/gu) ?? [];
  const tanglishWords = words.filter((word) => TANGLISH_WORDS.has(word)).length;
  const tanglish = tanglishWords >= 2 || (tanglishWords >= 1 && words.length <= 10);
  return { language: tanglish ? "tanglish" : "en", tamilShare, tanglishWords };
}

export function detectLanguage(text: string): DetectedLanguage {
  return readLanguage(text).language;
}
