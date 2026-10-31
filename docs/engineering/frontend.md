# Frontend standards

> Source: distilled from the approved implementation plan and AI harness design (30 Oct 2026). References such as `plan 07 §4.2`, `03` §10 or `ADR-009` point to the archived plan, the harness design documents, or `docs/adr/`. From Stage 1 (S1-T12) this repository is authoritative (HD-11).

Scope: pages, features, client islands, forms, URL state, styling use. Components and tokens are in `design-system.md`.

## Rules

| ID      | Rule                                                                                                                                                                                                                                                                                                | Enforced by                                                | Source                |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | --------------------- |
| R-FE-01 | Server Components by default. `"use client"` appears only in `*.client.tsx` leaf files                                                                                                                                                                                                              | G-02 (`no-restricted-syntax` on the directive)             | ADR-002, plan 05 §2   |
| R-FE-02 | `*.client.tsx` files never import `server/`, `*.server.ts`, `queries.ts` or `service.ts`, and never read `process.env`                                                                                                                                                                              | G-02 (boundaries)                                          | plan 03 §5.2          |
| R-FE-03 | Imports flow downward through the layer table in plan 03 §5.2. A feature is imported only through its `index.ts`; no deep imports                                                                                                                                                                   | G-02 (boundaries)                                          | plan 03 §5            |
| R-FE-04 | Files in `app/` compose only: read params, call a feature query, render feature components. No Supabase calls, no business rules, no copied markup                                                                                                                                                  | G-02 (restricted imports in `app/`); Review                | plan 03 §3.2          |
| R-FE-05 | Next.js 16 conventions: `await params`, `searchParams`, `cookies()`, `headers()`; `proxy.ts` not `middleware.ts`; `images.remotePatterns` not `domains`; `revalidateTag(tag, 'max')` or `updateTag`; `default.js` for parallel-route slots. For any Next.js API read `node_modules/next/dist/docs/` | G-03, G-09, G-14 (banned file `middleware.ts`); Review     | plan 05 §1            |
| R-FE-06 | Use the shared components. No raw `<button>`, `<input>`, `<select>`, `<textarea>` or `<a>` in `features/**` and `app/**`                                                                                                                                                                            | G-02 (`no-restricted-syntax`)                              | plan 04 §2.13         |
| R-FE-07 | Tokens only. No hex, rgb or hsl colours, no arbitrary pixel values, no spacing step outside the scale, no default Tailwind palette, no inline colour styles outside `src/styles/`                                                                                                                   | G-04                                                       | plan 04 §2.13         |
| R-FE-08 | One `accent` (copper) button per view; portals use `primary`                                                                                                                                                                                                                                        | G-10 (dev-only count check); Review                        | plan 04 §7.2          |
| R-FE-09 | Implement every state the approved UX defines for the screen: loading, empty, no matches, validation error, success, failed action, auth required, confirmation, rate limited, not found, long text, missing optional data                                                                          | G-10 (visual and axe per state); Review                    | plan 13 §2            |
| R-FE-10 | Forms use the same Zod schema on client and server. Simple forms: `<form action>` with `useActionState`. Complex forms: React Hook Form with `zodResolver`. Keep typed values on failure, focus the first error, disable submit while pending, carry an idempotency key for costly creates          | G-08, G-10; Review                                         | ADR-007, plan 05 §7   |
| R-FE-11 | Filters, sort, pagination and tabs live in the URL. One schema parses `searchParams`; defaults are omitted; params are in canonical order; invalid values are dropped                                                                                                                               | G-05 (`UT-search-schema`)                                  | ADR-012, plan 05 §6   |
| R-FE-12 | Content images use `next/image` with `sizes` and a fixed aspect ratio, and a fallback tile. No raw `<img>`                                                                                                                                                                                          | G-02 (`@next/next/no-img-element`)                         | plan 05 §11           |
| R-FE-13 | TanStack Query only inside client islands that need client caching, optimistic updates or polling. Never for search results or detail pages. No global state library                                                                                                                                | G-02 (restricted imports), G-11 (banned dependencies)      | ADR-006, plan 05 §8   |
| R-FE-14 | No `dangerouslySetInnerHTML`, no inline scripts. User content renders as text only                                                                                                                                                                                                                  | G-02 (`react/no-danger`)                                   | plan 07 §8            |
| R-FE-15 | External links carry `rel="noopener"`; sponsor links `rel="sponsored noopener"` and `https` only                                                                                                                                                                                                    | G-02 (`react/jsx-no-target-blank`); G-05 (`UT-sponsors`)   | plan 07 §8            |
| R-FE-16 | Interactive elements are labelled and keyboard operable; errors are linked with `aria-describedby`; focus is managed after dialogs, drawers and "Show more"                                                                                                                                         | G-02 (`jsx-a11y`), G-10 (axe)                              | plan 08 §6            |
| R-FE-17 | Map view, AI search and PG/hostels sit behind `FLAG_MAP_VIEW`, `FLAG_AI_SEARCH`, `FLAG_PG_LISTINGS` (off by default) and are absent from navigation when off                                                                                                                                        | G-10 (E2E flag-off check)                                  | plan 03 §8, C-19      |
| R-FE-18 | Do not introduce a global store, a CSS-in-JS library or another UI kit                                                                                                                                                                                                                              | G-11 (banned dependencies)                                 | ADR-004, plan 05 §8   |
| R-FE-19 | User-facing copy is whole sentences (no concatenation). Copy outside the approved UX text is flagged in the PR; where it lives is R-FE-21                                                                                                                                                           | Review                                                     | plan 03 §6            |
| R-FE-20 | Build only what the approved UX or addendum shows. If a screen or state is missing, stop and ask                                                                                                                                                                                                    | Review (PR field "UX screen keys")                         | plan 13 §2, `04` §2.1 |
| R-FE-21 | All visitor-facing text lives in `src/i18n/messages/en.json` and is read with `translate('key')`. No literal text in JSX children, in `alt`, `title`, `aria-label`, `placeholder` or `label`, or in page metadata. Server code returns codes and keys, never sentences (ADR-035)                    | G-02 (lint, negative tests), G-10 (text-origin smoke test) | ADR-035, plan 14      |
| R-FE-22 | Message files: keys are plain names grouped by area and named by meaning (`errors.RATE_LIMITED`); whole sentences only; named variables (`{minutes}`); plurals as ICU plural blocks; no HTML; no key without a use; any other language has exactly the keys and variables of `en.json`              | G-21 (`check-messages`)                                    | ADR-035, plan 14      |
| R-FE-23 | Prices, areas and dates are formatted only through `src/lib/format.ts` (₹, lakh and crore, `/mo`, `sq.ft`, India time); the words around the numbers come from `en.json`                                                                                                                            | G-05 (`UT-format`), Review                                 | ADR-035, plan 14      |

