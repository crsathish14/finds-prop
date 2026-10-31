# Design handoff: open decisions and assumptions

This is the list of things the design **does not decide**, the things it **proposes**, and the assumptions it had to make. Nothing here has been implemented, and nothing is treated as a confirmed requirement. Where the design needed an answer to keep moving, it shows the most conservative option and marks it **Proposed**, **To confirm** or **Assumed** in the mockups.

Per your brief, none of the advertising, regulatory, booking, analytics, backend or notification questions below block the design.

---

## 1. Already decided (not reopened)

| Decision | Source |
|---|---|
| Direction: Concept 1 (Search Desk), Grove palette, Fraunces and Figtree, Concept 1's navigation approach | Your brief |
| Two interchangeable homepage layouts (A and the split preview) sharing one header, search and visual language | Your brief |
| Advertising = **finished banner images** supplied by advertisers; several ads supported; no assumption of automatic rotation | Your brief |
| No-sponsor state = Concept 1 without a banner, no empty container, no gap | Your brief |
| UX only: no advertiser dashboards, booking, billing, reports or campaign logic | Your brief |

---

## 2. Advertising: for development planning

| # | Question | What the design does meanwhile |
|---|---|---|
| A1 | **Rotation.** Do ads rotate, how often, in what order? | Container supports a list with a manual pager; no autoplay. If rotation is chosen it needs a pause control, stops on hover and focus, and respects reduced motion. |
| A2 | **Creative requirements.** File types, maximum weight, and whether both sizes of a pair are mandatory. | Specified two sizes per layout, supplied at 2×; suggestion JPG, PNG or WEBP up to 150 KB. |
| A3 | **Legal wording of “About this ad”** and any disclosure rules. | Placeholder popover marked “Wording to be approved”. Needs legal review. |
| A4 | **Regulatory identifiers.** Must a registration number appear inside the banner? Who checks it? | Not shown by the platform. Sample banners carry the placeholder “Regulatory line, supplied by the advertiser”. No real numbers anywhere. |
| A5 | **Claims.** Which claims are not allowed in a banner (for example guaranteed returns)? Who reviews creatives? | Out of scope; flagged because the platform links to advertiser content. |
| A6 | **Alt text and destination** ownership. | Each banner needs advertiser-supplied alt text; the link opens in a new tab with `rel="sponsored noopener"`. |
| A7 | **Layout setting.** Is “Hero layout” (Search Desk / Split) a CMS setting, and is it per campaign or global? | Shown as a **Proposed** control in the admin Hero editor. |
| A8 | **Which placements exist.** Hero strip and panel are designed; in-results and between-sections banners are **proposed** slots. | Designed and labelled proposed; not recommended next to enquiry forms. |
| A9 | **Format mismatch.** If a campaign lacks the live layout's format, show the fallback. | Designed as the rule (never stretch the wrong image). |
| A10 | **Where banners come from** (admin CMS or a separate service), scheduling, time zones, impression and click reporting, booking and billing. | Not designed. |
| A11 | **Ratio tolerance.** Cover within about 8 %, letterbox within about 30 %, reject beyond. | A suggested rule; tune with real creatives. |

---

## 3. Product decisions that change the design

