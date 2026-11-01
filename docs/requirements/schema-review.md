# Rule-to-schema review (S3-T01)

Status: **Q1 to Q3 answered (owner accepted all recommendations, 1 Nov 2026).** No SQL exists yet. Each migration needs an approved written plan first (class C2).

Sources: business rules `BR-*` (analysis `06`), Supabase interactions (analysis `07`), schema plan (plan `06` sections 3 to 7 and 10), decisions `DEC-*` (plan `12`), the approved UX and the UX addendum. The demo's SQL was not used (ADR-011).

Scope of this pass: the identity, site settings and listings tables (F01 to F03 and F06, tasks S3-T02 and S3-T03) are settled below. The builders, projects, forms and CRM tables (F04 and F05, task S3-T04) have their rules traced here, but their column lists are settled in the S3-T04 plan, because they come from the project, builder, form and CRM editors and that reading has not been done yet.

## 1. Rule-to-schema checklist

"Test" is the proposed pgTAP name (`DB-TRG-*` trigger, `DB-RLS-*` policy, `DB-CON-*` constraint, `DB-FN-*` function). "App" means the rule is not a database rule; it is checked by a unit or integration test and appears here only so that nothing is lost.

| Rule        | What it says                                                  | Enforced by (new schema)                                                                                             | Test                                           | Step |
| ----------- | ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- | ---- |
| BR-01       | Sign-up methods                                               | **Changed.** Customers use phone OTP only (FR-AUTH-01); Google is for staff. Auth configuration, not schema          | App (`IT-auth-otp`)                            | T09  |
| BR-02       | Profile created on sign-up                                    | `handle_new_user()` on `auth.users`, null-email safe                                                                 | `DB-TRG-handle_new_user`                       | F02  |
| BR-03       | Everyone starts as `customer`                                 | Same trigger grants the role                                                                                         | `DB-TRG-handle_new_user`                       | F02  |
| BR-04, 05   | Email confirmation, password reset                            | Auth configuration and staff UI                                                                                      | App                                            | T10  |
| BR-06       | Safe redirect                                                 | Not a database rule                                                                                                  | App (`UT-safe-redirect`)                       | T09  |
| BR-10       | Four roles                                                    | `app_role` enum (`super_admin`, `agent`, `builder`, `customer`)                                                      | `DB-CON-app_role`                              | F01  |
| BR-11       | Only the reserved account can be `super_admin`                | `guard_user_roles()` trigger; the addresses live in one function, `reserved_admin_emails()` (two since 1 Nov 2026)   | `DB-TRG-user_roles-guard`                      | F02  |
| BR-12       | Reserved account is granted `super_admin` on create / confirm | Triggers on `auth.users` insert and on `email_confirmed_at` update                                                   | `DB-TRG-super_admin-grant`                     | F02  |
| BR-13       | Admin API cannot touch `super_admin` rows                     | RLS on `user_roles` excludes `super_admin` rows for writes                                                           | `DB-RLS-user_roles-*`                          | F02  |
| BR-14       | `agent` exists, no portal                                     | Enum value only (DEC-08 option a)                                                                                    | `DB-CON-app_role`                              | F01  |
| BR-15       | Builders are invitation-only                                  | `builders` row plus `user_roles` created by the invite saga, never by sign-up                                        | App (`IT-builder-invite`); `DB-RLS-builders-*` | T04  |
| BR-20       | New listing: `draft` or `pending`, `featured = false`         | `BEFORE INSERT` guard trigger                                                                                        | `DB-TRG-properties-insert`                     | F06  |
| BR-21       | Owner may only mark `sold` / `rented`, only from `approved`   | Guard trigger                                                                                                        | `DB-TRG-properties-owner-status`               | F06  |
| BR-22       | Only the admin approves, rejects, features                    | Guard trigger plus admin update policy                                                                               | `DB-TRG-properties-admin-only`                 | F06  |
| BR-23       | `owner_id` never changes                                      | Guard trigger                                                                                                        | `DB-TRG-properties-owner-immutable`            | F06  |
| BR-24, 90   | Public sees `approved` only                                   | RLS plus column grants (section 4)                                                                                   | `DB-RLS-properties-anon`                       | F06  |
| BR-25       | Only the admin sets `featured`                                | Guard trigger                                                                                                        | `DB-TRG-properties-featured`                   | F06  |
| BR-26       | Owner deletes only their own listing                          | RLS delete policy                                                                                                    | `DB-RLS-properties-delete`                     | F06  |
| BR-27, 28   | Listing and property type vocabularies                        | `CHECK` constraints; parity test with `config/vocab.ts` (R-DB-12)                                                    | `DB-CON-properties-vocab`                      | F06  |
| BR-30       | `current_builder_id()` returns the active builder             | Function, `SECURITY DEFINER`, pinned `search_path`                                                                   | `DB-FN-current_builder_id`                     | T04  |
| BR-31       | Builders see only their own projects, units, leads, events    | RLS using `project_is_mine()`                                                                                        | `DB-RLS-matrix`                                | T04  |
| BR-32       | Builder cannot change `active`, `user_id`, `email`            | `guard_builder_update()` (also `phone`, `invited_at`)                                                                | `DB-TRG-builders-guard`                        | T04  |
| BR-33       | Inactive builder loses access                                 | `current_builder_id()` requires `active`                                                                             | `DB-FN-current_builder_id`                     | T04  |
| BR-34       | Builder portal needs role **and** active record               | App guard plus the same function in RLS                                                                              | App (`IT-AUTHZ-builder`)                       | T10  |
| BR-35       | Reserved address cannot become a builder                      | Check in the invite saga **and** a trigger on `builders` (the plan only had the saga; the rule says "enforce at DB") | `DB-TRG-builders-reserved-email`               | T04  |
| BR-40       | New project: `pending`, unpublished, not featured             | `BEFORE INSERT` guard trigger                                                                                        | `DB-TRG-projects-insert`                       | T04  |
| BR-41       | Builder edit resets to `pending`                              | Guard trigger on update by non-admin                                                                                 | `DB-TRG-projects-reapproval`                   | T04  |
| BR-42       | Public sees `approved AND published`                          | `project_is_live()` plus RLS                                                                                         | `DB-RLS-projects-anon`                         | T04  |
| BR-43       | Builder cannot reassign a project                             | Guard trigger                                                                                                        | `DB-TRG-projects-builder-immutable`            | T04  |
| BR-44       | No project delete while leads exist                           | `project_leads.project_id ON DELETE RESTRICT`                                                                        | `DB-CON-project_leads-restrict`                | T04  |
| BR-45       | Units never move between projects                             | `guard_unit_project()`                                                                                               | `DB-TRG-units-project-lock`                    | T04  |
| BR-46, 47   | Lead project fixed; builders change `status` only             | `guard_lead_update()`                                                                                                | `DB-TRG-leads-guard`                           | T04  |
| BR-48       | RERA fields                                                   | Columns `rera_applicable`, `rera_number` (with a check: number only when applicable, to confirm in T04)              | `DB-CON-projects-rera`                         | T04  |
| BR-49       | Project form fallback chain                                   | App (resolution order); FK `projects.form_id`                                                                        | App                                            | T04  |
| BR-50       | Enquiry sender cannot be spoofed                              | `submit_enquiry()` reads `auth.uid()`; no direct insert policy                                                       | `DB-FN-submit_enquiry` (built in S5)           | S5   |
| BR-51       | Sender and listing owner can read an enquiry                  | RLS select policies                                                                                                  | `DB-RLS-enquiries-*`                           | F06  |
| BR-52       | Status `new → contacted → closed`, owner only                 | Guard trigger: forward moves, status column only                                                                     | `DB-TRG-enquiries-status`                      | F06  |
| BR-53       | One save per user and listing                                 | `UNIQUE (user_id, property_id)`                                                                                      | `DB-CON-saved-unique`                          | F06  |
| BR-54       | Saving needs sign-in                                          | RLS requires `authenticated` and `has_verified_phone()`                                                              | `DB-RLS-saved`                                 | F06  |
| BR-60       | Form fields validated on the server                           | App (against the stored definition)                                                                                  | App (`IT-forms`)                               | S5   |
| BR-61, 70   | 5 submissions per visitor per form per hour                   | `rate_limit_hit()`                                                                                                   | `DB-FN-rate_limit_hit`                         | F07  |
| BR-62       | Upload limits (5 MB, types, 3 files)                          | Bucket limits plus app check                                                                                         | `DB-STO-form-uploads-*`                        | F08  |
| BR-63       | Submission mirrored to `project_leads`                        | `record_form_submission()`                                                                                           | `DB-FN-record_form_submission` (S5)            | S5   |
| BR-64       | CRM secrets never reach the browser                           | Separate table, all grants revoked                                                                                   | `DB-RLS-secrets-denied`                        | T04  |
| BR-65       | CRM URL must be https, no private addresses                   | App (`assertSafeUrl`, DEC-28)                                                                                        | App (`UT-crm-url`)                             | S7   |
| BR-66       | Retry schedule 1, 5, 30, 120, 720 min, 6 attempts             | Columns on `form_submissions`; `arm_crm_retry()` / `disarm_crm_retry()`; schedule itself in app                      | `DB-FN-arm_crm_retry`                          | T04  |
| BR-67       | Cron endpoint token, constant-time compare                    | `internal_cron_tokens` (service only); compare in app                                                                | `DB-RLS-secrets-denied`, App                   | T04  |
| BR-71, 72   | 30 events / minute, 5 leads / hour, view de-dupe              | `rate_limit_hit()`; de-dupe in `track_project_event()`                                                               | `DB-FN-track_project_event` (S5)               | S5   |
| BR-73, 74   | AI search limits                                              | **Not created** (AI deferred)                                                                                        | none                                           | —    |
| BR-75       | Visitor hash = HMAC(IP, UA, salt)                             | App only; the hash is stored, never the address                                                                      | App (`UT-visitor-hash`)                        | S5   |
| BR-80 to 82 | CMS keys, defaults merged, homepage toggles                   | `site_settings` (key, JSON) plus app-side merge                                                                      | `DB-RLS-site_settings`, App                    | F03  |
| BR-83       | Header uses the asset, not a CMS logo                         | App                                                                                                                  | App                                            | S4   |
| BR-91 to 95 | Search, labels, localities, AI                                | `search_properties()` and `listing_label()` (F10, Stage 4); AI not built                                             | `DB-FN-search`                                 | S4   |

