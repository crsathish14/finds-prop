# ADR-048 · Cache tags and what a change refreshes (S4-T11)

- Status: Accepted
- Date: 2026-11-06
- Related: ADR-003 (the rendering and caching model), ADR-041, ADR-042, ADR-043, ADR-046 (the cached reads), ADR-017 (public projections), R-BE-11, `docs/engineering/backend.md` (rendering, caching and revalidation)
- Plan approved by the owner on 6 Nov 2026 with the recommended answer for each decision: keep the tag names the reads already use, and leave search results cached for minutes as ADR-042 decided.

## Decision

- **One file names every cache tag** (`src/lib/cache-tags.ts`). Four fixed tags keep the values the first reads were built with, so nothing already cached changes: `home-listings` (every list of homes: the homepage sections, the results page, the sitemap and each home page), `home-projects` (the homepage's developers), `projects` (the projects list, every project page and the sitemap's projects) and `site-settings` (the site content). Two builders name a single page: `property:{shortId}` and `project:{slug}`.
- **The names in `backend.md` are superseded.** It lists `listings:home`, `property:{id}`, `projects:live` and `project:{slug}`; they were written before any read existed. The built names above are the ones in force (`property:{id}` became `property:{shortId}`, because the short id is what the page is read by). `docs/engineering/backend.md` is protected, so its table is left as it is until the owner asks for it to be brought in line.
- **A home page and a project page carry two tags**: the shared one and their own. A sold, rented, rejected or edited home can leave its page and every list at once, and a project's own page can be refreshed without touching the others.
- **Three helpers say what a change touches**, so an action does not have to remember: `tagsAfterListingChange(shortId)` (every list of homes and the home's page), `tagsAfterProjectChange(slug)` (the projects list and sitemap, the project's page and the homepage's developers) and `tagsAfterSiteSettingsChange()`. An action lists them in its `invalidate` setting, and the action pipeline refreshes them after the write (`updateTag`, which Next.js 16 allows only inside a Server Action). No action writes public data yet (approving and editing are Stages 6 to 8), so the helpers have no caller until then.
- **Search results stay cached for minutes** under `home-listings` (ADR-042), although `AGENTS.md` and R-BE-11 say "search results are never cached". The owner kept the ADR-042 decision on 6 Nov 2026; the helper refreshes them with the lists of homes, so a sold home leaves the results at once, not after the minutes are up.

## Tests (`IT-cache`)

`src/lib/__tests__/cache-tags.test.ts` checks the fixed names, the three lists, and by reading the source that every `cacheTag(...)` in the app uses a central tag and that a helper refreshes that tag; a new cached read with a tag nobody refreshes fails it. The existing query tests check each read's tags. **Not tested: an actual eviction.** That needs a running app with a database, which the pipeline does not have; it is for the first real moderation action (Stage 7) to prove.

## Not done

- A builder being deactivated hides all of its projects at once (BR-94). The `projects` and `home-projects` tags already cover it, but no helper names it; add one with the builder admin actions in Stage 8.
- The per-user parts of a page (save hearts, compare state, enquiry state) are never cached.
