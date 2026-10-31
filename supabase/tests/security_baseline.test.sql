-- Cross-cutting database rules that must hold for every table and function, now and later.
-- Tests: DB-RLS-all-tables-enabled, DB-RLS-no-anon-writes, DB-FN-search-path.
begin;
select plan(3);

select is_empty(
  $$
    select tablename from pg_tables
    where schemaname = 'public' and not rowsecurity
  $$,
  'DB-RLS-all-tables-enabled: every public table has row level security on'
);

select is_empty(
  $$
    select class.relname
    from pg_class as class
    join pg_namespace as space on space.oid = class.relnamespace
    where space.nspname = 'public'
      and class.relkind in ('r', 'p', 'v', 'm')
      and (
        has_any_column_privilege('anon', class.oid, 'INSERT')
        or has_any_column_privilege('anon', class.oid, 'UPDATE')
        or has_table_privilege('anon', class.oid, 'DELETE')
        or has_table_privilege('anon', class.oid, 'TRUNCATE')
      )
  $$,
  'DB-RLS-no-anon-writes: anon has no write privilege on any public relation'
);

select is_empty(
  $$
    select proc.proname
    from pg_proc as proc
    join pg_namespace as space on space.oid = proc.pronamespace
    where space.nspname = 'public'
      and proc.prosecdef
      and not coalesce(proc.proconfig::text like '%search_path=%', false)
  $$,
  'DB-FN-search-path: every SECURITY DEFINER function pins its search_path'
);

select * from finish();
rollback;
