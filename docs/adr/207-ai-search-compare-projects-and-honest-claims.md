# ADR-207 · AI search compares projects, and says cheapest, largest or best only when a result backs it

- Status: Accepted (Phase 3 of "AI property search: from chatbot to discovery engine", approved by the owner on 26 Nov 2026, plan section K). The way an unbacked claim is handled (the sentence is taken out) is a default the owner may change.
- Date: 2026-11-26
- Related: ADR-206 (state and paging), ADR-205 (ranking), ADR-128 (the assistant, sections 5 and 6.4.2), ADR-171 (login wall)
- Class: C1. Server code in the AI chat feature only. No migration, no dependency, no new words the customer sees.

## Context

The assistant could compare two or three homes (`compare_properties`) but not projects: asked "which of these two projects?", it read each with `get_project` and worked out the differences itself. Nothing stopped an answer from calling a project "the best" or a home "the cheapest" when no result said so. Since Phase 1, promotion orders genuine matches, so the first result is often a promoted one: an unchecked "the best" would turn a promotion into a claim the customer cannot see is paid for.

## Decision

- **`compare_projects`** (`tools/compare-projects.ts`): 2 to 4 projects by slug, signed-in customers only, each read with the project page's own cached read. Per project: price as the page writes it, a rate per sq ft only when the price is one or a total over one known area, BHK sizes, property type, area, possession, units available, RERA, and the amenities only that project lists; for all of them, the amenities in common. The differences are worked out in code: the lower and higher price (only between totals of the same type), the lower rate per sq ft, the earliest and latest possession, the most units available. When the chat has a current project search (ADR-206), each project gets code-made `matchReasons` and `missedPreferences` against it (BHK, budget, preferred areas, preferred amenities). Nothing about promotion is in the result, so a comparison cannot be won by a promotion.
- **The honest-claims check** (`guards/superlatives.ts`, rule 9 of the output check): a sentence that says cheapest, lowest price, best deal, largest, biggest, or that a home, project or builder is the best or number one, is kept only when this turn's results back it:
  - a price claim by a record marked `lowestPriceOfMatches` or named lowest in a comparison's differences;
  - a size claim by `largestOfMatches` or a comparison's largest area;
  - a quality claim ("the best project") never: no result can back it. A sentence that ties "best" to the customer ("best if you want a pool") or denies a single best is not a claim.
    A sentence that names a record (marker or name) must name a backed one. One that names none passes when the turn has a backed record or the customer asked for exactly that ("show me the cheapest").
- **What happens to an unbacked claim:** the sentence is taken out of the answer; its cards stay; the tag `claim_unbacked` is counted in the usage row. The answer is not blocked, because the rest of it is usually right. If nothing is left, the existing empty-answer fallback applies.
- **Prompt and descriptions:** one line in the facts section ("never call a home or project the best; cheapest or largest only when a result marks it so"); the compare tool tells the model to explain trade-offs against the customer's wants. Prompt version 2026-11-26.3.
- **Cost ceilings kept:** the tool list stays under 28,000 characters and the prompt under 13,000 (15,800 with every optional section) by shortening existing tool descriptions and prompt wording. The ceilings were not raised.
- **Evals:** a golden case (a backed "cheapest" in a comparison passes) and two red-team cases (a crowned "best project" and a false "cheapest" are taken out).

## Alternatives not taken

- **Blocking the whole answer** on an unbacked claim: one wrong word would cost the customer the whole answer and every card.
- **Shadow mode first** (like number grounding): the owner asked that false claims not be shown; the patterns are narrow (they need a listing noun or "is the best"), and the evals cover the common phrasings.
- **Extending `compare_properties` to projects:** one tool for two record kinds with different rules (sign-in, price types) would make both descriptions longer; a second tool is clearer and costs about the same.

## Consequences

- Project comparisons are worked out by code, and the answer can only name a winner on price, area, possession or units, never on promotion.
- A sentence like "Kadal Vista is the best project in Chennai" no longer reaches the customer. A phrasing the patterns miss still can: the prompt line and the evals are the other two layers.
- Left out of Phase 3 on purpose: match reasons in `get_project` and `get_builder` (the comparison carries them), and the Sponsored label of the plan's decision D3 (the owner chose no visible promotion label, K.3).
