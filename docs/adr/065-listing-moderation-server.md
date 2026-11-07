# ADR-065 · Listing moderation: the server side of the admin queue (S6-T04, part 2)

- Status: Accepted
- Date: 2026-11-07
- Related: ADR-064 (the database functions), ADR-060 and ADR-061 (the listing wizard's server side, the pattern followed here), ADR-048 (cache tags), ADR-035 (error and message keys), FR-ADM-02, BR-23 to BR-25
- Plan approved by the owner on 7 Nov 2026 ("all recommended"). This is part 2 of 4: server side only, no screens.

## Decision

- **One action, `moderateListing`, with the decision in its input.** The input is a union on `decision`: `approve`, `feature` and `unfeature` take the listing; `reject` also takes a reason. The reason is trimmed and must be 1 to 500 characters (the database holds the same rule); a reason sent with any other decision is dropped by the schema and never reaches the database. One action keeps one rate limit, one error mapping and one place where the cache is refreshed, and the screens (a confirm dialog per decision) call it with a different `decision`.
- **Super admin only, as the admin's own session.** `defineAction` checks the role first; the store then calls `moderate_listing` through the admin's cookies, so the service role is not used and the database checks the role a second time. A visitor is `UNAUTHENTICATED`; a customer or a builder is `FORBIDDEN`, before the rate limit or the database are touched.
- **A new rate-limit scope, `admin_decision`: 120 per admin per hour.** A busy review session is well inside it; a stuck script or a stolen session is not. The number is mine, not a requirement; it is one line in `limits.ts` if the owner wants another. The plan table in `docs/engineering` lists the scopes and was not edited (protected); it needs the new row when next touched.
- **No idempotency key and no `audit` entry in the action.** A repeated decision finds the listing already decided and the database answers with a conflict, so nothing is written twice. The audit trigger already records every status and featured change with the admin as the actor, and the rejection reason (ADR-064); a second entry from the action would duplicate it.
- **Cache: every decision refreshes `tagsAfterListingChange(shortId)`.** An approval puts the home on the public lists, a rejection or an unfeature takes it off, a feature changes its badge and place. The short id comes from the database's answer, not from the request.
- **Database errors become the closed action codes** (the messages are never shown): `listing.not_reviewable` and `listing.not_featurable` are `CONFLICT` (another admin decided first, or the page is out of date); `listing.reason_required` is `VALIDATION` on the `reason` field; `listing.not_found` is `NOT_FOUND`; `listing.not_allowed` is `FORBIDDEN`; anything else is `INTERNAL`.
- **The reads are three queries, never cached.** `getQueuePage`, `getQueueCounts` and `getQueueLocalities` run as the admin and map rows to view models (`QueueItem`, `QueueCounts`); a row that is not shaped as a listing is left out and counted in the log, so one bad row cannot blank the queue. The page cursor is the last row's submission time and id, joined and encoded (`cursor.ts`, server side because it uses `Buffer`); a cursor that is not one the page made is ignored. A page reads one row more than it shows (25) to know whether "Show more" is needed. The queue's address bar (tab, locality, kind, cursor) is one schema in which invalid values fall back to the defaults (R-FE-11).
- **Photos are public.** The `listing-photos` bucket is public (ADR-058), so the queue builds each photo's address from its path; no signed address is needed.
- **Tests.** Unit tests cover the schemas, the action's pipeline (who may call, the limit, the tags, no audit entry), the error mapping, the view models, the cursor and the queries with a stand-in database. `tests/integration/moderation.test.ts` (IT-actions-listing and IT-AUTHZ-admin) runs in CI against the local stack: each decision as a real signed-in super admin, each refusal (visitor, customer, builder), the audit entry, and the shape of the queue rows. The test administrator is made through the reserved address with a one-time link (`signInTestAdmin`); the account is removed afterwards unless it was already there.

## Consequences

- No new package, table, grant or migration. One new rate-limit scope.
- The screens (parts 3 and 4) import only the feature's index file; client components get the view models and `moderateListing` through props, never the queries or the store.
- Rollback: delete `src/features/moderation`, the scope line and the test support function. Nothing is destroyed.
