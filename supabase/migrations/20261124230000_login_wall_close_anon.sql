-- Login wall, part C: close the doors visitors who are not signed in used to read lists through.
-- Why: the public pages now read one home, one project, the homepage sections and the sitemap through narrow functions
-- (part A), and the lists, the comparison and the assistant's list tools are for signed-in visitors (part B and the AI
-- tools change). So `anon`, the role of everybody who is not signed in and holds the public key in the browser, no longer
-- needs the five tables or `search_properties()`. Without this, anyone could still page through every home and project
-- with a plain request (`/rest/v1/properties`, `/rest/v1/rpc/search_properties`).
-- `authenticated` keeps its grants and policies (signed-in people: the wall is the sign-in), and the definer functions of
-- part A and B keep working for `anon` where they were granted to it: they run with the owner's rights.
-- Revoking a table privilege also revokes the column privileges on it (PostgreSQL), so the column grants of the
-- searches and the plot, villa and extra-field columns go with it.
-- Rollback note: nothing is lost. To go back, add a migration that grants select on these tables to anon again with the
-- column lists of the earlier migrations, and execute on search_properties to anon.

revoke select on table public.properties from anon;
revoke select on table public.listing_media from anon;
revoke select on table public.projects from anon;
revoke select on table public.project_units from anon;
revoke select on table public.project_price_trends from anon;

revoke execute on function public.search_properties(
  text, text, integer, bigint, bigint, text, double precision, double precision, double precision,
  double precision, double precision, double precision, double precision, text, text, text, integer, text
) from anon;
