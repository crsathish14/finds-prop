-- F10 search: let Postgres inline listing_label() (S4-SPK-01 finding).
-- Rules: BR-92 (the labels), ADR-012 (search architecture), plan 06 section 9.2 (p95 under 100 ms).
-- listing_label() was created with `set search_path = ''`. Postgres does not inline a function that
-- carries a SET clause, so the label filter in search_properties() called it once for every approved
-- listing (about 8,500 at the planned scale) and paid a setting switch on each call: the two label
-- searches took 38 to 51 ms at the median and up to 83 ms at p95 in the first CI runs, against 1 to 25 ms
-- for the others. Without the SET clause the planner inlines the CASE expression into the query.
-- The function only compares its own arguments with literals. It reads no table and calls no other
-- function, so there is nothing for a search_path to redirect (the operators it uses are found in
-- pg_catalog, which is always searched first), and it runs as the caller with no extra rights. The
-- rule that pins search_path (R-DB-05, DB-FN-search-path) is for SECURITY DEFINER functions.
-- The limits, the arguments, the result and the grants are unchanged (create or replace keeps the grants).
-- Rollback note: nothing here is destructive. Fix forward with a new migration.

create or replace function public.listing_label(listing_price bigint, listing_kind text, is_featured boolean)
returns text
language sql
immutable
as $$
  select case
    when is_featured then 'featured'
    when listing_price is null or listing_kind is null then null
    when listing_kind = 'sale' and listing_price >= 15000000 then 'prime'
    when listing_kind = 'rent' and listing_price >= 60000 then 'prime'
    when listing_kind = 'sale' and listing_price <= 6000000 then 'budget'
    when listing_kind = 'rent' and listing_price <= 20000 then 'budget'
    else null
  end
$$;
