# ADR-104 · Sponsor management: the server side (S7-T11, part A)

- Status: Accepted
- Date: 2026-11-09
- Related: ADR-045 (the banners on the pages and the stored shape), ADR-038 (the rotating carousel), ADR-089 (the site content server side, whose action pattern this follows), FR-ADM-11, FR-PUB-03, FR-PUB-04, DEC-15
- Plan approved by the owner on 9 Nov 2026 ("approved", all seven recommended answers). S7-T11 is built in four changes: this server side; Design Lab parts (two); the sponsor manager on the Hero page.

## Context

The public side reads banners from the `sponsors` setting and shows them (ADR-045), and the `site-assets` bucket exists with its admin-only write policy, a 500 KB cap and no SVG. What is missing is everything the admin needs to put banners there: a save, and the checks that make a stored banner safe and usable.

## Decision

- **One action, `saveSponsors`, replaces the whole list** (the same rule as the other site content saves: last write wins). It is built with `defineAction`: super admin only, the existing `admin_edit` limit (600 an hour), the `site-settings` cache tag refreshed so the change is live at once. The database already audits `site_settings` (`cms.changed`: who and which setting, never the content). No migration, no new rate scope, no `security.md` change, no environment change.
- **The browser puts the pictures in the bucket first and sends their paths**, under `sponsors/<the sponsor's id>/`. The setting stores the path, the pixel size and the weight of each picture, never a web address (ADR-045). The save is refused for a path outside the sponsor's own folder, with `..`, or not ending in `.webp`, `.jpg`, `.jpeg` or `.png`.
- **Nothing the browser says about a file is believed.** On a save, each picture the stored list does not already hold is read back from the bucket (as the admin), and its type, weight and size are worked out from its own first bytes (PNG, JPEG and WebP are recognised by their signatures; an SVG, a script renamed `.png`, an empty or cut-off file has none). The result is what is stored. No new package: the reader is about a hundred lines and is covered by tests for all three types.
- **The slot rules (DEC-15, the approved screen)**, the same on the server and, in the next changes, in the browser: JPG, PNG or WEBP only; **at most 150 KB** (the screen's figure; the bucket's 500 KB cap stays as the safety net); at least **twice the slot's size** (strip 1940 × 180 desktop and 640 × 200 phone; panel 1048 × 988 desktop and 1280 × 640 phone) and at most 6000 on a side; and a shape the public side can fit: within 8% of the slot it fills it, within 30% it is shown whole on a plain background (accepted, with a notice on the screen), further off it is refused. A format (strip, panel) is **both of its pictures or neither**, because a campaign needs the pair.
- **A refusal names the picture** (`sponsors.0.strip.desktop`) with one of five messages: not found, wrong type, too heavy (with the limit), too small (with the smallest size), wrong shape. Nothing is written and no file is removed when any picture is refused.
- **The rest of a sponsor:** an id (made by the browser), an advertiser name (staff only, new), alt text (needed; it is also the link's name), an `https` destination with no user name or password, and active. **Placements are not a choice on the screen**, so every sponsor is eligible for the hero and for results; each slot keeps its own rule (results use the strip, the hero follows the layout). **At most 10 sponsors** can be saved (the public side still reads 30).
- **Before writing, the whole list is checked once more against what the public side reads** (its own shape and its own banner reader), so a value it would ignore, which would silently show no banner, is never stored.
- **Files that no sponsor uses any more are taken out of the bucket after the list is saved**: a deleted sponsor's pictures and a replaced picture. A failure there is logged and never raised (the list is already right and nothing points to the file). A picture the stored list already holds is not read again.
- **The editor's read side:** `getSponsorsPage` gives the stored sponsors in their order with the address of each picture (built from our own storage) for the preview. An entry it cannot read is left out and counted, never thrown on, so one bad entry cannot lock the admin out; a sponsor stored before the editor opens with an empty name and no weight on its pictures.

## Words (new keys in `en.json`, `validation.*`, for the owner's approval with the screen's wording in the next changes)

"We could not find this picture. Choose it again.", "Use a JPG, PNG or WEBP picture.", "This picture is too heavy. The limit is 150 KB.", "This picture is too small. Supply at least 1940 × 180 pixels." (the size of the slot) and "This picture is the wrong shape for its slot. Supply one that is close to the slot's shape." These are the server's last-word messages; the screen shows the approved, more specific sentences ("Rejected: wrong shape" and the rest) as the pictures are chosen.

## Consequences

- No migration, package, gate or environment change. New in `src/features/site-content`: the slot and picture rules, the input shape, the save rules and their store, the editor's read side, the action and its configuration, and tests (the reader on all three formats, the slot rules at each edge, the input shape, the save with a stand-in store covering every refusal and the cleanup, the editor's view, the action's role, limit and cache refresh). One integration test against the real database and bucket runs in CI only: the bucket refuses a customer and a visitor, a saved sponsor is accepted by the public side's reader, a picture never uploaded and a file that is not a picture are refused, a deleted sponsor's files leave the bucket, and the audit records who and not what.
- No screen yet: the Lab parts and the sponsor manager follow. Nothing changes for visitors.
- Rollback: delete the files above, the five messages and this ADR. The `sponsors` setting is untouched.
