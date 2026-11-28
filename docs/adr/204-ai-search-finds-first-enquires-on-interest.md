# ADR-204 · AI search finds first, offers an enquiry only on interest, and searches every project and city

- Status: Accepted (on 26 Nov 2026 the owner asked to start Phase 0 of the plan "AI property search: from chatbot to discovery engine", and answered that it replaces the 23 Nov rule of offering an enquiry after every list).
- Date: 2026-11-26
- Related: ADR-128 (the assistant), ADR-174 (conversation and enquiry offers, changed here), ADR-175 (reply buttons, changed here), ADR-178 (a city given as a locality), ADR-171 (login wall)
- Class: C1. Prompt wording, the server's choice of reply buttons, one tool input on two tools and a larger project read. No migration, no dependency, no new words the customer sees (one button wording is removed).

## Context

The owner found that the AI search behaved like a chatbot: it showed three or four homes and then pressed for an enquiry or a site visit, although many more homes matched. The code did exactly that:

- the prompt said to talk about at most three homes at a time, and to offer an enquiry after every list of homes and every project (ADR-174);
- the server put an "Enquire" button under every list, every single home and every single project (ADR-175);
- `search_projects` filtered the project list in code, but the list read held at most 60 projects; dev had 65 live, so five could never be found;
- the tools had no city input, although `search_properties()` and `live_project_list()` both take one, so "in Chennai" became a text match.

## Decision

- **Find first.** The prompt no longer caps the homes discussed at three. When a search finds more than the assistant describes, it says how many match in all and that the customer can see more or narrow the search. It may end with one short question that narrows the search.
- **An enquiry or a site visit only on interest.** After a list of homes or projects the assistant offers neither. It offers one only when the customer shows interest in one particular home or project (asks about it, likes it, or asks about a visit, the owner, the builder, the price or contact), once for each, as before. A customer who asks for an enquiry still gets the card at once; only Send sends it (unchanged).
- **Reply buttons follow the same rule** (`pickReplies`): several homes get Compare and Show more; one home from a search gets the EMI sum and similar homes; "Enquire about this home" is added only when the home was looked up in detail (`get_property`); one project gets Enquire and Site visit only when it was looked up in detail (`get_project`), and nothing when it came from a search. The button "Enquire about one of these" (`ai.replies.enquireOne`) is removed.
- **Every project is searched.** `PROJECT_LIST_LIMIT` is 120, the most `live_project_list()` gives. The projects page reads the same list.
- **A city filter.** `search_properties` and `search_projects` take `city` (null for any). The tool turns it into the city key (lower case, Latin letters and digits only, the form `city_key()` compares) and passes it to `search_properties(p_city)` (through `getSearchResults(params, { city })`, which only the assistant uses: the results page's address has no city) or to `live_project_list(p_city)`. A name with nothing usable in it (for example Tamil script) sends no city filter. When a city finds no home, its words are tried once as a keyword without the city filter (a neighbourhood taken for a city), as ADR-178 does for a locality; a locality tried as a keyword keeps the city.
- **Prompt version** 2026-11-26.1. The eval cases that expected an offer after a list now expect none.

## Alternatives not taken

- **Raising the cards from 3 to 6 now:** approved by the owner, but it goes with paging (the next phase), so that Show more brings new homes instead of repeating them.
- **Validating the city against the listed cities first:** one more read per search, and the search already answers an unknown city with nothing, which the keyword retry covers.

## Consequences

- Fewer enquiry offers in the chat; enquiries now come from customers who looked at one home or project.
- A project beyond the 120th is still not searched; the ranking phase of the plan replaces this read with a search that has no such limit.
- The results still come back newest first, not best first, and Show more still repeats: the ranking and paging phases of the plan fix both.

## Amendment, 28 Nov 2026: the city chosen in the header

The owner found that "homes in KK Nagar" on a visitor set to Chennai listed Madurai's KK Nagar: the chat searched every city unless the customer typed one. Now the endpoint reads the city chosen in the site's header (`getSelectedCity`, the default city when none was chosen) and the other listed cities (`ChatDeps.chosenCity`). A home or project search with no city of its own looks only in the chosen city (`withChosenCity` in `city-filter.ts`, used by `search_properties`, its place search and `search_projects`; the page is remembered with the city, so Show more and See all keep it). A city the customer names always wins: "homes in Coimbatore" searches Coimbatore only. The prompt's city section (prompt `2026-11-28.5`) says so, and tells the assistant to say when nothing is found in the chosen city and offer the other listed cities. Test `UT-ai-chosen-city`.
