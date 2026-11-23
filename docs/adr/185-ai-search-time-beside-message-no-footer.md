# ADR-185 · AI search: the time beside the visitor's message, and no footer

- Status: Accepted (the owner asked for both on 24 Nov 2026; no new customer wording).
- Date: 2026-11-24
- Related: ADR-128 (the chat), ADR-175 and ADR-184 (what is drawn in the chat)
- Class: C1. A small change to how the chat page is drawn and to two prompt lines. No migration, no dependency.

## Context

The assistant began some answers with "As of 23 Nov 2026, 7:49 pm:". That is the time its lookup was read, which the prompt and the tool descriptions told it to say when availability mattered. The owner does not want a time inside the answer. They want the time shown beside the visitor's own message, small, under the bubble, as in a chat app. The owner also does not want the site footer on the AI search page.

## Decision

- **The time moves out of the answer.** The prompt (version `2026-11-24.2`) now says to say that availability or a price may have changed since, and never to write the time or date a result was read, and never to begin an answer with one. The tool descriptions (`search_properties`, `get_property`, `get_project`, `compare_properties`, `search_projects`) say that `asOf` is for the assistant only. The tool results still carry `asOf`; nothing is removed from them.
- **The visitor's message shows when it was sent.** Each message the visitor sends keeps `at` (the browser's clock, in milliseconds), and `ChatUserBubble` draws it under the bubble as a small `time` element: "7:49 pm" for today, "23 Nov, 7:49 pm" for another day, in the visitor's own zone. The time is kept with the conversation in the tab, so it is still there after a reload; a conversation kept before this change has no time on its old messages.
- **No footer on the AI search page.** The page moves from the `(public)` route group to a new `(chat)` group whose layout has the site header, the bottom bar on phones and the compare bar, but no footer. The error and not-found screens of the group are the same ones as before. Every URL stays the same.

## Alternatives not taken

- **A code filter that deletes a leading "As of ..." sentence from the answer:** a pattern on the model's words that would miss a different phrasing and would change text the output check has already passed. The instruction is in the prompt and in every tool description that mentioned `asOf`.
- **The server's time of the answer, beside the answer:** the owner asked for the visitor's own message.
- **Hiding the footer with a style rule or a client check of the path:** a footer that is in the page and hidden is still in the document; a group layout without it is plain.

## Consequences

- The model may still occasionally write a time; the instruction is strong, but it is a request to the model, not a block. If it keeps happening the output check can be extended (ADR-128 section 6.4).
- The data-freshness hint ("a few minutes old") is now only the assistant's own words, "it may have changed since".
- The footer's links (terms, privacy, contact) are not on the AI search page; the header and the site menu still lead to them.
