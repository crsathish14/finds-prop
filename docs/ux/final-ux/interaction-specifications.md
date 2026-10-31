# Interaction specifications

How the major interactions behave, and how screens adapt. Rules marked **(rule)** come from Phase 1 (`06-business-rules-and-data.md`) and must be preserved. Anything marked **(proposed)** is a design recommendation. Open any state from [screen-inventory.md](screen-inventory.md).

## 1. Principles

1. **Never lose what the person typed.** A failed submit keeps every field.
2. **Confirm only what cannot be undone.** Deleting a listing, marking sold, rejecting, deactivating: yes. Removing from compare: no (offer Undo).
3. **Say what happened and what to do.** Messages name the thing and give the next step.
4. **Same input, same result.** Filters live in the URL, so a result can be shared, bookmarked and returned to with Back.
5. **The page decides, not a spinner.** The sponsor, if any, is decided with the page; nothing waits on an ad.

---

## 2. Search (home and results)

### The search card

| Field | Behaviour | Maps to |
|---|---|---|
| **Buy / Rent** | Segmented, one selected. Changes the budget options (sale amounts vs monthly rent). | `listingType` = `sale` \| `rent` |
| **New projects** | A link-style tab that opens `/projects` (a small arrow shows it navigates). Fields are not used. *(Decision: see handoff #7.)* | n/a |
| **Locality** | Text field with a suggestion list of the 12 Chennai localities; typing filters it; Enter or click selects; a clear (×) button appears when filled. Keyboard: ↑ ↓ Enter Esc. | `locality` |
| **Property type** | Select: Apartment, Villa, Independent House, Plot / Land, Commercial. | `propertyType` |
| **Bedrooms** | **Single value** 1 to 4, or Any **(rule: the existing filter is one value, not a range)**. | `bhk` |
| **Max budget** | **Maximum only** **(rule)**. Sale: Up to ₹50 L … ₹3 Cr. Rent: Up to ₹15,000 … ₹1 L. Exact steps to confirm. | `maxPrice` |
| **Popular** chips | One tap sets the locality and searches. | `locality` |
| **Quick picks** | “3 BHK” sets bedrooms; “Budget homes” sets the Budget label. | `bhk`, `label=budget` |
| **Describe it in words** | Opens `/ai-search`. | n/a |
| **Search** | Goes to `/properties` with the chosen filters. An empty search is allowed and shows everything. Enter in any field submits. | URL params |

Typing into Locality something that is not a locality becomes a keyword search (`q`, max 120 characters). *(To confirm: Phase 1 has `q` but no visible text field for it.)*

Both homepage layouts use this one component with the same fields, order and behaviour; only the arrangement differs (one joined bar vs stacked).

**Mobile:** the card stacks (tabs, locality, three selects in a row with short labels, Search, “Describe it in words”). Selects open as native pickers or a bottom list. The popular chips are hidden in the card to keep the ad and the Search button above the fold; localities remain one tap away in “Explore by locality”.

### Results page

| Element | Behaviour |
|---|---|
| Filters | **Laptop and up:** a sticky left rail; each change applies immediately and updates the URL. **Below 1024:** a “Filters” button opens a bottom sheet; changes apply with “Show N homes”; “Clear all” resets. |
| Filter fields | Looking to (All / Buy / Rent), Locality, Property type, Bedrooms (Any, 1–4), Max budget; the sheet also has Sort. |
| Sort | Newest, Price low to high, Price high to low, Largest first. |
| Label pills | All, Featured, Prime, Budget. Labels are computed **(rule, BR-92)**: Featured is a flag; Prime is ≥ ₹1.5 Cr or ≥ ₹60,000 a month; Budget is ≤ ₹60 L or ≤ ₹20,000 a month. |
| Active filter chips *(proposed)* | One removable chip per active filter, “Clear all” at the end. Removing a chip updates results and URL. |
| Grid / list toggle *(proposed)* | Presentation only; remembered per visit. |
| Count | “48 homes found in Velachery, Chennai”. |
| Show more *(proposed)* | Replaces the hard 60-result cap: “Showing 9 of 48” with a progress bar and button; focus moves to the first new card. |
| Compare | See section 5. |
| Save (heart) | Toggles; if signed out, goes to sign-in and returns, then saves **(rule, BR-54)**. Filled copper heart when saved. |
| Back from a property | Returns to the same scroll position with the same filters (recommended). |
| Sponsored banner in results *(proposed)* | After the second row, full width of the results column, labelled; never between the filters and the first row. |

**States:** loading (six skeleton cards), no matches (arch illustration, “Clear all filters” and “Describe it in words”), failed load (alert with Try again; filters kept), sort menu open, mobile sheet open.

---

## 3. Property detail

| Element | Behaviour |
|---|---|
| Gallery | Thumbnail click changes the main image; arrows and ← → keys move; counter “2 / 6”. Phones: swipe, dots. One photo: strip and arrows hidden. |
| Add to compare / Save | Same behaviour as on cards. |
| Price card | Price, and ₹ per sq.ft for sale listings only **(rule)**. |
| Missing optional details | Left out, not shown as blanks. A long title wraps and is never truncated on this page. |

### Enquiry card (three documented states + errors)

| State | Content |
|---|---|
| Signed out | Lock icon, “Contact the owner”, **Sign in to contact** (copper) and Create an account. Both carry `?redirect=` to this page. |
| Signed in | Name\*, Phone\*, Email (optional), Message (optional, 0 / 1000), **Send enquiry** (copper). A line says the owner will see these details. |
| Sent | Success icon, “Enquiry sent”, **View my enquiries** (→ `/dashboard?tab=sent`). |

**Validation (rule):** name 2 to 80 characters; phone 6 to 15 digits; email optional; message up to 1000. Errors appear under the field on submit and on leaving an edited field; focus moves to the first error. On a server failure the form stays filled with a “We couldn't send your enquiry” alert.

**Mobile:** a sticky bar shows the price and **Enquire** (or **Sign in to enquire**). Enquire opens the form in a bottom sheet.

---

## 4. Projects

- **Projects page:** cards open the project. Locality chips *(proposed)* filter the list. Empty: “New projects are coming soon”.
- **Project page:** Call (tel link), WhatsApp, Brochure (download), Shortlist, all of which the product records **(rule: view, call, whatsapp, brochure, shortlist events; 30 events per visitor per minute)**.
- **Units table:** unit, floor, BHK, area, facing, price, status. Statuses: Available, On hold, Sold, Blocked. Scrolls sideways on phones.
- **Lead form:** Enquire or Site visit (segmented). Site visit adds a required date. Name and phone required. **Rate limit 5 per visitor per hour (rule)** shows a “Please wait a little” alert. Success replaces the form. If an admin assigned a custom form, it renders in the same card; otherwise the built-in form is used **(rule, BR-49)**.
- **Price trend:** single-series line with hover values and a “View as table” alternative.
- **Mobile:** a sticky bar with Call, WhatsApp and **Enquire about this project**.

---

## 5. Compare

- **Selecting:** the “Compare” toggle on cards and the “Add to compare” button on detail pages. **Maximum 3 (rule).** At three, the other cards' toggles disable with “You can compare up to 3 homes”.
- **Compare bar:** appears after the first selection: three slots (thumbnail with ×), “N of 3”, Clear all, **Compare now**, which is disabled until two are chosen. Stored on the device **(rule)**.
- **Compare page:** one table, label column on the left. Remove (×) per home updates the page and the URL (`?ids=`); fewer than two shows “Choose at least two homes to compare” with a Browse link.
- **Phones:** the table scrolls sideways with the label column fixed; about two homes are visible.
- **Removed:** a toast with **Undo**.

---

## 6. AI search

1. The person types or taps an example; English, Tamil and Tanglish are supported **(rule)**.
2. **Find homes** shows a loading state (button in progress, skeleton cards).
3. Results: a short summary, matching homes, “You may also like”, a link to browse everything, and the lead form below.
4. **Fewer than three matches:** the lead form is highlighted (copper outline, “Fewer than 3 matches” badge) **(rule)**.
5. **Limits (rule):** 10 searches per visitor per minute → “Too many searches in a short time, try again in 45 seconds”; 100 per day overall → “AI search is unavailable right now” with a link to filter search; 50 lead submissions per hour per visitor.
6. A note under the box tells people not to include personal details in the description.

---

## 7. Sign-in and accounts

| Flow | Behaviour |
|---|---|
| Sign in | Google, or email and password. Wrong credentials: alert above the form; fields kept. |
| Create account | Adds Full name; after submit the page becomes “Check your email”; the account is usable after the confirmation link **(rule, BR-04)**. A taken email shows the error under the field with “Sign in instead”. |
| Arriving from a gated action | An info alert explains why (“Sign in to contact the owner”) and the person is returned afterwards. Redirect must start with `/` and not `//` **(rule, BR-06)**. |
| Forgot password *(to confirm for /auth)* | Email only; “If an account exists…” confirmation (does not reveal whether the email is registered). |
| Reset password | Arrives from the email link. No valid session: “Use the link in your email” and a button to request a new one. Mismatch: error under Confirm. Success: signed in; builders go to the builder portal, others home. |
| Builder sign in | Email and password only, no sign-up. Not an active builder: signed out with “This account doesn't have active builder access”. |
| Show / hide password | Eye button, 44 px target, announces state. |

---

## 8. Dashboard

| Tab | Behaviour |
|---|---|
| Saved | Grid of cards with filled hearts; tapping a heart removes it. Empty: “You haven't shortlisted any homes yet”. |
| My listings | Rows with a status badge. **Mark as sold / rented** appears **only for Live listings (rule, BR-21)** and asks for confirmation; it cannot be undone by the owner, and the home leaves search. **Delete** is owner-scoped and always confirmed. Pending listings explain “Waiting for review”. A fifth state for admin-rejected listings is needed (wording to confirm). “Edit” is proposed (the owner can already update in the database). |
| Enquiries received | Cards with name, phone, email, the property, the message. Buttons follow the one-way flow **New → Contacted → Closed (rule, BR-52)**: New shows Mark contacted and Close; Contacted shows Close; Closed shows none. Only the property owner can change status. |
| My enquiries | Read-only list with “Waiting for owner”, Contacted or Closed. |

Tab selection is in the URL (`?tab=`) and is announced to screen readers. Success feedback is a toast; failed actions show an alert with Try again and change nothing.

---

## 9. Post a property *(five steps are proposed; fields and rules are existing)*

| Step | Fields | Rule |
|---|---|---|
| 1 Basics | Listing type (Sell / Rent out), Property type, Locality, Address | Locality 2 to 80 characters; address up to 300 |
| 2 Details | Bedrooms, Bathrooms (0 to 10), Area (≥ 0), Price (≥ 0), Furnishing, Amenities (any of the 12; the rule allows up to 20) | Rent price is per month |
| 3 Photos | Up to 6 photos | *Upload is proposed.* Today the form picks up to 3 sample photos; that picker is kept as a state. Real limits to be decided. |
| 4 Description | Title (8 to 140), Description | Counter shows N / 140 |
| 5 Review | Summary with Edit links | Submitting creates a **Pending** listing owned by the person **(rule, BR-20)** |

Continue validates the current step only and moves focus to the first error. Back never loses data. **Save draft** *(proposed)* stores progress and shows a toast. Submit shows “Submitting”, then returns to **My listings** with a “submitted for review” toast; a failure keeps all answers and shows an alert. On phones the stepper becomes a five-segment progress bar and Back and Continue are a sticky footer.

---

## 10. Admin

| Area | Behaviour |
|---|---|
| Overview | Date presets (Today, Yesterday, 7 days, 30 days, This month, Custom) in one row above the content; all numbers and charts follow it. Charts keep their last render, dimmed, while reloading. The line chart has a crosshair with a single tooltip for all series, arrow-key support, and a Chart / Table switch. |
| Listings *(proposed)* | Pending first. **Review** opens a drawer with the full listing and Approve / Reject. Approve shows a toast; Reject asks for confirmation. Only a super admin can feature a listing **(rule, BR-25)**; offering Feature on approved listings only is a design choice, because a pending listing is not public anyway (to confirm). |
| Projects | Contextual primary action: Pending → Approve and Reject; Approved and unpublished → Publish; Published → Unpublish; Rejected → Approve. A “More” menu holds Edit, Feature, View live and Delete; row menus open in a popover layer above the table so they are never clipped by its scroll area. **Delete is blocked when the project has leads (rule, BR-44)**: the item is disabled with a reason and an alert explains it. Rejecting and deleting ask for confirmation. |
| Units | Pick a project; add and edit in a drawer; status is a select in the row. Units cannot be moved to another project **(rule, BR-45)**. |
| Builders | “New builder” sends an invitation; the reserved admin email is rejected with an inline error **(rule, BR-35)**. Resend invitation for builders who never signed in. Deactivate confirms; builders cannot be deleted. |
| Leads | Status select per row. Form submissions have filters (date, form, project, source, CRM status); selecting a row opens details with files and **Retry delivery** on failures. |
| Forms | List with an Active switch. Editor: settings, quick-add presets, fields, live preview. Fields reorder by **dragging or with Move up / Move down buttons**; duplicate keys are rejected inline. |
| CRM | Credentials are masked and never returned **(rule, BR-64)**: Replace or Clear. The URL must be https and public **(rule, BR-65)**. **Test API** shows success or failure inline. Logs show status, HTTP code and attempt; failed rows have **Retry**. Automatic retries after 1, 5, 30, 120 and 720 minutes, up to 6 attempts **(rule, BR-66)**. |
| Site content | One editor, four tabs, live preview beside the form; Save applies immediately. Empty tables still render with defaults **(rule, BR-81)**. |

---

## 11. Builder

- **Projects:** only Edit and View live. Saving an edit sets the project to **Pending**, which hides it from the public site until it is approved again **(rule, BR-41, BR-42)**. The form and the list say so before the builder saves, and a toast confirms “Changes sent for approval”. *(This consequence is harsh; confirm the rule, see handoff.)*
- **Units, Leads:** the same components as admin, limited to the builder's own data. In Leads the builder can change status only **(rule, BR-47)**.
- **Insights:** the same date presets and a project filter; two line charts (views and visitors; leads and enquiries) because the scales differ, plus leads by project.
- **Profile:** email is read-only **(rule, BR-32)**; saving does not need approval.

---

## 12. Sponsored banners

Single link, new tab, `rel="sponsored noopener"`. “About this ad” opens a popover. A pager appears only when there is more than one ad; it is manual and has no autoplay. If an image fails to load, the slot is removed and the page falls back to the no-sponsor layout. Full rules in [homepage-ad-variations.md](homepage-ad-variations.md).

---

## 13. Responsive behaviour

| Area | Mobile < 768 | Tablet 768–1023 | Laptop and desktop |
|---|---|---|---|
| Header | Logo, Sign in or avatar, menu | Adds Post property | Full |
| Primary nav | Bottom bar and drawer | Drawer | Inline |
| Home hero | Stacked, left aligned | Centred (A) or stacked (B) | Centred strip (A) or split (B) |
| Search card | Stacked, short labels | Stacked, two rows | One bar (A) or stacked (B) |
| Results | One card per row, filters in a sheet | Two columns, filters in a sheet | Rail plus three columns |
| Detail pages | Full-bleed gallery, sticky bar, sheet | Two columns, sticky bar | Sticky right column |
| Tables | Labelled cards | Scroll sideways | Full table |
| Forms | One column | Two columns | Two columns |
| Portals | Drawer navigation | Icon rail | Sidebar |
| Dialogs | Centred; forms use sheets | Centred | Centred |

---

## 14. Keyboard and assistive technology

- **Order:** skip link, header, main, footer; the bottom bar and compare bar come last in the DOM but are reachable.
- **Menus:** arrow keys, Home, End, Esc; focus returns to the trigger.
- **Dialogs and sheets:** focus is trapped, Esc closes, focus returns. Destructive dialogs focus the safe button first.
- **Gallery:** ← → change the photo; thumbnails are buttons named “Photo 3: Kitchen”.
- **Charts:** focusable; ← → move the crosshair; values are also in the table view and the legend.
- **Reordering fields:** pointer drag **and** Move up / Move down buttons.
- **Live regions:** result counts, toasts, success panels and errors are announced (`status` or `alert`).
- **Tabs and segmented controls:** `role="tablist"`; the current item has `aria-selected` or `aria-current`.
- **Reduced motion:** transitions, shimmer and the card zoom are removed.

---

## 15. Where each state type is designed

| State | Examples |
|---|---|
| Loading | Search, property, projects, compare, AI search, dashboard, post-property submitting, admin refetch |
| Empty | Search no matches, projects, saved, listings, received, sent, compare, admin lists, units |
| Validation error | Property enquiry, project lead, contact, auth, post-property, project form, unit form, builder invite, CRM, forms, CMS, profile |
| Success | Enquiry sent, lead sent, contact sent, listing submitted, toasts in dashboard and portals |
| Failed action | Search, dashboard, post-property, property enquiry, AI search, admin overview, CRM test |
| Authentication required | Property sign-in gate, auth “gate”, bottom bar, saved |
| Confirmation | Mark sold, delete listing, reject, delete project, delete unit, deactivate builder, delete form, delete CRM |
| Rate limited | AI search (two kinds), project lead, contact |
| Not found | Property, project, 404 page |
| Long text, missing details | Property “sparse”, card gallery on the components board |
| Responsive navigation | Navigation board, mobile drawers, portal drawer, tablet rail |
