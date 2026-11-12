# AI chat assistant: phase plan

The execution plan for [ADR-128](adr/128-ai-chat-assistant.md). Read the ADR first; this file says what to build, in what order, how to prove it, and what to paste into Claude for each task. It repeats none of the design.

**Status:** the owner agreed the architecture on 11 Nov 2026. Nothing is built. On 12 Nov 2026 the owner accepted all recommendations for D8 to D13 and the ADR is Accepted, so task AI-P0-T04 is done. What is still open is listed in the gates below: three values to set (the example loan rate, the daily budget, the Tamil wording), the UX approval, the new wording, the provider terms and the cookie-policy review.

## How to run the plan with Claude

- **One task = one session = one branch = one pull request** (workflow.md: one concern per PR, one task per session). Branch from `develop` as `feat/ai-p<phase>-t<task>-<name>`. Never commit to `develop` or `main`; Claude does not push or merge without being asked.
- **C2 tasks** (marked below) start with a written plan. Claude stops and waits for your approval before editing any file. Approval does not carry to the next session.
- **Migrations** go in their own commit and their own PR, with `/new-migration`. **New packages** go alone in their own PR, with `/add-dependency`. Use `/new-slice` for a feature slice.
- **Review:** after a C2 task, start a fresh session and run `/review-change` on the branch. Run `/security-review` on the phases marked below.
- **Parallel work** only in separate worktrees, never two writers on the same files. Only one migration PR open at a time.
- **Secrets:** Claude never reads `.env*` or keys. Tasks that need a real provider key are run by you locally (marked **You run**).
- **Evidence:** every PR pastes the real result of `npm run check` and the commands the task lists, and says what could not run. After each merge, the PR updates `docs/status.md` and the traceability row (R-DOC-02).

### The prompt to start every task

Paste this, then the task's own line from below:

```text
Read AGENTS.md, docs/status.md, the nested AGENTS.md for the folders you will touch,
docs/adr/128-ai-chat-assistant.md (the sections the task names) and docs/ai-chat-phase-plan.md.
Do task <ID> only. Classify the change (C0, C1 or C2). If it is C2, write the plan and wait
for my approval before editing. Branch from develop. Do not push, merge, open a PR, touch .env
or add a package unless the task says so. Use whole-word names, text from en.json, and the
existing patterns. The product name in all AI text is findsprop (lowercase), see ADR-128. Run npm run check and the task's commands, and report the real output.
When done, summarise what changed, what you verified and what you could not.
```

## Decision gates (the owner, before the task that needs them)

| Gate | Decision                                                                                                                 | Needed before  |
| ---- | ------------------------------------------------------------------------------------------------------------------------ | -------------- |
| G-A  | D8 what is stored (recommended: usage metadata only)                                                                     | P4-T05         |
| G-B  | D9 numbers: trial of 2, IP and burst and daily limits, the daily budget, rounds 5, calls 6, parallel 3, tool timeout 3 s | P1-T04, P8-T03 |
| G-C  | D10 EMI defaults (down payment, years, example rate)                                                                     | P1-T05         |
| G-D  | D11 and D12 how the assistant describes itself, and the language of the fixed replies                                    | P4-T01         |
| G-E  | D13 anonymous cookie id, and the cookie-policy wording (legal review)                                                    | P1-T04         |
| G-F  | The UX addendum for the chat screens is approved                                                                         | P5-T01         |
| G-G  | All new customer-visible wording approved (refusals, "Searching…", the cap note, the consent line on the confirm card)   | P4-T01, P6-T02 |
| G-H  | The provider terms (retention, training use, data location) read by you and your legal reviewer; the provider is chosen  | P1-T01         |

## Phase map

```
P0 decisions, spike, UX ──► P1 foundation ──► P2 property tools + loop ──► P3 more tools
                                   │                                          │
                                   └──────────────► P4 guardrails, endpoint, usage ◄─┘
                                                              │
                                              P5 chat UI ──► P6 enquiry and visit ──► P7 entry points
                                                              │
                                                  P8 evals, security, cost ──► P9 rollout
```

