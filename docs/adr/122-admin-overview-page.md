# ADR-122 · The admin's Overview page, connected (S7-T06 part 3)

- Status: Accepted (the wording below waits for the owner's confirmation)
- Date: 2026-11-11
- Related: ADR-120 (the chart parts and "Updating" instead of dimming), ADR-121 (the numbers, in the database), ADR-097 and ADR-098 (the builder's pages, built the same way), FR-ADM-01
- Plan for S7-T06 and for this part approved by the owner on 11 Nov 2026 ("approved"), with the defaults listed below.

## Decision

- **A server page and one island.** `/admin/dashboard` reads the dates from the address, makes one call to `admin_overview()` as the signed-in admin, checks the answer with Zod, and hands the island the numbers (or that the read failed). The island (`AdminOverview`) draws the Insights panel, the line chart with its Chart / Table card, the share bar, the horizontal bars and the recent leads, from the parts of ADR-120. It keeps nothing the server does not also know, except the last numbers that arrived (below).
- **The dates are in the address,** as on the builder's pages: `?range=today|yesterday|7|month|custom`, with `&from=&to=` for a custom range. The default (30 days) is left out of the address. "Today" and "Yesterday" are one India day each; "7 days" and "30 days" end today and count today; "This month" is the 1st to today; "Custom" takes two real days, the first not after the second, up to a year. Anything else is 30 days, so a mistyped address still shows the page. The helpers for India days moved to `src/lib/india-days.ts`, shared with the builder's pages (their exports and tests are unchanged).
- **Choosing a date reads the page again,** inside a React transition, so the numbers already on screen stay, are not clickable, and an "Updating the numbers…" line with a spinner (read aloud as a status) shows until the new ones arrive (ADR-120: dimming text fails the contrast rule).
- **A read that fails does not throw.** The page catches it (Next's own signals, such as a redirect, are passed on), the reading code has already logged why, and the island shows the notice "We couldn't load the overview" with "Try again" (the page is read again). If numbers had arrived before, they stay under the notice and it says they are from the last successful load; if none ever did, the notice is all there is. The date choice stays usable either way, and shows the choice in the address (the one that failed). "Try again" sits under the text inside the notice, not beside it, because the notice's action does not wrap on a phone.
- **What is on the page.** Three groups of numbers (Listings, People, Leads and engagement), the chart of leads, enquiries and shortlists per day (Shortlists, Leads, Enquiries in their fixed colours) with its table view, "Leads by source" (project pages, property enquiries, other forms), "Enquiries by project" (up to six), and "Recent leads" with a link to all leads (`/admin/leads`). The page's title is "Overview".
- **Conversion** is leads divided by the visitors of project pages, as a percentage to one decimal, or a dash when nobody visited. It can be over 100%, because leads include property enquiries and forms with no project while visitors are of project pages only; its note stays "Definition to confirm", as in the approved screen. The database returns both numbers; the page divides.
- **How long ago** is worked out on the server, from the time the page was read, and sent as data, so the browser does not disagree with it: "just now", minutes, hours, "Yesterday" (by the day in India), days up to 30, then the date with its year.
- **Decisions the owner approved as the defaults:** the range is spelled out in the chart's line ("Per day, 1 Oct to 3 Oct"; "Per day, 11 Nov" for one day; with the year when the range crosses one), not as the separate "1 Oct to 30 Oct 2026" text beside the date choice (the shared Insights panel has no place for it, and changing it would change the Admin board's pictures); the note "Review listings" on "Awaiting approval" is plain text, because the stat tile cannot be a link; site visits and brochure requests get the copper avatar, as in the approved screen; a form sent with no name is shown as "Someone".
- **Not in this change:** a link on the "Awaiting approval" tile; the "AI search" slice of the sources (it comes with AI search); a saved choice of dates.

## Wording to confirm (owner)

The approved admin-overview screen gives the title, the introduction, the date choices, the tile names and notes, the chart titles and lines, the empty chart text, the error notice and "Try again", and the recent leads' kinds and times as examples ("12 min ago", "1 hr ago"). These are not in it:

- The empty text of the other cards: "No leads in this range" and "No enquiries in this range", each with "Try a longer date range." (the screen has only the line chart's "No activity in this range").
- The line "Updating the numbers…" (from ADR-120), and the notice's text when no numbers ever arrived: "Check your connection and try again." (the screen's second sentence, "The numbers below are from the last successful load.", is used only when there are old numbers).
- "Someone" for a form with no name; "Message" for a form with no project; "Kind · what" written as "Kadal Vista · Enquiry".
- "just now", "N days ago" and the date (the screen shows only minutes, hours and "Yesterday").
- "Top 1 project" for a single project (the screen says "Top 6 projects").
- The table view's first column, "Date" (from ADR-120).

## Consequences

- No migration, package, environment, CI, gate or protected-file change; no Design Lab or picture change (the page is made of parts already photographed). One server page, one island, the helpers for the address, the numbers and the query, the words in `en.json` (`admin.overview`), and the FR-ADM-01 traceability row.
- Tests: the date choice (India days, month ends, invalid and over-a-year ranges, the addresses), the numbers (the shape, the conversion, how long ago, nothing happened), the query (the call, a failed read, a wrong shape), the island (the numbers formatted the Indian way, every date choice, the charts and their table view, the empty states, the "Updating" line, a failed read with and without old numbers, "Try again"), that the browser file imports nothing from the server, and an integration test against a real database (the admin reads the numbers for a day, a quiet day, a range of more than a year refused, a builder and a visitor refused), which runs in CI.
- The page is read for every visit and never cached; the numbers are counts, so a read is cheap at this size (ADR-121).
- Rollback: put back the placeholder page and delete the feature folder and its words; the database function (ADR-121) can stay.
