# ADR-134 · Place search: the database part of the usage count (PR 3a)

- Status: Proposed. The owner approved the overall plan on 17 Nov 2026 (`OLA_MAPS_PLAN.md` section 4.6, PR table rows 3a, 3b and 6b); this change is only the database part and merges when its checks pass and the owner accepts it.
- Date: 2026-11-17
- Related: ADR-131 (the adapter), ADR-132 (the screens, including the usage card), ADR-133 (the autocomplete route), ADR-121 (the admin overview function), ADR-124 (retention, DEC-28), ADR-128 section 8 (the AI usage table this one copies), R-DB-01 to R-DB-07
- Owner answers of 17 Nov 2026: track calls to Ola Maps only, saved for the admin dashboard; no email or other alert; no cost, no price rates, no allowance bar, no credit balance.

## Decision

- **One table, `public.places_usage_daily`.** One row for each day, API, caller and outcome, holding a number (`calls`) and nothing else: no typed text, no place name, no visitor hash, no user id. `day` is the calendar day in India time. `api` is text with a shape check (`^[a-z][a-z0-9_]*$`, at most 40 characters), so a later Ola API needs no migration; today only `autocomplete` is used. `caller` is one of `search_box`, `listing_form`, `admin_picker`, `ai_chat` and `outcome` one of `ok`, `empty`, `timeout`, `quota`, `error`; a new value is a one-line migration (the lists match the plan and the card of ADR-132). The primary key (`day`, `api`, `caller`, `outcome`) also serves the month and range reads, so there is no other index.
- **Closed to every client role.** RLS is on, there is no policy and `anon` and `authenticated` hold no privilege, the same as `ai_usage_events`. Not even the admin reads the table through the API.
- **`record_places_call(api, caller, outcome)` counts one call.** A definer function with a pinned search path. It checks the three values against the same lists (`places_usage.bad_api`, `.bad_caller`, `.bad_outcome`, error code `22023`; a missing value is refused too) and then does one `insert ... on conflict (day, api, caller, outcome) do update set calls = calls + 1` for today's India date, so two calls at the same moment are both counted. `EXECUTE` is for the service role only, so a browser can never raise the counts. The server calls it with the admin client after the answer is sent; that is PR 3b and is not in this change.
- **`admin_places_usage(from, to)` is what the card reads.** It checks the role as `admin_overview` does (`is_super_admin()`, otherwise `places_usage.not_allowed`, `42501`), and a range must have `from` before or on `to` and at most 92 days counting both ends (`places_usage.bad_range`, `22023`). Unlike `admin_overview` it is a **definer** function: the table has no policy, so an invoker function could read nothing; the admin check inside the function is the gate, and it is granted to signed-in people and the service role only, never to visitors. It returns one JSON object of counts: `total`, `today` and `month` (the current India day and month so far, whatever the range), `days` (one entry per day of the range, a zero for a quiet day), `apis` (the busiest first), `callers` and `outcomes` (every caller and outcome always present, with a zero) and `problems` (timeout + quota + error). No cost, no allowance and no balance appear anywhere. `apis` is not drawn by the first card; it is there so a second API needs no change to the function.
- **Retention: 24 months, provisional.** `run_retention` is replaced whole (as the runbook says) with a sweep of rows whose day is older than 24 months, a `places_usage_daily` count in its answer and in the `retention.ran` audit entry. The rows hold no personal data, so the window is long enough for the admin to compare a year with the one before; the owner confirms it (DEC-28).
- **Only calls that reach Ola are counted** (a request our own limit refuses, or one answered from our locality list, is not). That is a rule of the writer in PR 3b, not of the table.

## Consequences

- The count is the site's own, so it is a guide to the 100,000 free calls a month, not Ola's invoice; the balance and the bill stay in Ola's console.
- A later API needs no migration (a new `api` name), a later caller or outcome needs a one-line migration, and a later "calls our own limit refused" count (OLA_MAPS_PLAN.md section 4.7) would be a new outcome value.
- PR 3b writes the counts and PR 6b draws the card from `admin_places_usage`; until then the table is empty and the function answers zeros.
- Rollback: nothing else depends on the table or the functions. Drop both functions and the table after taking the writer out of the app, or fix forward. Rows deleted by retention stay deleted.

## Verification

- pgTAP, `places_usage_daily.test.sql` (56 checks): RLS on with no policy and no client privilege, the checks on each column, a first call creates the row for the India day and a second adds one to the same row, bad input is refused and counts nothing, who may record (service role only), the admin's numbers for a fixed range (days, APIs, callers, outcomes, problems, a quiet range, 92 and 93 days, today and month as a change), and who is refused (customer, agent, visitor, the service role with no admin behind it).
- `retention.test.sql` deletes a count older than 24 months and keeps a newer one, and the answer and the audit entry gain the `places_usage_daily` key. `function_grants.test.sql` and `rls_matrix.test.sql` list the two functions and the table.
- No app code, package, environment or CI change. `src/types/database.types.ts` is regenerated.
