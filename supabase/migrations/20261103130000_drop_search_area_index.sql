-- F10 search: drop the unused properties_search_area index (S4-SPK-01 finding).
-- Rules: R-DB-09 (every index is justified by a named query), ADR-012 (search architecture).
-- The index was made for the "Largest" sort (area_sqft desc). The performance spike asked whether it can
-- serve that sort twice: with no filter, and with one (buy, apartment, largest, 24). In CI run 122 it
-- could not serve either: it was in no plan, as a visitor or as the superuser, even with full scans and
-- bitmap scans turned off. search_properties() returns total_count with count(*) over (), so it reads and
-- sorts every match before it returns the first page, and an index that only supplies the order cannot help.
-- Nothing changes for callers: the function, its arguments, its rows and their order, and the grants are
-- the same, and the other five indexes stay. The "Largest" sort already ran without this index; dropping
-- it only saves its upkeep on every write to an approved listing.
-- If total_count is ever capped or counted apart from the page (ADR-012), recreate the index in a new
-- migration:
--   create index properties_search_area on public.properties (area_sqft desc nulls last, id)
--     where status = 'approved';
-- Rollback note: not destructive (no data is lost, and the index can be rebuilt from the table at any
-- time). Fix forward with a new migration that recreates it, as above.

drop index if exists public.properties_search_area;
