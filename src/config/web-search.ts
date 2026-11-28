/**
 * The numbers and names of the assistant's web search (ADR-218, owner decisions of 27 Nov 2026, `ai-chat-next-plan.md`
 * piece 5), in one file. Nothing about the web search is written anywhere else.
 *
 * Web search ships switched off: the server setting `FLAG_AI_WEB_SEARCH` stays `0` until the owner turns it on. The owner's
 * final list of trusted sites is below (28 Nov 2026).
 */

/**
 * The only websites a web search may read: the owner's final list (28 Nov 2026), trusted sites only, never a property
 * portal (a competitor). Each entry is a plain domain and covers its subdomains (OpenAI's `allowed_domains`), so
 * `tn.gov.in` also covers TN RERA, CMDA, DTCP, the Housing Board, the Urban Habitat Development Board, the Madras High
 * Court, Water Resources and Chennai Metro Water, and `indianrailways.gov.in` covers Southern Railway. The banks are on
 * their `.bank.in` addresses (RBI, from 31 Oct 2025); their old addresses only redirect. OpenAI takes at most 100.
 * OpenAI gives every entry the same weight: the order below is for people, the prompt says which kind to trust for what.
 */
export const WEB_SEARCH_TRUSTED_DOMAINS: readonly string[] = [
  // Government, RERA and legal authorities
  "tn.gov.in",
  "tnreginet.gov.in",
  "india.gov.in",
  "mohua.gov.in",
  "bis.gov.in",
  "indiacode.nic.in",
  "egazette.gov.in",
  "sci.gov.in",
  "ncdrc.nic.in",
  "consumeraffairs.nic.in",
  "nhb.org.in",
  "cpwd.gov.in",
  "lawmin.gov.in",
  "tnpcb.gov.in",
  "moef.gov.in",
  "greentribunal.gov.in",
  "surveyofindia.gov.in",
  "dolr.gov.in",
  // Banking, finance, taxation and official data
  "rbi.org.in",
  "sbi.bank.in",
  "hdfc.bank.in",
  "icici.bank.in",
  "axis.bank.in",
  "bankofindia.bank.in",
  "canarabank.bank.in",
  "unionbankofindia.bank.in",
  "bankofbaroda.bank.in",
  "lichousing.com",
  "incometax.gov.in",
  "gst.gov.in",
  "uidai.gov.in",
  "data.gov.in",
  "mospi.gov.in",
  // Infrastructure, planning, transport and research
  "chennaimetrorail.org",
  "indianrailways.gov.in",
  "nhai.gov.in",
  "morth.nic.in",
  "chennaicorporation.gov.in",
  "tnpdcl.org",
  "tneb.tnebnet.org",
  "aai.aero",
  "tidco.com",
  "tiic.org",
  "iihs.co.in",
  // Real estate news and industry research: trends and reports, not rules
  "economictimes.indiatimes.com",
  "moneycontrol.com",
  "business-standard.com",
  "thehindu.com",
  "thehindubusinessline.com",
  "livemint.com",
  "financialexpress.com",
  "cnbctv18.com",
  "ndtvprofit.com",
  "businesstoday.in",
  "indianexpress.com",
  "timesofindia.indiatimes.com",
  "hindustantimes.com",
  "deccanchronicle.com",
  "realtyplusmag.com",
  "constructionworld.in",
  "bcn.in",
  "jll.co.in",
  "cbre.co.in",
];

/** The most domains OpenAI's `allowed_domains` takes. */
export const WEB_SEARCH_MAX_DOMAINS = 100;

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
