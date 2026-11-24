# ADR-193 · The Developer spotlight on the home page

- Status: Accepted (owner decisions of 23 Nov 2026 on the sponsor ads redesign; the owner said "Start" on 24 Nov 2026; the new words await approval).
- Date: 2026-11-25
- Related: ADR-191 (who it draws from), ADR-179 (builder logos and spotlight fields), ADR-192 (the Featured project card), CR plan 5 (the home section order)
- Class: C2 (a new section of the home page, not in the approved UX). No migration, no dependency.

## Context

The owner decided that the Developer spotlight (concept D) is a new home page section, placed by the admin in the section order like the others; that it shows one of the builders or agents the admin picked on the Sponsored builders page (ADR-191), drawn only from what they uploaded: their logo (or initials), name, tagline (or the start of their description), the years since they started, the projects they delivered, how many they list and launch on findsprop, and up to three of their live projects; and that each visit shows a different one (with one picked, that one).

## Decision

- **The section key** `spotlight` joins the home section order after New launches. It has no switch: it shows when the admin picked someone and one of them has a live project in the visitor's city. A saved order from before gets it at the end (the order's usual rule), where the admin can move it.
- **The reader** (`getSpotlight` in `src/features/sponsored`): with no one picked it reads nothing. Otherwise, as an anonymous visitor (the home page is public), it reads the city's live projects through `home_developers()` and keeps the picked builders that have one (cached for minutes); picks one by chance for the visit (`connection()` first, so the chance is the visit's own); then reads that builder's public columns (`builders`: the anonymous visitor's columns of an active builder) and their projects through `public_project()` (the first 24, enough to count the launching ones; three are shown), cached for minutes per builder. Both caches carry the homepage developers' tag, which a project change and a builder change already refresh. Only approved, published projects of active builders can show. The logo is the uploaded one, else the logo link, else initials. The website is linked only when it is a web address. A failed read is logged by its code and shows nothing.
- **The part** (`DeveloperSpotlight`, domain): a dark rounded band in the page width with a soft teal glow; "Sponsored · Developer spotlight"; the logo or initials and the name as the section's heading; the tagline; the figures as a description list (each left out when not given or zero); "Visit website" (a new tab, marked sponsored); up to three project cards (cover, status, name, locality and BHK, price in the project cards' own words), each one link to the project page, side by side from 768 px and scrolling sideways on phones. The cards lift a little on hover, not with reduced motion.
- **The page**: the section is read behind its own Suspense boundary (the city is a cookie and the pick is per visit), so the rest of the home page stays in the static shell. It is placed only when someone is picked (the site settings say so without a request), and nothing holds its place while it is read, so a city with nothing to show leaves no gap.
- **The admin**: the section order on the Homepage page lists "Developer spotlight", with a line saying it shows when developers are picked on the Sponsored builders page.

## Words (new, awaiting the owner's approval)

`domain.developerSpotlight.*`: "Sponsored", "Developer spotlight", "Years", "Delivered", "Listed", "Launching", "Visit website". `admin.siteContent.homepage.order.spotlight.*`: "Developer spotlight", "Shown when you pick developers on the Sponsored builders page. Has no switch."

## Consequences

- Tests: the rules (who can show, the pick, the tagline or description, the years), the reader (nothing picked, the picked builder with details, logo and projects, the fallbacks, a project that cannot be read, nothing live, failures), the part, the home page with and without someone picked, the section order lists; Design Lab "Developer spotlight" on the Ads board.
- With no one picked on the Sponsored builders page, the home page is as before.
- Rollback: revert this change; a saved order holding `spotlight` loses it (an unknown key is dropped).
