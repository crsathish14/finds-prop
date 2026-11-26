# ADR-206 · AI search keeps the customer's requirements in a signed state and pages without repeats

- Status: Accepted (Phase 2 of "AI property search: from chatbot to discovery engine", approved by the owner on 26 Nov 2026, plan section K). The new words the customer sees (`ai.more.*`, `ai.seeAll.*`) wait for the owner's approval.
- Date: 2026-11-26
- Related: ADR-205 (ranking, Phase 1), ADR-204 (Phase 0), ADR-128 (the assistant), the proposals' signature (`tools/proposal.ts`)
- Class: C1. Server and chat code in the AI chat feature only. No migration, no dependency.

## Context

After Phase 1 every match was ranked, but each search still gave the model the first results only, and the chat remembered nothing between two messages except the last twelve messages' text. Show more ran the model again, which searched again and gave the same first homes. The model had to rebuild the customer's filters from the text each time, and could offer an enquiry for a home it had already offered. Only three cards were drawn under an answer.

## Decision

- **A signed requirements state** (`src/features/ai-chat/state/chat-state.ts`): a token `body.signature`, an HMAC-SHA256 with a fixed label over the body, with the server-only secret already used for the proposals and the visitor hash. It holds the last home or project search (tool, filters and preferences as the tool took them, the ids shown so far in ranked order, how many match), the homes and projects shown in this chat (at most 200) and those an enquiry or a visit was offered for (at most 10). No person, phone or listing text. It lives 12 hours. The browser keeps it with the conversation and sends it back; the server checks it on every message, and a made-up, changed, cut or expired token is ignored (no state), never an error.
- **"Current search" in the prompt** (`prompts/requirements.ts`): the given filters as JSON (quoted data, never instructions), how many of how many were shown, and the offers already made. Only present when there is a state.
- **Paging without repeats** (`tools/paging.ts`): one page is `AI_SEARCH_PAGE_SIZE` (six). Both search tools take a required `page` input (`"next"` or null). With `"next"` and the same filters as the current search, the page starts after the ids already given; with other filters the ranking starts again, and a home seen earlier is marked `seenBefore`, never left out.
- **The Show more button needs no model call** (`endpoint/show-more.ts`): with a remembered search the endpoint runs the tool for the next page itself and answers with one fixed line and the cards. It counts toward the short rate limit only, like a refusal, and spends no free message or daily budget. A typed "show more" goes to the model, which calls the tool with `page: "next"`.
- **Six cards** per answer (`AI_MAX_CARDS_PER_ANSWER`, was three).
- **A "See all" link** (`state/see-all.ts`) under a home search's answer: the results page with the search's filters, built by the server, never by the model. Preferences are left out (the page has none); a city goes into the keyword because the page's address has no city, so that link names no number. No link for a search around a place or after an offer.
- **No promotion badge inside the chat** (`chat-cards.ts`): the Featured badge is left off home and project cards in the chat only. The website keeps its badges.
- **Offers once:** an Enquire or Site visit button or a confirm card records the record in the state; the buttons and the prompt then do not offer it again.
- **Prompt cost:** the prompt stays under its ceilings (13,000 characters, 15,800 with every optional section): existing wording was shortened to make room for the new section, and the ceilings were not raised.

## Alternatives not taken

- **Keeping the state in the database:** a table, a migration and a clean-up job for what one browser tab needs; a signed token needs none.
- **Letting the model page on its own (an offset input):** the model would have to count, and Show more would still cost a model call.

## Consequences

- Show more gives new homes every time, at no model cost.
- A chat whose state is lost (another browser, a token older than 12 hours) simply starts again: searches still work.
- If the secret is not set the chat works as before, without a state (logged as an error).
