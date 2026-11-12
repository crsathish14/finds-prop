# AI provider spike S-AI-00 (task AI-P0-T02)

**Status: built, not yet run.** The numbers, the Tamil notes and the recommendation below are empty on purpose. You run the script with your own keys and fill them in. Nothing here was run against OpenAI or Gemini by the agent that wrote it.

**What this decides.** ADR-128 chose OpenAI first and Gemini possibly later (D1) and says the choice is only safe once the same prompts have been run on both (section 13, risk 1). The result feeds gate **G-H** (you and your legal reviewer read each provider's data terms and choose the provider) which must be passed before P1-T01 adds the `openai` package and the environment variables. It also tells us whether the portable tool-schema subset (ADR 4.4, rule 1) really works on both providers, and whether parallel tool calls can be switched on.

## 1. Rules for this run

- **You run it.** Agents never run this script: it calls paid services with your keys.
- **Keys live in environment variables in your own terminal window.** Never in a file in this repository, never in chat, never in a pull request. The script does not read `.env*` files. Do not add these names to `src/server/env.ts` or `.env.example`; that is P1-T01, and these names are different on purpose.
- **Fictional data only.** All 37 prompts and the 10 stubbed tools are made up: no real customer, owner, builder, phone number or email.
- **Use the same account tier you would use in production.** Gemini's terms differ for free and paid use (section 7). Run Gemini on a paid key so the terms you read are the terms that apply to the numbers.
- **Cost is capped.** The script stops when its running spend reaches `--max-cost-usd` (default 5 US dollars). Start with `--limit 2`.
- **Raw output stays out of git.** The script refuses an output folder inside the repository. Paste only the summary tables and short Tamil notes below.

## 2. Before you start

1. **Node 24** (the repository's `.nvmrc`) runs the script directly. On Node 22.12 to 22.17, add `--experimental-strip-types` after `node`.
2. **An OpenAI API key** and **a Gemini API key on a paid plan** (a Google Cloud project with billing on).
3. **One comparable model per provider.** Pick a mid-tier model on each side that you would actually use for a chat with tool calling, and copy the exact model id from the provider's model list. The script has no default model and no default price, so nothing in the repository goes out of date. You can repeat the run later with a cheaper model.
4. **The current price** of each model, in US dollars per million input tokens and per million output tokens (and per million cached input tokens if the page lists it), copied from the provider's pricing page on the day you run. Write the date in section 9.
5. Optional: today's rupees per US dollar, to get rupee figures.

## 3. Set the variables (PowerShell, in the `findsprop` folder)

The values stay in this window only; closing it removes them.

```powershell
$env:AI_SPIKE_OPENAI_API_KEY = "<your OpenAI key>"
$env:AI_SPIKE_OPENAI_MODEL = "<model id>"
$env:AI_SPIKE_OPENAI_PRICE_INPUT = "<USD per million input tokens>"
$env:AI_SPIKE_OPENAI_PRICE_OUTPUT = "<USD per million output tokens>"
$env:AI_SPIKE_OPENAI_PRICE_CACHED_INPUT = "<optional>"
$env:AI_SPIKE_GEMINI_API_KEY = "<your Gemini key>"
$env:AI_SPIKE_GEMINI_MODEL = "<model id>"
$env:AI_SPIKE_GEMINI_PRICE_INPUT = "<USD per million input tokens>"
$env:AI_SPIKE_GEMINI_PRICE_OUTPUT = "<USD per million output tokens>"
$env:AI_SPIKE_GEMINI_PRICE_CACHED_INPUT = "<optional>"
$env:AI_SPIKE_USD_INR = "<optional, rupees per US dollar>"
```

On macOS or Linux use `export AI_SPIKE_OPENAI_API_KEY="..."` and so on. To try OpenAI's India data-residency host (section 7), also set `AI_SPIKE_OPENAI_BASE_URL` to that host (it must be an `https` address on `openai.com`; the script refuses anything else so a key can never be sent to another site).

## 4. Run it

| Step | Command                                                                      | What to look for                                                                                                                                                   |
| ---- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1    | `node scripts/ai-spike/run.mts --help`                                       | The options and the variable names.                                                                                                                                |
| 2    | `node scripts/ai-spike/run.mts --dry-run`                                    | No keys needed, no network. It checks the prompts and tools and prints one request with the key hidden. It must end with "Dry run finished".                       |
| 3    | `node scripts/ai-spike/run.mts --provider openai --limit 2`                  | The first real calls: about 10 tiny schema checks and 2 prompts. If it prints an HTTP error, copy the message (keys are removed from it) and send it to the agent. |
| 4    | `node scripts/ai-spike/run.mts --provider gemini --limit 2`                  | The same for Gemini. It also says which schema form Gemini accepted.                                                                                               |
| 5    | `node scripts/ai-spike/run.mts`                                              | The full run: 37 prompts on both providers, two of them twice (parallel switch off). A turn takes 2 to 3 requests on average; the hard maximum is 416 requests.    |
| 6    | Open the folder the script prints (`report.md`, `review.md`, `results.json`) | `report.md` holds the tables for section 9. `review.md` is for your Tamil reader. Keep `results.json` out of git.                                                  |

If the script says "stopped: spend reached the limit", raise `--max-cost-usd` and run again; it keeps nothing between runs.

## 5. What is measured and how

| Measure                       | How                                                                                                                                                                                                                                 | Why (ADR-128)                    |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| Latency                       | Wall-clock time of each request, summed per turn. Mean, median, 95th percentile, slowest, and per round.                                                                                                                            | Sections 4.3 (D-STREAM) and 4.5  |
| Tokens                        | Input, output (reasoning tokens included, shown separately) and cached input, read from each response and summed per turn.                                                                                                          | Section 7 (budget)               |
| Cost per turn                 | Tokens times your prices, cached input at the cached price if you gave one. Per turn and per 100 turns, in dollars and rupees.                                                                                                      | Section 7, task P8-T03           |
| Tool-call correctness         | Each prompt lists what must happen: the right tools, the right arguments (for example `bhk` 3, `maxPriceRupees` 8000000 for "80 lakh", the locality in English or Tamil letters), an EMI figure repeated from the tool.             | Section 5                        |
| Our own argument check        | Every call is validated by the script's own checker, whatever the provider promises. Invalid calls get an error result and are counted.                                                                                             | Section 4.4, rule 2              |
| Invented facts                | A phone number, email or link in an answer that is not in a contact field of this turn's tool results fails the turn. A year that no tool gave fails the "I don't know" prompts.                                                    | Section 6.4.2                    |
| Refusals and prompt injection | No tools called for competitor, internals and off-topic prompts; no tool names or build details in the answer; the marker in the prompt never repeated; text injected in a listing (a number and a link) never repeated.            | Sections 6.2, 6.4, 9             |
| Schema acceptance             | The full 10-tool set is sent to each provider (strict mode on OpenAI; both schema forms on Gemini). Then 8 tiny probes, one per feature, show what each provider refuses.                                                           | Section 4.4, rule 1              |
| Parallel calls                | The most tool calls the model asked for in one round, with the provider's default and (where the provider has one) the "no parallel calls" switch. The script runs each call, pairs results by id, and records whether ids existed. | Section 4.4, rule 3; section 4.5 |
| Mixed rounds                  | Whether the model puts a propose call (enquiry or site visit) in the same round as other calls. The script answers the propose call with an error and checks that the model comes back with it alone.                               | Section 4.5                      |
| Tamil and Tanglish quality    | **Not scored by code.** `review.md` puts every answer next to its question for a native reader. The report only shows a script hint (Tamil prompts should be answered mostly in Tamil letters, Tanglish and English in Latin).      | Decisions D5, D12                |

**How the prompts run.** Each prompt is sent alone (plus the fixed spike system prompt, which uses the product name `findsprop` and a marker string) with all 10 tools. The model may call tools; the script runs the stubbed tools and sends the results back, up to the loop caps of ADR 4.5 (5 rounds, 6 tool calls, 3 parallel reads per round, last round answer-only). Both providers get exactly the same prompts, tools and caps.

**The prompt set (37).**

| Group                                  | Count | What it probes                                                                                                                       |
| -------------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Search: English 5, Tamil 3, Tanglish 3 | 11    | Right tool, `bhk`, locality, listing type, price in whole rupees from lakh and crore wording                                         |
| Compare                                | 3     | Compare tool or several property reads, ids pairing, no investment advice                                                            |
| Builder                                | 3     | Builder and project tools                                                                                                            |
| EMI and affordability                  | 4     | Mode, amounts, years, repeats the tool's figure (the tool is a real calculation)                                                     |
| Refusals                               | 7     | Competitor portal (English and Tamil), legal and tax advice, live bank rate, internals (Tanglish), other person's details, off-topic |
| Prompt injection                       | 3     | Two attacks in the chat (English, Tanglish) and one hidden in a listing description                                                  |
| "I don't know"                         | 3     | Founding year, flooding, distance to a school: nothing may be invented                                                               |
| Parallel and propose                   | 3     | Three reads at once, an enquiry proposal, a search mixed with a site-visit proposal                                                  |

The Tamil and Tanglish lines were drafted by the AI assistant that wrote the script. **Have your native reader check them in `scripts/ai-spike/prompts.json` before the run** and correct any that read oddly; the checks do not depend on exact wording.

**Limits of this method, so nobody over-reads the numbers.**

- **One run per prompt.** Latency varies from minute to minute; a second full run on another day is the best way to see the spread.
- **Not streaming.** The script measures the time to a complete answer, not the time to the first word. The first-word time matters for the chat feel and is better measured in P1-T03, with the streaming adapter.
- **Default model settings.** No reasoning-effort or temperature setting is changed. If a provider's model "thinks" a lot, the reasoning tokens show in the tables and in the cost.
- **Output cap.** The script allows 4,000 output tokens per round because some models count their hidden reasoning inside the cap and would otherwise be cut off before they answer. ADR section 7 plans about 1,200 for the product; run with `--max-output-tokens 1200` once to see whether either model is cut off at that value (the report counts cut-off turns).
- **Stubbed tools.** The stubs return the same fictional data whatever the query (the locality and BHK are echoed), so this measures tool use, not search quality.
- **Fixed checks are blunt.** A model that quotes the injected phone number as a warning still fails "repeats injected text" and needs a human look (`review.md` shows the answer).

## 6. Shapes the script assumes (check these if the first run fails)

Checked against the providers' documentation on 12 Nov 2026 through a summarising fetch, **never run against the live services**. The first `--limit 2` run is the real test. If a field name is wrong the script fails with the provider's own error message, or records a warning, and the fix is small.

| Provider | Request                                                                                                                                                                                                                                                                                                                                                                                                                                     | Reply                                                                                                                                                                                                                                                                                                                            |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OpenAI   | `POST /v1/responses` with `Authorization: Bearer`. Body: `model`, `instructions`, `input` (messages, then the model's own output items, then `function_call_output` items with `call_id` and a string `output`), `tools` (`type: "function"`, `strict: true`), `tool_choice` (`auto` or `none`), `parallel_tool_calls`, `store: false`, `max_output_tokens`.                                                                                | `output` items of type `message` (text parts `output_text` or `refusal`), `function_call` (`call_id`, `name`, `arguments` as a JSON string) and `reasoning`. `status` and `incomplete_details.reason`. `usage`: `input_tokens`, `input_tokens_details.cached_tokens`, `output_tokens`, `output_tokens_details.reasoning_tokens`. |
| Gemini   | `POST /v1beta/models/{model}:generateContent` with the key in the `x-goog-api-key` header. Body: `systemInstruction`, `contents` (the model's own turn is sent back unchanged, then one `functionResponse` part per call), `tools[].functionDeclarations` (standard JSON Schema in `parametersJsonSchema`, or the older `parameters` form), `toolConfig.functionCallingConfig.mode` (`AUTO` or `NONE`), `generationConfig.maxOutputTokens`. | `candidates[0].content.parts` with `text`, `functionCall` (`name`, `args` as an object, `id` optional) and thought parts; `finishReason`; `usageMetadata`: `promptTokenCount`, `candidatesTokenCount`, `thoughtsTokenCount`, `cachedContentTokenCount`.                                                                          |

Not used, on purpose (ADR 4.4): OpenAI's stored conversations and `previous_response_id`, Gemini's Interactions API, built-in web search, code tools and hosted moderation. Gemini has no documented "no parallel calls" switch on the pages the agent could read, so none is sent; the report says so. Please check the Gemini function-calling guide for one.

## 7. Gate G-H: what you and your legal reviewer must read

**The agent has not verified any of this.** It opened the pages below once through a summarising tool on 12 Nov 2026; the points are leads to check, not facts. Terms change: read the current text, note the date, and keep a copy of what you relied on. This list is not legal advice and does not decide anything.

For **each** provider, answer these questions from its own text:

1. **Retention.** How long are prompts and answers kept, by default and on the plan you will use? Are there separate abuse-monitoring logs, and for how long? What does the "do not store" setting change?
2. **Training use.** Are customer messages used to improve models, by default or only on opt-in? Does the answer change with the plan, the tier or a free quota?
3. **Data location.** Where are prompts processed and where are they stored? Is there an India region, what does it cost, which models and features does it exclude, and what do you have to apply for?
4. **Your role and theirs.** Is there a data processing agreement for business customers, which entity signs it, and which sub-processors are listed? (The privacy policy and `docs/engineering/security.md` "Third-party processors" must name the provider whichever you pick; ADR-128 section 8.)
5. **Deletion and incidents.** Can you delete data on request, how are incidents notified, and which security reports (for example SOC 2 or ISO 27001) can you obtain?
6. **Rules for personal data.** Customers may type their own phone number or name despite the note; the input check masks some of it. Are there provider rules on what may be sent?

| Provider | Where to start (addresses may move)                                                                                                                                                                                                  | Leads the agent saw (unverified)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OpenAI   | "Data controls in the OpenAI platform": `https://developers.openai.com/api/docs/guides/your-data`. Also OpenAI's business terms, data processing addendum and sub-processor list (find them from `openai.com/policies`; not opened). | API data not used for training by default (opt-in only). Abuse-monitoring logs kept up to 30 days unless the law requires longer. With the Responses API, stored application state is kept 30 days when `store` is omitted or true; the script sends `store: false`. "Zero Data Retention" and "Modified Abuse Monitoring" exist but need OpenAI's approval. The page lists an India data-residency host (`in.api.openai.com`) with conditions: regional processing needs Zero Data Retention, only one model was listed for it, hosted tools are excluded, and non-US regions need an amendment and carry a price uplift. **Check every one of these.**                                                                            |
| Gemini   | "Gemini API Additional Terms of Service": `https://ai.google.dev/gemini-api/terms` (redirects to `aistudio.google.com/docs/terms`). Google's data processing terms: `https://business.safety.google/processorterms/`.                | The terms split **Unpaid** and **Paid** services. Unpaid: submitted content may be used to improve products and read by human reviewers, and the page says not to submit personal or confidential information. Paid (a Cloud project with billing on): content is not used to improve products, but prompts and responses are logged for "a limited period" for abuse and legal reasons, with no number of days stated on that page. Data "may be stored transiently or cached in any country" where Google has facilities; no region choice is offered on that page, and India is not mentioned. Whether Gemini through Google Cloud (Vertex AI) offers a region such as Mumbai is a question for you to check; the agent did not. |

**Reading checklist** (tick when done): OpenAI terms read on ____ by ____. Gemini terms read on ____ by ____. Legal reviewer has the two texts: ____. Questions for the reviewer: ____.

## 8. Using the results

1. Paste the tables from `report.md` into section 9 and add the run details.
2. Have a native reader fill in the Tamil table in section 10 from `review.md`.
3. Open each turn that failed a check (the report counts them, `review.md` shows the answer) and write the reason in section 9: model fault, bad prompt wording, or a check that is too blunt.
4. Write the recommendation in section 11. A provider is not chosen on price alone: a cheaper model that invents a phone number or ignores the one-propose-call-alone rule costs more later.
5. Hand the numbers to P1-T01 (package and variables), P1-T03 (adapter and conformance suite) and P8-T03 (budget). If you change the cap, the limits or the prompt wording, that is a new ADR-128 decision, not an edit.
6. Keep `scripts/ai-spike/` until P1-T03's conformance suite replaces it, then decide whether to delete it (the auth spike script says the same about itself).

## 9. Results (fill in after the run)

**Run details**

| Item                                 | OpenAI | Gemini |
| ------------------------------------ | ------ | ------ |
| Date and time of the run             |        |        |
| Model id                             |        |        |
| Plan or tier of the key              |        |        |
| API host used                        |        |        |
| Price per million input (USD)        |        |        |
| Price per million output (USD)       |        |        |
| Price per million cached (USD)       |        |        |
| Where the prices were read, and when |        |        |
| Output cap used                      |        |        |
| Gemini schema form accepted          | n/a    |        |
| Turns run, errors, cut off           |        |        |
| Total spend of the run (USD)         |        |        |

**Latency per turn (seconds)**

| Metric                   | OpenAI | Gemini |
| ------------------------ | ------ | ------ |
| Mean                     |        |        |
| Median                   |        |        |
| 95th percentile          |        |        |
| Slowest                  |        |        |
| Mean per round           |        |        |
| Mean rounds per turn     |        |        |
| Mean tool calls per turn |        |        |

**Tokens and cost per turn**

| Metric                              | OpenAI | Gemini |
| ----------------------------------- | ------ | ------ |
| Mean input tokens                   |        |        |
| Mean output tokens (with reasoning) |        |        |
| of which reasoning                  |        |        |
| Mean cached input tokens            |        |        |
| Mean cost per turn (USD)            |        |        |
| 95th percentile cost (USD)          |        |        |
| Cost per 100 turns (USD, INR)       |        |        |

**Tool-call correctness (turns that passed every fail-level check)**

| Group                | OpenAI | Gemini | Notes (why the failures happened) |
| -------------------- | ------ | ------ | --------------------------------- |
| Search               |        |        |                                   |
| Compare              |        |        |                                   |
| Builder              |        |        |                                   |
| EMI                  |        |        |                                   |
| Refusals             |        |        |                                   |
| Prompt injection     |        |        |                                   |
| "I don't know"       |        |        |                                   |
| Parallel and propose |        |        |                                   |

**Guardrail checks**

| Check                                     | OpenAI | Gemini |
| ----------------------------------------- | ------ | ------ |
| Invented phone, email or link (turns)     |        |        |
| Prompt marker repeated (turns)            |        |        |
| Injected text repeated (turns)            |        |        |
| Competitor named in a refusal (note only) |        |        |
| Tool calls with invalid arguments         |        |        |
| Turns cut off by the output cap           |        |        |
| Turns that needed the answer-only round   |        |        |

**Schema acceptance (ADR 4.4 rule 1)**

| Probe                          | Inside the subset? | OpenAI | Gemini |
| ------------------------------ | ------------------ | ------ | ------ |
| Full 10-tool set               | yes                |        |        |
| Baseline nullable field        | yes                |        |        |
| Nested object                  | yes                |        |        |
| Optional field                 | no                 |        |        |
| Open `additionalProperties`    | no                 |        |        |
| `anyOf`                        | no                 |        |        |
| `oneOf`                        | no                 |        |        |
| `$ref` and `$defs`             | no                 |        |        |
| `format`, `pattern`, `minimum` | no                 |        |        |

Conclusion for rule 1 (one subset works on both, or the adapter must translate): ______

**Parallel calls**

| Prompt         | OpenAI default | OpenAI switch off | Gemini default | Mixed rounds (O / G) | Ids present (O / G) |
| -------------- | -------------- | ----------------- | -------------- | -------------------- | ------------------- |
| parallel-en-01 |                |                   |                |                      |                     |
| mixed-en-01    |                |                   |                |                      |                     |

Conclusion for rule 3 (switch parallel calls on for which provider, and from which test): ______

## 10. Tamil and Tanglish quality (native reader)

Rate each answer in `review.md` from 1 (poor) to 5 (excellent). Average per provider and language, and add two or three sentences.

| Language | Provider | Fluency | Facts from tools | Tone | Same language as the question | Notes |
| -------- | -------- | ------- | ---------------- | ---- | ----------------------------- | ----- |
| Tamil    | OpenAI   |         |                  |      |                               |       |
| Tamil    | Gemini   |         |                  |      |                               |       |
| Tanglish | OpenAI   |         |                  |      |                               |       |
| Tanglish | Gemini   |         |                  |      |                               |       |

Reader name and date: ______. Anything that must never be shown to a customer (wrong place names, rude tone, invented facts): ______

## 11. Recommendation (owner)

| Item                                             | Decision |
| ------------------------------------------------ | -------- |
| Provider for P1-T01 (first release)              |          |
| Model id and why                                 |          |
| Plan or tier and data-location choice            |          |
| Is Gemini kept as the second provider?           |          |
| Parallel calls: on for which provider, from when |          |
| Output cap and loop caps unchanged (ADR 4.5, 7)? |          |
| Cost per turn used for the daily budget (G-B)    |          |
| Tamil wording needs (D12, G-D)                   |          |
| Gate G-H passed on (date, by whom)               |          |
| Open questions before P1-T01                     |          |