Parallel where noted (separate worktrees): P0-T02 with P0-T03; P1-T02 with P1-T05; P3 tools with P4-T01 to T03.

---

## Phase 0: decisions, spike and UX (no production code)

**P0-T01 · Scope change in the docs** · C1 (docs, owner-approved scope change)
Move the AI chat from "out of scope" in `docs/requirements/v1-scope.md` to "gated, behind `FLAG_AI_SEARCH`"; revise FR-PUB-12 in `requirements.md`; add acceptance statements to `acceptance-criteria.md`; update `traceability.md`; add a row to `docs/status.md`; update the `security.md` rate-limit row and the processors table (provider name).
Done when: `npm run harness:check` and `npm run check` pass; every changed doc points to ADR-128.
Prompt: "Task AI-P0-T01. Update the requirement, scope, acceptance, traceability, status and security docs for the AI chat as ADR-128 says. Docs only."

**P0-T02 · Spike S-AI-00: compare OpenAI and Gemini** · C2 (external service, cost). **You run** the script with your own keys.
A TypeScript script under `scripts/ai-spike/` that sends the same 30 to 40 fictional prompts (English, Tamil, Tanglish: search, compare, builder, EMI, refusals, injection, "I don't know") to both providers with the tool set stubbed, using plain `fetch` (no new package). It records latency, tokens, cost per turn, tool-call correctness, schema-subset acceptance (ADR 4.4 rule 1), parallel-call behaviour, and Tamil quality notes. Write the results to `docs/runbooks/ai-spike.md`. No real customer data, no keys in the repo.
Done when: the runbook has the numbers and a recommendation; you have read each provider's current data terms (G-H).
Prompt: "Task AI-P0-T02. Write the spike script and the results runbook described in the plan, using fetch only and keys from environment variables I set locally. Write the plan first and wait for approval."

**P0-T03 · UX addendum for the chat** · C2 (new screens)
Draft the chat screens in the style of `docs/ux/ux-addendum/` (HTML plus manifest entry), reusing the design system: empty state with example prompts, streaming, answer with property and project cards, status ("Searching…"), the two rate-limited states, error with retry, sign-in gate after 2 messages, the confirm card, the "I couldn't check everything" note, mobile layout. You approve (G-F).
Done when: screens exist for every state in ADR section 10, and you have approved them.
Prompt: "Task AI-P0-T03. Draft the chat screens and states as a UX addendum in the existing addendum format. Use only existing tokens and components."

**P0-T04 · Record decisions and accept the ADR** · C0
Write D8 to D13 into the ADR (G-A to G-E, G-G, G-H) and set the status to Accepted.
Done when: the ADR has no open decision and `harness:check` passes.

## Phase 1: AI foundation (nothing visible to customers)

**P1-T01 · Dependency and environment** · C2. Needs G-H.
Add the `openai` package alone (`/add-dependency`: verify existence, maintainers, licence, install scripts and size from the registry, never from memory). Add `AI_PROVIDER`, `AI_MODEL`, `OPENAI_API_KEY` to `src/server/env.ts`, `.env.example` and `docs/runbooks/environment-variables.md`. No other change.
Done when: `npm run check` passes, the client-bundle check shows no key, `knip` shows no unused code.

**P1-T02 · Neutral provider interface and the fake** · C1. Parallel with P1-T05.
`src/server/ai/types.ts` (call, messages, tools, events, errors per ADR 4.4), `fake.ts` (scriptable: tool calls, parallel calls, refusals, invented phone, link, price, prompt leak), `index.ts`; `src/config/ai.ts` for the numbers; a helper that turns a Zod schema into the portable JSON Schema subset and rejects anything outside it.
Tests: the subset helper (accepts and rejects), the fake's scripts. Done when: `npm run check` passes.

