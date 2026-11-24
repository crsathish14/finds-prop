# ADR-191 · Sponsored builders: who the Featured card and the Developer Spotlight draw from

- Status: Accepted (owner decisions of 23 Nov 2026 on the sponsor ads redesign; the new words await the owner's approval).
- Date: 2026-11-25
- Related: ADR-179 (builder spotlight fields), the Top developers page (the same pattern), ADR-182 to ADR-190 (the hero ad)
- Class: C2 (a new admin page outside the approved UX). No migration, no dependency.

## Context

The owner decided that the Featured project card in the results (concept C) and the Developer Spotlight on the home page (concept D) show builders and agents the admin picks from a list, with everything shown coming from what each builder or agent uploaded (the admin adds no pictures or links); that each visit shows a different one of those picked; and that with only one picked, that one shows.

## Decision

- **A new site setting `sponsored_builders`**: `{ featured: [ids], spotlight: [ids] }`, at most 10 each (`SPONSORED_BUILDERS_MAX`), each a builder id, each once. It is stored like the other site settings (no database change: `site_settings` takes any key the super admin writes), read through the same cached site content, and empty by default, which means the slot shows nothing.
- **A new admin page, Sponsored builders** (`/admin/sponsored-builders`, in the menu beside Top developers): two lists, the Featured project card and the Developer spotlight, each with the picked builders and agents (their type beside the name) and the active ones to add, a limit of 10, and the page's Save bar (Discard puts both back). Only active builders and agents can be picked; one picked earlier who is no longer active is named as such and can be removed. The action `saveSponsoredBuilders` follows the other settings: super admin only, the `admin_edit` limit, the site settings cache tag.
- The public readers that turn the picks into a card and a band, with only live projects, come with those parts (the next changes of the sponsor ads plan).

## Words (new, awaiting the owner's approval)

`admin.nav.sponsoredBuilders` and `admin.sponsoredBuilders.*`: the page's title and description, the two places' titles and lines, the counts, the empty and full messages, Builder and Agent, Add and Remove, and the saved message.

## Consequences

- Tests: the input rule and the save (`content-service.test.ts`), the page's form (`sponsored-builders-form.test.tsx`), the admin menu.
- Nothing changes for visitors until the Featured card and the Spotlight are built.
- Rollback: remove the page, the action and the setting's schema; a stored value is then ignored.
