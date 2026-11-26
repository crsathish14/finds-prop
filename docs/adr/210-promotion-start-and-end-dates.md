# ADR-210 · Promotions get an optional start and end date

- Status: Accepted (Phase 1c of "AI property search: from chatbot to discovery engine", plan section K.8; the owner answered Q-E, approved the approach and the words on 26 Nov 2026)
- Date: 2026-11-26
- Related: ADR-191 (Sponsored builders), ADR-182 and ADR-045 (sponsor ads), ADR-205 (AI ranking reads the promotions), BR-81
- Class: C2. This first part changes the shapes of four existing `site_settings` keys (no migration), four admin screens and adds words. The home and project Featured dates follow in two more pull requests (a migration, then the moderation screens).

## Context

Every promotion the super admin sets ran until someone removed it by hand: a paid month had to be remembered and switched off on the right day. The owner asked for an optional first and last day on all six promotions: hero sponsor ads, Sponsored builders (the Featured project card), Spotlight builders, Top developers, and the Featured switch of a project and of a home.

## Decision

- **The rule** (`src/lib/promotion-dates.ts`): days are India dates (`YYYY-MM-DD`). A promotion runs from the beginning of its start date to the end of its end date; no start date means from now, no end date means until it is removed. Today it is _Scheduled_ (start ahead), _Running_ or _Ended_ (end passed). One pure function decides it for the site, the AI and the admin pages.
- **Where the dates live, for the four settings promotions:** beside the lists they belong to, by id, so a list saved before the dates is read as it was. `sponsored_builders` gains `featuredDates` and `spotlightDates`, `top_developers` gains `dates` (each `{ <id>: { startsOn?, endsOn? } }`), and each stored sponsor ad gains `startsOn` and `endsOn`. A save keeps dates only for ids still in the list, and only the days given.
- **Honoured when read:** the public settings read (`getSiteSettings`) keeps only what runs today (`running-promotions.ts`), so the home page, the results, the Featured card, the Spotlight, the hero and the AI ranking all follow the dates with no other change. That read is cached for minutes, so a date takes effect within minutes of midnight India time. The admin pages read the whole lists with their dates.
- **Admin screens:** each pick on Sponsored builders and Top developers, and each sponsor in the Hero page's drawer, gets the "Starts on" and "Ends on" boxes and its tag; the sponsors table shows Scheduled or Ended for an active sponsor whose dates are not today. An ended item stays in its list, tagged Ended, until the admin removes it. An end date before the start date is refused on the end date's box.
- **Home and project Featured (next pull requests):** `featured_from` and `featured_until` columns, set from the moderation screens, and a database job every 15 minutes that turns `featured` on when the start date arrives and off when the end date passes, so the eight database reads that use `featured` stay as they are (owner's choice of approach A).
- **Moderation screens** (`/admin/listings`, `/admin/projects`; third pull request): Feature on an approved home or project opens a small dialog with the two boxes and the India-time note; with both empty it works as before. A home or project whose Featured has dates shows its tag, and offers both Feature (to change the dates, filled in) and Remove from featured (which clears them); an ended one stays listed, tagged Ended, until removed. The boxes and the tag live in their own feature, `src/features/promotion-dates`, which holds nothing server-only, so both screens can use them in the browser; the date input rule for both actions is `src/lib/featured-dates-input.ts`. `ConfirmDialog` gained an optional slot for a few fields under its description.

## Consequences

- The dates sit in the public `site_settings` table like the rest of the settings: they are not private.
- A promotion can start or end a few minutes after midnight, never early.
- Words approved by the owner on 26 Nov 2026 (`admin.promotionDates.*`, `validation.promotionDatesOrder`).
