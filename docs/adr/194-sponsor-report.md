# ADR-194 · The sponsor report: views and clicks of the paid placements

- Status: Accepted (owner decisions of 23 Nov 2026 on the sponsor ads redesign, "views/clicks report in the admin"; the owner said "Start PR 8" on 24 Nov 2026; the new words await approval).
- Date: 2026-11-26
- Related: ADR-190 (the hero ads), ADR-192 (the Featured project card), ADR-193 (the Developer spotlight), ADR-191 (the picks), BR-75 (the visitor hash), ADR-124 (retention)
- Class: C2 (a new table, a counting action open to visitors, a new admin page). No dependency.

## Context

The owner wants a report of how many people saw and clicked each paid placement, so a sponsor can be shown what they got. There are three: the hero ad under the search (Showcase, Cinematic or the Split layout's picture), the Featured project card after the sixth result, and the Developer spotlight on the home page.

## Decision

- **What counts.** A view is counted when at least half of the placement has been on screen for a second (the usual ad measure), from the browser, so a crawler reading the HTML is not counted; a hero ad waiting its turn in the rotating frame is not on show and is not counted. A click is a followed link inside the placement (View project, Request a call back, the website, a project card). Each person is counted once a day (India time) per placement and sponsor for views, and once for clicks: reloading or coming back that day adds nothing. The hero ads are counted by the ad's id; the Featured card and the spotlight by the builder's or agent's id.
- **The database** (`20261126120000_sponsor_report.sql`): `sponsor_stats` holds the daily totals (day, placement, sponsor, views, clicks), with no visitor in them. `sponsor_seen` holds who was counted, as the rate limiter's one-way visitor hash (BR-75), for the current day only, to tell a repeat: the first count of a new day clears the earlier days, so no separate retention rule is needed. Both tables are closed to everyone. `record_sponsor_event()` counts (service role only); `admin_sponsor_report(from, to)` sums the days of a period, a year at most, for the super admin only.
- **The counting action** (`trackSponsorEvent`, open to visitors like `trackProjectEvent`): limited to 60 per visitor per minute (`sponsor_event`). It counts only a sponsor that is live now (an active hero ad, a builder picked for that placement), so the report cannot be filled with made-up sponsors. It calls the database with the service role, so `features/sponsored/service.ts` joins the service-role allow-list (lint and `docs/engineering/security.md` 4.3). A count that cannot be sent is dropped without a word to the reader.
- **The counting part** (`SponsorTracker`, layout, client): a plain wrapper around a placement, handed the action by the page. It draws nothing (so it has no Design Lab entry). The hero frames (`SponsorStyledFrame`, and `SponsorFrame` through `SponsorSlot` for the Split layout) wrap each ad in one; the homes and projects lists wrap the Featured card; the spotlight section wraps the spotlight. In the Design Lab no action is handed, so nothing is counted.
- **The report** (`/admin/sponsor-report`, in the admin menu after Sponsored builders): the last 7, 30 or 90 days (`?days=`, 30 by default) and the days they cover; for each placement a table of sponsors with views, clicks and click rate (clicks per hundred views). Every sponsor shown now has a row, with zeros until counted; a sponsor no longer shown that was counted in the period follows, marked "Not shown now" (a deleted ad is "Removed sponsor"). Read as the admin, never cached.
- Not in this change: counting enquiries that came from a sponsor (the plan's `ref=sponsor` mark on an enquiry). Clicks on "Request a call back" are counted as clicks.

## Words (new, awaiting the owner's approval)

`admin.nav.sponsorReport`: "Sponsor report". `admin.sponsorReport.*`: "Sponsor report"; "How many people saw and clicked each paid placement. Use it to show sponsors what they got."; "Period"; "Last {count} days"; "{from} to {to}"; "Hero ads", "The ads under the search on the home page."; "Featured project card", "The card after the sixth result on the homes and projects lists, counted by builder or agent."; "Developer spotlight", "The band on the home page, counted by builder or agent."; "Sponsor", "Views", "Clicks", "Click rate", "{rate}%", "–"; "Removed sponsor"; "Not shown now"; "No sponsors in this placement yet."; the note on how people are counted.

## Consequences

- Tests: pgTAP `sponsor_report.test.sql` (closed tables, counting once per visitor per day, clearing earlier days, refused input, the report's sums, range and role); the counting part (seen for a second, a glimpse, waiting its turn, a click, no action, a failure); the counting rule and input; the report's periods, India dates, rows and click rate; the report page; the action inventory, the rate limits and the admin menu.
- The counts start from zero when this is deployed; nothing earlier can be counted.
- Rollback: revert this change and drop the two functions and the two tables; the counts are lost.
