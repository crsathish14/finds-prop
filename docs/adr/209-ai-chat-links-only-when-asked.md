# ADR-209 · The AI chat shows a link only when the customer asks for one

- Status: Accepted (owner decision, 26 Nov 2026: "let's not show links until it is necessary or if the user asks for it; focus is to grab the user in the chat")
- Date: 2026-11-26
- Related: ADR-206 (the See all link, Show more), ADR-143 section 6.5 (source links of a content answer), ADR-128 (the assistant)
- Class: C1. Server code in the AI chat feature, one prompt line, eval data. No migration, no dependency, no new words.

## Context

Since ADR-206 every home search answer with more matches than it showed ended with "See all N matching homes", a link to the results page, and every Show more page did too. Since ADR-143 every answer drawn from an article or a question ended with its source links. Both take the customer out of the chat. The owner wants the chat to keep the customer, and to show a link only when it is needed or asked for.

## Decision

- **Asked for a link:** worked out by code from the customer's latest message (`endpoint/link-request.ts`), never by the model: a link, a URL, a web site, a page, the source, "where is this from", the full article, "see all", or all the results. "Show me all homes in Adyar" is a search, not a request for a link.
- **See all:** drawn under a home search answer only when the customer asked for a link. Never after Show more: a button press is not a request for a link.
- **Source links of an article or a question:** drawn only when the customer asked for a link. The answer itself is unchanged; it still says the date the article carries.
- **Still drawn without asking, because they are needed:** the cards of homes and projects (the way to see photos and details), a job's link (the job page is the only place to apply), the confirm cards and the site-link buttons the assistant uses for what only the website does.
- **Prompt:** the content section now says the website draws the source link when the customer asks for it. Prompt version 2026-11-26.4.

## Consequences

- Eval cases that expected a source link on a content answer now expect none; one new case (G-content-11) asks for the link and expects the source.
- The words of the links (`ai.seeAll.*`, the Sources row) are unchanged.
- A customer writing in Tamil or Tanglish who asks for a link in those words gets no link until the list of phrases grows; the cards and Show more still work.
