# 11 · Feature traceability

> Copied from the implementation plan on 31 Oct 2026 and now maintained here (HD-11). References to plan documents (`06`, `07` and so on) point to the archived plan.

Maps requirements → Phase 1 routes → UX screens → planned modules → implementation stage → tests. IDs come from `01` (requirements), `03` (routes, modules), `08` (tests), `10` (stages). Keep this file updated in every slice (it is part of the Definition of Done).

Legend: **Stage** `S4` = Stage 4, `S4-T14` = a specific task. **E** = `E2E-nn`. Test names are from `08`. "Gap" = needs the UX addendum (`DEC-04`). "Deferred" = not in the first release.

---

## 1. Requirement → module → stage → screens → tests

### Public discovery

| Req        | Name                               | Modules                          | Stage                        | UX screens                    | Primary tests                                             |
| ---------- | ---------------------------------- | -------------------------------- | ---------------------------- | ----------------------------- | --------------------------------------------------------- |
| FR-PUB-01  | Homepage, Variation A              | `site`, `sponsors`, `search`     | S2 (SponsorSlot), S4-T06/T07 | `home-a`                      | E09, UT-sponsors, VR                                      |
| FR-PUB-02  | Homepage, Variation B              | `site`, `sponsors`               | S4-T07; setting S7-T10       | `home-b`                      | E09, E15, UT-sponsors, VR                                 |
| FR-PUB-03  | No-sponsor fallback                | `sponsors`                       | S4-T07                       | `home-none`                   | E09 (no gap, CLS), UT-sponsors                            |
| FR-PUB-04  | Sponsored banner container         | `sponsors`, `components/layout`  | S2-T06, S4-T07, S7-T11       | `ds-ads`, `search#sponsored`  | UT-sponsors, IT-sponsors, VR, axe                         |
| FR-PUB-05  | Homepage sections (CMS-toggled)    | `site`, `properties`, `projects` | S4-T06                       | `home-*`                      | E01, IT-queries                                           |
| FR-PUB-06  | Property search and results        | `search`, `properties`, `places` | S4-T03/T04/T05               | `search`                      | DB-FN-search, UT-search-schema, UT-label, E01             |
| FR-PUB-06a | Chips, grid/list, Show more        | `search`                         | S4-T04                       | `search#list`                 | UT-search-schema, E01                                     |
| FR-PUB-07  | Property detail                    | `properties`, `enquiries`        | S4-T08 (+S5-T03)             | `property`                    | E01, E05, IT-queries                                      |
| FR-PUB-08  | Projects listing                   | `projects`                       | S4-T09                       | `projects`                    | E11, IT-queries                                           |
| FR-PUB-09  | Project detail                     | `projects`, `forms`              | S4-T09 (ADR-046; +S5-T05)    | `project`                     | E13, DB-FN-submit_project_lead, DB-FN-track_project_event |
| FR-PUB-10  | Compare                            | `compare`                        | S4-T02, S5-T02               | `compare`                     | UT-compare, E04                                           |
| FR-PUB-11  | Contact form                       | `forms`                          | S5-T05                       | `contact`                     | E13, IT-forms, UT-dynamic-form                            |
| FR-PUB-12  | AI search                          | —                                | **Deferred**                 | `ai-search` (design retained) | —                                                         |
| FR-PUB-13  | Not-found and error pages          | `app`, `components/ui`           | S1-T10, S2-T08               | `errors`                      | E20                                                       |
| FR-PUB-14  | SEO and metadata                   | `seo`                            | S4-T10 (ADR-047)             | n/a                           | SEO checks (`08` §7); unit and smoke tests                |
| FR-PUB-15  | Header, footer, drawer, bottom bar | `components/layout`, `site`      | S2-T06, S4-T06               | `ds-navigation`               | E17, UT-components                                        |

### Location and maps

