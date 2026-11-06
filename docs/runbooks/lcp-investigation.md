# Mobile LCP investigation (S4-T12 follow-up)

Done on 6 Nov 2026 on the owner's Windows machine, from `develop` after PR #92, with a production build and `next start`. **Investigation only: nothing in the app was changed.** The experiments below were made on throwaway local edits that were reverted; nothing from them is committed. Read `performance-baseline.md` first; this page explains its LCP finding.

## The short answer

1. **The 4.3 to 4.7 s in the baseline is Lighthouse's estimate, not what a browser measured.** Lighthouse's default ("simulated") mode loads the page quickly, then calculates what it would have cost on slow 4G with a 4x slower CPU, and that calculation is pessimistic about script. When the browser itself is slowed to the same profile ("applied" throttling), LCP is **2.2 to 2.5 s** on all three list pages. Without any throttling it is **0.3 to 0.9 s**.
2. **Script size is not what holds LCP up.** With every JavaScript file blocked, the applied LCP stays at 1.9 to 2.3 s. The 1 MB of script is still worth trimming (see TBT below), but trimming it will not by itself fix LCP.
3. **What sets the time is the number of steps in a row before text can be painted**: the page, then its stylesheet (render-blocking), then the fonts. Lighthouse's applied profile adds about 0.56 s to every request, so each step in a row costs about half a second.
4. **A check that fails from its first day.** If a later Lighthouse CI job uses the default simulated mode with LCP at 2.5 s, it will fail on every page even after sensible script trimming (with no script at all the simulated LCP of `/` is still 3.2 s). Judge LCP with field data (Vercel Speed Insights, or PageSpeed Insights on a preview) and use the lab only to compare runs.
5. **`/projects` and `/properties` have a real, small layout shift**: the footer moves down once when the streamed page replaces the loading outline.

## How it was measured (and one mistake to avoid)

- Lighthouse 12.8.2 through `npx`, mobile profile, 3 runs per page and setting, median shown. Local production build against the `findsprop-dev` project (no data in it, so every page is in its empty state).
- Three settings: **simulated** (the default, as in the baseline), **applied** (`--throttling-method=devtools`) and **unthrottled** (what the browser measured before any modelling, from the same runs).
- **Run everything under Node 24** (`.nvmrc`). Under Node 26 the server's Supabase reads fail after about 7 s: `/projects` then shows "We couldn't load projects" and the homepage leaves its data sections out. The first runs of this investigation were made by mistake under Node 26 and were thrown away. On this machine the plain shell's `node` is v26; use `fnm exec --using=24.22.2 ...`.
- Noise: the same page measured twice on the same build differs by about 60 to 80 ms (applied) and about 100 ms (simulated). A change smaller than that is not a finding.

## Where LCP stands (Node 24, medians of 3)

| Page          | Simulated LCP | Applied LCP | Unthrottled LCP | Largest element        |
| ------------- | ------------- | ----------- | --------------- | ---------------------- |
| `/`           | 4284 ms       | 2457 ms     | 0.34 to 0.36 s  | the hero headline      |
| `/properties` | 4172 ms       | 2285 ms     | 0.53 to 0.89 s  | the "no match" line    |
| `/projects`   | 4112 ms       | 2265 ms     | 0.35 to 0.54 s  | the "no projects" line |

A second applied sample on the same build gave 2399 ms (`/`) and 2207 ms (`/properties`), which is the noise level above. In the applied runs the first paint and the largest paint arrive together (the text is painted once), so there is no late swap of a big element.

## What decides the time

**The chain.** On every page the order is: the page (about 45 KB compressed), then the stylesheet (17 KB, render-blocking, Lighthouse estimates 110 to 160 ms), and on `/properties` and `/projects` the three preloaded font files (about 166 KB) join that chain. In the simulated mode that moves the first paint on those two pages from about 1.1 s to about 2.1 s; the homepage first paint does not wait for them.

**Scripts.** 28 script files, about 1 MB raw and 320 KB gzip, are loaded on every public page, though the page's own code is only 0 to 30 KB of it. All scripts load asynchronously, so they do not delay the first paint; they delay the page becoming usable (TBT 160 to 300 ms, Lighthouse's "good" is 200 or less).

| Setting       | `/` with scripts | `/` with no script | `/properties` with scripts | `/properties` with no script |
| ------------- | ---------------- | ------------------ | -------------------------- | ---------------------------- |
| Applied LCP   | 2399 ms          | 2270 ms            | 2207 ms                    | 1904 ms                      |
| Simulated LCP | 4284 ms          | 3209 ms            | 4172 ms                    | 2560 ms                      |
| TBT           | 205 ms           | 0                  | 85 ms                      | 0                            |

