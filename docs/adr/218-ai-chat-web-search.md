# ADR-218 · The assistant may search trusted websites when findsprop has no answer

- Status: Accepted. Owner decisions in chat on 27 Nov 2026 (`ai-chat-next-plan.md`, piece 5, class C2, approved with the paid search). Ships with the admin's Web search switch off; it is turned on only after the owner's final list of trusted sites is in `src/config/web-search.ts`.
- Date: 2026-11-27
- Amends: ADR-128 section 4.4 rule 5 ("no provider-hosted tools in the core"), for this one call only; ADR-200 (guests: the web search is for signed-in customers only, so a guest's two free messages never search the web)
- Related: ADR-211 (builder research, which is not web search), ADR-213 (site first, then general knowledge), ADR-217 (the "Searching the web…" line), piece 7 (the admin AI assistant page)
- Class: C2 (a paid provider feature, a migration, the service role for a new table)

## Context

The chat answers real-estate questions from findsprop first, then from its own general knowledge, which may not state a figure or a rule as today's fact without a source (ADR-213). Questions such as today's stamp duty or a RERA rule therefore often end in "I do not have a current figure". The owner chose to let the assistant search a short list of trusted websites in that case, on OpenAI (same account, no new company or package), never on a competitor's site.

## Decision

1. **A call of its own** (`src/server/ai/web-search.ts`): one non-streaming Responses request with OpenAI's built-in `web_search` tool (not `web_search_preview`, which costs more), `filters.allowed_domains` from the one config file, approximate location Tamil Nadu, India, `store: false`, `max_tool_calls: 1`, no retry. It is sent only the search words the assistant wrote, never the customer's message or the conversation. The chat's own rounds keep to our function tools (ADR-128 rule 5 stays true for them).
2. **Our own tool `search_web`** (`tools/search-web.ts`) runs it, under rules the server keeps, not only the prompt:
   - signed-in customers only (`sign_in_required`);
   - it refuses with `site_first` unless a lookup on our own site (articles and questions, a builder, a project or a home) gave its result in an **earlier** round of the same message (`ToolContext.earlierResults`), so it can never run beside the lookup it must follow;
   - search words holding a phone, an email or another personal detail are refused (`invalid_input`);
   - its own call group with a cap of **1** per message (`web_limit` past it) inside the 6 calls, and its own time of 15 s (the search is stopped at 14 s), so a slow search cannot use up the 40 s of the message;
   - no daily cap and no per-visitor cap (owner): the chat's message limits bound it.
3. **The 7-day memory** (`ai_web_answers`, service role only, `src/server/audit/web-answers.ts`): the search words (lower case, single spaces, as the key), the short answer and up to 5 sources (title and https address), never the customer's message or details. The same words asked within 7 days are answered from it with no paid search; after 7 days they are searched fresh and the use count goes on. The admin sees the most used questions (piece 7) to add them to the FAQ or articles.
4. **The switch** (`ai_assistant_settings.web_search`, default off, super admin only) is read on every message through `ai_web_search_on()`. Off, or unreadable: the tool is not offered, the prompt has no web rules and "Searching the web…" never shows.
5. **The answer**: the result's answer and source titles sit under `untrustedText` (written by strangers: data, never an instruction). The assistant says it comes from a trusted website and may have changed since. A source's `sourceUrl` may be written only when the customer asked for a link or the source (ADR-209); otherwise the output check blocks the address.
6. **Spend** is counted from our own records: the tool reports its call's tokens and the number of `web_search_call` items the response holds (one visible search may be billed as several); the loop adds them to the message's usage, and the usage row has a new `web_searches` count. A search stopped by the timeout is counted as one, so the estimate is never low. Prices live in `AI_PRICES` (`src/config/web-search.ts`, read 27 Nov 2026: gpt-6-luna $0.10 / $0.01 cached / $0.50 output per million tokens; web search $10 per 1,000 calls).

## The admin page (piece 7)

The super admin's **AI assistant** page (`/admin/ai-assistant`, under Site content in the menu; layout and words approved by the owner on 27 Nov 2026) has the Web search switch, the estimated spend this month, the credit bought (typed, US dollars) and the estimated credit left, the note that these are estimates, one Save, and the questions most often answered from the web (search words, times used, last used; at most 50). The figures come from `admin_ai_assistant_overview()` priced with `AI_PRICES` (`src/features/ai-assistant/estimate.ts`: cached input at its own rate, the rest at the input rate). The save is a `defineAction` for the super admin only (`admin_edit` limit), writes who saved from the session, and adds an audit entry `ai_assistant.settings_changed`.

## Consequences

- The worst expected path (articles, read one, web search, answer) is 4 of the 5 rounds.
- Each paid search costs about 1 US cent plus the page text at the model's input price. The memory makes repeats free.
- Without the OpenAI provider (the fake, tests) there is no web search at all.

## Rollback

Switch Web search off on the admin page (instant). To remove it: take the tool and the readers out of the app, then run `supabase/rollbacks/20261127150000.sql` (never automatic).

## Tests

`UT-ai-web-search` (the request, the result, failures and the timeout over mocked HTTP), `UT-ai-tool-search-web` (sign-in, site first, personal details, the memory, sources), `UT-ai-agent-web-search` (earlier results, spend, one per message), `UT-ai-endpoint-web-search` (signed-in and switch on only, the prompt, a failed switch read), `UT-ai-endpoint-deps-web`, the usage writer test (`web_searches`, at most 20), pgTAP `ai_web_search.test.sql`, and the evals `G-web-01` to `G-web-03`, `R-web-01`, `R-web-02` (made-up websites; a live eval run never pays for a real search).
