# ADR-198 · A guest's two free messages: search when the message is enough, ask one question when it is not

- Status: Accepted. Plan approved by the owner in chat on 26 Nov 2026. Builds on ADR-171 (login wall) and ADR-128 (the assistant's prompt). It replaces the idea tried in #377 (a guest's place read as an area name on the server), which was reverted in #379 and is not an ADR in force.
- Date: 2026-11-26
- Related: ADR-128, ADR-142 (place search), ADR-171
- Class: C2 (a change to the assistant's prompt and behaviour). No migration, no dependency, no new visitor words.

## Context

A guest has two free messages (`AI_TRIAL_MESSAGES`). A guest who wrote "2bhk near Adyar" was told to sign in (the place lookup is for signed-in customers), and the sign-in button also showed in the first two messages. The owner wants a guest to be asked only for what is missing from the question, not sent to sign in for a search.

## Decision

- The system prompt gets one more section, `GUEST_SECTION`, **only** for a customer who is not signed in (`session === null` in the handler). A signed-in customer's prompt is exactly what it was. The prompt version is raised.
- The section tells the model: search at once when the message holds enough (buy or rent with an area); otherwise ask exactly one short question for the most useful missing detail, in the order buy or rent, area, bedrooms, budget; never ask for what was said or put two questions in one message; read "near X" as the area X and search with the locality filter, never the place input; mention a distance search and sign-in only when the customer asks for a distance; do not offer the sign-in button for searching homes (projects, builders and the list of localities still need sign-in).
- The tool-level refusal for a guest's place input stays as a safety net, so a slip by the model cannot reach the map lookup or project localities.
- The 2-message limit is **not** changed. It is counted before the model answers, so a question turn cannot be told apart in advance; not counting it would need a refund path in the rate-limit code and its database scopes, and would allow unlimited free chat.

## Consequences

- The behaviour is steered by wording, so the model may still ask something extra now and then. The offline cases check the tool path and the prompt tests check the wording; the live evals check what the model does.
- A guest who writes only "flats" spends the first message on a question and gets homes in the second.
- No map quota, no new data source and no new words for the customer.

## Tests

`UT-ai-system-prompt` (the guest rules are in a guest's prompt only, after the place rules, no forbidden word, no run of words the output check would block); `UT-ai-endpoint` (an anonymous caller's prompt carries the section, a signed-in caller's does not); golden cases `G-guest-01` (one question, no search) and `G-guest-02` (near an area is searched by name, no place).
