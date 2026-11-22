# ADR-171 · The lists of homes and projects, and the comparison, are for signed-in visitors

- Status: Accepted. Plan approved by the owner (Plan 3, login wall) on 22 Nov 2026; the owner chose option 1 for the AI chat (search needs sign-in). Part A (narrow public reads) is merged (PR #313). This is part B. Part C closes the database doors; the AI tools change is its own pull request between B and C.
- Date: 2026-11-22
- Related: ADR-017 (public projections), ADR-042 (results page), ADR-044 (compare), ADR-046 (projects page), ADR-125 (authorization verification), BR-42, BR-90, BR-94
- Class: C2 (visibility of data, a new function and its grants, SEO)

## Why

Hiding the pages is not enough: every browser holds the public key, so anyone could read the lists straight from the database (`/rest/v1/properties`, `search_properties`), and the sitemap listed every address. The wall must be in the database, and the pages must stop depending on the open doors first.

## Decision

- **One home, one project, the homepage sections and the sitemap stay public** and read through narrow functions (`public_property`, `public_project`, `home_properties`, `home_developers`, `sitemap_entries`, part A). Each answers one row or a small fixed set and repeats its row rule.
- **The lists are for signed-in visitors:** `/properties` (all filters), `/projects` and `/compare`. A visitor who is not signed in gets a static wall instead: made-up cards (invented numbers, words from `en.json`, pictures from the Design Lab) that are blurred, hidden from assistive technology and unreachable, with a message and one button to the phone sign-in. The wall page reads nothing from the database for the list, and the module that draws it imports nothing from the server.
- **Sign-in inside the wall (amended 23 Nov 2026, owner decision):** nothing navigates. The wall card holds the phone number step and the code step of `/auth` themselves: the same components (`PhoneSignIn`, `CodeEntry` in an inline mode), the same server actions, limits, human check, error words and rules. After a right code the page refreshes its server data in place (`router.refresh()`), so the same address and filters draw the real list; no personal data goes into the address. The inline flow has no frame, no `h1`, no builder or back link, and does not ask a new account for its name or email: both are asked before posting or enquiring (ADD-04), and the sign-in cookie re-renders the page the moment the code is checked, so a step after it could not be kept in the card. The earlier button to `/auth?redirect=` is removed.
- **Readers use the visitor's own session and no shared cache.** `getSearchResults` calls `search_properties()` with the cookie client; `getProjects` calls the new `live_project_list()`, which only `authenticated` may run. The function repeats the public row rule, because a signed-in builder or admin can read other rows through their own policies and the list must be the same for everybody. The cost is that these reads are no longer cached; accepted.
- **Search engines:** a list page for a visitor who is not signed in has one generic title, `noindex,nofollow`, whatever the filters. `/properties` and `/projects` are removed from the sitemap. Property and project detail pages stay public, ranked and in the sitemap (slug and date only).
- **Hand-edited addresses** are still sent to their canonical form before the wall is drawn.

## Consequences

- The e2e smoke tests of the results, comparison and projects pages cannot sign anyone in (no code can be sent in CI), so they now check the wall, its way back, its title and tags, and its accessibility. The compare-bar tests that opened `/properties` open `/` instead. A signed-in list is covered by unit tests of the readers and the database tests; a signed-in end-to-end test needs a test user and is not part of this change.
- The Design Lab has no entry for the wall yet.
- **All words of the wall are unapproved** ("Sign in to see all properties", the message and "Sign in with phone"): the owner can edit them in `en.json`.
- **The AI chat (owner decision: sign-in required for search):** `search_properties`, `search_projects`, `list_localities` and `get_builder` refuse a customer who is not signed in with `sign_in_required`; the hint tells the model to point to the sign-in button and to list nothing from memory. The endpoint tells the tools only one yes or no (`signedIn`), from the verified session. `list_localities` and `get_builder` read through `live_locality_names()` and `live_builder_projects()`, which only signed-in customers may run, with the customer's own session and no shared cache. Replies that read no list, and one home or one project by its id, stay open to everybody. Part C revokes anonymous table access.
