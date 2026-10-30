# Navigation and information architecture

Live reference: [Navigation board](screens/ds-navigation.html). Route facts come from `property-platform-analysis/03-site-map.md` and `02-user-roles-and-permissions.md`; nothing here grants a permission that Phase 1 does not document.

## 1. Principles

1. **One public header for everyone.** The five main links never change with role. Roles add one entry to the account menu and, inside `/admin` and `/builder`, swap the public header for the portal shell.
2. **Show only what the person can use.** No admin link in the public header; no portal link for a customer. A signed-out visitor who reaches something that needs an account is sent to sign-in and returned afterwards.
3. **Shallow.** At most two levels before content. Secondary links live in the account menu (desktop) or the menu drawer (phone).
4. **Predictable position.** Logo left, main links next, actions right, on every public page and every size.
5. **Honest about proposals.** Anything not in Phase 1 is tagged *Proposed* in the mockups and in the table in section 10.

---

## 2. Site map

```
Find Prop
├── Home ............................ /                          home-a · home-b · home-none
├── Buy · Rent ...................... /properties               search
│   └── Property detail ............. /properties/$id           property
├── Projects ........................ /projects                 projects
│   └── Project detail .............. /projects/$slug           project
├── AI Search ....................... /ai-search                ai-search
├── Contact ......................... /contact                  contact
├── Compare (from the compare bar) .. /compare                  compare
├── Sign in / Create account ........ /auth                     auth
├── Builder sign in ................. /builder/login            builder-login
├── Reset password .................. /reset-password           reset-password
│
├── Account (signed in)
│   ├── Dashboard ................... /dashboard                dashboard
│   │     tabs: Saved · My listings · Enquiries received · My enquiries
│   └── Post a property ............. /post-property            post-property
│
├── Admin portal (super admin) ...... /admin → /admin/dashboard
│   ├── Overview .................... /admin/dashboard          admin-overview
│   ├── Moderation
│   │   ├── Listings (proposed) ..... /admin/listings           admin-listings
│   │   └── Projects ................ /admin/projects           admin-projects, admin-project-form
│   ├── Inventory
│   │   ├── Units ................... /admin/properties         admin-units
│   │   └── Builders ................ /admin/builders           admin-builders
│   ├── Leads and CRM
│   │   ├── Leads ................... /admin/leads              admin-leads
│   │   ├── Forms ................... /admin/forms              admin-forms
│   │   └── CRM ..................... /admin/crm                admin-crm
│   └── Site content ................ /admin/header · hero · homepage · footer   admin-cms
│
└── Builder portal (active builder) . /builder → /builder/dashboard
    ├── Dashboard ................... /builder/dashboard        builder-dashboard
    ├── Projects .................... /builder/projects         builder-projects, builder-project-form
    ├── Units ....................... /builder/properties       builder-units
    ├── Leads ....................... /builder/leads            builder-leads
    ├── Insights .................... /builder/insights         builder-insights
    └── Profile ..................... /builder/profile          builder-profile
```

The admin item “Units” is the existing `/admin/properties` route; it manages **project units**, not listings. It is labelled by what it does. The new Listings screen is a separate, proposed route.

---

## 3. Who sees what

| Role | Main navigation | Right side of header | Account menu | Work area |
|---|---|---|---|---|
| Visitor | Buy · Rent · Projects · AI Search · Contact | Post property · Sign in | n/a | Public pages |
| Customer (buyer or owner) | same | Post property · Saved (count) · avatar | Saved homes · My listings · Enquiries received (“N new”) · My enquiries · Post a property · Sign out | Dashboard tabs |
| Builder | same | same | the above + **Builder portal** | Portal shell, 6 items |
| Super admin | same | same | the above + **Admin portal** | Portal shell, 11 items + proposed Listings |
| Agent *(proposed)* | same | same | the above + Agent workspace, only if an agent portal is approved | Not designed: no routes or permissions exist (OQ-01) |

Builders and admins keep all customer abilities (Phase 1: builders have all customer permissions plus their own), so the customer items stay in their menu.

---

## 4. Public header

**Desktop and laptop (≥ 1024):** logo mark and Fraunces wordmark · Buy · Rent · Projects · ✦ AI Search · Contact · [Post property pill] · Sign in. Height 72 px. The AI Search link is copper text with the sparkle icon. Sticky, ivory at 94 % with a light blur; a hairline appears under it on inner pages (not on the homepage hero).

**Signed in:** Sign in is replaced by the **saved-homes heart** (with count) and an **avatar button** (initials, chevron). The pill stays.

**Tablet (768–1023):** logo · Post property · Sign in (or avatar) · menu button. Main links move into the drawer.

**Mobile (< 768):** logo · Sign in (or avatar) · menu button. “Post property” moves to the bottom bar and the drawer. Header height 56 px.

**Link states**

| State | Treatment |
|---|---|
| Default | Ink, 15 px, weight 500 |
| Hover | Forest |
| Current page | Forest, weight 700, 2 px copper underline, `aria-current="page"` |
| Keyboard focus | Standard focus ring |

**Which link is current:** Buy and Rent on `/properties` (by intent), Projects on `/projects` and project pages, AI Search, Contact. Home, auth, dashboard and portals have none.

A **skip link** (“Skip to content”) is the first focusable element on every page.

---

## 5. Account menu (avatar dropdown)

Contents, top to bottom: a header (avatar, name, email, role chip for builder and admin) · **Dashboard** group (Saved homes, My listings, Enquiries received, My enquiries; counts on the right, with “N new” in copper on Enquiries received) · Post a property · **Workspaces** group (Builder portal or Admin portal, by role) · Sign out.

