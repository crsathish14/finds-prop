/**
 * The numbers and names of the AI chat assistant, in one file (ADR-128 sections 4.5 and 7, D9). None of
 * them is written in a prompt, a component or the agent loop: they all read from here.
 *
 * Three numbers here are marked placeholders (`owner to confirm`, docs/ai-chat-phase-plan.md, gate G-B) so the
 * limit exists and fails safe until the owner sets the real value: the daily budget and, for the whole message,
 * the route's `maxDuration`, the time limit and the hard stop (the two limits must stay below `maxDuration`).
 */

/** What the assistant calls the product in every piece of its own text. Lowercase on purpose (ADR-128, D11). */
export const ASSISTANT_BRAND_NAME = "findsprop";

/** The model is called at most this many times for one customer message; the last round only answers. */
export const MAX_MODEL_ROUNDS = 5;

/** Tool calls in all, across every round of one customer message. Parallel calls count toward it. */
export const MAX_TOOL_CALLS_PER_MESSAGE = 6;

/** Read tools that may run in parallel in one round. Propose tools always run alone. */
export const MAX_PARALLEL_READ_CALLS = 3;

/** How long one tool may take, in milliseconds, so a slow read cannot hold the whole turn. */
export const TOOL_TIMEOUT_MS = 3000;

/**
 * How long a provider call may stay silent, in milliseconds: no response yet, or no new event in the stream.
 * Every event restarts the clock, so a long answer that keeps streaming is never cut, and a call that goes
 * quiet is. An engineering limit; the time for the whole message is the endpoint's deadline, set separately.
 */
export const AI_PROVIDER_IDLE_TIMEOUT_MS = 20_000;

/** The longest customer message the assistant accepts, in characters. */
export const MAX_INPUT_CHARACTERS = 1000;

/**
 * What the endpoint accepts from the browser (ADR-128 section 6.1): the last user and assistant text turns, about
 * 12 messages, capped by size. The client sends no tool call, no tool result and no system text; a message of any
 * other shape is refused. The customer's own message is capped by `MAX_INPUT_CHARACTERS`.
 */
export const AI_MAX_HISTORY_MESSAGES = 12;

/** The longest earlier assistant answer the endpoint accepts back, in characters (an answer is at most about 1,200 tokens). */
export const AI_MAX_HISTORY_ANSWER_CHARACTERS = 5000;

/** The largest request body the endpoint reads, in bytes: 12 messages at their caps, with room for Tamil (three bytes a letter). */
export const AI_MAX_REQUEST_BYTES = 128 * 1024;

/**
 * PLACEHOLDER, owner to confirm (gate G-B): the route's `maxDuration`, in seconds. The route file must write the same
 * number as a plain value (Next.js reads it from the file); a test fails if they differ. The two limits below stay under it.
 */
export const AI_ROUTE_MAX_DURATION_SECONDS = 60;

/**
 * PLACEHOLDER, owner to confirm (gate G-B): the time for the whole message, in milliseconds ("below `maxDuration`",
 * ADR-128 section 4.5). When it passes, the model call in flight is cancelled and the loop answers from the tool
 * results it has, or gives the fixed fallback. The answer-only round that follows still needs time to run.
 */
export const AI_MESSAGE_TIME_LIMIT_MS = 40_000;

/**
 * PLACEHOLDER, owner to confirm (gate G-B): the hard stop, in milliseconds: nothing runs after it, so the stream ends
 * cleanly before the function is cut off. Between `AI_MESSAGE_TIME_LIMIT_MS` and the route's `maxDuration`.
 */
export const AI_MESSAGE_HARD_STOP_MS = 55_000;

/** The most tokens the model may write in one round ("about 1,200" in ADR-128 section 7). */
export const MAX_OUTPUT_TOKENS = 1200;

/** The most items one tool result holds ("at most 10 items and compact fields", ADR-128 section 5). */
export const MAX_TOOL_RESULT_ITEMS = 10;