| Req       | Name                              | Modules              | Stage                      | UX                     | Tests                               |
| --------- | --------------------------------- | -------------------- | -------------------------- | ---------------------- | ----------------------------------- |
| FR-GEO-01 | Address autocomplete              | `places`             | S4-T05                     | Gap (suggestion rows)  | IT-places, UT-components (combobox) |
| FR-GEO-02 | Store address parts + coordinates | `listings`, `places` | S6-T02 (gated by `DEC-19`) | Gap                    | IT-actions-listing                  |
| FR-GEO-03 | Place-based search                | `search`             | S4-T03/T04                 | Gap                    | DB-FN-search                        |
| FR-GEO-04 | Map view                          | `places`             | S4-T14 (optional)          | **Gap (not designed)** | E18                                 |
| FR-GEO-05 | Project exact placement           | `projects`           | S7-T02                     | Gap                    | DB-FN-search (projects), E11        |

### Authentication

| Req        | Name                              | Modules                     | Stage          | UX                              | Tests                              |
| ---------- | --------------------------------- | --------------------------- | -------------- | ------------------------------- | ---------------------------------- |
| FR-AUTH-01 | Customer phone-OTP                | `auth`                      | S3-T09         | Gap (`auth` shows email/Google) | IT-auth-otp, IT-send-sms-hook, E02 |
| FR-AUTH-02 | Email verification                | `auth`                      | S3-T09, S5-T04 | Gap                             | IT-auth-otp, E02                   |
| FR-AUTH-03 | Builder login (+ second factor)   | `auth`, `builders`          | S3-T10         | Partial (`builder-login`)       | IT-builder-invite, E11             |
| FR-AUTH-04 | Admin login                       | `auth`                      | S3-T10         | Gap (no screen)                 | IT-AUTHZ-admin, E10                |
| FR-AUTH-05 | Password set/reset (staff)        | `auth`                      | S3-T10         | `reset-password`                | E11                                |
| FR-AUTH-06 | Safe redirect                     | `lib/url`, `auth`           | S3-T09         | `auth#gate`                     | UT-safe-redirect, E02              |
| FR-AUTH-07 | Route guards                      | `server/auth`, `app`        | S3-T07/T11     | n/a                             | IT-AUTHZ-*, E10                    |
| FR-AUTH-08 | Sign-out and refresh              | `auth`, `proxy.ts`          | S1-T08, S3-T09 | `ds-navigation`                 | E02                                |
| FR-AUTH-09 | OTP abuse controls                | `auth`, `server/rate-limit` | S3-T09/T12     | Gap                             | DB-FN-rate_limit_hit, IT-auth-otp  |
| FR-AUTH-10 | Profile + default role            | DB, `auth`                  | S3-T02         | n/a                             | DB-TRG-*, DB-MIGRATE               |
| FR-AUTH-11 | Role integrity (super_admin lock) | DB                          | S3-T06         | n/a                             | DB-TRG-user_roles-guard            |

### Account (buyer and seller)