Behaviour: opens on click or Enter; arrow keys move; Home and End jump; Escape or an outside click closes it and returns focus to the avatar. Items are real links to `/dashboard?tab=…`, `/post-property` and the portals.

---

## 6. Mobile navigation

**Menu drawer** (from the menu button, slides in from the right, 90 % wide): large Fraunces links (Buy, Rent, Projects, AI Search, Contact) with chevrons; for signed-in people an “Your account” group and, by role, a “Workspaces” group; at the bottom the actions: **Post a property** (copper), then Sign in and Create account, or Sign out.

**Bottom bar** (five items, 66 px): Home · Search · **Post** (the only raised, filled-circle item) · Saved (count) · Me. The current item is forest, bold, with a copper marker on its top edge.

| | Rule |
|---|---|
| Shown on | home, search, projects, compare, AI search, contact, dashboard, errors |
| Hidden on | property detail and project detail (a sticky price and enquiry bar replaces it), the post-property wizard (Back / Continue replace it), the auth pages, and the admin and builder portals |
| Signed out | Saved and Me lead to sign-in, then return the person to where they were going |
| “Me” | Opens the dashboard; there is no separate account-settings screen in Phase 1 |

The bottom bar and the menu drawer never repeat each other's job: the bar is for the five most-used destinations, the drawer for everything else.

---

## 7. Portal navigation (admin and builder)

One shell, two navigation sets. Admin pages are `noindex`.

**Admin sidebar** (256 px, forest): Overview · **Moderation** (Listings *proposed*, Projects) · **Inventory** (Units, Builders) · **Leads and CRM** (Leads, Forms, CRM) · **Site content** (Header, Hero, Homepage, Footer) · footer: View public site, Sign out. Counts appear on Listings (awaiting approval) and Projects (pending).

**Builder sidebar:** Dashboard · Projects · Units · Leads · Insights · Profile · footer: View public site, Sign out.

Grouping the admin's 11 tabs into four labelled groups replaces Phase 1's flat 11-tab bar. It is a presentation change; no route moved.

| Size | Behaviour |
|---|---|
| ≥ 1100 px | Full sidebar, sticky |
| 768–1099 px | 76 px icon rail; labels become tooltips; counts become small dots |
| < 768 px | Sidebar becomes a left drawer from the menu button in the top bar |

The portal top bar holds the menu button (small screens), the role chip (when the sidebar is collapsed), “View public site” and the avatar.

**Current item:** lighter forest fill, a copper marker on the left edge, `aria-current="page"`.

---

## 8. Breadcrumbs, tabs and back

| Pattern | Where | Behaviour |
|---|---|---|
| Breadcrumb | Property, project, compare, search, contact, project form | Laptop and up: Home › Properties › Velachery. Last item is the current page, not a link. |
| Back link | The same pages below 1024 px | A single “← Back to results” (or “← Home”) link. |
| Page tabs | Dashboard, leads, CRM, site content | Underline tabs, scrollable on phones, deep-linkable. Dashboard keeps the existing `?tab=saved \| listings \| received \| sent`. |
| Segmented control | Buy / Rent / New projects, All / Buy / Rent, date presets | Changes the content in place. |

“New projects” in the search card is a **link-style tab** to `/projects` (with a small arrow), because the Projects page has no search filters. This mirrors today's “Explore new projects” link.

---

## 9. Guards and redirects

| Situation | Result |
|---|---|
| Visitor taps a signed-in action (Save, Enquire, Post property, Dashboard) | `/auth?redirect=<current path>`; the sign-in screen says why (“Sign in to contact the owner”) and returns afterwards |
| Redirect value | Must start with `/` and not `//` (open-redirect protection, BR-06) |
| Signed-in non-admin opens `/admin/*` | Redirected to `/` |
| Non-builder opens `/builder/*` | Redirected to `/builder/login?denied=1` with the “doesn't have active builder access” message |
| Builder signs in on `/builder/login` but has no active builder record | Signed out, same message |
| `/admin` and `/builder` | Redirect to their dashboards |
| Password reset link opened | `/reset-password`; builders then go to `/builder/dashboard`, everyone else to `/` |

---

## 10. Changes to the information architecture, and what is proposed

Every row is a design recommendation, not existing behaviour, and needs approval. See `design-handoff.md`.

| Change | Why | Phase 1 reference |
|---|---|---|
| **Admin Listings screen** | Listings start as pending and only an admin can approve them, but no screen exists | A-03, AD2, brief 9.12 |
| Mobile bottom bar and menu drawer | Phase 1 found no mobile navigation | M-03, brief 9.4 and 10 |
| Admin sidebar groups | 11 flat tabs are hard to scan | N-04 |
| Active filter chips, grid and list toggle, “Show more” | Make large result sets manageable | Brief 9.5, 9.11 |
| Five-step post-property flow, draft saving, real photo upload | Long single form; no way to keep progress | L-01, L-03, brief 9.3 |
| Sectioned project form | 30+ fields on one page | B-05, brief 9.10 |
| Locality filter on Projects | The data layer supports it; the screen has no control | BR-94 |
| Hero layout setting in the CMS | Two interchangeable homepage layouts | New (this phase) |
| Footer “Builder sign in” link | Builders currently reach their login only by URL | P-10 entry points |
| Agent workspace | Agent role has no portal | OQ-01 |
| Notifications | None exist; only the “N new” count on enquiries is shown | Brief 9.6 |
| Map view | Not designed | Brief 9.8 |

**Corrected, not proposed:** the compare page wording now says “homes”, not “projects” (P-05); the localStorage key in the new build should use the Find Prop name, not “Chennai Estates” (N-07).
