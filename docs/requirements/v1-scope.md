# Stage 0 · v1 scope statement (S0-T08, `DEC-34` accepted as recommended)

> Copied from the implementation plan on 31 Oct 2026 and now maintained here (HD-11). References to plan documents (`06`, `07` and so on) point to the archived plan.

This freezes what "version 1" means so Stages 1–9 can be planned and accepted without drifting. Requirement IDs are from `01-requirements-and-scope.md`; acceptance statements are in `04-acceptance-criteria.md`.

## 1. In version 1 (core path, Stages 1–7, then 8–9)

| Area                  | Included                                                                                                                                                                                                   |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Foundation            | New Next.js 16 repository `findsprop`, npm, quality gates, CI, preview deployments                                                                                                                         |
| Design system         | Grove tokens, atoms, molecules, layout organisms, sponsor container, Design Lab (signed off by you)                                                                                                        |
| Database and security | Fresh schema (23 tables), RLS, triggers, storage policies, audit log, rate limiting, seed data                                                                                                             |
| Authentication        | Customer phone-code sign-in with email verification; invitation-only builders; the reserved admin; staff second factor; safe redirects                                                                     |
| Public discovery      | Homepage **Variation A** and the **no-sponsor fallback**; **Variation B available as an admin setting**; sponsor container; property search, results, detail; projects list and detail; SEO                |
| Location              | Address/place autocomplete (Tamil Nadu) behind a server route; place-based search                                                                                                                          |
| Buyer                 | Saved homes, compare, enquiries (send and track), contact and project lead forms, dashboard tabs                                                                                                           |
| Seller                | Five-step post-property flow with real photos, drafts, edit, mark sold/rented, delete, received enquiries                                                                                                  |
| Admin                 | Listing moderation, project moderation, units, builders, leads, form builder, CRM with retries, site content (header, hero, homepage, footer), hero layout setting, sponsor management, overview analytics |
| Builder               | Dashboard, projects with re-approval rule, units, leads (status only), insights, profile                                                                                                                   |
| Operations            | Structured logging, error tracking (by S8), backups and a restore drill, runbooks, rollback rehearsal                                                                                                      |

## 2. After the core path, only if time allows before launch

| Item                               | Rule                                                                                                                                                                              |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Map view** (`FR-GEO-04`)         | Built after Stage 7 and only with the map UX (ADD-09) approved and the India-boundary question answered (`RISK-28`). If not ready, launch without it; search by place still works |
| **Staging environment** (`DEC-20`) | Recommended before launch; decided by Stage 8                                                                                                                                     |

## 3. Gated (not in v1 unless the gate opens)

| Item                                      | Gate                                                                                      |
| ----------------------------------------- | ----------------------------------------------------------------------------------------- |
| PG and hostels (`FR-PG-01`)               | Written requirements and a UX design (ADD-13); post-launch by default                     |
| Agent portal                              | Written requirements; the role stays in the database with no extra permissions (`DEC-08`) |
| Notifications (email on enquiry/approval) | Post-launch; the mail adapter has hook points (`DEC-27`)                                  |

## 4. Out of scope (not planned)

AI natural-language search and its lead form · notifications centre · account settings page · advertiser dashboards, booking, billing, campaign scheduling, ad rotation, impression/click analytics · dark mode · Tamil interface · print styles · offline mode · builder deletion in the UI · self-service data export/erasure UI · map-based property posting beyond the location pin · saved searches and price alerts.

## 5. Preconditions that gate launch (not coding)

| Precondition                                                              | Owner          | Tracked as   |
| ------------------------------------------------------------------------- | -------------- | ------------ |
| Domain bought; email DNS verified                                         | You            | `DEC-03`     |
| MSG91 DLT sender and OTP template approved                                | You            | `RISK-02`    |
| UX addendum delivered and approved                                        | You / designer | `DEC-04`     |
| Legal pages and consent texts final                                       | You / counsel  | `DEC-25`     |
| Sponsor content legally reviewed **or** the site launches on the fallback | You            | `DEC-17`     |
| Ola terms answered, or the user-pin fallback accepted                     | You            | `DEC-19`     |
| Backup/restore drill done; rollback rehearsed                             | Me with you    | `DEC-30`, S9 |

## 6. Change control

1. A new feature or a changed rule needs: a requirement ID in `01`, a screen or a UX note, acceptance statements in `04`, a place in `10` and a row in `11`.
2. Anything from §3 or §4 is a **scope change** and needs your explicit approval; it does not enter a running stage.
3. Items marked _Proposed_ in the UX package are built only if approved (`DEC-*`) or already decided in the architecture (admin listing approval, photo upload, listing edit, builder edit → Pending).
4. Each stage ends with a report; scope questions raised during a stage are collected in the report, not decided silently.