**P1-T03 · OpenAI adapter and the conformance suite** · C1. Needs P1-T01, T02.
`src/server/ai/openai.ts` with timeouts, token caps, stateless calls ("do not store" where the API offers it), error mapping to our closed `ErrorCode` set, parallel calls off until the suite passes. The conformance suite (ADR 4.4): one tool call, two in a row, parallel reads, a mixed round, a tool error, a refusal, a long answer, a cut-off stream, a timeout, invalid arguments. Real-key run is **You run** (manual job).
Done when: the suite passes against the fake and against mocked HTTP in CI; the manual real-key run passes.

**P1-T04 · Rate-limit scopes and the new identities** · C2 (security, cost). Needs G-B, G-E.
Add the scopes of ADR section 7 to `src/server/rate-limit/limits.ts` and two new "who" values (`global`, and the anonymous cookie id) to the counter code; the IPv6 /64 rule for the IP hash; the cookie helper (random id, HttpOnly, SameSite); update `docs/engineering/security.md`. **No migration is needed:** `public_rate_limits.scope` is free text (lowercase letters, digits and underscore, at most 40 characters) and the subject only needs 8 to 128 characters, so a constant key such as a hash of `global_day` works.
Tests: each rule, fail-closed when the counter fails, an anonymous caller moving to a user id, the shared-IP case.
Done when: unit tests pass and `test:integration` passes.

**P1-T05 · EMI maths** · C1. Needs G-C. Parallel with P1-T02.
`src/lib/emi.ts`: EMI, affordability and breakdown, integer rupees, a fixed rounding rule, formatting through `src/lib/format.ts`. Tests against known values, zero rate, extremes, and invalid input.
Done when: `npm run check` passes.

## Phase 2: property tools and the agent loop

**P2-T01 · Tool framework and the first three read tools** · C1. Needs P1-T02.
`src/features/ai-chat/tools/`: the tool definition shape (name, description, Zod input, Zod output, run), then `search_properties`, `get_property`, `list_localities` over the existing cached reads (`getSearchResults`, `getProperty`) and a cached localities read. Results are compact (at most 10 items), money is formatted by code, every home id is returned for the id-tracking, and third-party text is wrapped as untrusted data. Add a test that fails if any tool input names a person (user id, phone, email) and one that fails if a schema leaves the portable subset.
Tests: unit, plus an integration test as a visitor (only approved homes, no private column).
Done when: `npm run check` and `npm run test:integration` pass.

**P2-T02 · The agent loop** · C1 (C2 if it needs a new pattern). Needs P2-T01, P1-T03.
`src/features/ai-chat/agent.ts` per ADR 4.5: 5 rounds, 6 tool calls, up to 3 read calls in parallel, propose tools alone, answer-only last round, one retry for transient errors, the fixed fallbacks, id tracking, usage totals, abort on deadline.
Tests with the fake provider: every row of the limit table in ADR 4.5, duplicates, one failing tool, result order, a mixed round, invalid arguments, timeout, a provider error.
Done when: `npm run check` passes and all loop cases are named tests.

## Phase 3: projects, builders, compare, EMI tool

**P3-T01 · Project and builder tools** · C1. Needs P2-T01.
`search_projects` (over `getProjects`, filtered in code), `get_project` (over `getProject`: units grouped by BHK and status, RERA, possession, last 12 months of price per sq ft), `get_builder` (a new cached read of the public builder columns plus the builder's live projects; "first project listed here" comes from the earliest project date, because the builder's own created-at column is not public). No migration expected; if the read needs a column visitors cannot read, stop and ask.
Tests: unit; integration as a visitor (inactive builders and unapproved projects never appear).

**P3-T02 · Compare and EMI tools** · C1. Needs P2-T01, P1-T05.
`compare_properties` (over `getComparedProperties`, with computed differences such as price per sq ft) and `calculate_emi` (over `src/lib/emi.ts`, always labelled "an example, not a bank offer").
Done when: unit tests pass and the tool-schema tests still pass.

