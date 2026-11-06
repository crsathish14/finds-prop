# Performance baseline (S4-T12)

Measured on 6 Nov 2026 on the owner's Windows machine, from the `develop` branch after PR #91, with a production build (`npm run build`, then `next start`). **Nothing here is enforced.** It records where Stage 4 ended, proposes budgets, and says how to measure again. Enforcing budgets (a Lighthouse CI job, a per-route size check) is a CI change and waits for the owner.

## Read this first: what the numbers are not

- **No data.** The `findsprop-dev` project has no homes, projects or builders yet, so every page was measured in its empty state. A real home or project page was **not** measured at all (no row to open). The lists have no photos, so a photo as the largest element is missing from these numbers.
- **A lab on one laptop.** Lighthouse 12.8.2, mobile profile, simulated throttling (slow 4G, 4x slower CPU), `localhost`, so the server answers in about 10 ms. A phone on a real network will differ. These are for comparing later runs on the same setup, not for promising a score.
- **Not the field.** NFR-01 is about field data (p75). Vercel Speed Insights will give that after launch.

Repeat the measurement with real data and on a preview before launch (S9), and replace this page's numbers then.

## 1. JavaScript loaded on first visit, per route

From `.next/diagnostics/route-bundle-stats.json`, written by `npm run build` (Next.js 16 no longer prints sizes). "First load" is every script chunk the page needs before it works; gzip and brotli are what the chunk files compress to (a server sends one or the other).

| Route                                                      | Raw     | gzip   | brotli |
| ---------------------------------------------------------- | ------- | ------ | ------ |
| `/` (homepage)                                             | 1030 KB | 328 KB | 286 KB |
| `/properties` (results)                                    | 1030 KB | 328 KB | 286 KB |
| `/properties/[slug]`                                       | 1004 KB | 317 KB | 277 KB |
| `/projects`                                                | 1011 KB | 319 KB | 279 KB |
| `/projects/[slug]`                                         | 1022 KB | 324 KB | 283 KB |
| `/compare`                                                 | 1004 KB | 317 KB | 277 KB |
| `/contact`, `/privacy`, `/terms`, `/cookies`, `/ai-search` | 1002 KB | 316 KB | 276 KB |
| `/auth`, `/dashboard`, `/post-property`                    | 795 KB  | 252 KB | 219 KB |
| `/admin/*`, `/builder/*` (placeholders)                    | 682 KB  | 212 KB | 184 KB |
| `/design-system/*` (internal)                              | 1232 KB | 383 KB | 331 KB |

What it shows: **every public page starts from about 1 MB raw (about 320 KB gzip)**, and the page's own code adds only 0 to 30 KB on top. The weight is a shared set of chunks that every page loads (not yet traced to its contents; the likely parts are the header, the footer, the search card, the message catalogue and the form components), which is why `/contact`, which holds almost nothing, weighs the same as the results page. That is the first place to look if a budget is ever tight (for example, whether each page needs the whole message catalogue, or the search card on pages that have none).

## 2. Lighthouse, mobile, median of 3 runs

| Page          | Score (3 runs) | FCP   | LCP (3 runs)            | TBT    | CLS       | Largest element        |
| ------------- | -------------- | ----- | ----------------------- | ------ | --------- | ---------------------- |
| `/`           | 77 / 58 / 77   | 1.1 s | **4.4 s** (4.3/4.4/4.4) | 348 ms | 0.000     | the hero headline      |
| `/properties` | 74 / 81 / 81   | 2.3 s | **4.3 s** (4.7/4.1/4.3) | 196 ms | 0.000     | the "no match" line    |
| `/projects`   | 76 / 75 / 75   | 2.3 s | **4.7 s** (4.7/4.3/4.7) | 211 ms | **0.094** | the "no projects" line |

Page weight on the wire was about 650 KB on each, with no photos.

Against NFR-01 (LCP 2.5 s or less, CLS 0.1 or less; INP is a field measure):

- **LCP is about 4.3 to 4.7 s on all three, well over 2.5 s**, with nothing heavy on the page: the largest thing is text. So the time is not a photo. The gap between first paint (1.1 to 2.3 s) and the largest text (4.3 s or more) points at what blocks or delays that text: the size of the JavaScript above, the order the page streams its parts, and the font. This is a finding, not fixed here. **It was investigated afterwards: see `lcp-investigation.md`.** In short, 4.3 to 4.7 s is Lighthouse's simulated estimate; with the browser throttled to the same profile LCP is 2.2 to 2.5 s. It needs a look with real data, because a real photo will usually be the largest element and move the number.
- **CLS on `/projects` is 0.094**, just inside the 0.1 limit. Something moves late on that page (not traced; the empty-state block appearing after the list loads is a guess). Worth a look before real content is added.
- **TBT is 196 to 348 ms** (Lighthouse's "good" is 200 ms or less), highest on the homepage. Consistent with the 1 MB of script.
- The first homepage run scored 58 against 77 for the other two; the cause was not found (other work on the machine is possible). Use the median, and expect run-to-run noise of about 10 points.

## 3. Proposed budgets (not enforced)

`test-catalogue.md` asks for per-route budgets set from this baseline plus 10 %.

**First-load JavaScript** (gzip, the strictest honest unit; raw in brackets):

| Route                            | Budget           |
| -------------------------------- | ---------------- |
| `/`, `/properties`               | 361 KB (1133 KB) |
| `/projects`                      | 351 KB (1112 KB) |
| `/projects/[slug]`               | 356 KB (1124 KB) |
| `/properties/[slug]`, `/compare` | 349 KB (1104 KB) |
| other public pages               | 348 KB (1102 KB) |

**Lighthouse (mobile profile):** the target is NFR-01, not baseline plus 10 %, because the baseline already fails it. Proposed: LCP at or under 2.5 s and CLS at or under 0.1 on `/`, `/properties`, one home page and one project page, and TBT at or under 200 ms. Set the Lighthouse limits only after the LCP finding above is understood and real data is in, or the check would fail from its first day.

## 4. How to measure again

0. Use **Node 24** (`.nvmrc`). Under Node 26 the server's Supabase reads fail after about 7 s and the pages show their failed-load state (details in `lcp-investigation.md`).
1. `npm run build` with the real `.env.local` (a build with CI's placeholder values has no data to show). `route-bundle-stats.json` is then in `.next/diagnostics/`; sum the compressed size of the files in `firstLoadChunkPaths` for a route (gzip level default, brotli default) to get the table in section 1.
2. `npx next start -p 3100`, and make sure nothing else listens on that port.
3. `npx lighthouse@12.8.2 http://localhost:3100/<path> --only-categories=performance --output=json --chrome-flags="--headless=new --no-sandbox"` with `CHROME_PATH` set to a Chrome install, three runs per page, and take the median. It is downloaded and run with `npx`; nothing is added to the repo.
4. Stop the server afterwards (on Windows a stopped `next start` can leave its child process listening on the port; check with `Get-NetTCPConnection -LocalPort 3100`).

For a real check, point step 3 at a preview deployment once there is one, and add Vercel Speed Insights for field data after launch.

## Not done, and why

- A home page and a project page were not measured: no data in `findsprop-dev`.
- No Lighthouse CI, no size-check script and no workflow job: new dependency and CI or `scripts/` changes, which the owner asked to keep out for now. The plan is to do them in a gated change before launch, once a preview exists.
