# ADR-216 · When a home search finds nothing: widen around the locality, or say what is nearest

- Status: Accepted. Owner decisions in chat on 27 Nov 2026 (`ai-chat-next-plan.md`, piece 3, and its decided points), approved for build the same day.
- Date: 2026-11-27
- Builds on: ADR-215 (one list), ADR-205 (ranking), ADR-142 (place search)
- Class: C1 (tool code, tests, one eval case). No migration, no dependency, no new tool, no new visitor words (the assistant writes its own sentences; the status lines are piece 4).

## Context

A search with nothing in the area got "nothing found" and a suggestion to widen, which the customer then had to ask for. The owner wants the assistant to widen on its own and, when the budget or the size finds nothing, to say what there is.

## Decision

All inside the one `search_properties` call, so a message keeps its limits (5 rounds, 6 calls, 3 s a tool, 40 s); the extra reads run together.

1. **Widening (signed-in customers only).** When nothing matches and the customer gave a locality (and no keyword), the search reads homes within 5, 10 and 15 km of the locality's centre at once and answers with the smallest circle that holds homes. The result says `widened.radiusKm`; the homes take the place of the matches (ranked with their distance), and paging works on them. The centre comes from what we already hold, never a paid map lookup: the admin's curated homepage locality with that name, else the mean of the exact points of the live projects in that locality. With no centre, nothing is widened.
2. **The nearest alternative.** When nothing matches (and nothing nearby), a bedroom count that found nothing is tried one fewer, then one more; the first count with homes comes back as `alternative` (its count, how many, up to 3 homes with their cards), never as matches.
3. **The price range.** When a budget found nothing, the lowest and highest price of our homes that meet everything but the budget come back as `priceRange`, only when at least 5 of our homes are there, and only for buy or for rent (never mixed). The tool description tells the model to say it as homes on findsprop, never as an average or a market price.
4. A guest gets the alternative and the price range, not the widening (owner, 27 Nov 2026). A search around a place (ADR-142), a search with matches, and a failed extra read change nothing.

## Consequences

- A search that found nothing costs up to five more cached search reads and one small read of project points. A search with matches costs nothing more.
- The model is told what was done, in facts, and writes its own sentence ("nothing in Velachery, but within 5 km there are…").
- The status lines "Searching nearby…", "Extending the range…", "Extending the range further…" come with piece 4.

## Tests

`UT-ai-tool-fallbacks` (5, 10, 15 km in one call and the smallest circle, no paid lookup and no locality text in the circle reads, no widening for a guest or without a centre, nothing more when there are matches, the alternative, the price range and its five-home floor, no mixed range, a failing read); `UT-ai-locality-centre` (curated first, the mean of the projects in that locality, a literal pattern, no centre on failure); golden case `G-fallback-01`.