## Phase 4: guardrails, endpoint and usage

**P4-T01 · Input pre-check** · C1. Needs G-D, G-G. Parallel with T02, T03.
`src/features/ai-chat/guards/input.ts` and the word lists in `src/config/ai.ts`: competitor portals, instruction attacks, internals probes, personal data masking (phone, email, Aadhaar-like, PAN, card-like), flooding. Fixed refusal and notice wording in `en.json` (approved).
Tests: a table in English, Tamil and Tanglish, including normal messages that must pass ("how is EMI calculated", "how do I post a property").

**P4-T02 · Output check and segmenter** · C1. Parallel with T01, T03.
`guards/output.ts`: contact allow-list from this turn's tool results, id validation, prompt-leak canary, competitor names, internals disclosure, advice phrases, format stripping, number grounding in **shadow mode** (log only); the sentence segmenter and the `replace` event; fail-closed.
Tests: the fake provider invents a phone, a link, a price, an id, leaks the canary, names a competitor and describes the build; each is caught, and normal turns pass.

**P4-T03 · System prompt and scope rules** · C1. Parallel with T01, T02.
Versioned prompt files (role, scope, language rule, facts only from tools, no advice, the confidentiality rule, the off-topic rule, the competitor rule), the canary, the prompt version string. No secrets or architecture in the prompt. The product name comes from one constant, `ASSISTANT_BRAND_NAME` in `src/config/ai.ts`, and the value is `findsprop`.
Done when: tests assert the canary and the version are present and that no forbidden word appears in the prompt.

**P4-T04 · The streaming endpoint** · C2 (new Route Handler, D-STREAM exception). Needs P2-T02, P4-T01 to T03, P1-T04.
`src/app/api/ai/chat/route.ts` composes only; the logic is in `src/features/ai-chat`. Steps in fixed order: flag check (404 when off), parse, optional session, input pre-check, limits, agent loop, output check, stream, usage. Accepts only user and assistant text from the client. Never logs message text; request id on every line.
Tests (fake provider): success, flag off, invalid input, rate limited (each scope), anonymous trial then the sign-in state, forged history, provider error, the stream `replace` event.
Done when: `npm run check` and `npm run test:integration` pass, and a fresh-context `/review-change` finds nothing medium or above. Run `/security-review`.

**P4-T05 · Usage metadata** · C2. Needs G-A. Skip if G-A chooses "nothing stored".
A migration (`/new-migration`, its own PR) for `ai_usage_events` with RLS on and no client grants, a pgTAP test, `npm run gen:types`; the writer (server-only) and the allow-list entry in `docs/engineering/security.md`; the row fields from ADR section 8 (never text). Rollback note in the PR.
Done when: `npm run check:db`, `npm run test:integration` pass.

## Phase 5: the chat UI

**P5-T01 · Components and Design Lab** · C1. Needs G-F.
`en.json` text first (an `ai` area; the literal word `findsprop` for the product name, not the `brandName` key), then the components from the approved UX: message list, composer with the personal-details note, streaming and status states, answer cards reusing the existing property and project cards, the two rate-limited states, error with retry, sign-in gate, the cap note. Design Lab entries; one copper button per view.
Done when: `npm run test:ds` and `npm run check` pass (a baseline change is explained in the PR).

**P5-T02 · The `/ai-search` page and the chat island** · C1. Needs P4-T04, P5-T01.
The page behind `FLAG_AI_SEARCH` (404 when off, absent from navigation), the `*.client.tsx` island, the transcript in `sessionStorage`, the stream reader, "sign in to keep chatting" with the return path and the kept transcript (the ADR-057 idea).
Tests: component tests; E2E smoke with `AI_PROVIDER=fake`: two free messages, the gate, sign in, return with the transcript. `npm run test:e2e:smoke` passes.