So the most that removing every script could give is about 0.13 to 0.30 s of real LCP, and about 1.1 to 1.6 s of the simulated number.

**What the script is made of** (the analyzer's count for `/projects`, 1236 KB raw, all chunks of the route):

| Part                                             | Raw    | gzip   | Where it comes from                                                                                                        |
| ------------------------------------------------ | ------ | ------ | -------------------------------------------------------------------------------------------------------------------------- |
| Next.js and React                                | 597 KB | 227 KB | the framework; not reducible by us                                                                                         |
| `zod`                                            | 102 KB | 33 KB  | the search card: `search-navigation.client.tsx` imports `params.ts`, which imports the zod schemas in `schemas.ts`         |
| Stylesheet                                       | 81 KB  | 15 KB  | `globals.css`                                                                                                              |
| `tailwind-merge`                                 | 55 KB  | 17 KB  | `cn()` in every component                                                                                                  |
| `sonner` (toasts)                                | 34 KB  | 9 KB   | the toast area mounted in the root layout, on every page                                                                   |
| Message catalogue and its message-format parsers | ~60 KB | ~21 KB | the whole catalogue is sent to the browser, and also written into the page HTML                                            |
| `features/auth`                                  | 21 KB  | 10 KB  | the header's account menu and sign-out button; whether the `@/features/auth` barrel file also pulls in more was not traced |
| `cmdk`                                           | 11 KB  | 4 KB   | the locality picker                                                                                                        |

## Experiments (local, reverted)

All against the same baseline, medians of 3, `/` and `/properties`.

| Experiment                                   | `/` simulated | `/properties` simulated | `/` applied | `/properties` applied | Verdict                                                                                                                           |
| -------------------------------------------- | ------------- | ----------------------- | ----------- | --------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Baseline                                     | 4284          | 4172                    | 2457 / 2399 | 2285 / 2207           |                                                                                                                                   |
| (a) fonts `display: "optional"`              | 4325          | 4290                    | 2380        | 2156                  | no gain (inside the noise) and a plain font on a first visit                                                                      |
| (b) Fraunces without its italic file         | 3961          | 3724                    | 2319        | 2201                  | small gain (80 to 140 ms applied); changes how the emphasis words in headings look                                                |
| (c) only needed messages sent to the browser | not built     |                         |             |                       | not safe to do mechanically: several client components read the whole catalogue; estimated gain 10 to 25 KB per page, about 0.1 s |

## Layout shift (CLS)

On `/projects` the whole CLS of 0.094 is one shift of the **footer**, which moves down once when the streamed page replaces the loading outline (the outline is shorter than the real content). On `/properties` the same shift appeared once in three runs at 0.103, which is over the 0.1 limit. With real data the size will change. A fix is to give the loading outline the height of a typical result.

## Options, ranked

None of these is started. Each would be its own plan.

1. **Measure with the right tool (no code).** Take the field number (Vercel Speed Insights after launch, PageSpeed Insights on a preview before it) as the judge of NFR-01. If a Lighthouse CI job is added, do not gate on the simulated LCP of 2.5 s; use it to compare runs, or gate on the applied number. This belongs in the gated change you already plan before launch.
2. **Trim the shared script (a small plan, measured gain only for TBT and the simulated number).** The candidates are loading the toast area and the locality picker only when needed (about 13 KB gzip together), tracing what the auth barrel file pulls in (up to 10 KB gzip), and keeping the zod schemas out of the search card's address helpers (up to 33 KB gzip). All sizes are estimates, and none of these was tried. Expected real LCP gain: under 0.15 s.
3. **Loading outline height (small, with visible pictures).** Fixes the footer shift; touches `loading.tsx` of `/properties` and `/projects`, so the screenshots change and need your approval.
4. **Drop the Fraunces italic (design decision).** About 0.1 s real, 0.3 to 0.45 s simulated. It changes the look of the emphasis words, so it is yours to decide.
5. **Fewer steps before text** (not tested): inlining the critical stylesheet or removing a font from the chain. This is the only idea aimed at the real cause, but it needs tooling this repo does not have, so it should only be tried if the field numbers on a preview show a problem.

## What was not done

- A home page and a project page were not measured: `findsprop-dev` has no data.
- The lab is one laptop; a real phone on a real network will differ, and the applied profile is harsher than a real 4G link (it adds about 0.56 s per request where a real link adds 0.05 to 0.15 s).
- No Lighthouse CI, size check or workflow was added.
