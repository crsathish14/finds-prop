-- Plan 8 (ADR-168), part 2: the answers to the extra project form boxes the super admin defines.
-- One jsonb object on the project: { "<box id>": "text" }. The boxes themselves (label, help, required, property
-- types, on/off) live in site_settings under 'project_fields', so a new box needs no migration. The answers are public
-- like the other facts of the project page, written by the builder and the admin through the existing project grants.
-- Required boxes are enforced by the save (the list of boxes changes after projects exist), not here; this only keeps
-- the value a small object of short texts.
--
-- Rollback note: fix forward. Dropping the column loses only these answers.

alter table public.projects
  add column extra_fields jsonb not null default '{}'::jsonb,
  add constraint projects_extra_fields_shape check (
    jsonb_typeof(extra_fields) = 'object' and octet_length(extra_fields::text) <= 8000
  );

grant select (extra_fields) on table public.projects to anon, authenticated;
grant insert (extra_fields) on table public.projects to authenticated;
grant update (extra_fields) on table public.projects to authenticated;