New in this product (no `BR-*` number): `has_verified_phone()` (customers write only with a verified phone), `audit_log` on every moderation, role and secret change, `idempotency_keys`, `listing_media` limits (at most 6, exactly one cover), storage policies per bucket. These follow plan `06` sections 5 to 7 and have tests listed in `docs/engineering/database.md`.

## 2. Table-by-table column status

| Table group                                                                                                        | Columns settled?                                   | Notes                                                                                        |
| ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `app_config`, `profiles`, `user_roles`, `site_settings`                                                            | Yes (plan `06` 6.3, 6.6)                           | Add `profiles.updated_at` so `touch_updated_at()` applies. Defaults in section 5.            |
| `properties`, `listing_media`, `enquiries`, `saved_properties`                                                     | Yes, **after Q1 and Q2** (plan `06` 6.1, 6.2, 6.4) | Public column grant changes with Q1. Drafts change nullability (Q3).                         |
| `builders`, `projects`, `project_units`, `project_leads`, `project_events`, `project_price_trends`                 | No                                                 | Settle from the project form, builder profile, unit table and lead forms in the S3-T04 plan. |
| `forms`, `form_submissions`, `crm_integrations`, `crm_integration_secrets`, `crm_api_logs`, `internal_cron_tokens` | No                                                 | Settle from the admin form builder and CRM editors in the S3-T04 plan.                       |
| `public_rate_limits`, `idempotency_keys`, `audit_log`, buckets                                                     | Yes (plan `06` 6.7 to 6.9, 13)                     | Built in S3-T05.                                                                             |