| Req       | Name                        | Modules                  | Stage          | UX                                  | Tests                                |
| --------- | --------------------------- | ------------------------ | -------------- | ----------------------------------- | ------------------------------------ |
| FR-ACC-01 | Dashboard tabs              | `account`                | S5-T04, S6-T03 | `dashboard`                         | E05, E06                             |
| FR-ACC-02 | Save / unsave               | `saved`                  | S5-T01         | `dashboard#saved`, cards            | E03, DB-RLS-saved                    |
| FR-ACC-03 | Send enquiry                | `enquiries`              | S5-T03         | `property#signedin…sent`            | DB-FN-submit_enquiry, E05            |
| FR-ACC-04 | Received enquiries + status | `enquiries`              | S6-T03         | `dashboard#received`                | DB-RLS-enquiries, E05                |
| FR-ACC-05 | Sent enquiries              | `enquiries`              | S5-T03         | `dashboard#sent`                    | E05                                  |
| FR-ACC-06 | Post property (5 steps)     | `listings`               | S6-T02         | `post-property`                     | IT-actions-listing, E06              |
| FR-ACC-07 | Photo upload                | `listings`, `media`      | S6-T01         | `post-property#step3`               | IT-media, DB-STO-listing-photos      |
| FR-ACC-08 | Draft save/resume           | `listings`               | S6-T02         | `post-property#step2,draft`         | IT-actions-listing                   |
| FR-ACC-09 | Edit listing                | `listings`               | S6-T03/T05     | `dashboard#listings`                | DB-TRG-properties-guard, E07         |
| FR-ACC-10 | Mark sold / rented          | `listings`               | S6-T03         | `dashboard#listings,confirm-sold`   | DB-FN-lifecycle, E06                 |
| FR-ACC-11 | Delete own listing          | `listings`               | S6-T03         | `dashboard#listings,confirm-delete` | DB-RLS-properties, IT-AUTHZ-customer |
| FR-ACC-12 | Not approved + resubmit     | `listings`, `moderation` | S6-T05         | `dashboard#listings`                | E08, DB-TRG-properties-guard         |
| FR-ACC-13 | No settings page            | —                        | as designed    | —                                   | —                                    |

### Builder portal

| Req       | Name                   | Modules              | Stage      | UX                                         | Tests                             |
| --------- | ---------------------- | -------------------- | ---------- | ------------------------------------------ | --------------------------------- |
| FR-BLD-01 | Dashboard              | `projects`           | S7-T03     | `builder-dashboard`                        | E11                               |
| FR-BLD-02 | Projects + re-approval | `projects`           | S7-T02/T03 | `builder-projects`, `builder-project-form` | DB-TRG-projects-guard, E12        |
| FR-BLD-03 | Units                  | `projects`           | S7-T03     | `builder-units`                            | DB-TRG-units, E16                 |
| FR-BLD-04 | Leads (status only)    | `projects`           | S7-T03     | `builder-leads`                            | DB-TRG-leads, E16                 |
| FR-BLD-05 | Insights               | `projects`, `charts` | S7-T03     | `builder-insights`                         | chart keyboard tests, E11         |
| FR-BLD-06 | Profile                | `builders`           | S7-T03     | `builder-profile`                          | DB-TRG-builders, IT-AUTHZ-builder |
| FR-BLD-07 | Price trends           | `projects`           | S7-T02     | `project`, form sidebar                    | DB-RLS-matrix                     |
| FR-BLD-08 | Project media upload   | `media`              | S7-T02     | `admin-project-form#media-error`           | DB-STO-project-media              |

### Admin portal

| Req       | Name                             | Modules                            | Stage          | UX                               | Tests                                                                                 |
| --------- | -------------------------------- | ---------------------------------- | -------------- | -------------------------------- | ------------------------------------------------------------------------------------- |
| FR-ADM-01 | Overview                         | `admin-overview`                   | S7-T06         | `admin-overview`                 | chart tests, UT-overview-*, DB-FN-admin_overview, IT-admin-overview, IT-AUTHZ-admin   |
| FR-ADM-02 | Listings moderation              | `moderation`                       | **S6-T04**     | `admin-listings`                 | DB-FN-lifecycle, E06/E08                                                              |
| FR-ADM-03 | Projects moderation              | `moderation`, `projects`           | S7-T04         | `admin-projects`                 | DB-TRG-projects-guard, E11/E12                                                        |
| FR-ADM-04 | Project form                     | `projects`                         | S7-T02         | `admin-project-form`             | E11                                                                                   |
| FR-ADM-05 | Units                            | `projects`                         | S7-T07         | `admin-units`                    | E16                                                                                   |
| FR-ADM-06 | Builders                         | `builders`                         | S7-T05         | `admin-builders`                 | IT-builder-invite, E11                                                                |
| FR-ADM-07 | Leads                            | `projects`, `forms`                | S7-T07         | `admin-leads`                    | IT-forms, E14                                                                         |
| FR-ADM-08 | Form builder                     | `forms`                            | S7-T08         | `admin-forms`                    | UT-dynamic-form, E14                                                                  |
| FR-ADM-09 | CRM                              | `crm`                              | S7-T09         | `admin-crm`                      | UT-crm-url, UT-retry, UT-crm-logs-view, UT-crm-editor-draft, IT-crm, IT-crm-page, E14 |
| FR-ADM-10 | CMS                              | `site`, `site-content`             | S7-T10         | `admin-cms`                      | IT-sponsors, E15                                                                      |
| FR-ADM-11 | Hero layout setting and sponsors | `site`, `sponsors`, `site-content` | S7-T10, S7-T11 | `admin-cms#hero`, ADD-11         | IT-sponsors, UT-sponsors-panel, E09, E15                                              |
| FR-ADM-12 | Banner management                | `sponsors`                         | S7-T11         | Partial (`admin-cms#hero`) + Gap | IT-sponsors, E15                                                                      |

