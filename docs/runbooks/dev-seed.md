# Fictional seed on the dev database

The hosted `findsprop-dev` project has no homes, projects or forms of its own (ADR-034: the deploy workflow applies migrations only). To try the site with data, the owner loads the **fictional seed**: made-up customers, builders, 60 listings, 12 projects and a site-visit form, none of it real. This page says how, and how to take it out again. Agents never touch the hosted project; every step below is yours.

## What you get

- 8 customers with fake phones (`+91 9000 1000 01` to `08`), 6 builders (one inactive, one an agent), 60 listings across ten cities (42 approved, the rest sold, rented, rejected or draft), and 12 projects (9 live) with units and price trends.
- One form made for one project: **Kadal Heights** (`/projects/kadal-heights-adyar`) shows "Book a visit" in its enquiry card for a signed-in visitor with a verified phone. The other projects show the built-in Enquire / Site visit card.
- The default contact form is not part of the seed: the migration stores it, so `/contact` works on any database.
- Two site settings (the homepage's localities and the region).
- No photos until step 3. Listing pages show empty picture frames without them.

## Load it (once)

1. Open the dev project in the Supabase dashboard, **SQL Editor**, a new query.
2. Open `supabase/seed.sql` in the repository, copy the whole file, paste it, and **Run**. It takes a few seconds and prints no rows.
   - If it says "The fictional seed is already loaded", it is. To load it again, remove it first (below).
3. Photos (optional, from your own terminal; the key never goes in a chat or a file): set `SEED_SUPABASE_URL` to the dev project's address, `SEED_SERVICE_ROLE_KEY` to its service key, and `SEED_ALLOW_URL` to the same address, then run `node scripts/seed-dev.mjs --hosted`. It adds the photo files, their database rows and test accounts. It refuses to run unless the address is named twice.

Check: `/properties` lists homes, `/projects` lists projects, `/contact` shows the form.

## Signing in as a seeded customer, without an SMS

The seeded customers have phone numbers but no way to receive a code. In the dashboard, **Authentication, Providers, Phone**, add **test phone numbers** with fixed codes (for example `919000100001=123456`). Signing in with that number and code then works without MSG91, so the live checks (enquiry, saved homes, the project form, an ended session) can be tried before DLT approval. Use your own phone the usual way once MSG91 is approved.

## Take it out, or reload it

Paste `supabase/seed-remove.sql` into the SQL Editor and Run. It deletes by the seed's own id prefix (`5eed0000-`) and the two seeded site settings, in one transaction. It also removes what other accounts did to seeded rows (enquiries, saved homes, project leads, form submissions to seeded projects or forms), and keeps accounts made by signing in, the default contact form and its submissions. Photo **files** stay in Storage until you delete them in the dashboard (bucket `listing-photos`, folders starting `5eed0000-`).

Then paste `seed.sql` again to reload. After a change to `seed.sql`, remove and reload; a change never edits what is loaded.

## Rules

- Dev only. The remove script deletes data; never run either file where real data lives.
- The seed is fictional: no real names, numbers, addresses or prices (`supabase/seed.sql` header).
- CI loads the seed on a local database and runs `supabase/seed-tests` against it, including the removal, so both files are checked on every pull request.