/**
 * The longest piece of third-party text (a listing's description) a tool hands to the model, in characters.
 * Longer text is cut and the result says so, which keeps a tool result compact (ADR-128 section 5.4, test 4).
 * An engineering limit, not an owner decision: a listing's description may be 5,000 characters.
 */
export const MAX_UNTRUSTED_TEXT_CHARACTERS = 1500;

/**
 * The EMI defaults of the `calculate_emi` tool (ADR-128 section 5.2, decision D10). They are only used when
 * the customer gives no value of their own, and the assistant always shows them as "an example, not a bank
 * offer". The maths that uses them is `src/lib/emi.ts`.
 */

/** Down payment as a percentage of the price. */
export const EMI_DEFAULT_DOWN_PAYMENT_PERCENT = 20;

/** Loan term in years. */
export const EMI_DEFAULT_YEARS = 20;

/**
 * The example interest rate, in percent a year, set by the owner on 14 Nov 2026 (gate G-C). It is an
 * example for the maths, never a lender's offer or current rate, and no text may present it as one.
 */
export const EMI_EXAMPLE_ANNUAL_RATE_PERCENT = 7.2;

/**
 * Rate limits of the chat (ADR-128 section 7, decision D9; the rules are in `src/server/rate-limit/limits.ts`).
 * The counters live in the database; only the numbers are here.
 */

/** Anonymous visitors get this many free messages, then the sign-in gate (D2, D9). */
export const AI_TRIAL_MESSAGES = 2;

/**
 * The free trial counts over one year, so the window is 366 days. The database accepts at most this (migration
 * 20261114120000) and keeps the trial rows for 400 days. Do not raise it without a new migration.
 */
export const AI_TRIAL_WINDOW_SECONDS = 366 * 24 * 60 * 60;

/** A loose per-address backstop for anonymous messages a day. Many mobile users share one carrier address. */
export const AI_ANONYMOUS_IP_MESSAGES_PER_DAY = 40;

/** At most this many messages a minute from one caller, signed in or not (BR-73, the UX note). */
export const AI_BURST_MESSAGES_PER_MINUTE = 10;

/** A signed-in customer's messages a day ("adjust after cost data", ADR-128 section 7). */
export const AI_SIGNED_IN_MESSAGES_PER_DAY = 40;

/**
 * PLACEHOLDER, owner to confirm (gate G-B): the most messages the whole chat answers in a day, for every caller
 * together. When it is used up, the chat shows "AI search is unavailable right now". The owner has not set a
 * value; 1,000 is only a stand-in so the limit exists and fails safe. It is set for real in task AI-P8-T03.
 */
export const AI_GLOBAL_DAILY_MESSAGE_BUDGET = 1000;

/**
 * The anonymous cookie id (D13): a random first-party id that counts the free trial per browser. It is kept for
 * a year, the length of the trial, and used for nothing else. PLACEHOLDER wording of the cookie policy: owner to
 * confirm (gate G-E, legal review).
 */
export const AI_ANONYMOUS_COOKIE_NAME = "fp_ai_anon";
export const AI_ANONYMOUS_COOKIE_MAX_AGE_SECONDS = 365 * 24 * 60 * 60;

/**
 * The input pre-check (ADR-128 section 6.4.1, `src/features/ai-chat/guards/input.ts`). The word lists are here, in
 * one file, so that a rule is changed in one place. Every term is written in lower case, because the check lowercases
 * the message before it looks. The check saves cost, removes noise and protects privacy; it is not the security
 * boundary (the model has no write tool, no web tool and cannot make a link), and word lists are easy to get around
 * with spelling tricks. A false positive shows a refusal that says what to do next, and the tag counts in the usage
 * row show a rule that is too strict. A phrase that real customers use (a builder called Gemini, "no broker" flats,
 * "square yards", "I am a developer looking for land") is left out of the lists on purpose.
 */

/**
 * Other property portals: their names, common spellings and domains. A term made of Latin letters and digits matches
 * only as a whole word ("olx" does not match "solxyz"); a Tamil-script term also matches with an ending attached,
 * because Tamil joins its endings to the word, so it is written as a stem without its last pulli ("மேஜிக்பிரிக்ஸ" matches
 * both "மேஜிக்பிரிக்ஸ்" and "மேஜிக்பிரிக்ஸில்").
 */