### Cross-cutting and gated

| Req       | Name                  | Modules             | Stage                                      | UX                   | Tests                                 |
| --------- | --------------------- | ------------------- | ------------------------------------------ | -------------------- | ------------------------------------- |
| FR-SYS-01 | Rate limiting         | `server/rate-limit` | S3-T12                                     | rate-limited states  | DB-FN-rate_limit_hit, UT-visitor-hash |
| FR-SYS-02 | CRM retry cron        | `crm`, DB           | S7-T09                                     | `admin-crm#logs`     | IT-crm                                |
| FR-SYS-03 | Event tracking        | `projects`          | S4-T09 (views, ADR-046); S5-T05 (the rest) | n/a                  | DB-FN-track_project_event             |
| FR-SYS-04 | Form pipeline         | `forms`             | S5-T05                                     | `contact`, `project` | IT-forms                              |
| FR-SYS-05 | Buckets with limits   | DB                  | S3-T05                                     | n/a                  | DB-STO-*                              |
| FR-SYS-06 | Audit log             | DB, `server/audit`  | S3-T05, S7-T12                             | n/a                  | DB-AUDIT, DB-TRG-audit-form-crm       |
| FR-SYS-07 | Seed data             | scripts             | S3-T13                                     | n/a                  | CI db job                             |
| FR-SYS-08 | Public projections    | DB, `queries`       | S3-T03, S4-T13                             | n/a                  | DB-RLS-column-grants, IT-queries      |
| FR-SYS-09 | Legal pages           | `app`               | S5-T06, S9-T05                             | Gap                  | E01 (links present)                   |
| FR-SYS-10 | Health and monitoring | `app/api`           | S1-T09, S9-T06                             | n/a                  | smoke                                 |
| FR-PG-01  | PG and hostels        | TBD                 | Track X                                    | **Gap**              | TBD                                   |

---

## 2. Phase 1 routes → new routes → screens → stages

