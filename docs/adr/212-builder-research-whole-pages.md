# ADR-212 · Builder research gives the assistant whole pages

- Status: Accepted (owner decision, 27 Nov 2026: "I dont want any budget cut anywhere. I need quality output and best result for the user")
- Date: 2026-11-27
- Related: ADR-211 (builder research; this ADR replaces its point 7 limit of 2,500 characters per page), ADR-128 section 7 (cost)
- Class: C1. One limit in `src/config/ai.ts`, tests and one eval case. No migration, no dependency, no new words.

## Context

ADR-211 gave the assistant only the first 2,500 characters of each page it read for a builder question, to keep each answer cheap. On a real builder's About page (27 Nov 2026) the menu (twice), the address, an enquiry form and the "by the numbers" section filled those 2,500 characters. The managing director's name started at character 2,995, so the assistant said it could not find it, although the page showed it plainly.

## Decision

- `research_builder` hands the model each page whole: all the text the reader saved, up to the reader's own limit of 40,000 characters per page (`PAGE_TEXT_MAX`, unchanged). `RESEARCH_PAGE_MAX_CHARACTERS` is now that same 40,000, and a test holds the two equal.
- `textShortened` is true only for a page longer than the reader keeps.
- Nothing else changes: at most 5 pages, code picks them, the text stays under `untrustedText`, and sources are given only when asked.

## Consequences

- Answer quality first, as the owner asked: any fact on a picked page reaches the model, wherever it sits on the page.
- Cost: a builder question now sends the picked pages in full. A typical page is 3,000 to 8,000 characters (the About page above is 4,711); the most one call can send is 5 pages of 40,000 characters, about 50,000 tokens, against about 3,500 before. Each later round of the same message sends it again. The real figure is in the usage rows and the eval report's "Model use".
- A very long website could come near the model's context size if one message researches several topics. The usage rows will show it; this ADR sets no other limit.
- Eval case G-builder-09: the managing director sits below a long menu on the made-up About page and is found.