| # | Decision | Why it matters | Design default |
|---|---|---|---|
| P1 | **Agent role** (OQ-01). Portal, listing attribution, or customer-equivalent? | No routes or permissions exist. | No agent screens. The account menu shows an “Agent workspace” item tagged *Proposed* only on the navigation board. |
| P2 | **Admin listing moderation screen** (OQ-02, A-03). | The “approved listings only” promise depends on someone approving listings. | Designed as a **proposed** screen (Listings: queue, review drawer, approve, reject, feature). |
| P3 | **Real photo upload** (OQ-04, L-03). Limits, formats, moderation of images. | Today the form picks sample photos. | Post-property step 3 shows upload (*Proposed*) **and** the existing sample-photo picker as its own state. Upload limits (6 photos, 10 MB) are placeholders. |
| P4 | **Edit a listing.** The database allows it; no UI exists. | Owners cannot correct a listing. | An “Edit” button tagged *Proposed* on the dashboard. |
| P5 | **Builder edits reset a project to Pending** (BR-41), and public pages show only approved, published projects (BR-42). | Together, any small edit takes a live project off the public site until re-approval. | The builder list and form warn before saving and a toast confirms “Changes sent for approval”. **Please confirm that this rule is intended.** |
| P6 | **Rejected listing state for owners.** Phase 1 lists four owner badges (Live, Pending review, Sold, Rented out); admins can reject. | Owners need to see a rejected listing. | A fifth badge, “Not approved”, tagged *Wording to confirm*. |
| P7 | **Notifications** (none exist). | Owners must visit the dashboard to learn of enquiries or approvals. | Only the existing counts (“1 new”) are shown. No notification centre designed. |
| P8 | **Pagination** instead of the 60-result cap. | Large result sets. | “Showing 9 of 48 · Show more” tagged *Proposed*. |
| P9 | **Map view, unified search with autocomplete** (briefs 9.7 and 9.8). | | Not designed. A keyword (`q`) is accepted in the Locality field (to confirm). |
| P10 | **Localities** (OQ-03): hardcoded 12; beyond Chennai? | Search extensibility. | The 12 real localities are used. Order and names to be confirmed from the data. |
| P11 | **Forgot password on `/auth`.** The roles analysis mentions it; the route inventory does not. | | Designed as a state tagged *To confirm*. |
| P12 | **Password rules.** Minimum length is not documented. | | “At least 8 characters”, tagged *Length to confirm*. |
| P13 | **“New projects” tab in search.** A link to Projects, or a real search mode? | The Projects page has no filters. | A link-style tab with an arrow; locality chips on Projects are *Proposed*. |
| P14 | **Trust language.** “Approved listings only” replaces the earlier “reviewed before going live” and is true by the existing rules, but only if admins moderate. | Marketing claim. | Used in the hero trust row, the “Why Find Prop” section and the property page; revisit once P2 is decided. |
| P15 | **Verification badges, owner vs agent labels** (briefs 11.5 to 11.7). | There is no data field. | Not designed. |
| P16 | **Account settings page.** A profile table exists; no screen. | “Account screens” in the brief. | The dashboard is the account area. No settings page invented. |
| P17 | **Conversion % definition** on the admin overview. | The measure is undefined. | Shown with “Definition to confirm”. |
| P18 | **Budget filter steps** (sale and rent). | Exact options were not in the documents. | Representative steps: Up to ₹50 L … ₹3 Cr, and ₹15,000 … ₹1 L a month. |
| P19 | **Project status values.** | Phase 1 shows a “status label” without the list. | “New launch”, “Under construction”, “Ready to move”. |
| P20 | **Hardcoded agency cards** on the existing homepage. | Fictitious, not database-driven (D-03). | **Not designed.** |
| P21 | **CMS hero background image.** Neither approved layout uses one. | A CMS field with no place to render. | Kept in the editor tagged *To decide*. |
| P22 | **“Agent” column in form submissions.** Meaning unclear (assigned sales agent or the browser's user agent). | | Labelled “Agent”. Confirm. |
| P23 | **Feature rule.** Only a super admin can feature (BR-25). | | Feature is offered on approved listings only (design choice). |
| P24 | **Brand.** Wordmark and arch mark are placeholders (carried from the exploration). | | Unchanged. |
| P25 | **Language.** English at launch; Tamil UI is not designed. | Tamil is supported in AI search input. | Type and layout are ready for Tamil; Noto Sans Tamil fallback. A Tamil reader should review. |
| P26 | **Legal pages and footer links.** Privacy, terms and cookie notices are not in Phase 1. | Often required before launch. | Not designed. The footer shows CMS-driven links only. |

---

## 4. Changes to presentation that you should know about

| Change | Phase 1 | Final design |
|---|---|---|
| Leads by source | Pie chart | Single stacked bar with a legend table (clearer for four parts; all charts also have a table view) |
| Admin navigation | 11 tabs | 4 labelled groups in a sidebar |
| Compare page wording | “Choose at least two projects” | “Choose at least two homes” |
| Post property | One page | Five steps (proposed), the existing fields |
| Project form | One dense page | Sectioned page with a section nav (proposed) |
| Mobile navigation | None | Bottom bar and menu drawer (proposed) |

---

## 5. Assumptions made (all flagged in the mockups)

1. Listing status words: Live, Pending review, Sold, Rented out, Not approved.
2. Unit status words: Available, On hold, Sold, Blocked.
3. Enquiry status words: New, Contacted, Closed; sent enquiries show “Waiting for owner”.
4. Rate-limit and failure messages are written to match the documented limits; the exact product wording is not specified.
5. Toasts last six seconds; dialogs and sheets follow the behaviour in `interaction-specifications.md`.
6. The compare bar shows up to three thumbnails and disables Compare now until two are chosen (documented), with a “Clear all” (documented).
7. Chart series colours are pinned to entities (Leads always ochre, Enquiries always blue).
8. Sample data (people, developers, projects, prices, localities beyond the real 12, phone numbers, emails) is **fictional**.
9. Property and project imagery is illustrated placeholder art, not photography.
10. The footer shows a “Builder sign in” link; builders currently have no link to their login.

---

## 6. Not designed

Advertiser dashboards, booking, billing, impression or click reports, campaign management (out of scope by your brief) · agent portal · notifications · map view · account settings · legal pages · email and SMS templates · the CRM retry endpoint (no UI) · hardcoded agencies · dark mode · a Tamil interface · print styles · offline behaviour.

---

## 6b. Business-rule traceability (Phase 1 `06-business-rules-and-data.md`)

Each documented rule that touches the interface, and where the design honours it. Rules enforced only in the database or server have no screen of their own and are listed as “backend”.

| Rule | Where it shows in the design |
|---|---|
| BR-01, BR-04, BR-05 Sign-up methods, email confirmation, reset | [Auth](screens/auth.html): Google and email, “Check your email”, forgot password; [Reset](screens/reset-password.html) |
| BR-06 Safe redirect | Navigation doc, section 9; the “gate” state on [Auth](screens/auth.html#gate) |
| BR-10 to BR-15 Roles | Role matrix in `navigation-and-information-architecture.md`; agent role not designed (BR-14 → decision P1); builders invitation-only on [Builders](screens/admin-builders.html) |
| BR-20 New listings start Pending | “Waiting for review” on the [dashboard](screens/dashboard.html#listings); “What happens next” on [Post property](screens/post-property.html#step5); the moderation queue (proposed) |
| BR-21 Owners may only mark sold or rented | Mark as sold / rented appears only on Live rows; confirmation says it cannot be undone |
| BR-22, BR-25 Only a super admin approves, rejects, features | No such controls anywhere for owners; admin-only on [Listings](screens/admin-listings.html) (proposed) and [Projects](screens/admin-projects.html) |
| BR-23 Owner cannot change | Backend: no screen offers it |
| BR-24, BR-90 Only approved listings are public | Public copy says “approved listings only”; sold and rented homes leave search (stated on the dashboard) |
| BR-26 Owner-scoped delete | Delete on the owner's own rows, always confirmed |
| BR-27, BR-28 Listing and property types | Buy / Rent; the five property types in every filter and form |
| BR-30 to BR-35 Builder isolation and limits | Builder screens reuse the admin components in builder mode; profile email read-only; reserved admin email rejected on [Builders](screens/admin-builders.html#blocked); deactivation not deletion |
| BR-40 to BR-44 Project moderation | Pending, Approved, Rejected, Published, Featured on [Projects](screens/admin-projects.html); builder edits warn about re-approval (**decision P5**); delete disabled when leads exist, with an explanation |
| BR-45 Units cannot move between projects | Note under the units table |
| BR-46, BR-47 Lead fields locked; builders change status only | [Builder leads](screens/builder-leads.html): status select is the only editable control |
| BR-48 RERA fields | RERA section in the project form; RERA number tile on the project page |
| BR-49 Dynamic form with fallback | Project page uses the assigned form or the built-in form (interaction doc, section 4) |
| BR-50 to BR-54 Enquiries and saved homes | Enquiry card gated by sign-in; New → Contacted → Closed buttons only for the owner; heart requires sign-in and returns |
| BR-60 to BR-67 Forms and CRM | [Forms](screens/admin-forms.html): field types, placement, CRM link; [CRM](screens/admin-crm.html): masked credentials, https-only URL error, retry schedule, logs |
| BR-61, BR-70 to BR-75 Rate limits | Rate-limited states on [Contact](screens/contact.html#ratelimit), the [project lead form](screens/project.html#ratelimit) and [AI search](screens/ai-search.html#ratelimit) |
| BR-80 to BR-83 CMS | [Site content](screens/admin-cms.html): four settings, section toggles, “header logo not shown” note |
| BR-91 to BR-93 Search filters, labels, localities | Filter rail and sheet with the real vocabularies; label pills and thresholds in the interaction doc |
| BR-95 AI search | [AI search](screens/ai-search.html) with its limits and lead form |

**Permissions check:** every screen is reachable only by the roles in the route table. The design adds no permission: the proposed Listings screen uses the existing super-admin gate, and the agent entry is tagged *Proposed*.

## 7. How this package was checked, and its limits

**Automated, on every screen and state** (`node tools/check.mjs`): no console or script errors; no horizontal overflow at 390, 820, 1024, 1280 and 1440 px; no broken images; no text below 11 px; no duplicate ids; no dead internal links; touch-target sizes reported at 390 px. Route coverage against the 33 Phase 1 routes is computed from the manifest (`tools/make-inventory.mjs`). Chart colours were validated with the dataviz validator. Contrast ratios are measured from the real token values.

**Reviewed by eye:** desktop, tablet and mobile renders of the homepage variations, search, property, project, compare, AI search, auth, dashboard, post-property, and the admin and builder screens; the design-system boards.

**Not done, and worth doing before development:**

- **No usability testing** and no eye-tracking. Statements about attention are design judgement. The first-click test described in `homepage-ad-variations.md` is the cheapest next step.
- **Browsers and devices:** checked in desktop Chrome only (including emulated phone and tablet widths). Not tested in Safari, Firefox, real phones, or with a screen reader or keyboard-only walkthrough on real assistive technology.
- **Fonts load from Google Fonts**; offline the pages use system fonts and spacing shifts a little.
- **Imagery and data are placeholders.** Real photography and real content will change contrast, density and the longest strings.
- **Performance** (image weight, font loading) was not measured.
- **The prototypes are static**: nothing is wired to data, search does not filter, and forms do not submit. States are selected with the URL hash.
- **Legal and regulatory review** of the advertising and of any trust claims is outside what a designer can confirm.

---

## 8. What happens next

Nothing further is started. Production implementation (the Next.js application, components, Supabase work) begins only after you review this package and approve it explicitly. Suggested first steps after approval: confirm P2 and P5, decide the hero layout default, run the first-click test, then build the shared components (`assets/c-*.css` is a ready reference for the tokens and states).
