# Screen inventory

Maps every route in `property-platform-analysis/04-page-inventory.md` to a final design. **Generated from `assets/manifest.js`** by `tools/make-inventory.mjs`, so this list, the gallery and the renders cannot disagree.

**Summary:** 33 routes (11 public, 2 signed-in, 12 admin including the index redirect, 7 builder including the index redirect, 1 machine endpoint) → **38 designed screens**, **180 states**, **265 rendered images** (desktop 1440, tablet 820, mobile 390). Not every route has its own layout: related routes share templates (the four CMS routes share one editor; admin and builder projects, units and leads share components).

Open any screen from the [gallery](index.html), or directly from the links below. State links use the URL hash, so they are shareable.

## 1. Route to design

| Phase 1 | Route | Area | Design | Notes |
|---|---|---|---|---|
| P-01 | `/` | Public | [Variation A, Search Desk](screens/home-a.html), [Variation B, Split search and ad](screens/home-b.html), [No-sponsor fallback](screens/home-none.html) | Existing. Two interchangeable hero layouts plus the no-sponsor fallback. |
| P-02 | `/properties` | Public | [Property search and results](screens/search.html) | Existing. Filters, sort, label pills, empty state. Active chips, grid/list and “Show more” are proposed. |
| P-03 | `/properties/$id` | Public | [Property detail](screens/property.html) | Existing. Enquiry card has the three documented states. |
| P-04 | `/projects` | Public | [Projects listing](screens/projects.html) | Existing. Locality filter chips are proposed. |
| P-05 | `/projects/$slug` | Public | [Project detail](screens/project.html) | Existing. Enquire or site-visit form, units, floor plans, price trend. |
| P-06 | `/compare` | Public | [Compare homes](screens/compare.html) | Existing. Wording corrected from “projects” to “homes”. |
| P-07 | `/contact` | Public | [Contact](screens/contact.html) | Existing. Renders the admin-built contact form. |
| P-08 | `/ai-search` | Public | [AI search](screens/ai-search.html) | Existing. All documented rate-limit and lead states. |
| P-09 | `/auth` | Public | [Sign in and create account](screens/auth.html) | Existing. Forgot-password on this screen is in the roles analysis but not the route inventory: to confirm. |
| P-10 | `/builder/login` | Public | [Builder sign in](screens/builder-login.html) | Existing. Invitation-only, denied, forgot password. |
| P-11 | `/reset-password` | Public | [Set a new password](screens/reset-password.html) | Existing. `noindex`. |
| P-12 | `/dashboard` | Signed in | [My dashboard](screens/dashboard.html) | Existing. Four tabs. “Edit listing” is proposed. |
| P-13 | `/post-property` | Signed in | [Post a property](screens/post-property.html) | Existing fields; five-step flow, draft saving and photo upload are proposed. Sample-photo picker kept as a state. |
| — | `/admin/` | Admin | [Overview](screens/admin-overview.html) | Redirect to /admin/dashboard. No screen of its own. |
| P-14 | `/admin/dashboard` | Admin | [Overview](screens/admin-overview.html) | Existing. “Leads by source” pie becomes a stacked bar. |
| P-15 | `/admin/projects` | Admin | [Projects](screens/admin-projects.html), [Project form](screens/admin-project-form.html) | Existing. Sectioned form is proposed. |
| P-16 | `/admin/properties` | Admin | [Units](screens/admin-units.html) | Existing. Manages project units. |
| P-17 | `/admin/builders` | Admin | [Builders](screens/admin-builders.html) | Existing. Includes the reserved-email block. |
| P-18 | `/admin/leads` | Admin | [Leads](screens/admin-leads.html) | Existing. Project leads and form submissions. |
| P-19 | `/admin/forms` | Admin | [Form builder](screens/admin-forms.html) | Existing. Keyboard reorder alternative added. |
| P-20 | `/admin/crm` | Admin | [CRM integrations](screens/admin-crm.html) | Existing. Connections, credentials, mappings, logs. |
| P-21 | `/admin/header` | Admin | [Site content](screens/admin-cms.html) | Existing. Shares one editor template (#header). |
| P-22 | `/admin/hero` | Admin | [Site content](screens/admin-cms.html) | Existing. Hero layout setting is proposed (#hero). |
| P-23 | `/admin/homepage` | Admin | [Site content](screens/admin-cms.html) | Existing (#homepage). |
| P-24 | `/admin/footer` | Admin | [Site content](screens/admin-cms.html) | Existing (#footer). |
| — | `/builder/` | Builder | [Dashboard](screens/builder-dashboard.html) | Redirect to /builder/dashboard. No screen of its own. |
| P-25 | `/builder/dashboard` | Builder | [Dashboard](screens/builder-dashboard.html) | Existing. Compact insights. |
| P-26 | `/builder/projects` | Builder | [Projects](screens/builder-projects.html), [Project form](screens/builder-project-form.html) | Existing. Same component as admin, builder mode. |
| P-27 | `/builder/properties` | Builder | [Units](screens/builder-units.html) | Existing. Same component as admin. |
| P-28 | `/builder/leads` | Builder | [Leads](screens/builder-leads.html) | Existing. Status is the only editable field. |
| P-29 | `/builder/insights` | Builder | [Insights](screens/builder-insights.html) | Existing. Ten measures, project filter, timelines. |
| P-30 | `/builder/profile` | Builder | [Company profile](screens/builder-profile.html) | Existing. Email read-only. |
| P-31 | `/api/public/crm-retry` | API | — | Machine endpoint, no UI. Its results appear in Admin · CRM · API logs. |

**Coverage:** 32 of 33 routes have a screen; the remaining one is the cron retry endpoint, which has no interface.

## 2. All designed screens and states

Viewports: **D** desktop 1440 · **T** tablet 820 · **M** mobile 390. “fold” means the first screen only.

### Homepage

| Screen | States designed | Roles |
|---|---|---|
| **[Homepage · Variation A, Search Desk](screens/home-a.html)**<br><sub>Centred search with the sponsored strip directly under it (970 × 90).</sub> | [Default, one sponsor](screens/home-a.html) <sub>DTM</sub><br>[Specification overlay](screens/home-a.html#spec) <sub>DM fold</sub><br>[Three ads, manual pager](screens/home-a.html#multi) <sub>D fold</sub><br>[Near-miss image, letterboxed](screens/home-a.html#contain) <sub>D fold</sub><br>[About this ad open](screens/home-a.html#info) <sub>D fold</sub> | visitor |
| **[Homepage · Variation B, Split search and ad](screens/home-b.html)**<br><sub>Search left, larger sponsored image right (540 × 510 frame). Same header, search and colours as A.</sub> | [Default, one sponsor](screens/home-b.html) <sub>DTM</sub><br>[Specification overlay](screens/home-b.html#spec) <sub>DM fold</sub><br>[Three ads, manual pager](screens/home-b.html#multi) <sub>D fold</sub><br>[Near-miss image, letterboxed](screens/home-b.html#contain) <sub>D fold</sub><br>[About this ad open](screens/home-b.html#info) <sub>D fold</sub> | visitor |
| **[Homepage · No-sponsor fallback](screens/home-none.html)**<br><sub>Approved fallback: Concept 1 without any banner, container or placeholder.</sub> | [Default](screens/home-none.html) <sub>DTM</sub><br>[Specification overlay](screens/home-none.html#spec) <sub>DM fold</sub> | visitor |

### Browse and decide

| Screen | States designed | Roles |
|---|---|---|
| **[Property search and results](screens/search.html)**<br><sub>Filters, sort, active chips, compare bar, grid and list.</sub> | [Results with compare bar](screens/search.html) <sub>DTM</sub><br>[List view](screens/search.html#list) <sub>D</sub><br>[Banner inside results (proposed placement)](screens/search.html#sponsored) <sub>D</sub><br>[Loading](screens/search.html#loading) <sub>DM</sub><br>[No matches](screens/search.html#empty) <sub>DM</sub><br>[Failed to load](screens/search.html#error) <sub>D</sub><br>[Sort menu open](screens/search.html#sort) <sub>D fold</sub><br>[Mobile filter sheet](screens/search.html#filters) <sub>M fold</sub> | visitor, customer |
| **[Property detail](screens/property.html)**<br><sub>Gallery, specs, enquiry card in three states, sticky mobile bar.</sub> | [Signed out: sign in to contact](screens/property.html#signedout) <sub>DTM</sub><br>[Signed in: enquiry form](screens/property.html#signedin) <sub>D</sub><br>[Validation errors](screens/property.html#errors) <sub>DM</sub><br>[Send failed](screens/property.html#failed) <sub>D fold</sub><br>[Enquiry sent](screens/property.html#sent) <sub>D</sub><br>[Mobile enquiry sheet](screens/property.html#sheet) <sub>M fold</sub><br>[Loading](screens/property.html#loading) <sub>D</sub><br>[Not found](screens/property.html#notfound) <sub>D fold</sub><br>[Long title, missing details](screens/property.html#sparse) <sub>DM</sub> | visitor, customer |
| **[Projects listing](screens/projects.html)**<br><sub>Project cards; locality filter is proposed (the data layer already supports it).</sub> | [Default](screens/projects.html) <sub>DTM</sub><br>[Loading](screens/projects.html#loading) <sub>D</sub><br>[Coming soon](screens/projects.html#empty) <sub>D fold</sub><br>[Failed to load](screens/projects.html#error) <sub>D fold</sub> | visitor, customer |
| **[Project detail](screens/project.html)**<br><sub>Specs, units, floor plans, price trend, enquire or site-visit form.</sub> | [Enquire form](screens/project.html) <sub>DTM</sub><br>[Site-visit form](screens/project.html#sitevisit) <sub>DM</sub><br>[Validation errors](screens/project.html#errors) <sub>D</sub><br>[Submitted](screens/project.html#success) <sub>D fold</sub><br>[Rate limited](screens/project.html#ratelimit) <sub>D fold</sub><br>[Not found](screens/project.html#notfound) <sub>D fold</sub> | visitor, customer |
| **[Compare homes](screens/compare.html)**<br><sub>Side by side, up to three; sticky label column on mobile.</sub> | [Three homes](screens/compare.html) <sub>DTM</sub><br>[Two homes](screens/compare.html#two) <sub>D</sub><br>[Fewer than two](screens/compare.html#empty) <sub>DM fold</sub><br>[Loading](screens/compare.html#loading) <sub>D fold</sub><br>[Removed, undo toast](screens/compare.html#removed) <sub>D fold</sub> | visitor, customer |
| **[AI search](screens/ai-search.html)**<br><sub>Describe the home in words; results, similar homes and lead form.</sub> | [Default](screens/ai-search.html) <sub>DM</sub><br>[Description entered](screens/ai-search.html#filled) <sub>D fold</sub><br>[Searching](screens/ai-search.html#loading) <sub>D</sub><br>[Results](screens/ai-search.html#results) <sub>DM</sub><br>[Fewer than 3 matches](screens/ai-search.html#few) <sub>D</sub><br>[Requirement sent](screens/ai-search.html#leadsent) <sub>D</sub><br>[Too many searches](screens/ai-search.html#ratelimit) <sub>D fold</sub><br>[Daily limit](screens/ai-search.html#daily) <sub>D fold</sub><br>[Failed](screens/ai-search.html#error) <sub>D fold</sub> | visitor, customer |
| **[Contact](screens/contact.html)**<br><sub>Renders the admin-built contact form.</sub> | [Default](screens/contact.html) <sub>DTM</sub><br>[Validation errors](screens/contact.html#errors) <sub>D</sub><br>[Uploading a file](screens/contact.html#uploading) <sub>D fold</sub><br>[Sent](screens/contact.html#success) <sub>D fold</sub><br>[Rate limited](screens/contact.html#ratelimit) <sub>D fold</sub><br>[Form failed to load](screens/contact.html#loadfail) <sub>D fold</sub> | visitor, customer |

### Sign in

| Screen | States designed | Roles |
|---|---|---|
| **[Sign in and create account](screens/auth.html)**<br><sub>Google or email; sign-in gate, check-email and forgot-password states.</sub> | [Sign in](screens/auth.html#signin) <sub>DTM</sub><br>[Create account](screens/auth.html#signup) <sub>DM</sub><br>[Wrong password](screens/auth.html#errors) <sub>D</sub><br>[Email already registered](screens/auth.html#taken) <sub>D fold</sub><br>[Signing in](screens/auth.html#busy) <sub>D fold</sub><br>[Arrived from a sign-in-required action](screens/auth.html#gate) <sub>DM</sub><br>[Check your email](screens/auth.html#checkemail) <sub>D fold</sub><br>[Forgot password (to confirm)](screens/auth.html#forgot) <sub>D fold</sub><br>[Reset link sent](screens/auth.html#forgotsent) <sub>D fold</sub> | visitor |
| **[Builder sign in](screens/builder-login.html)**<br><sub>Invitation-only accounts; access-denied and forgot-password.</sub> | [Sign in](screens/builder-login.html#signin) <sub>DM</sub><br>[Not an active builder](screens/builder-login.html#denied) <sub>DM</sub><br>[Wrong password](screens/builder-login.html#errors) <sub>D fold</sub><br>[Forgot password](screens/builder-login.html#forgot) <sub>D fold</sub><br>[Reset link sent](screens/builder-login.html#forgotsent) <sub>D fold</sub> | builder, visitor |
| **[Set a new password](screens/reset-password.html)**<br><sub>Arrives from the email link; no-session and success states.</sub> | [Default](screens/reset-password.html) <sub>DM</sub><br>[Passwords differ](screens/reset-password.html#mismatch) <sub>D fold</sub><br>[No valid link](screens/reset-password.html#nosession) <sub>D fold</sub><br>[Updated](screens/reset-password.html#success) <sub>D fold</sub> | visitor, builder |

### Account

| Screen | States designed | Roles |
|---|---|---|
| **[My dashboard](screens/dashboard.html)**<br><sub>Saved, My listings, Enquiries received, My enquiries; confirmations and feedback.</sub> | [Saved homes](screens/dashboard.html#saved) <sub>DTM</sub><br>[Saved: empty](screens/dashboard.html#saved-empty) <sub>D fold</sub><br>[My listings](screens/dashboard.html#listings) <sub>DTM</sub><br>[Listings: empty](screens/dashboard.html#listings-empty) <sub>D fold</sub><br>[Enquiries received](screens/dashboard.html#received) <sub>DM</sub><br>[Received: empty](screens/dashboard.html#received-empty) <sub>D fold</sub><br>[My enquiries](screens/dashboard.html#sent) <sub>D</sub><br>[Sent: empty](screens/dashboard.html#sent-empty) <sub>D fold</sub><br>[Loading](screens/dashboard.html#loading) <sub>D fold</sub><br>[Action failed](screens/dashboard.html#listings,failed) <sub>D fold</sub><br>[Confirm: mark as sold](screens/dashboard.html#listings,confirm-sold) <sub>D fold</sub><br>[Confirm: delete](screens/dashboard.html#listings,confirm-delete) <sub>DM fold</sub><br>[Success toast](screens/dashboard.html#listings,toast-sold) <sub>D fold</sub> | customer |
| **[Post a property](screens/post-property.html)** *(proposed)*<br><sub>Five-step wizard (proposed) over the existing fields; sample-photo fallback.</sub> | [Step 1 · Basics](screens/post-property.html#step1) <sub>DTM</sub><br>[Step 2 · Details](screens/post-property.html#step2) <sub>DM</sub><br>[Step 3 · Photos, upload (proposed)](screens/post-property.html#step3) <sub>DM</sub><br>[Step 3 · Sample photos (today)](screens/post-property.html#step3-sample) <sub>D</sub><br>[Step 4 · Description](screens/post-property.html#step4) <sub>D</sub><br>[Validation errors](screens/post-property.html#errors) <sub>DM</sub><br>[Step 5 · Review](screens/post-property.html#step5) <sub>DM</sub><br>[Submitting](screens/post-property.html#submitting) <sub>D fold</sub><br>[Submit failed](screens/post-property.html#failed) <sub>D fold</sub><br>[Draft saved (proposed)](screens/post-property.html#step2,draft) <sub>D fold</sub> | customer |

### Admin portal

| Screen | States designed | Roles |
|---|---|---|
| **[Admin · Overview](screens/admin-overview.html)**<br><sub>KPIs and charts with date range; the index route redirects here.</sub> | [Default](screens/admin-overview.html) <sub>DTM</sub><br>[Chart tooltip](screens/admin-overview.html#hover) <sub>D</sub><br>[Table view of the chart](screens/admin-overview.html#table) <sub>D</sub><br>[Custom date range](screens/admin-overview.html#custom) <sub>D fold</sub><br>[Reloading](screens/admin-overview.html#refetch) <sub>D fold</sub><br>[No activity](screens/admin-overview.html#empty) <sub>D fold</sub><br>[Failed to load](screens/admin-overview.html#error) <sub>D fold</sub><br>[Mobile navigation](screens/admin-overview.html#drawer) <sub>M fold</sub> | admin |
| **[Admin · Listings moderation](screens/admin-listings.html)** *(proposed)*<br><sub>Proposed: approve, reject and feature owner listings.</sub> | [Pending queue](screens/admin-listings.html) <sub>DTM</sub><br>[Review drawer](screens/admin-listings.html#review) <sub>D fold</sub><br>[Confirm reject](screens/admin-listings.html#confirm-reject) <sub>D fold</sub><br>[Approved toast](screens/admin-listings.html#toast) <sub>D fold</sub><br>[Nothing to review](screens/admin-listings.html#empty) <sub>D fold</sub> | admin |
| **[Admin · Projects](screens/admin-projects.html)**<br><sub>Moderate, publish, feature and delete builder projects.</sub> | [Default](screens/admin-projects.html) <sub>DTM</sub><br>[Row menu open](screens/admin-projects.html#menu) <sub>D</sub><br>[Confirm reject](screens/admin-projects.html#confirm-reject) <sub>D fold</sub><br>[Confirm delete](screens/admin-projects.html#confirm-delete) <sub>D fold</sub><br>[Delete blocked: has leads](screens/admin-projects.html#delete-blocked) <sub>D fold</sub><br>[Approved toast](screens/admin-projects.html#toast) <sub>D fold</sub><br>[No projects](screens/admin-projects.html#empty) <sub>D fold</sub> | admin |
| **[Admin · Project form](screens/admin-project-form.html)** *(proposed)*<br><sub>Sectioned project form with a section nav (proposed layout).</sub> | [Default](screens/admin-project-form.html) <sub>DTM</sub><br>[Validation errors](screens/admin-project-form.html#errors) <sub>D fold</sub><br>[Upload rejected](screens/admin-project-form.html#media-error) <sub>D fold</sub><br>[Saving](screens/admin-project-form.html#saving) <sub>D fold</sub><br>[Saved](screens/admin-project-form.html#saved) <sub>D fold</sub> | admin |
| **[Admin · Units](screens/admin-units.html)**<br><sub>Project selector, unit table, add and edit drawer. (The route name says properties; it manages project units.)</sub> | [Default](screens/admin-units.html) <sub>DM</sub><br>[Add unit](screens/admin-units.html#drawer) <sub>D fold</sub><br>[Add unit: error](screens/admin-units.html#drawer,errors) <sub>D fold</sub><br>[Confirm delete](screens/admin-units.html#confirm-delete) <sub>D fold</sub><br>[No units](screens/admin-units.html#empty) <sub>D fold</sub> | admin |
| **[Admin · Builders](screens/admin-builders.html)**<br><sub>Invite, edit, activate and deactivate builder accounts.</sub> | [Default](screens/admin-builders.html) <sub>DTM</sub><br>[Row menu open](screens/admin-builders.html#menu) <sub>D fold</sub><br>[Invite a builder](screens/admin-builders.html#new) <sub>D fold</sub><br>[Reserved email blocked](screens/admin-builders.html#blocked) <sub>D fold</sub><br>[Invitation sent](screens/admin-builders.html#toast-invited) <sub>D fold</sub><br>[Confirm deactivate](screens/admin-builders.html#confirm-deactivate) <sub>D fold</sub><br>[No builders](screens/admin-builders.html#empty) <sub>D fold</sub> | admin |
| **[Admin · Leads](screens/admin-leads.html)**<br><sub>Project leads and form submissions with CRM status.</sub> | [Project leads](screens/admin-leads.html#project) <sub>DTM</sub><br>[Form submissions](screens/admin-leads.html#submissions) <sub>DM</sub><br>[Submission details, CRM retry](screens/admin-leads.html#detail) <sub>D fold</sub> | admin |
| **[Admin · Form builder](screens/admin-forms.html)**<br><sub>Form list and editor with live preview and reorder.</sub> | [Form list](screens/admin-forms.html) <sub>DM</sub><br>[Editor](screens/admin-forms.html#edit) <sub>DM</sub><br>[Reordering](screens/admin-forms.html#dragging) <sub>D fold</sub><br>[Duplicate field key](screens/admin-forms.html#errors) <sub>D fold</sub><br>[Confirm delete](screens/admin-forms.html#confirm-delete) <sub>D fold</sub><br>[Saved](screens/admin-forms.html#toast) <sub>D fold</sub> | admin |
| **[Admin · CRM integrations](screens/admin-crm.html)**<br><sub>Connections, credentials, mappings and delivery logs. (/api/public/crm-retry has no UI.)</sub> | [Connections](screens/admin-crm.html#connections) <sub>DTM</sub><br>[API logs](screens/admin-crm.html#logs) <sub>D</sub><br>[Edit connection](screens/admin-crm.html#edit) <sub>D</sub><br>[Unsafe URL](screens/admin-crm.html#url-error) <sub>D fold</sub><br>[Test passed](screens/admin-crm.html#test-ok) <sub>D fold</sub><br>[Test failed](screens/admin-crm.html#test-fail) <sub>D fold</sub><br>[Confirm delete](screens/admin-crm.html#confirm-delete) <sub>D fold</sub> | admin |
| **[Admin · Site content](screens/admin-cms.html)**<br><sub>One editor template for the four CMS routes; hero layout setting is proposed.</sub> | [Hero](screens/admin-cms.html#hero) <sub>DTM</sub><br>[Header](screens/admin-cms.html#header) <sub>D</sub><br>[Homepage sections](screens/admin-cms.html#homepage) <sub>D</sub><br>[Footer](screens/admin-cms.html#footer) <sub>D</sub><br>[Validation error](screens/admin-cms.html#hero,errors) <sub>D fold</sub><br>[Saved](screens/admin-cms.html#hero,saved) <sub>D fold</sub> | admin |

### Builder portal

| Screen | States designed | Roles |
|---|---|---|
| **[Builder · Dashboard](screens/builder-dashboard.html)**<br><sub>Compact insights; the index route redirects here.</sub> | [Default](screens/builder-dashboard.html) <sub>DTM</sub><br>[Project awaiting approval](screens/builder-dashboard.html#pending) <sub>D fold</sub> | builder |
| **[Builder · Projects](screens/builder-projects.html)**<br><sub>Same component as admin projects in builder mode; edits go back for approval.</sub> | [Default](screens/builder-projects.html) <sub>DTM</sub><br>[Sent for approval](screens/builder-projects.html#toast) <sub>D fold</sub><br>[No projects](screens/builder-projects.html#empty) <sub>D fold</sub> | builder |
| **[Builder · Project form](screens/builder-project-form.html)** *(proposed)*<br><sub>Same form without the builder and form selectors; warns that saving sends it for approval.</sub> | [Default](screens/builder-project-form.html) <sub>DM</sub><br>[Saved, sent for approval](screens/builder-project-form.html#saved) <sub>D fold</sub> | builder |
| **[Builder · Units](screens/builder-units.html)**<br><sub>Same component as admin units, scoped to own projects.</sub> | [Default](screens/builder-units.html) <sub>DM</sub> | builder |
| **[Builder · Leads](screens/builder-leads.html)**<br><sub>Own project leads; status is the only editable field.</sub> | [Default](screens/builder-leads.html) <sub>DM</sub> | builder |
| **[Builder · Insights](screens/builder-insights.html)**<br><sub>Ten engagement measures with project filter and timelines.</sub> | [Default](screens/builder-insights.html) <sub>DTM</sub><br>[Chart tooltip](screens/builder-insights.html#hover) <sub>D</sub> | builder |
| **[Builder · Company profile](screens/builder-profile.html)**<br><sub>Edit company details; email is read-only.</sub> | [Default](screens/builder-profile.html) <sub>DM</sub><br>[Company name required](screens/builder-profile.html#errors) <sub>D fold</sub><br>[Saved](screens/builder-profile.html#saved) <sub>D fold</sub> | builder |

### System and design system

| Screen | States designed | Roles |
|---|---|---|
| **[Not found and error pages](screens/errors.html)**<br><sub>Global 404 and error screens.</sub> | [404](screens/errors.html#notfound) <sub>DM</sub><br>[Something went wrong](screens/errors.html#error) <sub>DM</sub> | all |
| **[Design system · Foundations](screens/ds-foundations.html)**<br><sub>Colour, contrast, type, space, shape, layout, focus, icons.</sub> | [Default](screens/ds-foundations.html) <sub>DM</sub> | — |
| **[Design system · Components](screens/ds-components.html)**<br><sub>Buttons, fields, badges, cards, gallery, tables, flows, search card.</sub> | [Default](screens/ds-components.html) <sub>DM</sub> | — |
| **[Design system · Navigation](screens/ds-navigation.html)**<br><sub>Header per role, avatar menus, portal shell, mobile drawer and bottom bar.</sub> | [Default](screens/ds-navigation.html) <sub>DM</sub> | — |
| **[Design system · Feedback and states](screens/ds-feedback.html)**<br><sub>Alerts, toasts, dialogs, sheets, empty and loading states, validation.</sub> | [Default](screens/ds-feedback.html) <sub>DM</sub> | — |
| **[Design system · Sponsored banner container](screens/ds-ads.html)**<br><sub>Anatomy, formats, fitting, multiple ads, placements, ownership.</sub> | [Default](screens/ds-ads.html) <sub>DM</sub> | — |

## 3. Your brief's screen list

| Brief item | Where |
|---|---|
| 1. Homepage and both advertising variations | [Variation A, Search Desk](screens/home-a.html), [Variation B, Split search and ad](screens/home-b.html), [No-sponsor fallback](screens/home-none.html), [Sponsored banner container](screens/ds-ads.html) |
| 2. Property search and results | [Property search and results](screens/search.html) |
| 3. Search filters and sorting | [Property search and results](screens/search.html) (rail, mobile sheet, sort menu), the search card on [Components](screens/ds-components.html) |
| 4. Property details | [Property detail](screens/property.html) |
| 5. Project details | [Project detail](screens/project.html), [Projects listing](screens/projects.html) |
| 6. Login, registration and authentication states | [Sign in and create account](screens/auth.html), [Builder sign in](screens/builder-login.html), [Set a new password](screens/reset-password.html) |
| 7. User dashboard and account screens | [My dashboard](screens/dashboard.html) (there is no separate account-settings route in Phase 1) |
| 8. Post-property flow | [Post a property](screens/post-property.html) |
| 9. Property listing management | [My dashboard](screens/dashboard.html#listings) for owners, [Listings moderation](screens/admin-listings.html) for moderation (proposed) |
| 10. Admin dashboard | [Overview](screens/admin-overview.html) |
| 11. Admin project management | [Projects](screens/admin-projects.html), [Project form](screens/admin-project-form.html), [Units](screens/admin-units.html), [Builders](screens/admin-builders.html) |
| 12. Admin forms and CRM | [Form builder](screens/admin-forms.html), [CRM integrations](screens/admin-crm.html), [Leads](screens/admin-leads.html), [Site content](screens/admin-cms.html) |
| 13. Builder portal | [Dashboard](screens/builder-dashboard.html), [Projects](screens/builder-projects.html), [Project form](screens/builder-project-form.html), [Units](screens/builder-units.html), [Leads](screens/builder-leads.html), [Insights](screens/builder-insights.html), [Company profile](screens/builder-profile.html) |
| 14. Property comparison | [Compare homes](screens/compare.html) |
| 15. Shared components | [Foundations](screens/ds-foundations.html), [Components](screens/ds-components.html), [Navigation](screens/ds-navigation.html), [Feedback](screens/ds-feedback.html) |

## 4. Proposed screens and layouts

These are not in Phase 1 and need approval (details in `design-handoff.md`):

- **Post a property**: Five-step wizard (proposed) over the existing fields; sample-photo fallback.
- **Admin · Listings moderation**: Proposed: approve, reject and feature owner listings.
- **Admin · Project form**: Sectioned project form with a section nav (proposed layout).
- **Builder · Project form**: Same form without the builder and form selectors; warns that saving sends it for approval.

Within existing screens, proposed elements carry a dashed **Proposed** tag in the mockups: active filter chips, grid/list toggle and “Show more” on search; the locality filter on Projects; “Edit listing” on the dashboard; draft saving and photo upload in the post-property flow; the hero layout setting in the CMS; the Agent workspace menu item.

## 5. State coverage by type

Each of these was designed where it applies: default, hover, focus, pressed, selected, disabled, loading, empty, no matches, validation error, success, failed action, authentication required, confirmation dialog, rate limited, not found, long text, missing optional details, responsive navigation. Component-level hover, focus and disabled states are on the [Components board](screens/ds-components.html); page-level states are the chips above.
