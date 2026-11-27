# ADR-213 · The assistant is a real-estate helper: greet, answer first, general knowledge with sourced figures

- Status: Accepted. Owner decisions in chat on 27 Nov 2026 (`ai-chat-next-plan.md`, piece 1), approved for build the same day.
- Date: 2026-11-27
- Amends: ADR-174 (conversation: a very general ask no longer leads with "buy or rent"), ADR-200 (a guest's one question is no longer "buy or rent" first), ADR-143 section 6.8 and ADR-128 section 6.2 (a real-estate question that our articles do not answer is no longer declined or left unanswered)
- Related: ADR-209 (sources only when asked), ADR-211 (builder research)
- Class: C1 (prompt wording, tests and eval cases). No migration, no dependency, no new tool, no new visitor words.

## Context

The owner wants the chat to feel like a real-estate helper, not only a home finder. Before this change a "hi" got a "buy or rent?" question, a guest's single question was always "buy or rent" first, and a real-estate question that our articles did not cover got "I could not find that", because the prompt said never to answer such questions from memory and called general knowledge off topic.

## Decision

1. **A greeting gets an introduction.** When the customer only greets the assistant, it says in one or two short lines of its own who it is and what it helps with (homes, projects, builders, any real-estate question), and asks how it can help. No search, no "buy or rent".
2. **Answer the question first.** A question is answered before the assistant asks anything of its own. "Buy or rent?" is asked only when a search really needs it and the customer has not said it, never as a routine first question.
3. **Answers come from, in order:** our site (homes, projects, articles, FAQ, builders), then the assistant's own general knowledge. Web search on trusted sites comes later (piece 5) and is not part of this change.
4. **General knowledge stays general.** It may explain a process, a term or what to check. A figure (fee, rate, tax, charge, limit, price) or a legal rule stated as today's fact must still come from a lookup; without one the assistant says it has no current figure and that the relevant office or a qualified professional can confirm it. Facts about a home, project, builder or locality still come only from lookups (`FACTS_SECTION` unchanged), and the advice rules are unchanged.
5. **Off topic is now "nothing to do with real estate or homes".** Sport, news, politics, health, writing and code are still declined.
6. **Guests (ADR-200, changed):** a guest's greeting or question is answered the same way. For a search, the guest's one question asks for the area first, then bedrooms or budget; "buy or rent" only when the search needs it (for example a budget that could be a price or a monthly rent). The two free messages and every other ADR-200 rule stay.
7. **Signed-in conversation (ADR-174, changed):** a very general ask for homes leads with the area or city, then the budget or bedrooms. Everything else in ADR-174 and ADR-204 stays.
8. The prompt version is `2026-11-27.1`. The fixed-cost test's prompt ceiling goes from 13,000 to 15,000 characters (measured 13,976), the price of the new rules.

## Consequences

- Real-estate questions that our articles do not cover get a short general answer instead of "I could not find that". The number-grounding check (shadow mode) still counts any figure that no lookup holds, so a slip shows in the usage rows.
- Behaviour is steered by wording: the live evals show what the real model does. The offline cases check the scripted path.
- No new words for the customer: the assistant writes its own sentences.

## Tests

`UT-ai-system-prompt` (greeting, answer-first, general knowledge without figures, the new off-topic line, the guest order; the example answers pass the prompt-copy check); `UT-ai-fixed-cost` (new ceiling); golden cases `G-conversation-01` to `G-conversation-05` (English, Tamil, Tanglish; visitor and signed-in) and the changed `G-guest-01` (asks for the area, not buy or rent).
