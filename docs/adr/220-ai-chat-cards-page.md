# ADR-220 · The AI chat keeps its cards on a page of their own, not in the conversation

- Status: Accepted. Owner decisions in chat on 28 Nov 2026 (`AI_SEARCH_UI_CARDS_NOTES.md`, decisions A1 to A13). Built in five pull requests: the compact cards, the pages model and the cards page component, the desktop layout (this one), the phone and tablet pager, and the swipe hint with the nudge. Until the pager lands the cards stay in the chat below the lg breakpoint, so no screen is half built.
- Date: 2026-11-28
- Amends: ADR-128 section 10 (the result cards sit in the conversation) and the UX addendum rule that the chat uses the approved cards unchanged (decision 5): the chat now uses a compact layout of the same two cards.
- Related: ADR-206 (Show more, the one list), ADR-175 (reply chips), ADR-185 (the chat page has no footer), ADR-152 (the disclaimer)
- Class: C2 (a changed screen of an accepted design). No migration, no dependency, no server change, no new Server Action.

## Context

Cards inside the chat make even a short conversation long, and a visitor who scrolls back through it loses their place among pictures and prices. The right half of a wide screen is empty.

## Decision

1. **The chat keeps text only.** The cards of an answer leave the conversation and sit on a **cards page**: a separate page of up to six compact cards that does not scroll (a screen too short for six cards scrolls them inside the page rather than cutting them off), showing only the cards of the answer the visitor is on.
2. **Compact cards.** `PropertyCard` and `ProjectCard` get `layout="compact"`: one row about 5.5 rem tall, a 5 rem picture, the price, the title, "3 BHK · 1,450 sq ft", the locality and one badge; the heart and Compare keep their slots and their 44 px targets. The same data, the same links, the same controls (no new card family). Compact skeletons hold the box while the facts are read, so nothing pops in.
3. **At lg (1024 px) and up** the page is a column beside the chat (chat about 32 rem, 36 rem from xl, the cards page filling the rest), sticky between the header and the composer. The two columns are always there; before the first cards the right side shows one quiet line ("Homes and projects you ask about appear here."), so nothing jumps when the first cards come.
4. **The page follows the answer most in view** as the visitor scrolls the chat (an observer on the answers, the newest on a tie), not the pointer; the answer being written is followed while it streams; a restored chat starts on its last answer with cards. An answer with no cards (a sum, a builder's profile) keeps the cards of the answer before it, so the page never goes blank.
5. **The change is a slide and fade** of about 250 ms (a newer page enters from below, an older from above; a plain swap under reduced motion). The 3D page flip was not chosen: fast scrolling through several answers would flip repeatedly and it is heavy on cheap phones. If it is wanted later only `useSlideSwap` changes.
6. **One quiet line under each answer with cards** ("6 homes on the right", "1 project on the right", "4 properties on the right" for a mixed list): a button that brings that answer's cards onto the page, in a polite live region so a screen reader says it once when the answer finishes. The page shows the answer indicator ("Answer 2 of 4" with a dot for each, pressing one scrolls the chat to that answer).
7. **Show more is a second page of the same answer.** The answer to Show more is stored with `moreOf` (the answer whose cards it adds to; optional, so chats kept in a tab still load). The cards page groups them and shows the numbers 1, 2 for the pages of one answer; the chat does not grow with cards.
8. **Stays in the chat:** the enquiry and site-visit confirm card, the reply chips, the "See all" link, the sources, the notes. The composer and the compare bar stay under the chat column.
9. **Phones and tablets (below lg)** use a snapping pager of two full-width panes, chat and cards (decisions A7 to A11 of the notes), built in the next pull request; a written hint with the count ("Swipe to see the 3 homes") and a small nudge follow in the one after.
10. **The prompt** says the cards are drawn "beside your answer" instead of "below your answer" (one sentence, same length); its version moves and the evals run again, in the pull request that takes the cards out of the chat below lg.

## Consequences

- The server, the tools, the ranking, the endpoint, the card event stream and `readChatCardsAction` do not change. The cards of an answer are read once in the browser however many parts of the screen draw them (a shared cache and one request in flight per set of references).
- At lg and up the chat island reads the window size, so the first paint of a wide screen has the chat column and an empty right side, then the cards page; below lg nothing changes yet.
- The compact layout is a second look for the same two cards, so a change to a card's facts touches both layouts; their tests and the Design Lab "Compact cards" entry show every state.
- The new words (English, in `en.json` under `ai`): "{count} homes on the right" (and its project and property forms), "Homes and projects you ask about appear here.", "Homes and projects from the conversation" (the page's name for screen readers), "Answer {number} of {total}", "Show the cards for answer {number}", "Page {number} of {total}".