## Layers and import boundaries

### 5.1 Responsibilities

| Layer                                   | Responsibility                                          | May contain                                   | Must not contain                               |
| --------------------------------------- | ------------------------------------------------------- | --------------------------------------------- | ---------------------------------------------- |
| `app/`                                  | Routing, composition, metadata, guards at segment level | layouts, pages, handlers (thin)               | queries inline, business rules, Supabase calls |
| `features/*/components`                 | Feature UI                                              | client/server components using `components/*` | direct Supabase access                         |
| `components/ui`                         | Atoms: tokens + behaviour                               | shadcn base, custom atoms                     | domain concepts, data fetching                 |
| `components/patterns`                   | Molecules                                               | field wrappers, price display, pagination     | feature imports                                |
| `components/layout`, `domain`, `charts` | Organisms shared by several features                    | header, PropertyCard, Gallery, SearchCard     | feature-specific rules                         |
| `features/*/queries.ts`                 | Typed reads with explicit columns                       | `server-only` Supabase calls                  | writes                                         |
| `features/*/service.ts`                 | Business rules + writes                                 | call RPCs, enforce rules, audit               | UI, request objects                            |
| `features/*/actions.ts`                 | Entry points for the UI                                 | `defineAction()` only                         | logic beyond orchestration                     |
| `features/*/schemas.ts`                 | Contracts                                               | Zod                                           | framework imports                              |
| `server/`                               | Infrastructure                                          | Supabase factories, adapters, env, logging    | UI                                             |
| `lib/`                                  | Pure helpers                                            | format, URL, cn                               | server secrets                                 |
| `types/`                                | Generated + domain types                                | types only                                    | runtime code                                   |

