# ADR-208 · Prime projects: the super admin sets the amounts, every read works the tag out

- Status: Accepted (Phase 1b of "AI property search: from chatbot to discovery engine", plan section K.2; the owner answered Q-B and approved the words on 26 Nov 2026)
- Date: 2026-11-26
- Related: ADR-205 (ranking: Prime is not a tier), ADR-168 and ADR-152 (same storage pattern), ADR-128 (the assistant), BR-81
- Class: C2. A new key in the existing `site_settings` store, a new admin page and new words. No migration, no dependency.

## Context

Prime existed only for homes, as a price label worked out in the database (`listing_label`: sale from ₹1.5 crore, rent from ₹60,000 a month). Projects had no Prime tag, so the assistant could not answer "prime projects in OMR". A project has one price and one price type (rate per sq ft, basic price, all inclusive price, rent per month, rent per sq ft per month), so one amount cannot fit every project.

## Decision

- **The rule:** one optional amount per kind of price, in whole rupees: _rate per sq ft (sale)_, _total price_ (a basic or an all inclusive price share it), _rent per month_ and _rent per sq ft per month_. A project is Prime when its price is at or above the amount for its price type. An empty amount means no project priced that way is Prime. A project with no price or no price type is never Prime. The rule is one pure function, `isPrimeProject` in `src/lib/project-prime.ts`, used by the site and the AI alike.
- **Where the amounts live:** one more key of `site_settings`, `project_prime`, value `{ ratePerSqft, totalPrice, rentPerMonth, rentPerSqftMonth }` (each a whole number or null). Same table, policies and audit trigger as ADR-152 and ADR-168: only the super admin writes, the audit records that it changed and by whom, the same `admin_edit` limit and the same cache tag. The save writes all four keys, a cleared one as null, so a cleared amount does not fall back to the built-in one. A stored row that does not fit is ignored (BR-81).
- **Built-in amounts (owner, 26 Nov 2026):** ₹1.5 crore for a total price and ₹60,000 for a rent per month, the same as a Prime home; the two per sq ft amounts are empty until the admin sets them.
- **Worked out on every read:** nothing is stored on the project. Each reader takes the current amounts from the site settings and works the tag out, so a saved change applies to every project at once (within the settings cache, which the save refreshes).
- **Where the super admin edits them:** a new admin page **Prime projects** (`/admin/prime-projects`), in the Inventory group of the sidebar.
- **Never a boost:** Prime is a fact about a project and a filter. It is not a promotion tier and never changes the order of results (ADR-205).
- **Where it shows (second PR):** a `prime` filter and fact in the assistant's project tools, and the Prime badge on project cards and the project page. The owner chose no Prime filter on the projects page: the chat is where customers narrow the list.

## Consequences

- Every settings read now also returns `project_prime` (the built-in amounts by default).
- The home Prime label stays as it is, in the database, with its fixed amounts.
- Changing a price type later means adding it to `PRIME_RULE_OF_PRICE_TYPE`; a test keeps that list equal to the project price types.
