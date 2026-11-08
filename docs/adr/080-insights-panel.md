# ADR-080 · The Insights panel (S7-T01, part 3)

- Status: Accepted
- Date: 2026-11-08
- Related: ADR-078, ADR-079 (the other shared parts), ADR-020 (Design Lab), FR-BLD-05, FR-BLD-06, S7-SPK-01 (the chart spike)
- Plan approved by the owner on 8 Nov 2026 ("as recommended"): tiles and filters now; the charts wait for the chart spike with S7-T06.

## Decision

- **One new domain part, one Admin board entry.** `InsightsPanel` is the top of the builder's Dashboard and Insights pages and of the admin's overview: the heading and its line, a notice slot, a choice of dates, an optional choice of project and the numbers in groups. It holds no state; the page passes the groups of tiles (already translated and formatted) and what is chosen.
- **The numbers are `StatTile`s.** The groups and the tiles in them are data (`id`, `label`, `value`, `icon`, `iconTone`, `note`), so the dashboard (Portfolio, Activity this month, Actions) and the Insights page (Activity, Actions) are the same part with different groups. A group of five tiles has five columns from 1024 px of room and a group of four has four; the part asks its own width, as the lists do.
- **Charts are not part of it.** There is no chart code yet; the roadmap puts the chart spike (S7-SPK-01) with S7-T06. The charts go in `children`, under the numbers, when they exist.
- **The date choice is a `SegmentedControl`** (7 days, 30 days, This month, Custom). When Custom is chosen the part shows two date boxes (From and To) from the page's props. The approved screen draws the Custom button but not what follows it; the two date boxes are new and are listed below.
- **The group headings sit one level under the title** (a level 2 under a level 1 page title, a level 3 under a level 2 title in the Design Lab), so the page's outline stays in order.
- **Not in this change:** the data (counts of views, visitors, leads and so on), the date arithmetic, any query or page. The pages that use it are S7-T03 (builder), S7-T06 (admin overview) and the builder's Insights page.

## Wording to confirm

Plain English in the Design Lab; the connected pages put the same words in `en.json`. From the approved builder-dashboard and builder-insights screens: "Dashboard" with "A quick look at how your projects are doing.", "Insights" with "How visitors find and respond to your projects.", "7 days", "30 days", "This month", "Custom", "All projects", the group names "Portfolio", "Activity this month", "Activity" and "Actions", every tile name ("Projects", "Active projects" with "Approved and published", "Total units", "Available units" with "164 sold", "Project views", "Unique visitors", "Enquiries", "Leads", "Shortlists", "Comparisons", "Brochure downloads", "Calls", "WhatsApp clicks", "Site visit requests") and the notice "1 project is waiting for approval" with its line. New, for your confirmation:

- The two date boxes' labels "From" and "To", shown when Custom is chosen.
- The accessible name of the date choice, "Date range", and of the project box, "Project".

## Consequences

- No migration, package, gate, environment, message or protected-document change. One part and one Design Lab entry on the Admin board; its three pictures change again and are added from CI after the owner approves them.
- Rollback: delete the part, its entry and its test. Nothing is destroyed.