export const AI_COMPETITOR_PORTAL_TERMS: readonly string[] = [
  "99acres",
  "99 acres",
  "99 acre",
  "99acres.com",
  "magicbricks",
  "magic bricks",
  "magicbricks.com",
  "housing.com",
  "nobroker",
  "nobroker.in",
  "commonfloor",
  "common floor",
  "commonfloor.com",
  "makaan.com",
  "proptiger",
  "prop tiger",
  "proptiger.com",
  "squareyards",
  "squareyards.com",
  "olx",
  "olx.in",
  "quikr",
  "quikr.com",
  "sulekha",
  "sulekha.com",
  "nestaway",
  "propertywala",
  "property wala",
  "realestateindia",
  "indiaproperty",
  "homeonline",
  "நோபுரோக்கர",
  "மேஜிக் பிரிக்ஸ",
  "மேஜிக்பிரிக்ஸ",
  "99 ஏக்கர்ஸ",
  "99ஏக்கர்ஸ",
  "ஹவுசிங்.காம்",
  "ஒலெக்ஸ",
  "குயிக்கர்",
];

/**
 * Obvious attempts to change the rules (a plain attack): the message is refused with the scope reply and tagged
 * `injection_suspected`. English, Tamil and Tanglish. Tamil puts the object before the verb, so a Tamil rule reads
 * "rules ... forget"; Tanglish usually keeps the English noun and adds a Tamil verb.
 */
export const AI_INSTRUCTION_ATTACK_PATTERNS: readonly RegExp[] = [
  /\b(ignore|disregard|forget|override|overrule)\b[^.!?\n]{0,25}\b(instructions?|rules?|prompts?|guidelines?|guardrails?|restrictions?)\b/u,
  /\b(developer|dev|god|jailbreak|unrestricted|dan|sudo) mode\b/u,
  /\bjail\s*break(ing|en)?\b/u,
  /\bdo anything now\b/u,
  /\b(remove|disable|bypass|break|lift) (all |any |your |the )?(restrictions|guardrails|safeguards|safety)\b/u,
  /\byou (have|are under) no (rules|restrictions|limits)\b/u,
  /\b(instructions?|rules?|prompt|restrictions?)\b[^.!?\n]{0,25}\b(ignore|ignor|marandhu|maranthu|vitturu)\w*/u,
  /\b(ignore|ignor|marandhu|maranthu|vitturu)\w*\s+(pannu|pannunga|pannidu|panni|seiyu|seyyu|vidu|viduga)\b[^.!?\n]{0,25}\b(instructions?|rules?|prompt)/u,
  /\b(ellam|ella|ellathaiyum|ellaathaiyum)\s+(marandhu|maranthu|ignore|vitturu)\w*/u,
  /(விதி|கட்டளை|அறிவுறுத்தல்|நிபந்தனை|ப்ராம்ப்ட்|பிராம்ப்ட்)\S*(\s+\S+){0,2}\s+(புறக்கணி|மறந்து|மறந்திடு|மீறு|நீக்கு)/u,
  /(டெவலப்பர்|டெவெலப்பர்|ஜெயில்பிரேக்|ஜெயில் பிரேக்)\s*(மோட்|பயன்முறை)/u,
];

/**
 * Doubtful: a phrase that is often an attack but can be innocent ("act as a friendly agent"). The message goes on,
 * tagged `injection_doubtful`, and a reminder line is added to this turn's instructions.
 */