| Phase 1 | Phase 1 route           | New route                               | UX screen(s)                               | Module(s)                           | Stage    | Primary tests    |
| ------- | ----------------------- | --------------------------------------- | ------------------------------------------ | ----------------------------------- | -------- | ---------------- |
| P-01    | `/`                     | `/`                                     | `home-a`, `home-b`, `home-none`            | site, sponsors                      | S4       | E09              |
| P-02    | `/properties`           | `/properties`                           | `search`                                   | search, properties                  | S4       | E01              |
| P-03    | `/properties/$id`       | `/properties/[slug]`                    | `property`                                 | properties, enquiries               | S4, S5   | E01, E05         |
| P-04    | `/projects`             | `/projects`                             | `projects`                                 | projects                            | S4       | E11              |
| P-05    | `/projects/$slug`       | `/projects/[slug]`                      | `project`                                  | projects, forms                     | S4, S5   | E13              |
| P-06    | `/compare`              | `/compare`                              | `compare`                                  | compare                             | S5       | E04              |
| P-07    | `/contact`              | `/contact`                              | `contact`                                  | forms                               | S5       | E13              |
| P-08    | `/ai-search`            | flagged stub                            | `ai-search`                                | —                                   | Deferred | —                |
| P-09    | `/auth`                 | `/auth`                                 | `auth` (+ addendum)                        | auth                                | S3       | E02              |
| P-10    | `/builder/login`        | `/builder/login`                        | `builder-login` (+ addendum)               | auth                                | S3       | E11              |
| P-11    | `/reset-password`       | `/reset-password`                       | `reset-password`                           | auth                                | S3       | E11              |
| P-12    | `/dashboard`            | `/dashboard`                            | `dashboard`                                | account, saved, enquiries, listings | S5, S6   | E03, E05, E06    |
| P-13    | `/post-property`        | `/post-property`, `/post-property/[id]` | `post-property`                            | listings, media                     | S6       | E06              |
| —       | `/admin/`               | `/admin` → `/admin/dashboard`           | —                                          | app                                 | S3       | E10              |
| P-14    | `/admin/dashboard`      | `/admin/dashboard`                      | `admin-overview`                           | admin-overview                      | S7       | IT-AUTHZ-admin   |
| P-15    | `/admin/projects`       | `/admin/projects` (+ `/new`, `/[id]`)   | `admin-projects`, `admin-project-form`     | projects, moderation                | S7       | E11              |
| P-16    | `/admin/properties`     | `/admin/units`                          | `admin-units`                              | projects                            | S7       | E16              |
| P-17    | `/admin/builders`       | `/admin/builders`                       | `admin-builders`                           | builders                            | S7       | E11              |
| P-18    | `/admin/leads`          | `/admin/leads`                          | `admin-leads`                              | projects, forms                     | S7       | E14              |
| P-19    | `/admin/forms`          | `/admin/forms`                          | `admin-forms`                              | forms                               | S7       | E14              |
| P-20    | `/admin/crm`            | `/admin/crm`                            | `admin-crm`                                | crm                                 | S7       | E14              |
| P-21    | `/admin/header`         | `/admin/header`                         | `admin-cms#header`                         | site, site-content                  | S7       | E15              |
| P-22    | `/admin/hero`           | `/admin/hero`                           | `admin-cms#hero`                           | site, sponsors, site-content        | S7       | E15              |
| P-23    | `/admin/homepage`       | `/admin/homepage`                       | `admin-cms#homepage`                       | site, site-content                  | S7       | E15              |
| P-24    | `/admin/footer`         | `/admin/footer`                         | `admin-cms#footer`                         | site, site-content                  | S7       | E15              |
| new     | —                       | `/admin/listings`                       | `admin-listings`                           | moderation                          | S6       | E06, E08         |
| —       | `/builder/`             | `/builder` → `/builder/dashboard`       | —                                          | app                                 | S3       | E10              |
| P-25    | `/builder/dashboard`    | `/builder/dashboard`                    | `builder-dashboard`                        | projects                            | S7       | E11              |
| P-26    | `/builder/projects`     | `/builder/projects` (+ `/new`, `/[id]`) | `builder-projects`, `builder-project-form` | projects                            | S7       | E12              |
| P-27    | `/builder/properties`   | `/builder/units`                        | `builder-units`                            | projects                            | S7       | E16              |
| P-28    | `/builder/leads`        | `/builder/leads`                        | `builder-leads`                            | projects                            | S7       | E16              |
| P-29    | `/builder/insights`     | `/builder/insights`                     | `builder-insights`                         | projects, charts                    | S7       | E11              |
| P-30    | `/builder/profile`      | `/builder/profile`                      | `builder-profile`                          | builders                            | S7       | IT-AUTHZ-builder |
| P-31    | `/api/public/crm-retry` | `/api/internal/crm-retry`               | —                                          | crm                                 | S7       | IT-crm           |

