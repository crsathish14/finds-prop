# ADR-205 · AI search ranks every match, with the admin's promotion tiers among genuine matches

- Status: Accepted (on 26 Nov 2026 the owner answered the plan's decisions D1-D11 and asked to start Phase 1 of "AI property search: from chatbot to discovery engine"). Two defaults wait for the owner: Q-A (whether the hero sponsor ads that link to a project count as Sponsored: built as yes) and Q-C (whether a featured home ranks above other homes: built as yes, among good matches only).
- Date: 2026-11-26
- Related: ADR-204 (Phase 0), ADR-128 (the assistant), ADR-191 (Sponsored builders page), ADR-045 / ADR-182 (sponsor ads), ADR-171 (login wall)
- Class: C1. Server code in the AI chat feature only, and one optional field on the project list item. No migration, no dependency, no new words the customer sees.

## Context

After Phase 0 the assistant could find every project and filter by city, but the results still came back in the database's order (homes newest first, projects featured first): the first ten were the newest ten, not the best ten. Nothing the admin sets as a promotion reached the assistant, and a preference (a pool, an area the customer likes) could only be a hard filter or nothing.

## Decision

- **Every match is ranked.** The home search reads up to 120 matches (the most `search_properties()` gives; a guest's read still gives ten); the project search ranks every live project that passes the filters (up to 120). `rankedAll` / `searchedAll` say whether that was every match.
- **Filters stay filters; preferences only rank.** New inputs `preferLocalities`, `preferAmenities` (both tools) and `preferFurnishing` (homes). A home or project without a preference still shows, lower.
- **Relevance from 0 to 100** (`src/features/ai-chat/ranking/rank.ts`, numbers in `src/config/ai-ranking.ts`): preferences met (40), budget use (20, never penalising a price under budget by much), distance from a place (15), freshness (10), completeness (15). A part the customer said nothing about scores full marks for everyone.
- **Order:** strong matches (relevance at least 60) first; inside each band the promotion tier, then relevance, then the newest, then the id. A promotion orders genuine matches and never lifts a weak match above a strong one.
- **Promotion tiers, from the admin's own settings** (read fresh each search; nothing hard-coded): sponsored (the Sponsored builders page's Featured-card list, and projects an active sponsor ad links to), featured (the project's Feature switch in moderation), spotlight (the Spotlight list), top (the Top developers page), none. A builder in several lists gets its best tier once; tiers never add up. A home is featured (listing moderation) or none. The Prime tag is not a tier.
- **Nothing promotional is said.** The tier never appears in a tool result; a home's label `featured` is given to the model as no label; the tool descriptions forbid calling a result sponsored, featured or promoted (owner, 26 Nov 2026).
- **Reasons made by code.** Each result carries `matchReasons` and `missedPreferences` (plain English facts from the request and the ranking, never a listing's text), and `lowestPriceOfMatches` / `largestOfMatches` (homes), so the model may say "cheapest" only when it is true of every match.
- **Slightly above budget (decision D4):** when the customer gave a maximum, at most one promoted project or featured home that misses only that maximum, by at most 10%, comes back apart as `slightlyAboveBudget`, never counted as a match. For homes it costs one more read of the same search; for projects none.
- **Reads that only improve the order never break the search** (`ranking/reads.server.ts`): the promotion lists, the homes' amenities and furnishing (only read when such a preference is given), and the projects' amenities and listing day. Each is the signed-in customer's own read of public columns; a failure ranks without it.

## Alternatives not taken

- **New database functions for the candidates:** the existing functions already apply the filters and visibility rules, and the signed-in customer may read the few extra public columns; a migration would add work without changing what is found.
- **A vector search:** the asks are structured (BHK, budget, area) and the inventory is small; see the plan, section B.
- **Scoring in SQL:** the ranking rules are tested in seconds as pure functions here; in SQL they could only be tested in CI.

## Consequences

- The first results are the best fits, and a sponsored or featured project comes first among equally good matches.
- One more read per home search with a budget (the slightly-above-budget slot), and one read per project search (amenities).
- Show more still repeats the first results: paging is Phase 2. The cards in the chat still show the site's own Featured badge (the card component is the site's): Phase 2 decides that with the card change.
