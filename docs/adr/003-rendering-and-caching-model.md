# ADR-003 · Rendering and caching model — **Approval required (`DEC-10`)**

- Status: Proposed
- Date: 2026-10-29
- Related: Proposed; approval: **Yes (`DEC-10`)**; stage S1

> Awaiting spike S1-SPK-01 (DEC-10).

## Record

- **Context:** Public pages are mostly the same for everyone (property detail, projects, homepage sections) but the header, save hearts and enquiry card are per user. Next 16 offers opt-in **Cache Components** (`cacheComponents: true`, `"use cache"`, `cacheLife`, `cacheTag`, Partial Prerendering).
- **Options:** (A) Adopt Cache Components from day one: static shell + `<Suspense>` holes for user state; public reads use a cookie-less Supabase client inside `"use cache"` with tags; mutations call `updateTag()`/`revalidateTag(tag,'max')`. (B) Stay on the default dynamic model; cache selected reads with `unstable_cache`/`fetch` options.
- **Recommendation:** **A**, validated by a Stage 1 spike (`S1-SPK-01`) that proves a Supabase-cookie session, a cached public listing and a per-user save heart coexist without "blocking route" errors. Fall back to **B** if the spike fails.
- **Benefits:** fast first paint for search traffic; explicit cache semantics; fits the "ad decided with the page" principle (UX §1.5).
- **Risks:** newer model; every dynamic access must sit under `<Suspense>`; team learning cost. Mitigation: conventions in `05 §3`.