### 5.2 Import rules (enforced by ESLint)

| From ↓ / may import →                | `components/ui` | `components/patterns,layout,domain,charts` | `features/*` (via index)   | `server/`             | `lib/` | `types/` | `styles/` |
| ------------------------------------ | --------------- | ------------------------------------------ | -------------------------- | --------------------- | ------ | -------- | --------- |
| `components/ui`                      | ✔               | ✘                                          | ✘                          | ✘                     | ✔      | ✔        | ✘         |
| `components/patterns…`               | ✔               | ✔                                          | ✘                          | ✘                     | ✔      | ✔        | ✘         |
| `features/*/components`              | ✔               | ✔                                          | ✔ (other modules' `index`) | ✘                     | ✔      | ✔        | ✘         |
| `features/*/queries,service,actions` | ✘               | ✘                                          | ✔ (`index`)                | ✔                     | ✔      | ✔        | ✘         |
| `app/`                               | ✔               | ✔                                          | ✔ (`index`)                | ✔ (server files only) | ✔      | ✔        | ✔         |
| `server/`                            | ✘               | ✘                                          | ✘                          | ✔                     | ✔      | ✔        | ✘         |

Additional rules:

- `*.client.tsx` (or any file with `"use client"`) **cannot import** `server/`, `*.server.ts`, `queries.ts`, `service.ts`.
- `server/supabase/admin.server.ts` (service role) may be imported **only** from an allow-list: `features/{builders,forms,crm,media}/service.ts`, `server/rate-limit`, `app/api/**/route.ts` listed in `07 §4.3`. Anything else fails lint.
- `.select('*')` and `.select()` without columns are banned in `features/**`.
- Hard-coded colours, `px` arbitrary Tailwind values and inline colour styles are banned outside `src/styles/` (`scripts/check-tokens.mjs`, also in CI).
- Each feature has a single `index.ts`; deep imports from another feature fail lint.

Tooling: `eslint-plugin-boundaries` (v5+, ESLint 9 flat config; chosen over `eslint-plugin-import` zones, which has no native flat-config support: harness `CH-03`), `no-restricted-imports`, `no-restricted-syntax`, plus the `server-only` and `client-only` packages for runtime guards. The full rule-to-check design is in `../property-platform-ai-harness/05` §3.

## Conventions

| Topic           | Convention                                                                                                                                                                                                                |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Files           | `kebab-case.ts(x)`; one exported component per file, named export; `index.ts` only at feature roots                                                                                                                       |
| Components      | `PascalCase`; props type `ComponentNameProps`; variants with `cva`; `className` forwarded via `cn`                                                                                                                        |
| Client files    | `*.client.tsx` (and `"use client"`); keep them leaf-like and small                                                                                                                                                        |
| Server-only     | `*.server.ts` or `import 'server-only'` at top                                                                                                                                                                            |
| Types           | `type` aliases for data, `interface` for extendable props; no `any`; no `enum` (use `as const` unions); DB row types from generated file, **domain types are mapped in `queries.ts`** so UI never depends on column names |
| Tests           | Co-located `__tests__/name.test.ts(x)`; E2E in `e2e/`; pgTAP in `supabase/tests/`                                                                                                                                         |
| Constants       | Vocabularies (`PROPERTY_TYPES`, `AMENITIES`, label thresholds) live in `config/vocab.ts` and are the single source for Zod enums, Postgres checks (checked by a test), and UI options                                     |
| Strings         | All visitor-facing text in `src/i18n/messages/en.json`, read with `translate('key')` (R-FE-21, R-FE-22); sentences whole, never concatenated                                                                              |
| Dates and money | Stored UTC / integer rupees (`bigint`); formatting only through `src/lib/format.ts` (₹, lakh/crore, `/mo` for rent; R-FE-23)                                                                                              |
| Comments        | Explain _why_; reference requirement/ADR IDs (`// BR-41`, `// ADR-024`) at rule sites                                                                                                                                     |
| Commits / PRs   | Conventional commits; PR template lists requirement IDs, UX screen keys, tests, security checklist                                                                                                                        |

TypeScript baseline: `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `verbatimModuleSyntax`, `isolatedModules`, path alias `@/*`.

## Server and Client Component boundaries

**Rule:** a file is a Server Component unless it needs state, effects, event handlers on rich widgets, or a browser API.

| Surface                                   | Server                      | Client island                             | Why                                                           |
| ----------------------------------------- | --------------------------- | ----------------------------------------- | ------------------------------------------------------------- |
| Page shells, layouts, metadata            | ✔                           |                                           | SEO, no JS cost                                               |
| Property/project lists and detail content | ✔                           |                                           | Server-rendered for search traffic                            |
| Header (links, CMS)                       | ✔                           | Avatar menu, mobile drawer toggle         | Menus need interaction                                        |
| Search card                               | form shell ✔                | Combobox, segmented, selects (controlled) | Interaction and URL push                                      |
| Filter rail / sheet                       |                             | ✔                                         | Applies immediately and updates URL                           |
| Property card                             | ✔ (markup)                  | Heart toggle, Compare toggle              | Only the two controls are interactive                         |
| Gallery                                   |                             | ✔                                         | Arrows, keys, swipe                                           |
| Enquiry card                              | ✔ (state decided on server) | Form                                      | Signed-in state resolved server-side; form is a client island |
| Compare store/bar                         |                             | ✔                                         | `localStorage`                                                |
| Wizard, upload zone                       |                             | ✔                                         | Complex form state, file API                                  |
| Charts, form-builder (dnd-kit), map       |                             | ✔ (`dynamic`, `ssr:false` for map)        | Libraries need the browser                                    |
| Portal tables                             | ✔ initial                   | Row actions, drawers, live filters        |                                                               |

Practices:

- **Push `"use client"` to the leaves.** Pass server-rendered children into client wrappers instead of converting a whole page.
- **Serialise only what is needed** across the boundary (IDs, small view models), never raw DB rows.
- **No secrets, no `process.env` reads** in client files. Public configuration comes from `lib/public-env.ts`.
- Client files end in `.client.tsx` and are import-restricted (`03` §5.2).

## URL-driven search, filters, sorting and pagination

### 6.1 Search parameter contract (`/properties`)

Names follow Phase 1 (BR-91) so tests and links from the analysis stay recognisable.

| Param          | Type         | Values / rule                                          | Default        | Notes                                          |
| -------------- | ------------ | ------------------------------------------------------ | -------------- | ---------------------------------------------- |
| `listingType`  | enum         | `sale` \| `rent`                                       | omitted = both | UX "Looking to": All / Buy / Rent              |
| `propertyType` | enum         | `apartment` `villa` `house` `plot` `commercial`        | omitted        |                                                |
| `bhk`          | int          | 1–4 (single value, not a range)                        | omitted        |                                                |
| `maxPrice`     | int (₹)      | ≥ 0; presets differ for sale vs rent (UX P18)          | omitted        | `minPrice` accepted by schema, not shown in UI |
| `place`        | string       | label of the picked suggestion (display only)          |                |                                                |
| `lat`, `lng`   | number       | WGS84; both or neither; Tamil Nadu bounds validated    |                | from picked suggestion                         |
| `r`            | number (km)  | 1–50                                                   | 5              | radius around `lat,lng`                        |
| `locality`     | string ≤ 80  | text match fallback                                    |                |                                                |
| `q`            | string ≤ 120 | keyword (title/locality/address)                       |                |                                                |
| `label`        | enum         | `featured` \| `prime` \| `budget`                      | omitted        | computed per BR-92                             |
| `sort`         | enum         | `newest` \| `price_asc` \| `price_desc` \| `area_desc` | `newest`       |                                                |
| `show`         | int          | 12…120, multiples of 12                                | 12             | "Show more" (`DEC-11`)                         |
| `view`         | enum         | `grid` \| `list`                                       | `grid`         | presentation only; also remembered per visit   |
| `bbox`         | `w,s,e,n`    | map viewport (map view only)                           |                | `S4b`                                          |

Rules:

1. One Zod schema (`features/search/schemas.ts`) parses `searchParams` on the server and the client. **Invalid values are dropped, not thrown**, and the page shows an "invalid filter removed" notice only when relevant; the canonical URL is rewritten.
2. Defaults are omitted from the URL. Param order is canonical (alphabetical) so the same search always has one URL (used for canonical tag and cache).
3. Filter changes: `router.replace` (no history spam) with `scroll:false` on desktop rail; on mobile the sheet applies on "Show N homes" and pushes once. "Clear all" removes every filter param but keeps `sort`/`view`.
4. "Back from a property returns to the same scroll position with the same filters" (UX): rely on App Router scroll restoration; ensure list URL carries `show` so the same cards re-render.
5. Active-filter chips are derived from the parsed params, so they cannot disagree with results.
6. The count line ("48 homes found in Velachery, Chennai") comes from the RPC's total, not a separate query.
7. **Empty/invalid states:** no matches → illustration + "Clear all filters" + (AI link only when flagged); failed load → alert with Try again, filters preserved (UX §2).

### 6.2 Sorting and pagination

- `sort` maps to `ORDER BY` in the RPC with a stable tiebreaker (`id`) so "Show more" never duplicates or skips.
- `show` is a bounded count; the RPC returns `{ items, total }`. UI shows "Showing N of total" with a progress bar; **focus moves to the first newly added card** after "Show more".
- Beyond `show=120`, the button changes to "Refine your search" (prevents unbounded queries).

### 6.3 Shareable URLs

All filters live in the URL (UX principle 4). Compare uses `?ids=a,b,c` (max 3). Dashboard uses `?tab=`. Auth uses `?redirect=` (§13).

## Forms

| Pattern                 | Use for                                                                    | Mechanism                                                                                            |
| ----------------------- | -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| **Simple server form**  | contact form, project lead, enquiry, password reset                        | `<form action>` + `useActionState`; progressive enhancement; field errors returned in `ActionResult` |
| **Complex client form** | post-property wizard, project form, form builder, CMS editors, unit drawer | React Hook Form + `zodResolver` (same schema as server); submit through a Server Action              |
| **Search/filter form**  | search card, rail                                                          | Controlled client state that writes URL params (no submit action)                                    |

Shared behaviours (implemented in `FormField` and a `useFormFeedback` helper):

1. **Never lose typed values** on failure (RHF keeps state; `useActionState` re-renders with submitted values).
2. Validate on submit and on blur of an edited field; on invalid submit, **focus the first error** and render an error summary on long forms.
3. Server `fieldErrors` are mapped back to fields (`setError`).
4. Disable the submit button while pending; show `loading` on the button (width held); prevent double submit (`§10`).
5. Required/optional marking exactly as UX; input modes and `autocomplete` tokens set per field.
6. Phone/email normalisation happens in the Zod schema (`transform`), so client and server agree.
7. Wizard: **validates the current step only**; Back never loses data; draft persisted server-side (`DEC-09`) with `Save draft` toast; mobile sticky footer.
8. Validation rules to carry (from the UX/ANA): enquiry name 2–80, phone 6–15 digits, email optional, message ≤ 1000; listing title 8–140, locality 2–80, address ≤ 300, bathrooms 0–10, price ≥ 0, area ≥ 0, ≤ 6 photos, ≤ 20 amenities (UI offers the 12 known amenities).
