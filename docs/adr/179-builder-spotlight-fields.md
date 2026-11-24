# ADR-179 · Builder spotlight fields: logo upload, tagline, year started, projects delivered

- Status: Accepted (owner decisions of 23 Nov 2026 on the sponsor ads redesign; the new words were approved by the owner on 24 Nov 2026 ("approved")).
- Date: 2026-11-25
- Related: ADR-016, ADR-045 and ADR-105 (sponsored banners), ADR-096 (the builder's Company profile), ADR-017 (public column grants)
- Class: C2. One migration (four columns, one bucket, one storage helper, the admin overview function recreated), no dependency, no environment change.

## Context

The owner chose four sponsor ad designs on 23 Nov 2026: the hero ad is a Showcase (A) or a Cinematic banner (B), chosen by the admin; a Featured project card (C) sits in the results; a Developer Spotlight (D) is a new home page section. For C and D the admin only picks builders or agents from a list, and everything shown comes from what they uploaded. D shows a builder's logo, a short line about them, how long they have been building and how many projects they have delivered. The `builders` record holds only a name, a logo web address (an https link the admin can type, mostly empty), a website and a description.

The owner asked that builders and agents enter the missing facts themselves, with the logo upload optional.

## Decision

- **Four new optional columns on `builders`:** `tagline` (one line, up to 100 characters, not blank), `established_year` (1900 to 2100 in the database; the form also refuses a year after this one), `projects_delivered` (0 to 100,000) and `logo_path` (an uploaded picture, below). All four are public like the name and the description (column grants to visitors), and a builder updates them on their own row through the existing update policy; the admin can update any row.
- **The logo is uploaded to a new public bucket `builder-logos`**, 1 MB, JPG, PNG or WEBP only (never SVG), at `<builder id>/logo-<unique>.<type>`. A new helper `storage_builder_logo_path_ok` lets only that builder (through `current_builder_id()`) or the super admin write in a folder, one level deep. The database refuses a `logo_path` outside the row's own folder or with another ending, and the save refuses it too before writing. The browser uploads the file when it is chosen; the save stores the path; the replaced logo, and a logo chosen and replaced before saving, are taken out of the bucket by the browser (a file left behind is harmless: nothing points to it).
- **The old `logo_url` stays**: the admin's drawer keeps its Logo link box, the builder's profile no longer shows it (it shows the upload instead) and sends the stored value back unchanged. Where a logo is drawn, the uploaded one comes first and the link is the fallback; with neither, the initials are shown.
- **Forms:** the shared `BuilderForm` gets a "Developer spotlight" group (tagline, year started, projects delivered) used by the builder's profile and the admin's invite and edit drawers, and a `showLogoUrl` switch. A new design-system part `BuilderLogoField` shows the logo or the initials with upload, replace and remove. `admin_builder_overview()` is recreated to return the four columns (its return type changes, so it is dropped first; the grants are the same).

## Words (English, new, approved by the owner on 24 Nov 2026; Tamil follows when the Tamil messages file lands)

`admin.builders.form`: "Developer spotlight", "Shown when findsprop features your company on the home page.", "Tagline", "One line about your company, up to 100 characters.", "Year started", "Projects delivered". `builderPortal.profile.logo`: "Logo", "A square JPG, PNG or WEBP picture, up to 1 MB. Without one, your initials are shown.", "Upload logo", "Replace logo", "Remove logo", "Uploading", "Your company logo", "Use a JPG, PNG or WEBP picture.", "This picture is too heavy. The limit is 1 MB.", "The logo could not be uploaded. Try again."

## Consequences

- Tests: a new database test file (limits, own-row writes, public reads, the bucket and its folder rule), the public column list and the function list updated, and unit tests for the rules, the save and the profile page's upload.
- Nothing is shown to visitors yet: the Developer Spotlight that uses these fields comes in a later change of the sponsor ads plan.
- Rollback: fix forward. Dropping the columns, the bucket's policies and the helper, and recreating `admin_builder_overview()` as it was, undoes it; uploaded logos would then be left in the bucket.
