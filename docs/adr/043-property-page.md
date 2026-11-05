# ADR-043 · The property page (S4-T03)

- Status: Accepted (data layer); the page is added by the next change
- Date: 2026-11-05
- Related: ADR-025 (SEO and URLs), ADR-012 and ADR-042 (search and results), ADR-017 (public projections), `docs/ux/final-ux/screens/property.html`, FR-PUB-07, BR-90, BR-92
- Plan approved by the owner on 5 Nov 2026 ("All recommended"): step A (this data layer), step B (the page), step C only if the signed-in form needs its own change. The traceability table names this task S4-T08; the owner calls it S4-T03.

## Decision for step A: the data layer (`src/features/property`)

- **The address** is `/properties/{slug}-{shortId}` (ADR-025). `parsePropertyAddress` reads the last eight characters as the public id (the 32-letter alphabet the database checks, no 0, 1, i, l or o) and the slug before them; capitals are read as lower case; anything else is "not found". `canonicalPropertyPath` gives the address a home should have when the one given differs (an old or edited slug, capitals): the page redirects with a 308 and a link with the right id never breaks.
- **One cached read of one home** (`getProperty`) as an anonymous visitor, so the database's own rules decide what exists (BR-90): only approved listings, only the granted columns. The owner, the address, the pincode and the exact location are never asked for, and a test fails if they are. The photos come from `listing_media` (the cover first, then the owner's order), and the label from the database's own `listing_label()` (BR-92), so there is one source for it.
- **"Missing" is not an error.** No approved home with the id is `missing`, which covers a home never listed, one waiting for review, and one sold or rented. Anything else that goes wrong throws and is never cached: a failed read must not look like a home that is gone, and a row that does not fit what the page expects is a failure, not "not found". Errors are logged by their code only.
- **Cache:** minutes, under the homes tag (`home-listings`), so an approval or an edit refreshes it.
- **Pure rules, no words** (`view.ts`): the facts for "At a glance" in the UX order and only when given (bedrooms are also left out for a plot, a commercial property and a count of 0), the price per square foot for a sale only and only with a known area, the description as paragraphs of plain text (a blank line starts one; never HTML), the amenities as the owner wrote them (trimmed, none empty, none twice), whether a detail the owner may leave out is missing (bathrooms, furnishing, amenities: "available from" is not drawn, so it does not count), the place line, and the page description (the first paragraph, cut at a word). The page turns these into text.

## Consequences

- The page (step B) adds no query of its own.
- Not tried against real homes: the hosted dev database needs secrets, so the read is tested with a stub client.