## Phase 6: enquiry and site visit through the chat

**P6-T01 · Propose tools** · C1 (server, no new write path). Needs P3-T01.
`propose_enquiry` and `propose_site_visit`: validate the home or project is still visible, the caller does not own the home, and the date is from today to a year ahead; return the data for the confirm card; write nothing. A proposal is signed by the server so the card cannot be forged.
Tests: foreign, unapproved, own and gone targets; a forged proposal is refused.

**P6-T02 · The confirm card** · C2 (consent text, a customer-facing write path). Needs P6-T01, G-G.
The card shows the real target, the customer's name and verified phone from the account, the message and a **Send** button. The click runs the existing `sendEnquiry` or `submitProjectLead` with a fresh idempotency key; the session-ended handling and kept draft work as on the existing forms. Typing "yes" never sends. The consent line is reviewed wording.
Tests: success, unauthenticated, no verified phone, duplicate, rate limited, forged identity fields, a forged proposal; E2E main path plus one error path.
Run `/security-review`.

## Phase 7: entry points and context

**P7-T01 · "Ask about this home" and the search-card link** · C1. Needs UX approval for the new buttons.
Buttons on the property and project pages open the chat with that item as context (an id, never raw data); the search card's "Describe it in words" and the navigation link appear only when the flag is on; the compare list is sent as context.
Tests: flag off means absent everywhere; the context id is validated server-side.

## Phase 8: evaluation, security and cost

**P8-T01 · Golden set, red-team set and the eval script** · C1. **You run** the real-model run.
A TypeScript script and about 60 golden and 40 red-team cases in English, Tamil and Tanglish: search, compare, builder, EMI, refusals, off-topic, internals probes, other-people requests, competitor requests, injected listings. Scored on match to tool output, refusal correctness, language, and the number-grounding false-positive rate. A prompt version does not ship unless it passes.

**P8-T02 · Security review and hardening** · C2.
A fresh-context `/review-change` and `/security-review` of the whole feature; the other-people and forged-history tests; close any finding of medium or above.

**P8-T03 · Cost, budget, privacy and the header check** · C2 (money, personal data). Needs G-B. **You run** the deployed checks.
Measure cost and latency per turn at dev scale, set the daily budget, update the privacy policy, the cookie policy and the processors list (legal review), and close the deployed forwarded-IP header check SPK-03 (a launch precondition).

## Phase 9: rollout

**P9-T01 · Runbook and staged rollout** · C2 (touches dev, staging, production).
`docs/runbooks/ai-chat.md`: variables, the kill switch (`FLAG_AI_SEARCH` off returns 404), how to read the usage rows, the budget alert, how to switch provider. Roll out dev, then staging, then production, flag off by default, switched on by you.
Done when: the dev and staging checks pass and you switch the flag on.

---

## Later: RAG over PDFs (a separate ADR and plan)

Embeddings with `pgvector`, a PDF and OCR ingestion pipeline, citations, and deletion when a project is edited or unpublished. It starts after the first release, with the questions in ADR section 11 answered (what PDFs, who uploads, scanned or text, Tamil, volume, whether files must stay in India).

## Task checklist

| Phase | Tasks                   | Class              |
| ----- | ----------------------- | ------------------ |
| P0    | T01, T02, T03, T04      | C1, C2, C2, C0     |
| P1    | T01, T02, T03, T04, T05 | C2, C1, C1, C2, C1 |
| P2    | T01, T02                | C1, C1             |
| P3    | T01, T02                | C1, C1             |
| P4    | T01, T02, T03, T04, T05 | C1, C1, C1, C2, C2 |
| P5    | T01, T02                | C1, C1             |
| P6    | T01, T02                | C1, C2             |
| P7    | T01                     | C1                 |
| P8    | T01, T02, T03           | C1, C2, C2         |
| P9    | T01                     | C2                 |
