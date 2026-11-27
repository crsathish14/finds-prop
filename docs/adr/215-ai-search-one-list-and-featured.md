# ADR-215 · One list of homes and projects, with Featured back on promoted cards in the chat

- Status: Accepted. Owner decisions in chat on 27 Nov 2026 (`ai-chat-next-plan.md`, piece 2), approved for build the same day. One new line for Show more waits for the owner's approval of its words.
- Date: 2026-11-27
- Amends: ADR-206 (its point "no promotion badge inside the chat"), ADR-205 (what the home search ranks)
- Related: ADR-200 (guests see homes only), ADR-208 (Prime), ADR-214 (residential projects for rent)
- Class: C1 (tool code, tests and eval cases). No migration, no dependency, no new tool.

## Context

A customer who asked for "2 BHK to buy in Porur" got homes only; the projects in Porur came only when they asked for projects by name. The owner wants homes and projects in one list, with the projects of paying builders first among the good matches and marked "Featured" in the chat.

## Decision

1. **One call, one list.** `search_properties` reads the matching projects at the same time as the homes (one more read of the cached projects list, run in parallel) and ranks both together with the same ranking (ADR-205): strong matches first, and among them the promoted tier first. Paging, Show more, "seen before" and the cards run through the one list; a project is paged and remembered as `project:<slug>`.
2. **Which projects.** A buy search reads projects for sale (anything but rent), a rent search projects for rent, a search for either reads both. With no property type, residential projects only; "commercial" reads the commercial ones; apartment, villa and plot read residential projects of that kind; a house has no project kind. Locality, keyword, bedrooms, city and the budget apply as for the projects search; a budget compares with a total price for sale and with the monthly rent for rent (a rate per sq ft never meets a budget).
3. **When.** For a signed-in customer only (a guest sees homes only, ADR-200), and only when the customer asked for no order of their own and no home label (Prime, budget, featured are home labels). A search around a place lists homes only: the projects list holds no position. When the projects cannot be read, the homes still answer.
4. **The result** adds `projects` (as `search_projects` gives them) and `order` (the page as `home:<homeId>` and `project:<slug>`); `total` counts both. The cards follow the same order.
5. **Featured in the chat** (changes ADR-206): a featured home keeps its Featured badge on its card in the chat, and a project carries Featured when its tier is a paid one: a sponsored builder or project, featured in moderation, or a Spotlight builder. The Top developers page is the admin's own pick: it still ranks, with no label. The model is still never told a tier and still never calls anything sponsored, featured or promoted (ADR-205 point 6).
6. **Show more** on a page that holds homes and projects says "Here are # more matches for your search ({shown} of {total} shown so far)." (`ai.more.matches`, **new words awaiting the owner's approval**). A page of homes only or of projects only keeps its approved line.

## Consequences

- A signed-in home search costs one more cached read (the projects list, shared with the projects page) and one small read of the matching projects' kind and amenities. It stays one tool call, inside the per-message limits.
- `search_projects` stays for project-only questions (status, Prime, a project by name).
- A customer may now see a project where they saw only homes before, which three golden cases now expect.

## Tests

`UT-ai-tool-one-list` (sale and rent, commercial only when asked, promoted first, homes only for a guest, a sort or a label, the homes still answer when projects fail, paging and memory, the comparable price, which tiers carry Featured); `UT-ai-endpoint-show-more` (a mixed page and its line); the chat cards test (Featured on a featured home and a promoted project, none on another); golden cases `G-search-03`, `G-cards-01`, `G-cards-02` now expect the matching project card.
