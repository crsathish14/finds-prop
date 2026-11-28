/**
 * The numbers and names of the assistant's web search (ADR-218, owner decisions of 27 Nov 2026, `ai-chat-next-plan.md`
 * piece 5), in one file. Nothing about the web search is written anywhere else.
 *
 * Web search ships switched off: the server setting `FLAG_AI_WEB_SEARCH` stays `0` until the owner has sent the final list
 * of trusted sites and it is written below (ADR-218, amended 28 Nov 2026).
 */

/**
 * The only websites a web search may read (owner, 27 Nov 2026: trusted sites only, never a competitor's site). A site
 * includes its subdomains (OpenAI's `allowed_domains`), so `tn.gov.in` also covers the Tamil Nadu departments on it.
 *
 * STARTING SUGGESTION from the plan, not yet the owner's final list (the owner sends it later): the registration
 * department, TN RERA, CMDA, DTCP, the TN Housing Board, the Tamil Nadu government, the RBI, the income tax department,
 * and the home-loan pages of SBI, HDFC Bank, ICICI Bank and LIC Housing Finance.
 */
export const WEB_SEARCH_TRUSTED_DOMAINS: readonly string[] = [
  "tnreginet.gov.in",
  "rera.tn.gov.in",
  "cmdachennai.gov.in",
  "dtcp.tn.gov.in",
  "tnhb.tn.gov.in",
  "tn.gov.in",
  "rbi.org.in",
  "incometax.gov.in",
  "sbi.co.in",
  "homeloans.sbi",
  "hdfcbank.com",
  "icicibank.com",
  "lichousing.com",
];

/** Where the searches are made for: Tamil Nadu, India (OpenAI's approximate user location). */
export const WEB_SEARCH_USER_LOCATION = {
  type: "approximate",
  country: "IN",
  region: "Tamil Nadu",
} as const;

/**
 * How long `search_web` may take, in milliseconds (owner, 27 Nov 2026: "about 15 s, like builder research"), so a slow
 * search cannot use up the 40 s of the message. The search itself is stopped a second earlier, so the tool can still
 * report what was spent.
 */
export const WEB_SEARCH_TIMEOUT_MS = 15_000;
export const WEB_SEARCH_REQUEST_TIMEOUT_MS = WEB_SEARCH_TIMEOUT_MS - 1000;

/** How long a web answer is kept and given again to anyone who asks the same thing (owner, 27 Nov 2026: 7 days). */
export const WEB_ANSWER_MEMORY_DAYS = 7;

/** Web searches per customer message (owner, 27 Nov 2026: at most 1). No daily cap: the message limits bound it. */
export const MAX_WEB_SEARCH_CALLS_PER_MESSAGE = 1;

/** The longest search words the assistant may write, in characters (the memory's own limit is 200). */
export const WEB_SEARCH_QUERY_MAX_CHARACTERS = 200;

/** The longest web answer kept and handed to the model, in characters (the memory's own limit is 4,000). */
export const WEB_ANSWER_MAX_CHARACTERS = 4000;

/** The most sources one web answer keeps (the memory's own limit is 5). */
export const WEB_ANSWER_MAX_SOURCES = 5;

/** The most tokens the web search call may write: a short factual answer. */
export const WEB_SEARCH_MAX_OUTPUT_TOKENS = 800;

/**
 * The prices the admin AI assistant page estimates this month's spend with (ADR-218), in US dollars. An estimate from
 * our own records, never a bill: OpenAI's billing page has the exact amount. Change the numbers and the date together
 * when a price changes.
 *
 * Read on 27 Nov 2026: the model page of gpt-6-luna (input $0.10, cached input $0.01, output $0.50 per million tokens)
 * and the tools page ($10 per 1,000 calls of the `web_search` tool; the page text it reads is billed as model input,
 * which is in the tokens of the usage row).
 */
export const AI_PRICES = {
  checkedOn: "2026-11-27",
  model: "gpt-6-luna",
  inputUsdPerMillionTokens: 0.1,
  cachedInputUsdPerMillionTokens: 0.01,
  outputUsdPerMillionTokens: 0.5,
  webSearchUsdPerCall: 0.01,
} as const;
