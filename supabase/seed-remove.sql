-- Takes the fictional seed (supabase/seed.sql) out of a database again, so it can be loaded again after a
-- change. Paste it into the dashboard's SQL editor of the DEV project (docs/runbooks/dev-seed.md). Never run
-- it anywhere that holds real data: it deletes by the seed's own id prefix (5eed0000-...), and the two site
-- settings keys 'homepage' and 'region'.
-- What goes: the seed's customers (with their profiles, roles, listings, and anything others did to those
-- listings: enquiries, saved homes), builders, projects (with units, price trends and events), the project
-- form, and the leads and form submissions that were sent to the seeded projects or forms. What stays:
-- accounts made by signing in (yours or the test users of scripts/seed-dev.mjs), the default contact form
-- and its submissions. Photos are files in Storage and stay until deleted in the dashboard (the
-- listing-photos bucket, folders starting 5eed0000-); their database rows go with the listings.
-- supabase/seed-tests/seed.test.sql runs these same statements against the seed and what a tester leaves
-- behind, and a unit test keeps this file and that one identical.

begin;

delete from public.project_leads where project_id::text like '5eed0000-0000-4000-8002-%';
delete from public.form_submissions
  where form_id::text like '5eed0000-0000-4000-8003-%' or project_id::text like '5eed0000-0000-4000-8002-%';
delete from public.forms where id::text like '5eed0000-0000-4000-8003-%';
delete from public.projects where id::text like '5eed0000-0000-4000-8002-%';
delete from public.builders where id::text like '5eed0000-0000-4000-8001-%';
delete from public.properties where owner_id::text like '5eed0000-0000-4000-8000-%';
delete from auth.users where id::text like '5eed0000-0000-4000-8000-%';
delete from public.site_settings where key in ('homepage', 'region');

commit;
