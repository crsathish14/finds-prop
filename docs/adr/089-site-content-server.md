# ADR-089 · Site content: the server side (S7-T10, part A)

- Status: Accepted
- Date: 2026-11-09
- Related: ADR-081 (admin units server, the same pattern), ADR-045 (sponsors read), ADR-048 (cache tags), FR-ADM-10, FR-ADM-11, BR-80 to BR-82, DEC-13, DEC-14
- Plan approved by the owner on 9 Nov 2026 ("approved"): typed latitude and longitude for the localities because the place search (S4-T05) was left out; a limit of 8 localities on save; "Logo link", "Hero background image" and "Featured section title" left out; the hero headline is required; the header shows the links visitors see today when none are saved. The Site content work is split into the server side (here), Design Lab parts (two changes) and the connected pages (two changes).

## Decision

- **A new `site-content` feature, no migration.** `site_settings` already exists with its rules: anyone reads, only the super admin writes, and a trigger records `cms.changed` (which setting changed and who, never its content; a save that changes nothing is not recorded). The public side (`features/site`) is unchanged except that its index now also exports the defaults, the merge and the setting shapes, because other features may import a feature only through its index.
- **Four actions**, all for a super admin: `saveHeader`, `saveHero`, `saveHomepage` and `saveFooter`. Each saves its own row (`header`, `hero`, `homepage`, `footer`), so saving one never touches another, and never touches the `sponsors` row that S7-T11 will write or the `region` row, which has no editor in the approved design and stays as seeded. A save replaces the row whole: a cleared box is left out, so the default shows again (BR-81).
- **The user's own client, not the service role.** `contentStore` acts as the signed-in admin through their cookies and writes with an upsert on the key, so the policies decide what is allowed and the service-role allow-list is unchanged.
- **Limits and refresh.** Each save counts against the existing `admin_edit` scope (600 per admin per hour), so no new scope and no change to the protected security table. Each save refreshes the `site-settings` tag (`tagsAfterSiteSettingsChange`), so the header, hero, homepage and footer change on the public site straight away. There is no idempotency key (a save sets a value, so repeating it changes nothing more) and no audit call in the action (the database audits).
- **Checked twice.** The form's values are parsed with their own schemas (`validation.*` message keys), turned into the stored value, and parsed again with the shapes the public side reads. A value the public side would ignore is never stored, because the whole setting would then fall back to the defaults without a word.
- **Links** are a page on this site (one slash, then no spaces) or a full https address; `javascript:`, `data:`, `//host`, `/\host` and plain http are refused, because they end up in links on every page. At most 12 in the header and 20 in the footer, as the public side reads them.
- **Localities.** At most **8** on save (the approved design's limit; the public side still reads up to 30, so nothing already stored becomes unreadable). A label may not repeat (compared without regard to case), and the point must lie inside the launch area, which is the saved `region` bounds or, without them, the built-in box around Tamil Nadu. The refusal names the latitude box of each row outside. Coordinates are typed for now and are rounded to six decimals; the stored shape (label, lat, lng, radius) is the same one a place picker will fill when the place search is built.
- **The editor reads the database directly, never the cached read.** `getSiteContent` returns the settings over the defaults and which of the four have ever been saved, as the signed-in admin, uncached: the public read keeps its answer for minutes, and an editor must open on what was last saved.
- **Three new messages** under `validation.*`: `linkTarget`, `localityLabelTaken` and `outsideRegion`.
- **Not in this change:** any page or part (the next changes), sponsors (S7-T11), the place picker (S4-T05).

## Wording to confirm

- "Enter a page on this site, starting with /, or a full address starting with https://" (a link that is neither)
- "Another row already uses this name." (a repeated locality label, on the later row)
- "This place is outside the area the site covers. Check the latitude and longitude." (a locality outside the launch area, on its latitude box)

## Consequences

- No migration, package, gate or environment change, and no change to the protected security table.
- The integration test (`tests/integration/site-content.test.ts`) runs in CI against the real local database: saving and replacing each setting, the stored shape read the way a visitor reads it, the editor read, the launch-area check, a customer and a visitor refused, and the audit entry. It was not run on the developer's machine, because the owner asked that nothing be started locally.
- Rollback: delete the `site-content` feature, its tests, the three messages and the three exports added to `features/site/index.ts`. Settings already written stay as they are.
