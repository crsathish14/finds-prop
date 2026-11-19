-- ADR-143 phase 1b: the categories shared by the Blog, the FAQ and Careers.
-- Rules: ADR-143 section 3 (one table and one category manager serve all three modules), ADR-017 (the public columns
-- are named), plan 07 section 5 (anyone reads what is visible; only the super admin writes).
-- `module` says which list a category belongs to: `blog` (article categories), `faq` (question groups) or
-- `department` (the job departments on /careers). The same slug may exist in two modules.
-- A visitor reads only an active category, so a hidden category disappears from the filters and from the AI tools at
-- the same time; the super admin reads them all. Every change is recorded as `content.changed` (the id, the module and
-- the names of the changed columns, never the text), written by a trigger like the other audit entries.
-- Rollback note: nothing here is destructive. Fix forward with a new migration.

create table public.content_categories (
  id uuid primary key default gen_random_uuid(),
  module text not null check (module in ('blog', 'faq', 'department')),
  slug text not null
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 2 and 60),
  name text not null check (char_length(btrim(name)) between 2 and 60),
  sort_order integer not null default 0 check (sort_order between 0 and 10000),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint content_categories_module_slug_key unique (module, slug)
);

alter table public.content_categories enable row level security;

-- The category lists on the public pages and in the admin manager: one module, in the admin's order.
create index content_categories_by_module on public.content_categories (module, sort_order, name);

revoke all on table public.content_categories from anon, authenticated;
grant select on table public.content_categories to anon, authenticated;
grant insert, update, delete on table public.content_categories to authenticated;

create trigger content_categories_updated_at
  before update on public.content_categories
  for each row execute function public.touch_updated_at();

create policy content_categories_select on public.content_categories
  for select to anon, authenticated
  using (active or (select public.is_super_admin()));

create policy content_categories_insert_admin on public.content_categories
  for insert to authenticated
  with check ((select public.is_super_admin()));

create policy content_categories_update_admin on public.content_categories
  for update to authenticated
  using ((select public.is_super_admin()))
  with check ((select public.is_super_admin()));

create policy content_categories_delete_admin on public.content_categories
  for delete to authenticated
  using ((select public.is_super_admin()));

-- The audit entry: which category and what kind of change, never its name.
create function public.audit_content_categories()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform public.audit_write(
      'content.changed', 'content_category', new.id::text,
      jsonb_build_object('change', 'created', 'module', new.module)
    );
  elsif tg_op = 'UPDATE' then
    perform public.audit_write(
      'content.changed', 'content_category', new.id::text,
      jsonb_build_object(
        'change', 'updated', 'module', new.module,
        'columns', public.changed_columns(to_jsonb(old), to_jsonb(new))
      )
    );
  else
    perform public.audit_write(
      'content.changed', 'content_category', old.id::text,
      jsonb_build_object('change', 'deleted', 'module', old.module)
    );
  end if;
  return null;
end;
$$;

revoke execute on function public.audit_content_categories() from public, anon, authenticated;

create trigger content_categories_audit_insert
  after insert on public.content_categories
  for each row execute function public.audit_content_categories();

-- A save that changes nothing is not recorded (updated_at alone does not count).
create trigger content_categories_audit_update
  after update on public.content_categories
  for each row
  when ((old.module, old.slug, old.name, old.sort_order, old.active)
    is distinct from (new.module, new.slug, new.name, new.sort_order, new.active))
  execute function public.audit_content_categories();

create trigger content_categories_audit_delete
  after delete on public.content_categories
  for each row execute function public.audit_content_categories();