## 3. Questions and answers

These change a column list or a policy that cannot be edited later without a new migration. **Answered 1 Nov 2026: the owner accepted the recommendation for Q1, Q2 and Q3.** Open point inside Q1: whether the property page shows the full street address to everyone; the default is no (owner, admin and enquiry flow only) until the owner says otherwise.

**Q1. How exact is a listing's public location? (DEC-35)**
Plan `06` 6.10 grants `anon` the exact `location` and the full `address`. DEC-35 recommends the opposite for owner listings, and a column grant cannot be taken back without a migration.
_Recommendation:_ keep exact `location` and the full `address` visible only to the owner, the admin and the enquiry flow. Add a generated `public_location` (rounded to about 100 m) and grant that, with `locality`, `city`, `state` and `pincode`, to `anon`. Search by radius and the map use `public_location`. Projects stay exact. Say if the property page should show the full street address to everyone.

**Q2. Which edits send an approved listing back to review? (DEC-09)**
_Recommendation:_ option C. Changing title, description, listing type, property type, address or location, or the photo set moves `approved` back to `pending`. Price, availability, amenities and furnishing do not. Because the photo set lives in another table, `listing_media` changes also have to touch the listing; I would do that with a trigger on `listing_media`.

**Q3. Are drafts part of v1?**
The status `draft` and "Save draft" are marked _Proposed_ in the approved UX, and the addendum repeats "Save draft" on the address step. If drafts are stored in `properties`, required fields cannot simply be `NOT NULL`.
_Recommendation:_ yes. Required columns are nullable only while `status = 'draft'`, enforced by one `CHECK`. If you say no, drop `draft` and the columns are plainly `NOT NULL`.

## 4. Where the sources disagree (resolved here, no answer needed unless you object)