export const AI_INSTRUCTION_DOUBTFUL_PATTERNS: readonly RegExp[] = [
  /\b(pretend|imagine|roleplay|role-play|role play)\b[^.!?\n]{0,30}\b(you|you're|you are|to be)\b/u,
  /\b(you are now|you're now|from now on you|from now on,? you|act as|behave as|new instructions?|new rules?|updated instructions?)\b/u,
  /(^|\n)\s*(system|assistant|developer)\s*:/u,
  /\[(system|inst|\/inst)\]|<\|?(system|im_start|im_end)\|?>/u,
  /இனி\s*(நீ|நீங்கள்)/u,
];

/**
 * Questions about how findsprop or the assistant is built, and claims of being the developer or an admin. The reply
 * is the fixed self-description, with no model call. English, Tamil and Tanglish. A word such as "database",
 * "model" or "code" alone is not enough, because customers use them about homes ("show me the pincode", "which
 * model flat"); the rule needs the word beside a question about the assistant or the site.
 */
export const AI_INTERNALS_PROBE_PATTERNS: readonly RegExp[] = [
  // The prompt, the instructions and what the assistant was told.
  /\b(system|initial|hidden|secret|original|master) (prompt|message|instructions?)\b/u,
  /\b(your|ur|the assistant's) (prompt|instructions|configuration|config)\b/u,
  /\b(reveal|show|print|display|leak|dump|share|tell|give|send|paste|repeat|recite|output|read out|list)\b[^.!?\n]{0,25}\b(prompt|your instructions|the instructions you|rules you (were|have been) given|what you were told)\b/u,
  /\b(repeat|print|show|say|write|recite|copy|output)\b[^.!?\n]{0,25}\b(everything|all|the text|the words|the message|the conversation)\b[^.!?\n]{0,15}\b(above|before|so far|earlier|prior)\b/u,
  /\bwhat (were|was|are) you (told|given|instructed|programmed|trained)\b/u,
  // The code, the repository, the stack and the data behind the site.
  /\b(source\s*code|your code|ur code|the codebase|code base|your repo|your repository|github repo|repository link)\b/u,
  /\b(show|share|give|send|reveal|leak|paste|dump|print)\b[^.!?\n]{0,15}\b(your (config|configuration|schema|secrets?|credentials?|api keys?|environment variables?|logs?)|the (secrets?|credentials?|api keys?|environment variables?))\b/u,
  /\b(api[ _-]?keys?|secret keys?|service[ _-]?role|env file|access tokens?|bearer tokens?)\b/u,
  /\b(supabase|postgres|postgresql|postgis|vercel|next\.?js|nextjs|tailwind|typescript|langchain|openai|anthropic)\b/u,
  /\b(are you|r u|do you use|you use|you using|powered by|based on|built on|built with|made by|running on|your model is)\s+(the |a )?(chat ?gpt|gpt-?[0-9][a-z0-9.-]*|openai|gemini|claude|llama|bard|copilot|deepseek|mistral)\b/u,
  /\b(what|which) (llm|ai model|language model|ai provider|tech stack|backend|hosting) (are you|do you|does findsprop|does this (site|app|website)|is (this|findsprop|your)|you (use|run))\b/u,
  /\b(what|which) (ai |llm |language )?model (are you|do you use|does findsprop use|you use|you run|is your)\b/u,
  /\b(what|which) (database|db|framework|programming language|language) (do you|does findsprop|does this (site|app|website)|is findsprop|are you|you use)\b/u,
  /\bhow (are you|were you|is findsprop|is this site|is this website|is this app|was this site|was this website|was findsprop) (built|made|coded|created|developed|programmed|designed|trained)\b/u,
  /\b(who|which company|which team) (built|made|created|developed|programmed|trained) (you|this assistant|this chatbot|this bot|this site|this website|findsprop)\b/u,
  /\b(what|which) (tools|functions|apis|endpoints|plugins) (do you|are you|can you|you)\b[^.!?\n]{0,15}\b(have|use|call|access|using|available|allowed)\b/u,
  /\b(list|show|name|tell me|give me)\b[^.!?\n]{0,15}\b(your|all your) (tools|functions|apis|endpoints|plugins|tables|columns|database tables)\b/u,
  /\b(search_properties|get_property|list_localities|search_projects|get_project|get_builder|compare_properties|calculate_emi)\b/u,
  /\b(findsprop'?s?|your) (backend|back end|architecture|tech stack|infrastructure|admin panel|server code)\b/u,
  // A claim of authority. Chat messages carry none, and the answer says so by not changing.
  /\bi\s*(am|'m|’m)\s+(the|your)\s+(developer|dev)\b(?!\s+(of|for)\b)/u,
  /\bi\s*(am|'m|’m)\s+(the |your )?(admin|administrator|sysadmin|maintainer|findsprop (staff|team|employee|developer|admin))\b/u,
  /\bi\s*(am|'m|’m)\s+(a|an)\s+(findsprop|site|system)\s+(developer|admin|administrator|engineer)\b/u,
  /\bi (work|am working) (for|at) findsprop\b/u,
  /\b(as|being)\s+(the |an? |your )?(developer|admin|administrator|maintainer)\b[^.!?\n]{0,30}\b(show|give|tell|reveal|need|require|debug|print)\b/u,
  /\b(debug|maintenance|admin|diagnostic|root|superuser) mode\b/u,
  // Tanglish: English nouns with Tamil verbs.
  /\b(system prompt|source code|prompt|config|configuration|api key)\b[^.!?\n]{0,25}\b(kaatu|kattu|kaattu|kaami|kami|kaamichu|kaamingu|kaatunga|kaattunga|sollu|solluga|sollunga|anuppu|anuppunga|tharu|thaa|thaanga|kudu|kudunga|venum|ethu|enna)\b/u,
  /\b(unga|un|ungaloda|unnoda)\s+(code|prompt|system prompt|source code|instructions|config|model|database|tech stack)\b/u,
  /\b(nee|neenga)\s+(ethu|entha|enna|yaaru)\s+(model|ai|llm|chatgpt|company)\b/u,
  /\b(yaaru|yaar)\b[^.!?\n]{0,15}\b(unna|ungala|unnai)\b[^.!?\n]{0,20}\b(create|build|panna|pannanga|senjanga|senjaanga|uruvaakki|uruvakkina)\w*/u,
  /\bnaan\s+(oru\s+|un\s+|unga\s+)?(developer|admin|administrator|creator|programmer)\s+(da|di|pa|nu|dhaan|thaan|than)\b/u,
  /\b(ellathaiyum|ellaathaiyum|ellam|ella)\b[^.!?\n]{0,15}\b(repeat|sollu|kaattu|kaatu|print)\b/u,
  // Tamil script.
  /(சிஸ்டம்|சிஸ்டெம்)\s*(ப்ராம்ப்ட்|பிராம்ப்ட்|ப்ரோம்ப்ட்|இன்ஸ்ட்ரக்ஷன்)/u,
  /(சோர்ஸ்|மூல)\s*(கோட்|கோடு|குறியீடு)/u,
  /(உன்|உங்கள்|உங்க|உன்னோட|உங்களோட)\s*(கோட்|கோடு|குறியீட்டை|குறியீடு|கட்டளைகள்|கட்டளைகளை|அறிவுறுத்தல்|டேட்டாபேஸ்|தரவுத்தளம்)/u,
  /(ஏபிஐ|API)\s*(கீ|சாவி|விசை)/u,
  /(டேட்டாபேஸ்|தரவுத்தளம்|சர்வர்|பின்தளம்)\s*(எது|காட்டு|காண்பி|சொல்லு|சொல்)/u,
  /(நீ|நீங்கள்|நீங்க)\s*(எந்த|என்ன)\s*(மாடல்|ஏஐ|ஏ\.ஐ|நிறுவனம்|தொழில்நுட்பம்)/u,
  /(உன்னை|உங்களை)\s*(யார்|எவர்)\s*(உருவாக்கி|உருவாக்கின|கட்டினார்|கட்டின)/u,
  /(நான்|நா)\s*(ஒரு\s+)?(டெவலப்பர்|டெவெலப்பர்|அட்மின்|நிர்வாகி)\s*(தான்|டா|டி)/u,
  /(எல்லாவற்றையும்|எல்லாத்தையும்|மேலே\s*உள்ள)\s*[^.!?\n]{0,15}(திரும்ப|மீண்டும்)\s*(சொல்|சொல்லு|எழுது)/u,
];

/** Flooding: more than this many of the same character in a row is noise, not a question ("aaaaaaaa…"). */
export const AI_FLOOD_MAX_CHARACTER_RUN = 20;

/** Flooding: a message of at least this many words that uses only a few different words is noise. */
export const AI_FLOOD_MIN_WORDS = 12;

/** Flooding: for that many words, no more than this share may be different ones (0.25 = one in four). */
export const AI_FLOOD_MAX_DISTINCT_WORD_SHARE = 0.25;

/**
 * Flooding: the same message sent again. A customer may well send a message a second time (a retry after an error),
 * so only the third in a row counts: this many earlier customer messages must be exactly the same.
 */
export const AI_FLOOD_REPEATED_MESSAGES = 2;

/** What each kind of personal data is replaced with, so the model sees that something was there and not what. */
export const AI_MASK_PLACEHOLDERS = {
  email: "[email removed]",
  phone: "[phone number removed]",
  aadhaar: "[id number removed]",
  pan: "[id number removed]",
  card: "[card number removed]",
} as const;

/**
 * The output check (ADR-128 section 6.4.2, `src/features/ai-chat/guards/output.ts`). Same rules as the input lists:
 * every term is lower case (the check lowercases the text first), the lists are easy to get around and are one layer
 * among several (the model has no write tool, no web tool and cannot make a link), and a phrase that real answers
 * use is left out on purpose (a builder called Gemini, "developed by", "database" alone).
 */

/**
 * The answer is held back until a sentence ends and each sentence is checked before it is sent. A very long sentence
 * is cut at the last space before this many characters, so the customer never waits for a whole paragraph.
 */
export const AI_SEGMENT_MAX_CHARACTERS = 300;

/** A run of this many words copied word for word from the system prompt counts as a prompt leak. */
export const AI_PROMPT_COPY_RUN_WORDS = 8;

/**
 * Endings that make a bare word.word a web address ("kadalhomes.com") in an answer. A decimal number ("1.5") or an
 * abbreviation ("e.g.") never has one of these after the dot. An address with `http`, `https` or `www` is found
 * without this list.
 */
export const AI_LINK_TLDS: readonly string[] = [
  "com",
  "in",
  "co",
  "net",
  "org",
  "io",
  "app",
  "dev",
  "info",
  "biz",
  "me",
  "ly",
  "ai",
  "tv",
  "xyz",
  "online",
  "site",
  "store",
  "link",
  "page",
  "test",
  "example",
];

/**
 * What the assistant must never say about how it or the site is built: a tool name, the stack, the provider, a
 * secret, the prompt. A match replaces the answer with the fixed self-description (`ai.refuseInternals`) and is
 * tagged `internals_leak`. English, Tamil and Tanglish (the technical words are Latin letters in Tanglish).
 */
export const AI_INTERNALS_LEAK_PATTERNS: readonly RegExp[] = [
  // The tools by name.
  /\b(search_properties|get_property|compare_properties|search_projects|get_project|get_builder|list_localities|calculate_emi|propose_enquiry|propose_site_visit)\b/u,
  // The stack and the provider.
  /\b(supabase|postgres|postgresql|postgis|vercel|next\.?js|tailwind|typescript|langchain|openai|anthropic|chat ?gpt|gpt-?[0-9][a-z0-9.-]*)\b/u,
  /\b(large language model|language model|llm)\b/u,
  // What the assistant says about itself: "I am Gemini", "I run on Claude". A builder called Gemini stays allowed.
  /\b(i am|i'm|i’m|i was|i run on|i'm running on|i use|i'm using|my model is|i am powered by|i'm powered by|i am built on|i'm built on|i am based on|i'm based on)\s+(the |a |an )?(gemini|claude|llama|bard|copilot|deepseek|mistral|gpt)\b/u,
  // The prompt and the rules it holds.
  /\b(system|developer|hidden|initial|original) (prompt|instructions|message)\b/u,
  /\b(my|these|the) (instructions|rules|prompt) (say|says|state|states|tell|tells|are|were)\b[^.!?\n]{0,30}\b(i|me|must|should|never)\b/u,
  // Secrets, code and data structure.
  /\b(api[ _-]?keys?|secret keys?|service[ _-]?role|env file|access tokens?|bearer tokens?)\b/u,
  /\benvironment variables?\b/u,
  /\b(source\s*code|codebase|code base|the repository|github repo|database (table|schema|columns?)|(table|column) (named|called))\b/u,
  /\b(my|our|the assistant's|findsprop'?s) (backend|back end|architecture|tech stack|infrastructure|server code)\b/u,
  // How a tool was used: "I used the search tool".
  /\b(i|i've|i have|we) (used|called|ran|invoked|triggered)\b[^.!?\n]{0,30}\b(tool|function|api|endpoint)\b/u,
  // Tamil script: the stack and the prompt written as the Tamil letters sound.
  /(ஓபன்\s*ஏ\.?\s*ஐ|சூபாபேஸ்|சுபாபேஸ்|வெர்செல்|போஸ்ட்கிரெஸ்|டைப்ஸ்கிரிப்ட்|சிஸ்டம்\s*(ப்ராம்ப்ட்|பிராம்ப்ட்)|சோர்ஸ்\s*(கோட்|கோடு))/u,
];

/**
 * Advice and guarantee words: legal or financial advice, a promised return, "legally safe". The text stays and the
 * fixed disclaimer line is added after the answer (tag `advice_phrase`). English, Tanglish and Tamil; the Tanglish
 * and Tamil lists are a first set for the owner to extend.
 */
export const AI_ADVICE_PHRASE_PATTERNS: readonly RegExp[] = [
  /\b(guaranteed?|assured)\b[^.!?\n]{0,25}\b(returns?|profits?|appreciation|gains?|income|resale|growth)\b/u,
  /\b(returns?|profits?|appreciation|gains?)\b[^.!?\n]{0,15}\b(are|is|will be)\s+(guaranteed|assured)\b/u,
  /\b(risk[- ]free|zero[- ]risk|no[- ]risk|sure[- ]shot|surefire)\b/u,
  /\b(definitely|certainly|surely|guaranteed to|sure to|bound to|certain to)\b[^.!?\n]{0,20}\b(appreciate|go up|rise|double|increase in value|gain value)\b/u,
  /\b(legally|100%|completely|totally|absolutely) (safe|clear|valid|secure|sound)\b/u,
  /\bno (legal|title|legal or title) (issues?|problems?|disputes?|risks?)\b/u,
  /\byou (should|must|need to|ought to|have to) (definitely |surely |certainly )?(buy|invest in|invest|purchase|book|go for)\b/u,
  /\b(i|we) (recommend|advise|suggest) (that )?(you )?(to )?(buy|buying|invest|investing|purchase|purchasing)\b/u,
  /\b(best|safest|perfect|ideal) (investment|time to buy|time to invest)\b/u,
  /\b(can'?t|cannot|won'?t|can’t|won’t) (go wrong|lose|fail)\b/u,
  // Tanglish.
  /\b(kandippa|kandipa|nichayama)\b[^.!?\n]{0,25}\b(price|vilai|laabam|labam|profit|return|appreciate)\w*/u,
  /\b(neenga|nee)\s+(kandippa\s+|nichayama\s+)?(vaanganum|vaanga venum|vaangunga|vangunga|invest pannunga|invest panna venum)\b/u,
  // Tamil script.
  /(உறுதியான|நிச்சயமான|உத்தரவாதமான)\s*(லாபம்|வருமானம்|வருவாய்)/u,
  /நிச்சயம்[^.!?\n]{0,20}(விலை\s*(உயரும்|ஏறும்)|லாபம்)/u,
  /(சட்டப்படி|சட்டரீதியாக)\s*(பாதுகாப்பான|பாதுகாப்பு|சரியான)/u,
  /(நீங்கள்|நீங்க)\s*(கண்டிப்பாக\s*|நிச்சயமாக\s*)?(வாங்க\s*வேண்டும்|வாங்குங்கள்|முதலீடு\s*செய்யுங்கள்)/u,
];
