# ADR-150 · The home page search is one AI search bar

- Status: Accepted (owner's change request and approval of the plan and its defaults, 22 Nov 2026, "Approved, use defaults")
- Date: 2026-11-22
- Supersedes: the home page search card of FR-PUB-01 and FR-PUB-02 and of `docs/ux/final-ux` home-a and home-b (Buy, Rent and New projects tabs, Locality with place suggestions, Property type, Bedrooms, Max budget, Popular and Quick-pick chips, "Describe it in words"); the Popular chips of ADD-11 in the admin's Homepage page
- Related: ADR-128 (AI chat), ADR-131 and ADR-136 (place search, still used by the results filters), R-FE-17 (flags), DEC-13 (curated localities)
- Class: C2 (it changes the approved UX)

## Decision

- **One box and one button.** The home page hero shows a single search box and a **Search with AI** button, in place of the filter card. The headline, line, eyebrow, banner area and trust lines are unchanged.
- **Search with AI opens the chat and sends the words.** The words are kept in this tab's `sessionStorage` (`findsprop:ai-chat:home-question:v1`) and the page goes to `/ai-search`. The chat takes them once, removes them and sends them as the next message of the conversation already in the tab (or the first). An empty box opens the chat with the cursor in its box.
- **The words never go in the address.** No `?q=` on `/ai-search`: search words stay out of server logs and analytics, and a link from another site cannot make the chat send a message in the visitor's name. Before the page's script has loaded, the form still goes to `/ai-search`, without the words.
- **Sign-in is unchanged.** The chat's endpoint decides as before. A visitor whose trial is used up sees the gate, with the words back in the box; if the gate is already up when the chat opens, the words wait in the box and nothing is sent.
- **While `FLAG_AI_SEARCH` is off** the same bar is a keyword search: a plain GET form to `/properties?q=…` with a **Search** button (it works without script).
- **Removed:** `SearchCard`, `HomeSearch`, the Popular and Quick-pick links (`home-links.ts`) and the card's address mapping (`searchHrefFromCard`), with their tests and unused messages. The admin's Homepage page no longer describes or draws Popular chips. The place search box itself stays in the results filters.

## Decisions taken by default (owner approved)

- The bar has no other link: "New projects" and the chips are gone from the hero (the Projects page stays in the navigation).
- The question is added to the conversation already kept in the tab rather than starting a new one.
- The wording: placeholder "Describe the home you want, e.g. 3 BHK near Velachery under ₹90 lakh" and button "Search with AI". The keyword bar's words ("Search by locality, project or keyword", "Search") are draft wording for the owner to confirm.

## Consequences

- The home page no longer calls the place suggestion route, so it makes no Ola Maps calls.
- `docs/requirements` (FR-PUB-01, FR-PUB-02) and the final UX boards still draw the card; this record is what is built.