- **Public grant vs DEC-35.** Resolved by Q1.
- **BR-35 enforcement.** The plan checks the reserved address only in the invite saga. The rule says "enforce at database level" for the others, so I add a trigger on `builders` as well.
- **BR-20 vs ADR-024.** BR-20 says new listings are `pending`; ADR-024 adds `draft`. New rows are `draft` or `pending`, never anything else.
- **BR-01 vs FR-AUTH-01.** The business rule says email and Google; the product now says phone OTP for customers. The requirement wins; the rule is recorded above as changed.
- **Seeding without Docker (ADR-034).** The plan has the dev seed script create the admin test user locally. There is no local stack, and the script needs the service-role key, which agents must never hold. So the **owner runs `seed-dev.mjs`** against `findsprop-dev`, and the admin signs in with the real reserved mailbox through Google (DEC-32). pgTAP creates its own users in CI.
- **Environment-specific values.** The URL the CRM retry job calls is not a secret but differs per environment. It goes in `app_config` through a runbook step, not through a migration. The dev value needs a stable dev URL (RISK-07, RISK-20).

## 4a. Guests (signed-out visitors)

A guest is the database role `anon`: no session, no token. Guests never get an anonymous Supabase session. A guest never writes to a table directly; anything a guest submits goes through a server action that uses the service role or a function, with a rate limit keyed by the visitor hash (BR-75).

| Guest action                                        | Database mechanism                                                                        | Test                                                                                     | Step     |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | -------- |
| Read header, hero, footer, sponsors                 | `anon` select on `site_settings`                                                          | `DB-RLS-site_settings`                                                                   | F03 done |
| Browse approved listings                            | `anon` select, approved rows, public columns only; no owner, exact location or moderation | `DB-RLS-properties-anon`, `DB-RLS-column-grants`                                         | F06      |
| Photos of approved listings                         | `anon` select on `listing_media` where the listing is approved                            | `DB-RLS-listing_media-anon`                                                              | F06      |
| Browse live projects, units, price trends, builders | `anon` select via `project_is_live()`; builders limited to active rows and public columns | `DB-RLS-projects-anon`, `DB-RLS-builders-anon`                                           | F04      |
| Read an active form                                 | `anon` select where `active`                                                              | `DB-RLS-forms-anon`                                                                      | F05      |
| Submit a project lead or form, track a view         | Server only: function with rate limit; `anon` has no insert on these tables               | `DB-FN-submit_project_lead`, `DB-FN-record_form_submission`, `DB-FN-track_project_event` | S5       |
| Upload a form attachment                            | Server issues a signed URL; the bucket has no `anon` policy                               | `DB-STO-form-uploads-denied`                                                             | F08      |
| Send an enquiry, save a home                        | Denied: sign-in and a verified phone are required (BR-50, BR-54)                          | `DB-RLS-enquiries-*`, `DB-RLS-saved`                                                     | F06      |
| Compare homes                                       | Browser storage only                                                                      | none                                                                                     | none     |
| Write anywhere                                      | Denied for every table and view                                                           | `DB-RLS-no-anon-writes`                                                                  | F01 done |

## 5. Defaults I will apply unless you object

- `bhk`: nullable, 0 to 10 (0 means studio); required for apartment, villa and house; empty for plot and commercial. `bathrooms` 0 to 10.
- `place_provider` and `place_ref` are **left out** until DEC-19 (map-provider storage terms) is answered. Adding a column later is safe; removing one is not.
- `short_id` is 8 characters from a function, `slug` is regenerated when title or locality changes (ADR-025).
- `price` is a `bigint` of whole rupees; rent is per month.
- The pending-listing cap (DEC-26, five draft plus pending) and the one-enquiry-per-day rule live in the S6 and S5 functions, with the numbers in `app_config`.
- Email verification (DEC-07) is checked when a listing is **submitted**, not when a draft is saved.
- `reserved_admin_emails()` is one function holding both admin addresses; changing the list takes a reviewed migration, and a migration that removes an address must also remove that account's `super_admin` role (RISK-14).
- Staff second factor (DEC-05), admin entry (DEC-06), CAPTCHA (DEC-23) and OTP policy (DEC-31) keep their recommended defaults until the auth spike (S3-T08). Policies that need `aal2` are added in a later migration once the spike settles it; until then admin writes are role-only on the dev project.
- `has_verified_phone()` is written against the assumed JWT `phone` claim. If the spike (S3-SPK-01) shows otherwise, a new migration replaces the function body; no table changes.

## 6. Proposed order and what I need from you

1. You answer Q1 to Q3 (or accept).
2. I write the written plan for **F01 to F03** (`base`, `identity`, `site_settings`) and ask for approval. These do not depend on Q1 to Q3, so they can go first.
3. After approval, the migrations and their pgTAP tests, one concern per commit, on a branch. CI (`db` job) is where they run; after the merge the `db-deploy` workflow applies them to `findsprop-dev`.
4. The F06 plan (listings) follows once Q1 to Q3 are settled.
5. Auth spikes (S3-T08) need the dev project's phone provider and test OTP numbers set in the dashboard; that is a step only you can do.
