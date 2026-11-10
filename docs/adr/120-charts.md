# ADR-120 · Charts without a library, and the chart parts (S7-SPK-01 outcome; S7-T06 part 1)

- Status: Accepted (the wording below waits for the owner's confirmation)
- Date: 2026-11-10
- Related: ADR-020 (Design Lab), ADR-078 and ADR-080 (the shared admin parts and the Insights panel, which left the charts for this task), ADR-097 (the builder's numbers), FR-ADM-01, `docs/engineering/design-system.md` section 7.2 ("Charts")
- Plan for S7-T06 approved by the owner on 10 Nov 2026 ("approved"): three changes (this one, the database function, the page). The spike is settled here.

## The spike (S7-SPK-01): can the Overview's charts be drawn by hand?

The approved admin-overview screen and the design system's chart rules ask for: 2 px lines, ringed end dots, a hairline grid, text in ink (never in a series colour), series colours pinned to the entity, a legend for two or more series, a crosshair with **one tooltip that lists every series**, keyboard use (the arrow keys move the crosshair), a table view for every chart, a part-to-whole drawn as one bar and not a pie, and single values per category as horizontal bars. The prototype draws all of it in about 100 lines of plain SVG.

What was tried: the three chart kinds were built as React and SVG parts and every rule above was written as a test or as a Design Lab state. What was weighed against it: a chart library (for example Recharts, or visx or D3 primitives), which would be dependency code shipped to every visit of the admin portal and would have to be overridden for the tooltip, the crosshair, the end labels, the 2 px gaps and the keyboard behaviour.

**Outcome: build them by hand, with no new dependency.** The parts are about 800 lines in all (the line chart is 300), the bars and the bar list need no script, and nothing in the spec needed anything a library gives (zoom, animation, many series, large data). Checked and passing: the colour palette (the four series colours, run through the colour validator for colour-blind separation: the worst adjacent pair is 8.6 on the protanopia model, 19.6 for normal sight, and every colour has at least 3:1 against white); every behaviour in the list above in unit tests; and the text staying 12 px at every width, because the chart is drawn at the width it is given. **Not checked here** (there is no local browser, by the owner's rule): how the pointer feels in a real browser, and the redraw while a window is resized; the CI pictures and the axe checks on the Design Lab board cover the look and the accessibility, and the page (part 3) is the first place the chart sees real numbers.

If a later chart needs more than this (many series, a zoom, thousands of points), that is the time to look at a library again; nothing here prevents it.

## Decision

- **Five parts in `patterns/`, one in `domain/`, one helper in `lib/`.** `LineChart` (the only one that is a client file with its own state: which point the crosshair is on, and the width it is drawn at), `ChartTable` (the table twin), `ChartCard` (the frame with the Chart / Table switch and the empty state), `ShareBar`, `BarList`, and `RecentLeads` (the newest few leads, in `domain/` because it knows what a lead line is). `lib/chart-scale.ts` holds the pure numbers (round tick marks, how many labels fit, the series colours, number and share formatting, moving end labels apart), so each is tested without a screen.
- **Colour follows the entity.** A series is given a slot (1 to 4) and keeps it: a chart that loses a series does not repaint the others. At most four series; a fifth part of a share bar and the ones after it are added together as "Other" in the colour kept for it.
- **Numbers are written the Indian way** for English (1,28,400), as the rest of the admin is, through one helper.
- **A chart is never the only way to read its numbers.** A line chart has a table twin; a share bar is drawn above a table that says the same in words (the bar itself is hidden from a screen reader); a bar list is a list whose rows say their numbers in text. The line chart has one focusable picture with a name; the left and right arrow keys, Home and End move the crosshair, Escape hides it, and a polite line says the day and every series' number.
- **Two end names that finish at the same height are moved apart** (16 px), and on a phone (under 480 px) the end names go and fewer day labels are drawn; the legend still names every series.
- **Two props for the Design Lab only,** `defaultPoint` on the line chart and `defaultView` on the card, so a picture can show the crosshair and the table view. They are documented in the parts' headers; nothing else uses them.
- **The Lab gets a board of its own, "Charts"** (`/design-system/charts`, mirroring the admin Overview screen), because the Admin board is already too tall to photograph in time at 820 and 1440 px. Five entries: the line chart, the card and the table view, the share bar and the bar list, the recent leads, and the whole Overview page put together from these parts and the Insights panel, with its error notice and its Updating line while it reloads.
- **Not in this change:** the data, the database function, the page and its date handling (parts 2 and 3). The numbers on the Lab board are a repeatable wave, not real data.

## Wording to confirm (owner)

The approved admin-overview screen gives the page's headings, the date choices, the tile names, the chart titles and lines ("Leads, enquiries and shortlists", "Per day, 1 to 30 Oct", "Leads by source", "Share of 862 leads", "Enquiries by project", "Top 6 projects", "Recent leads", "All leads"), "Chart" and "Table", "No activity in this range" with "Try a longer date range.", and the error "We couldn't load the overview" with "Try again". These are not in it:

- The name of the Chart / Table switch for a screen reader: "Chart view".
- The "Recent leads" box with nothing in it: "No leads yet" with "New leads will show here."
- The table view's first column heading, "Date" (the screen's prototype has it; the screen's text does not show it).
- In the share bar, the name "Other" for the parts added together (the screen says only "≤ 4, then Other"), and the demo's "Other forms" for leads that did not come through a project page (the page's own names come with part 3).

## Reloading is shown with a line, not by dimming (to confirm)

The approved screen dims the page while the numbers reload. Dimming text fails the contrast rule that the Design Lab checks in CI (at 60% the muted text is 2.65:1, the ink 4.11:1, and the white-on-green switch 3.34:1; 4.5:1 is needed), and it did fail on the first CI run. So the numbers stay at full contrast, are not clickable while loading, and an "Updating the numbers…" line with a spinner (read aloud as a status) shows above them. The owner can ask for a lighter dim (90% passes, but is hardly visible) instead.

## Consequences

- No migration, package, environment, CI, gate or protected-file change. Parts and tests: 24 for the line chart, table and card, 12 for the share bar and bar list, 5 for the recent leads, and 10 for the helper; one Design Lab board with its pictures at 390, 820 and 1440 px, which come from CI and are added after the owner approves them.
- The board list at the top of every Lab page gets a fourteenth link. Last time a link made it wrap onto one more line at 390 px (and every picture 29 px taller); if it does here, the same fix applies.
- Rollback: delete the parts, the helper, the board and its tests; nothing else uses them yet.