All 33 Phase 1 routes are covered. New routes with no Phase 1 counterpart: `/admin/login`, `/auth/confirm`, `/auth/callback`, `/admin/listings`, `/post-property/[id]`, `/api/auth/hooks/send-sms`, `/api/places/*`, `/api/map/search`, `/api/internal/sweep-uploads`, `/api/health`, `/privacy`, `/terms`, `/cookies`, `sitemap.xml`, `robots.txt`, `/design-system/*` (dev only).

---

## 3. UX screens (38) → template → key components → stage → verification

| Screen key                                                                  | Template (`04` §6)                       | Key components                                                                   | Stage    | Status vs UX                                                         | Verification           |
| --------------------------------------------------------------------------- | ---------------------------------------- | -------------------------------------------------------------------------------- | -------- | -------------------------------------------------------------------- | ---------------------- |
| `home-a`                                                                    | HeroTemplate (A)                         | SearchCard wide, SponsorSlot strip, sections                                     | S4       | approved                                                             | VR ×3 widths, E09      |
| `home-b`                                                                    | HeroTemplate (B)                         | SearchCard stacked, SponsorSlot panel                                            | S4       | approved (setting S7)                                                | VR, E09                |
| `home-none`                                                                 | HeroTemplate (none)                      | A without banner                                                                 | S4       | approved                                                             | VR, E09 gap test       |
| `search`                                                                    | ListTemplate                             | FilterRail/Sheet, PropertyCard, ShowMore, CompareBar, Sponsor in-results (later) | S4       | approved; chips/list/show-more proposed                              | VR all states, E01     |
| `property`                                                                  | DetailTemplate                           | Gallery, SpecGrid, PriceCard, EnquiryCard, StickyMobileBar, EnquirySheet         | S4, S5   | approved                                                             | VR, E01, E05           |
| `projects`                                                                  | ListTemplate                             | ProjectCard, locality chips (proposed)                                           | S4       | approved                                                             | VR                     |
| `project`                                                                   | DetailTemplate                           | UnitsTable, PriceTrendChart, LeadForm                                            | S4, S5   | approved                                                             | VR, E13                |
| `compare`                                                                   | CompareTemplate (DetailTemplate variant) | CompareTable, Undo toast                                                         | S5       | approved                                                             | VR, E04                |
| `ai-search`                                                                 | —                                        | —                                                                                | Deferred | approved, not built                                                  | —                      |
| `contact`                                                                   | FormPage (PublicShell)                   | Dynamic form renderer, UploadZone                                                | S5       | approved                                                             | VR, E13                |
| `auth`                                                                      | AuthShell                                | PhoneField, OtpInput, Turnstile                                                  | S3       | **addendum required**                                                | VR, E02                |
| `builder-login`                                                             | AuthShell                                | Email/password, Google, second factor                                            | S3       | **addendum required**                                                | VR, E11                |
| `reset-password`                                                            | AuthShell                                | PasswordField                                                                    | S3       | approved (staff scope)                                               | VR, E11                |
| `dashboard`                                                                 | DashboardTemplate                        | Tabs, saved grid, ListingRow, EnquiryCard                                        | S5, S6   | approved; Edit proposed→decided                                      | VR each tab, E03/05/06 |
| `post-property`                                                             | WizardTemplate                           | Stepper, UploadZone, place picker                                                | S6       | five steps proposed; photo upload decided; address step **addendum** | VR each step, E06      |
| `admin-overview`                                                            | ManagerTemplate (dashboard)              | StatTile, charts                                                                 | S7       | approved                                                             | VR, chart tests        |
| `admin-listings`                                                            | ManagerTemplate                          | Queue table, review drawer                                                       | S6       | proposed→decided                                                     | VR, E06/E08            |
| `admin-projects`                                                            | ManagerTemplate                          | ResponsiveTable, row menu, ConfirmDialog                                         | S7       | approved                                                             | VR, E11                |
| `admin-project-form`                                                        | SectionedFormTemplate                    | Section nav, MediaUploader, price trends                                         | S7       | sectioned layout proposed                                            | VR, E11                |
| `admin-units`                                                               | ManagerTemplate                          | Table, ManagerDrawer                                                             | S7       | approved                                                             | VR, E16                |
| `admin-builders`                                                            | ManagerTemplate                          | Table, invite drawer                                                             | S7       | approved                                                             | VR, E11                |
| `admin-leads`                                                               | ManagerTemplate                          | Tabs, filters, detail drawer                                                     | S7       | approved                                                             | VR, E14                |
| `admin-forms`                                                               | EditorWithPreviewTemplate                | SortableRow, preview                                                             | S7       | approved                                                             | VR, E14                |
| `admin-crm`                                                                 | ManagerTemplate                          | Connections, logs, test                                                          | S7       | approved                                                             | VR, E14                |
| `admin-cms`                                                                 | EditorWithPreviewTemplate                | Settings forms, sponsor manager                                                  | S7       | approved; layout setting proposed; banner UI **addendum**            | VR, E15                |
| `builder-dashboard`                                                         | DashboardTemplate (portal)               | StatTiles, notice                                                                | S7       | approved                                                             | VR                     |
| `builder-projects`                                                          | ManagerTemplate                          | ProjectsManager (builder mode)                                                   | S7       | approved                                                             | VR, E12                |
| `builder-project-form`                                                      | SectionedFormTemplate                    | Warning banner, toast                                                            | S7       | proposed                                                             | VR, E12                |
| `builder-units`                                                             | ManagerTemplate                          | UnitsManager                                                                     | S7       | approved                                                             | VR, E16                |
| `builder-leads`                                                             | ManagerTemplate                          | LeadsTable (status only)                                                         | S7       | approved                                                             | VR, E16                |
| `builder-insights`                                                          | DashboardTemplate (portal)               | InsightsPanel, charts                                                            | S7       | approved                                                             | VR                     |
| `builder-profile`                                                           | FormPage (portal)                        | Form, read-only email                                                            | S7       | approved                                                             | VR                     |
| `errors`                                                                    | StateTemplates                           | not-found, error                                                                 | S1/S2    | approved                                                             | VR, E20                |
| `ds-foundations`, `ds-components`, `ds-navigation`, `ds-feedback`, `ds-ads` | —                                        | **Design Lab** reproduces these                                                  | S2       | reference boards                                                     | Lab VR + axe           |

---

## 4. Coverage checks

**UX screens with no production build in v1:** `ai-search` (deferred). All others are built.

**Requirements with no approved UX (need the addendum, `DEC-04`):** FR-AUTH-01/02/04/09, builder second-factor step of FR-AUTH-03, FR-GEO-01…05 (suggestion rows, map), FR-ACC-06 address step, FR-ADM-12 banner management, FR-SYS-09 legal pages, FR-PG-01.

**UX elements marked Proposed that the architecture already decides:** admin listing approval (P2), real photo upload (P3), listing edit (P4), builder edit → Pending (P5). Remaining Proposed items are built only after the related `DEC-*` is answered (P6 wording, P8 pagination `DEC-11`, hero layout `DEC-16`, draft saving `DEC-09`).

**Business rules → tests:** see `08` §10 (BR-01 … BR-95 mapped; BR-73/74/95 deferred with AI).

**Decisions → stage gates:** see `12` §2 ("Needed by" column) and `10` §4.

**Maintenance rule.** When a slice changes behaviour, update: the FR row (stage/tests), the route row, the screen row, and add the new test IDs to `08` if a new test is created.
